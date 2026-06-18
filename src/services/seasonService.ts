import type { Season, Match, CalendarDay } from '../types/competition'
import type { Team } from '../types/team'
import type { League } from '../types/competition'
import type { Player } from '../types/player'
import type { PotentialAnalysis, DifficultySettings } from '../types/career'
import type { LeagueSeason } from '../types/season'
import { initStandings } from './standingsService'
import { applySeasonGrowth } from './growthService'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// Day-of-week offset per round so matches spread across different weekdays.
// Each round starts at matchDate + offset[round % len], then each match gets +1 day.
// Values 0-2 ensure all matches (max 5 per round) stay within the 7-day window.
const ROUND_DAY_OFFSETS = [0, 1, 2, 0, 2, 1, 0, 1]

// Round-robin schedule generator (each team plays every other team twice)
// Matches are staggered: max 1 per day, varying start day per round.
function generateRoundRobinMatches(
  teamIds: number[],
  leagueId: string,
  startDate: string,
): Match[] {
  const n = teamIds.length
  const ids = [...teamIds]
  if (n % 2 !== 0) ids.push(-1)

  const totalTeams = ids.length
  const matchesPerRound = totalTeams / 2
  const matches: Match[] = []
  let roundBaseDate = startDate

  // First half
  for (let round = 0; round < totalTeams - 1; round++) {
    const dayOffset = ROUND_DAY_OFFSETS[round % ROUND_DAY_OFFSETS.length]
    let matchInRound = 0
    for (let i = 0; i < matchesPerRound; i++) {
      const home = ids[i === 0 ? 0 : ((round + i - 1) % (totalTeams - 1)) + 1]
      const away = ids[i === 0 ? (round % (totalTeams - 1)) + 1 : ((round - i + totalTeams - 1) % (totalTeams - 1)) + 1]
      if (home !== -1 && away !== -1) {
        matches.push({
          id: crypto.randomUUID(),
          leagueId,
          round: round + 1,
          homeTeamId: home,
          awayTeamId: away,
          date: addDays(roundBaseDate, dayOffset + matchInRound),
          played: false,
          homeGoals: 0,
          awayGoals: 0,
          result: null,
        })
        matchInRound++
      }
    }
    roundBaseDate = addDays(roundBaseDate, 7)
  }

  // Second half: reversed home/away, grouped by original round
  const firstHalfMatches = matches.slice()
  const byRound = new Map<number, Match[]>()
  for (const m of firstHalfMatches) {
    const arr = byRound.get(m.round) ?? []
    arr.push(m)
    byRound.set(m.round, arr)
  }
  const firstHalfRounds = Array.from(byRound.keys()).sort((a, b) => a - b)

  for (let ri = 0; ri < firstHalfRounds.length; ri++) {
    const roundMatches = byRound.get(firstHalfRounds[ri])!
    const absoluteRound = (totalTeams - 1) + ri
    const dayOffset = ROUND_DAY_OFFSETS[absoluteRound % ROUND_DAY_OFFSETS.length]
    roundMatches.forEach((orig, matchInRound) => {
      matches.push({
        id: crypto.randomUUID(),
        leagueId,
        round: orig.round + (totalTeams - 1),
        homeTeamId: orig.awayTeamId,
        awayTeamId: orig.homeTeamId,
        date: addDays(roundBaseDate, dayOffset + matchInRound),
        played: false,
        homeGoals: 0,
        awayGoals: 0,
        result: null,
      })
    })
    roundBaseDate = addDays(roundBaseDate, 7)
  }

  return matches
}

export function initSeason(
  teamId: number,
  leagueId: string,
  teams: Team[],
  leagues: League[],
  year: number,
): Season {
  const league = leagues.find((l) => l.id === leagueId)
  const leagueTeams = teams.filter((t) => t.leagueId === leagueId)
  const teamIds = leagueTeams.map((t) => t.id)

  const startDate = `${year}-08-01`
  const matches = generateRoundRobinMatches(teamIds, leagueId, startDate)
  const lastMatch = matches[matches.length - 1]
  const endDate = lastMatch ? lastMatch.date : `${year}-12-31`

  const standings = initStandings(teamIds, teams)
  const totalRounds = league ? (league.teamsCount - 1) * 2 : matches.reduce((m, r) => Math.max(m, r.round), 0)

  return {
    year,
    leagueId,
    teamIds,
    matches,
    standings,
    currentDate: startDate,
    startDate,
    endDate,
    currentRound: 1,
    totalRounds,
    finished: false,
  }
}

// Like initSeason but returns a LeagueSeason for external (non-user) leagues
export function initLeagueSeason(
  leagueId: string,
  teams: Team[],
  leagues: League[],
  year: number,
): LeagueSeason {
  const league = leagues.find((l) => l.id === leagueId)
  const leagueTeams = teams.filter((t) => t.leagueId === leagueId)
  const teamIds = leagueTeams.map((t) => t.id)

  const startDate = `${year}-08-01`
  const matches = generateRoundRobinMatches(teamIds, leagueId, startDate)
  const standings = initStandings(teamIds, teams)
  const totalRounds = league
    ? (league.teamsCount - 1) * 2
    : matches.reduce((m, r) => Math.max(m, r.round), 0)

  return { leagueId, teamIds, matches, standings, totalRounds, finished: false }
}

export function endSeason(
  season: Season,
  teams: Team[],
  players: Player[],
  potentials?: Record<number, PotentialAnalysis>,
  settings?: DifficultySettings,
): { teams: Team[]; players: Player[]; promotions: number[]; relegations: number[] } {
  // Season growth only — promotion/relegation is deferred to closeSeason
  const grownPlayers = applySeasonGrowth(players, potentials, settings)

  return { teams, players: grownPlayers, promotions: [], relegations: [] }
}

export function generateCalendar(season: Season): CalendarDay[] {
  const calendar: CalendarDay[] = []
  const matchDateMap = new Map<string, Match[]>()

  for (const match of season.matches) {
    const existing = matchDateMap.get(match.date) ?? []
    existing.push(match)
    matchDateMap.set(match.date, existing)
  }

  const start = new Date(season.startDate)
  const end = new Date(season.endDate)
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const matches = matchDateMap.get(dateStr) ?? []
    const isMatchDay = matches.length > 0

    calendar.push({
      date: dateStr,
      matches,
      isTrainingDay: !isMatchDay,
      isRestDay: false,
    })

    current.setDate(current.getDate() + 1)
  }

  return calendar
}
