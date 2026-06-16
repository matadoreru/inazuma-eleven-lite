import type { Season } from '../types/competition'
import type { CareerSeasonStats } from '../types/career'
import { sortStandings } from './standingsService'

export function computeSeasonStats(
  season: Season,
  teamId: number,
  seasonNumber: number,
): CareerSeasonStats {
  const teamMatches = season.matches
    .filter((m) => (m.homeTeamId === teamId || m.awayTeamId === teamId) && m.played)
    .sort((a, b) => a.date.localeCompare(b.date))

  const sortedStandings = sortStandings(season.standings)
  const teamRow = sortedStandings.find((r) => r.teamId === teamId)
  const position = sortedStandings.findIndex((r) => r.teamId === teamId) + 1

  let wins = 0
  let draws = 0
  let losses = 0
  let goalsFor = 0
  let goalsAgainst = 0
  let cleanSheets = 0
  let possessionSum = 0
  let currentStreak = 0
  let bestWinStreak = 0

  for (const match of teamMatches) {
    const isHome = match.homeTeamId === teamId
    const gf = isHome ? (match.homeGoals ?? 0) : (match.awayGoals ?? 0)
    const ga = isHome ? (match.awayGoals ?? 0) : (match.homeGoals ?? 0)

    goalsFor += gf
    goalsAgainst += ga

    if (gf > ga) {
      wins++
      currentStreak++
      bestWinStreak = Math.max(bestWinStreak, currentStreak)
    } else if (gf === ga) {
      draws++
      currentStreak = 0
    } else {
      losses++
      currentStreak = 0
    }

    if (ga === 0) cleanSheets++

    if (match.result) {
      const poss = isHome ? match.result.homePossession : match.result.awayPossession
      possessionSum += poss ?? 50
    }
  }

  const matchesPlayed = teamMatches.length

  return {
    seasonNumber,
    year: season.year,
    leagueId: season.leagueId,
    finalPosition: position > 0 ? position : 0,
    matchesPlayed,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    points: teamRow?.points ?? 0,
    winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    avgPossession: matchesPlayed > 0 ? Math.round(possessionSum / matchesPlayed) : 0,
    cleanSheets,
    bestWinStreak,
  }
}

export interface GlobalCareerStats {
  seasons: number
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  winRate: number
  cleanSheets: number
  bestWinStreak: number
}

export function computeGlobalStats(
  seasonHistory: CareerSeasonStats[],
  currentStats: CareerSeasonStats | null,
): GlobalCareerStats {
  const all = currentStats ? [...seasonHistory, currentStats] : [...seasonHistory]

  const matchesPlayed = all.reduce((s, x) => s + x.matchesPlayed, 0)
  const wins = all.reduce((s, x) => s + x.wins, 0)
  const draws = all.reduce((s, x) => s + x.draws, 0)
  const losses = all.reduce((s, x) => s + x.losses, 0)
  const goalsFor = all.reduce((s, x) => s + x.goalsFor, 0)
  const goalsAgainst = all.reduce((s, x) => s + x.goalsAgainst, 0)

  return {
    seasons: all.length,
    matchesPlayed,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    cleanSheets: all.reduce((s, x) => s + x.cleanSheets, 0),
    bestWinStreak: all.reduce((m, x) => Math.max(m, x.bestWinStreak), 0),
  }
}
