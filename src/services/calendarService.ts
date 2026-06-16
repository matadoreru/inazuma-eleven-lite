import type { Season, Match } from '../types/competition'

export function advanceDay(season: Season): Season {
  const current = new Date(season.currentDate)
  current.setDate(current.getDate() + 1)
  const nextDate = current.toISOString().split('T')[0]

  const upcoming = season.matches
    .filter((m) => !m.played && m.date >= nextDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  const nextRound = upcoming.length > 0 ? upcoming[0].round : season.currentRound

  return {
    ...season,
    currentDate: nextDate,
    currentRound: nextRound,
  }
}

export function advanceToNextMatch(season: Season, teamId: number): Season {
  const next = getNextMatch(season, teamId)
  if (!next || next.date <= season.currentDate) return season

  let s = season
  while (s.currentDate < next.date) {
    s = advanceDay(s)
  }
  return s
}

export function getNextMatch(season: Season, teamId: number): Match | null {
  const upcoming = season.matches
    .filter(
      (m) =>
        !m.played &&
        (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
        m.date >= season.currentDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  return upcoming[0] ?? null
}

export function getMatchday(season: Season, date: string): Match[] {
  return season.matches.filter((m) => m.date === date)
}

export function isDayFree(season: Season, date: string, teamId: number): boolean {
  return !season.matches.some(
    (m) =>
      m.date === date &&
      (m.homeTeamId === teamId || m.awayTeamId === teamId),
  )
}
