import type { Team } from '../types/team'
import type { League, Season } from '../types/competition'
import type { LeagueSeason } from '../types/season'
import { sortStandings } from './standingsService'

export interface PromotionRelegationResult {
  teams: Team[]
  promotedIds: number[]
  relegatedIds: number[]
}

export function applyPromotionsRelegations(
  teams: Team[],
  leagues: League[],
  userSeason: Season,
  allLeagueSeasons: Record<string, LeagueSeason>,
): PromotionRelegationResult {
  // Build a map of leagueId → sorted standing positions
  const positionsByLeague: Record<string, number[]> = {}

  // User's league standings
  const userSorted = sortStandings(userSeason.standings)
  positionsByLeague[userSeason.leagueId] = userSorted.map((r) => r.teamId)

  // External leagues
  for (const [leagueId, ls] of Object.entries(allLeagueSeasons)) {
    positionsByLeague[leagueId] = sortStandings(ls.standings).map((r) => r.teamId)
  }

  const promotedIds: number[] = []
  const relegatedIds: number[] = []
  const alreadyMoved = new Set<number>()

  for (const league of leagues) {
    const rankedIds = positionsByLeague[league.id]
    if (!rankedIds || rankedIds.length === 0) continue

    // Top N → promoted
    if (league.promotionSlots > 0 && league.promotionTo) {
      for (let i = 0; i < Math.min(league.promotionSlots, rankedIds.length); i++) {
        const id = rankedIds[i]
        if (!alreadyMoved.has(id)) {
          promotedIds.push(id)
          alreadyMoved.add(id)
        }
      }
    }

    // Bottom N → relegated
    if (league.relegationSlots > 0 && league.relegationTo) {
      for (let i = rankedIds.length - league.relegationSlots; i < rankedIds.length; i++) {
        if (i < 0) continue
        const id = rankedIds[i]
        if (!alreadyMoved.has(id)) {
          relegatedIds.push(id)
          alreadyMoved.add(id)
        }
      }
    }
  }

  const updatedTeams = teams.map((team) => {
    if (promotedIds.includes(team.id)) {
      const currentLeague = leagues.find((l) => l.id === team.leagueId)
      const targetLeagueId = currentLeague?.promotionTo ?? team.leagueId
      const targetLeague = leagues.find((l) => l.id === targetLeagueId)
      return { ...team, leagueId: targetLeagueId, tier: targetLeague?.level ?? team.tier }
    }
    if (relegatedIds.includes(team.id)) {
      const currentLeague = leagues.find((l) => l.id === team.leagueId)
      const targetLeagueId = currentLeague?.relegationTo ?? team.leagueId
      const targetLeague = leagues.find((l) => l.id === targetLeagueId)
      return { ...team, leagueId: targetLeagueId, tier: targetLeague?.level ?? team.tier }
    }
    return team
  })

  return { teams: updatedTeams, promotedIds, relegatedIds }
}
