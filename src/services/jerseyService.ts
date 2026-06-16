import type { Player } from '../types/player'

// Assigns jersey numbers to all players on a team who have jerseyNumber === 0.
// Numbers 1–99 are left for manual assignment; auto-assignment starts from 100.
// Respects non-zero jersey numbers already in the data and avoids duplicates.
export function autoAssignJerseys(teamPlayerIds: number[], allPlayers: Player[]): Player[] {
  const teamPlayers = allPlayers.filter((p) => teamPlayerIds.includes(p.id))
  const otherPlayers = allPlayers.filter((p) => !teamPlayerIds.includes(p.id))

  // Collect already-taken numbers (non-zero) within this team
  const taken = new Set(teamPlayers.filter((p) => p.jerseyNumber !== 0).map((p) => p.jerseyNumber))

  let next = 100  // start auto-assignment from 100
  function nextFree(): number {
    while (taken.has(next)) next++
    const n = next++
    taken.add(n)
    return n
  }

  const updatedTeamPlayers = teamPlayers.map((p) => {
    if (p.jerseyNumber !== 0) return p
    return { ...p, jerseyNumber: nextFree() }
  })

  return [...otherPlayers, ...updatedTeamPlayers]
}
