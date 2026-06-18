import type { Position } from '../types/player'
import type { Player, Stats } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import type { Team, Formation, LineupSlot, TeamSnapshot, SnapshotPlayer } from '../types/team'
import { staminaPerformanceMultiplier } from './energyService'
import { getEffectiveStats } from './equipmentService'

// Position modifier: how well a player performs out of their natural position
export function positionModifier(slotPosition: Position, playerPosition: Position): number {
  if (slotPosition === playerPosition) return 1.0
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

export function calcForwardScore(player: Player, modifier: number): number {
  const s: Stats = player.stats
  return (s.POT * 0.40 + s.TEC * 0.25 + s.CON * 0.15 + s.AGI * 0.10 + s.INT * 0.10) * modifier
}

export function calcMidfieldScore(player: Player, modifier: number): number {
  const s: Stats = player.stats
  return (s.CON * 0.30 + s.TEC * 0.25 + s.INT * 0.25 + s.PRE * 0.10 + s.AGI * 0.10) * modifier
}

export function calcDefenseScore(player: Player, modifier: number): number {
  const s: Stats = player.stats
  return (s.PRE * 0.35 + s.FIS * 0.25 + s.INT * 0.20 + s.AGI * 0.10 + s.CON * 0.10) * modifier
}

export function calcGoalkeeperScore(player: Player, modifier: number): number {
  const s: Stats = player.stats
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
    const effectivePlayer = { ...player, stats: getEffectiveStats(player) }
    const mod = positionModifier(slot.assignedPosition, player.position)
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

  const starterPlayers: SnapshotPlayer[] = starters
    .map((slot) => {
      const p = playerMap.get(slot.playerId)
      if (!p) return null
      return { id: p.id, name: p.name, nameRomaji: p.nameRomaji, spriteUrl: p.spriteUrl, position: slot.assignedPosition, element: p.element, techniques: p.techniques }
    })
    .filter((p): p is SnapshotPlayer => p !== null)

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
      if (i < needed[pos]) newStarters.push(s)
      else demotedIds.add(s.playerId)
    })
  }

  const starterIds = new Set(newStarters.map((s) => s.playerId))
  const existingBench = team.lineup.filter((s) => !s.isStarter)
  const demotedSlots: LineupSlot[] = [...demotedIds].map((pid) => {
    const p = playerMap.get(pid)
    return { playerId: pid, assignedPosition: p?.position ?? 'MD', isStarter: false }
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
