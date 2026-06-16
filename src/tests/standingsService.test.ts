import { describe, it, expect } from 'vitest'
import { initStandings, updateStandings, sortStandings } from '../services/standingsService'
import type { Team } from '../types/team'
import type { Match, StandingRow } from '../types/competition'

const makeTeam = (id: number, name: string): Team => ({
  id,
  name,
  tier: 1,
  reputation: 50,
  budget: 100000,
  leagueId: 'league-1',
  captainId: 1,
  formation: {
    id: 1,
    name: '4-4-2',
    tacticalType: 'BALANCED',
    GK: 1,
    DF: 4,
    MD: 4,
    FW: 2,
  },
  lineup: [],
  playerIds: [],
})

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1',
  leagueId: 'league-1',
  round: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  date: '2026-01-01',
  played: true,
  homeGoals: 2,
  awayGoals: 1,
  result: {
    homeGoals: 2,
    awayGoals: 1,
    homeShots: 8,
    awayShots: 5,
    homeShotsOnTarget: 4,
    awayShotsOnTarget: 2,
    homePossession: 55,
    awayPossession: 45,
    homeFouls: 10,
    awayFouls: 8,
    homeYellows: 1,
    awayYellows: 2,
    homeReds: 0,
    awayReds: 0,
    homeCorners: 5,
    awayCorners: 3,
    homeSaves: 2,
    awaySaves: 4,
    homeXG: 1.8,
    awayXG: 0.9,
    events: [],
  },
  ...overrides,
})

describe('initStandings', () => {
  it('creates one row per team with all-zero stats', () => {
    const teams = [makeTeam(1, 'Raimon'), makeTeam(2, 'Teikoku')]
    const rows = initStandings([1, 2], teams)

    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.played).toBe(0)
      expect(row.won).toBe(0)
      expect(row.drawn).toBe(0)
      expect(row.lost).toBe(0)
      expect(row.goalsFor).toBe(0)
      expect(row.goalsAgainst).toBe(0)
      expect(row.goalDiff).toBe(0)
      expect(row.points).toBe(0)
    }
  })

  it('uses team names from the teams array', () => {
    const teams = [makeTeam(1, 'Raimon'), makeTeam(2, 'Teikoku')]
    const rows = initStandings([1, 2], teams)

    expect(rows[0].teamName).toBe('Raimon')
    expect(rows[1].teamName).toBe('Teikoku')
  })

  it('falls back to "Team {id}" when team is not found', () => {
    const rows = initStandings([99], [])
    expect(rows[0].teamName).toBe('Team 99')
  })
})

describe('updateStandings', () => {
  const baseStandings: StandingRow[] = [
    { teamId: 1, teamName: 'Raimon', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
    { teamId: 2, teamName: 'Teikoku', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
  ]

  it('awards 3 points to the winner and 0 to the loser', () => {
    const match = makeMatch({ homeTeamId: 1, awayTeamId: 2, homeGoals: 2, awayGoals: 0 })
    const updated = updateStandings(baseStandings, match)
    const home = updated.find((r) => r.teamId === 1)!
    const away = updated.find((r) => r.teamId === 2)!

    expect(home.points).toBe(3)
    expect(home.won).toBe(1)
    expect(home.lost).toBe(0)
    expect(away.points).toBe(0)
    expect(away.won).toBe(0)
    expect(away.lost).toBe(1)
  })

  it('awards 1 point to each team on a draw', () => {
    const match = makeMatch({ homeTeamId: 1, awayTeamId: 2, homeGoals: 1, awayGoals: 1 })
    const updated = updateStandings(baseStandings, match)
    const home = updated.find((r) => r.teamId === 1)!
    const away = updated.find((r) => r.teamId === 2)!

    expect(home.points).toBe(1)
    expect(home.drawn).toBe(1)
    expect(away.points).toBe(1)
    expect(away.drawn).toBe(1)
  })

  it('correctly updates goals scored and conceded', () => {
    const match = makeMatch({ homeTeamId: 1, awayTeamId: 2, homeGoals: 3, awayGoals: 1 })
    const updated = updateStandings(baseStandings, match)
    const home = updated.find((r) => r.teamId === 1)!
    const away = updated.find((r) => r.teamId === 2)!

    expect(home.goalsFor).toBe(3)
    expect(home.goalsAgainst).toBe(1)
    expect(home.goalDiff).toBe(2)
    expect(away.goalsFor).toBe(1)
    expect(away.goalsAgainst).toBe(3)
    expect(away.goalDiff).toBe(-2)
  })

  it('does not update standings for unplayed matches', () => {
    const match = makeMatch({ played: false, result: null })
    const updated = updateStandings(baseStandings, match)
    expect(updated).toEqual(baseStandings)
  })
})

describe('sortStandings', () => {
  it('sorts by points descending', () => {
    const standings: StandingRow[] = [
      { teamId: 1, teamName: 'A', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, goalDiff: -2, points: 3 },
      { teamId: 2, teamName: 'B', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 9, goalsAgainst: 1, goalDiff: 8, points: 9 },
      { teamId: 3, teamName: 'C', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 3, goalDiff: 2, points: 6 },
    ]
    const sorted = sortStandings(standings)
    expect(sorted.map((r) => r.teamId)).toEqual([2, 3, 1])
  })

  it('breaks ties by goal difference', () => {
    const standings: StandingRow[] = [
      { teamId: 1, teamName: 'A', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 4, goalsAgainst: 3, goalDiff: 1, points: 6 },
      { teamId: 2, teamName: 'B', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 6, goalsAgainst: 2, goalDiff: 4, points: 6 },
    ]
    const sorted = sortStandings(standings)
    expect(sorted[0].teamId).toBe(2)
    expect(sorted[1].teamId).toBe(1)
  })

  it('breaks ties by goals scored when points and goalDiff are equal', () => {
    const standings: StandingRow[] = [
      { teamId: 1, teamName: 'A', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 2, goalDiff: 3, points: 6 },
      { teamId: 2, teamName: 'B', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 8, goalsAgainst: 5, goalDiff: 3, points: 6 },
    ]
    const sorted = sortStandings(standings)
    expect(sorted[0].teamId).toBe(2)
    expect(sorted[1].teamId).toBe(1)
  })

  it('does not mutate the original array', () => {
    const standings: StandingRow[] = [
      { teamId: 1, teamName: 'A', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDiff: -1, points: 0 },
      { teamId: 2, teamName: 'B', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDiff: 1, points: 3 },
    ]
    const original = [...standings]
    sortStandings(standings)
    expect(standings).toEqual(original)
  })
})
