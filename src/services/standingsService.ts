import type { StandingRow, Match } from '../types/competition'
import type { Team } from '../types/team'

export function initStandings(teamIds: number[], teams: Team[]): StandingRow[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  return teamIds.map((id) => ({
    teamId: id,
    teamName: teamMap.get(id)?.name ?? `Team ${id}`,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  }))
}

export function updateStandings(standings: StandingRow[], match: Match): StandingRow[] {
  if (!match.played || match.result === null) return standings

  const { homeTeamId, awayTeamId, homeGoals, awayGoals } = match

  return standings.map((row) => {
    if (row.teamId !== homeTeamId && row.teamId !== awayTeamId) return row

    const isHome = row.teamId === homeTeamId
    const scored = isHome ? homeGoals : awayGoals
    const conceded = isHome ? awayGoals : homeGoals
    const won = scored > conceded
    const drawn = scored === conceded
    const lost = scored < conceded

    return {
      ...row,
      played: row.played + 1,
      won: row.won + (won ? 1 : 0),
      drawn: row.drawn + (drawn ? 1 : 0),
      lost: row.lost + (lost ? 1 : 0),
      goalsFor: row.goalsFor + scored,
      goalsAgainst: row.goalsAgainst + conceded,
      goalDiff: row.goalDiff + scored - conceded,
      points: row.points + (won ? 3 : drawn ? 1 : 0),
    }
  })
}

export function sortStandings(standings: StandingRow[]): StandingRow[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    return b.goalsFor - a.goalsFor
  })
}
