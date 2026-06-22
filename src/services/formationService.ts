import type { Position } from '../types/player'
import type { Player, Stats } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import type { Team, Formation, LineupSlot, TeamSnapshot, SnapshotPlayer } from '../types/team'
import { staminaPerformanceMultiplier } from './energyService'
import { getEffectiveStats } from './equipmentService'
import { getFormationSlots } from '../data/formations'

const MATCH_STAT_CAP = 99
const LEGACY_STAT_MAX = 234
export const INJURED_PERFORMANCE_MULTIPLIER = 0.25

export function initFormationSlotAssignment(formation: Formation, lineup: LineupSlot[]): (number | null)[] {
  const formationSlots = getFormationSlots(formation)
  const result = new Array<number | null>(formationSlots.length).fill(null)
  const positionedPlayerIds = new Set<number>()

  // New saves preserve the exact visual slot selected by the user.
  for (const lineupSlot of lineup) {
    if (!lineupSlot.isStarter || lineupSlot.formationSlotIndex === undefined) continue
    const index = lineupSlot.formationSlotIndex
    if (index < 0 || index >= formationSlots.length || result[index] !== null) continue
    if (formationSlots[index].position !== lineupSlot.assignedPosition) continue
    result[index] = lineupSlot.playerId
    positionedPlayerIds.add(lineupSlot.playerId)
  }

  // Legacy saves have no index; place only those remaining players left-to-right.
  const byPosition: Record<Position, number[]> = { GK: [], DF: [], MD: [], FW: [] }
  for (const lineupSlot of lineup) {
    if (!lineupSlot.isStarter || positionedPlayerIds.has(lineupSlot.playerId)) continue
    byPosition[lineupSlot.assignedPosition]?.push(lineupSlot.playerId)
  }
  for (let index = 0; index < formationSlots.length; index++) {
    if (result[index] !== null) continue
    const playerId = byPosition[formationSlots[index].position].shift()
    if (playerId !== undefined) result[index] = playerId
  }

  return result
}

/** FIFA-style ratings use 99 as the effective match ceiling. */
export function normalizeMatchStats(stats: Stats): Stats {
  const cap = (value: number) => {
    if (value <= MATCH_STAT_CAP) return Math.max(1, value)
    // The imported Godot database used a different 100–234 scale. Convert it
    // below the FIFA-style ceiling instead of clipping every value to 99.
    const normalizedLegacy = 50 + ((value - 100) / (LEGACY_STAT_MAX - 100)) * 48
    return Math.max(50, Math.min(MATCH_STAT_CAP - 1, Math.round(normalizedLegacy)))
  }
  const normalized = {
    POT: cap(stats.POT),
    CON: cap(stats.CON),
    TEC: cap(stats.TEC),
    PRE: cap(stats.PRE),
    FIS: cap(stats.FIS),
    AGI: cap(stats.AGI),
    INT: cap(stats.INT),
    TOT: 0,
  }
  normalized.TOT = Math.round((normalized.POT + normalized.CON + normalized.TEC + normalized.PRE + normalized.FIS + normalized.AGI + normalized.INT) / 7)
  return normalized
}

function getPlayerMatchStats(player: Player): Stats {
  const normalizedBase = normalizeMatchStats(player.stats)
  const withEquipment = getEffectiveStats({ ...player, stats: normalizedBase })
  const cap = (value: number) => Math.max(1, Math.min(MATCH_STAT_CAP, value))
  const result = {
    POT: cap(withEquipment.POT), CON: cap(withEquipment.CON), TEC: cap(withEquipment.TEC),
    PRE: cap(withEquipment.PRE), FIS: cap(withEquipment.FIS), AGI: cap(withEquipment.AGI),
    INT: cap(withEquipment.INT), TOT: 0,
  }
  result.TOT = Math.round((result.POT + result.CON + result.TEC + result.PRE + result.FIS + result.AGI + result.INT) / 7)
  return result
}

// Position modifier: how well a player performs out of their natural position
export function positionModifier(slotPosition: Position, playerPosition: Position, alternatePosition: Position | null = null): number {
  if (slotPosition === playerPosition || slotPosition === alternatePosition) return 1.0
  if (slotPosition === 'GK' || playerPosition === 'GK') return 0.30
  const adjacent: Record<Position, Position[]> = {
    GK: [],
    DF: ['MD'],
    MD: ['DF', 'FW'],
    FW: ['MD'],
  }
  if (adjacent[slotPosition].includes(playerPosition)) return 0.82
  return 0.65
}

function applyPerformanceMultiplier(stats: Stats, multiplier: number): Stats {
  const scale = (value: number) => Math.max(1, Math.round(value * multiplier))
  const adjusted = {
    POT: scale(stats.POT), CON: scale(stats.CON), TEC: scale(stats.TEC), PRE: scale(stats.PRE),
    FIS: scale(stats.FIS), AGI: scale(stats.AGI), INT: scale(stats.INT), TOT: 0,
  }
  adjusted.TOT = Math.round((adjusted.POT + adjusted.CON + adjusted.TEC + adjusted.PRE + adjusted.FIS + adjusted.AGI + adjusted.INT) / 7)
  return adjusted
}

export function calcForwardScore(player: Player, modifier: number): number {
  const s: Stats = normalizeMatchStats(player.stats)
  return (s.POT * 0.40 + s.TEC * 0.25 + s.CON * 0.15 + s.AGI * 0.10 + s.INT * 0.10) * modifier
}

export function calcMidfieldScore(player: Player, modifier: number): number {
  const s: Stats = normalizeMatchStats(player.stats)
  return (s.CON * 0.30 + s.TEC * 0.25 + s.INT * 0.25 + s.PRE * 0.10 + s.AGI * 0.10) * modifier
}

export function calcDefenseScore(player: Player, modifier: number): number {
  const s: Stats = normalizeMatchStats(player.stats)
  return (s.PRE * 0.35 + s.FIS * 0.25 + s.INT * 0.20 + s.AGI * 0.10 + s.CON * 0.10) * modifier
}

export function calcGoalkeeperScore(player: Player, modifier: number): number {
  const s: Stats = normalizeMatchStats(player.stats)
  return (s.PRE * 0.30 + s.AGI * 0.25 + s.FIS * 0.20 + s.INT * 0.15 + s.TEC * 0.10) * modifier
}

export function buildTeamSnapshot(team: Team, players: Player[]): TeamSnapshot {
  const playerMap = new Map(players.map((p) => [p.id, p]))

  const starters = team.lineup.filter((slot) => slot.isStarter)

  let forwardTotal = 0
  let midfieldTotal = 0
  let defenseTotal = 0
  let goalkeeperTotal = 0
  let forwardCount = 0
  let midfieldCount = 0
  let defenseCount = 0
  let goalkeeperCount = 0

  for (const slot of starters) {
    const player = playerMap.get(slot.playerId)
    if (!player) continue
    const effectivePlayer = { ...player, stats: getPlayerMatchStats(player) }
    const positionMod = positionModifier(slot.assignedPosition, player.position, player.positionAlt)
    const injuryMod = player.isInjured ? INJURED_PERFORMANCE_MULTIPLIER : 1
    const mod = positionMod * injuryMod
    const stamMod = staminaPerformanceMultiplier(player.stamina)
    switch (slot.assignedPosition) {
      case 'FW':
        forwardTotal += calcForwardScore(effectivePlayer, mod) * stamMod
        forwardCount++
        break
      case 'MD':
        midfieldTotal += calcMidfieldScore(effectivePlayer, mod) * stamMod
        midfieldCount++
        break
      case 'DF':
        defenseTotal += calcDefenseScore(effectivePlayer, mod) * stamMod
        defenseCount++
        break
      case 'GK':
        goalkeeperTotal += calcGoalkeeperScore(effectivePlayer, mod) * stamMod
        goalkeeperCount++
        break
    }
  }

  const starterPlayers: SnapshotPlayer[] = []
  for (const slot of starters) {
    const p = playerMap.get(slot.playerId)
    if (!p) continue
    const positionMod = positionModifier(slot.assignedPosition, p.position, p.positionAlt)
    const injuryMod = p.isInjured ? INJURED_PERFORMANCE_MULTIPLIER : 1
    const staminaMod = staminaPerformanceMultiplier(p.stamina)
    starterPlayers.push({
      id: p.id,
      name: p.name,
      nameRomaji: p.nameRomaji,
      spriteUrl: p.spriteUrl,
      position: slot.assignedPosition,
      element: p.element,
      techniques: [...p.techniques, ...(p.improvementTechniques ?? [])],
      stats: applyPerformanceMultiplier(getPlayerMatchStats(p), positionMod * injuryMod * staminaMod),
    })
  }

  return {
    id: team.id,
    name: team.name,
    formation: team.formation,
    forwardScore: forwardCount > 0 ? forwardTotal / forwardCount : 0,
    midfieldScore: midfieldCount > 0 ? midfieldTotal / midfieldCount : 0,
    defenseScore: defenseCount > 0 ? defenseTotal / defenseCount : 0,
    goalkeeperScore: goalkeeperCount > 0 ? goalkeeperTotal / goalkeeperCount : 0,
    starters: starterPlayers,
  }
}

export function applyFormation(team: Team, formationId: number, formations: Formation[]): Team {
  const formation = formations.find((f) => f.id === formationId)
  if (!formation) return team
  return { ...team, formation }
}

// When switching formation, keeps top-N starters per position (by media) and demotes the rest to bench.
export function rebalanceLineup(team: Team, newFormation: Formation, players: Player[]): Team {
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const needed: Record<Position, number> = {
    GK: newFormation.GK,
    DF: newFormation.DF,
    MD: newFormation.MD,
    FW: newFormation.FW,
  }

  const byPos: Record<Position, LineupSlot[]> = { GK: [], DF: [], MD: [], FW: [] }
  for (const slot of team.lineup) {
    if (slot.isStarter && byPos[slot.assignedPosition]) {
      byPos[slot.assignedPosition].push(slot)
    }
  }

  const newStarters: LineupSlot[] = []
  const demotedIds = new Set<number>()

  for (const pos of ['GK', 'DF', 'MD', 'FW'] as Position[]) {
    const slots = byPos[pos].sort((a, b) => {
      const pA = playerMap.get(a.playerId)
      const pB = playerMap.get(b.playerId)
      return (pB ? getPlayerStatsSummary(pB).media : 0) - (pA ? getPlayerStatsSummary(pA).media : 0)
    })
    slots.forEach((s, i) => {
      if (i < needed[pos]) newStarters.push({ ...s, formationSlotIndex: undefined })
      else demotedIds.add(s.playerId)
    })
  }

  const starterIds = new Set(newStarters.map((s) => s.playerId))
  const existingBench = team.lineup.filter((s) => !s.isStarter)
  const demotedSlots: LineupSlot[] = [...demotedIds].map((pid) => {
    const p = playerMap.get(pid)
    return { playerId: pid, assignedPosition: p?.position ?? 'MD', isStarter: false, formationSlotIndex: undefined }
  })

  return {
    ...team,
    formation: newFormation,
    lineup: [
      ...newStarters,
      ...existingBench.filter((s) => !starterIds.has(s.playerId)),
      ...demotedSlots,
    ],
  }
}
