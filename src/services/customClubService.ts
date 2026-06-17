import type { Player } from '../types/player'
import type { Team, LineupSlot, CustomClubConfig } from '../types/team'
import type { StrengthTier } from '../types/team'
import { getPlayerStatsSummary } from '../types/player'
import { formations } from '../data/formations'
import { autoAssignJerseys } from './jerseyService'

const TIER_REPUTATION: Record<StrengthTier, { reputation: number; tier: number }> = {
  weak:        { reputation: 30, tier: 4 },
  normal:      { reputation: 50, tier: 3 },
  strong:      { reputation: 65, tier: 2 },
  very_strong: { reputation: 80, tier: 1 },
}

// Formation 1 GK + 4 DF + 4 MD + 2 FW
const STARTER_SLOTS: Array<{ position: Player['position']; count: number }> = [
  { position: 'GK', count: 1 },
  { position: 'DF', count: 4 },
  { position: 'MD', count: 4 },
  { position: 'FW', count: 2 },
]
const SUB_COUNT = 5

function sortedFreeAgents(allPlayers: Player[]): Player[] {
  return allPlayers
    .filter((p) => p.teamId === 0)
    .sort((a, b) => getPlayerStatsSummary(a).media - getPlayerStatsSummary(b).media)
}

function selectTierPool(sorted: Player[], tier: StrengthTier): Player[] {
  const n = sorted.length
  if (n === 0) return []
  const q1 = Math.floor(n * 0.25)
  const mid = Math.floor(n * 0.5)
  const q3 = Math.floor(n * 0.75)
  switch (tier) {
    case 'weak':        return sorted.slice(0, Math.max(q1, 16))
    case 'normal':      return sorted.slice(q1, Math.max(mid, q1 + 16))
    case 'strong':      return sorted.slice(mid, Math.max(q3, mid + 16))
    case 'very_strong': return sorted.slice(Math.max(0, n - Math.max(n - q3, 16)))
  }
}

export function assignSquadFromFreeAgents(
  config: CustomClubConfig,
  allPlayers: Player[],
): { playerIds: number[]; lineup: LineupSlot[] } {
  const sorted = sortedFreeAgents(allPlayers)
  // Prefer tier pool; fall back to full free agent pool if pool is too small
  const pool = selectTierPool(sorted, config.strengthTier)
  const fullPool = pool.length >= 16 ? pool : sorted

  // Select starters: for each position slot, pick best available from pool
  const selected: Player[] = []
  const usedIds = new Set<number>()

  for (const { position, count } of STARTER_SLOTS) {
    const candidates = fullPool
      .filter((p) => p.position === position && !usedIds.has(p.id))
      .sort((a, b) => getPlayerStatsSummary(b).media - getPlayerStatsSummary(a).media)
    // Fill as many as possible from primary position; use any position as fallback
    const picked = candidates.slice(0, count)
    const remaining = count - picked.length
    if (remaining > 0) {
      const fallback = fullPool
        .filter((p) => !usedIds.has(p.id) && !picked.includes(p))
        .sort((a, b) => getPlayerStatsSummary(b).media - getPlayerStatsSummary(a).media)
        .slice(0, remaining)
      picked.push(...fallback)
    }
    picked.forEach((p) => usedIds.add(p.id))
    selected.push(...picked)
  }

  // Subs: top available from pool (not already selected)
  const subs = fullPool
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => getPlayerStatsSummary(b).media - getPlayerStatsSummary(a).media)
    .slice(0, SUB_COUNT)

  const squad = [...selected, ...subs]
  const lineup: LineupSlot[] = []

  // Build lineup: starters first
  let starterIdx = 0
  for (const { position, count } of STARTER_SLOTS) {
    for (let i = 0; i < count; i++) {
      const player = selected[starterIdx++]
      if (!player) break
      lineup.push({ playerId: player.id, assignedPosition: position, isStarter: true })
    }
  }
  // Subs
  for (const sub of subs) {
    lineup.push({ playerId: sub.id, assignedPosition: sub.position, isStarter: false })
  }

  const playerIds = squad.map((p) => p.id)
  return { playerIds, lineup }
}

export function buildCustomTeam(
  config: CustomClubConfig,
  existingTeams: Team[],
  playerIds: number[],
  lineup: LineupSlot[],
): Team {
  const { reputation, tier } = TIER_REPUTATION[config.strengthTier]
  const newId = existingTeams.length > 0
    ? Math.max(...existingTeams.map((t) => t.id)) + 1
    : 100

  // Use first 4-4-2 formation available
  const formation = formations.find((f) => f.GK === 1 && f.DF === 4 && f.MD === 4 && f.FW === 2)
    ?? formations[0]

  // Captain = highest-media starter
  const starterIds = lineup.filter((s) => s.isStarter).map((s) => s.playerId)
  const captainId = starterIds[0] ?? playerIds[0]

  return {
    id: newId,
    name: config.name,
    badgeUrl: config.badgeUrl,
    tier,
    reputation,
    budget: 300_000,
    leagueId: config.leagueId,
    captainId,
    formation,
    lineup,
    playerIds,
    scoutLevel: Math.max(1, Math.ceil(reputation / 20)),
    facilitiesLevel: Math.max(1, Math.ceil(reputation / 20)),
  }
}
