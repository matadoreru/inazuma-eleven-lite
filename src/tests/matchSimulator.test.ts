import { describe, it, expect } from 'vitest'
import { simulate, buildSnapshot } from '../services/matchSimulator'
import { buildTeamSnapshot } from '../services/formationService'
import type { Team, Formation, TeamSnapshot } from '../types/team'
import type { Player } from '../types/player'
import type { Match } from '../types/competition'

const makeFormation = (tacticalType: Formation['tacticalType'] = 'BALANCED'): Formation => ({
  id: 1,
  name: '4-4-2',
  tacticalType,
  GK: 1,
  DF: 4,
  MD: 4,
  FW: 2,
})

const makePlayer = (id: number, position: Player['position'], overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Player ${id}`,
  nameRomaji: `Player${id}`,
  gender: 'Masculino',
  position,
  positionAlt: null,
  element: 'FIRE',
  stats: { POT: 80, CON: 80, TEC: 80, PRE: 80, FIS: 80, AGI: 80, INT: 80, TOT: 80 },
  career: {
    maxLevel: 80,
    potential: 75,
    growthRate: 1.2,
    contractStatus: 'contracted',
    marketValue: 50000,
    salary: 1000,
    experience: 0,
    trainingProgress: 0,
    trainingSessionsThisWeek: 0,
    positionAlt: null,
  },
  techniques: [],
  spriteUrl: '',
  stamina: 100,
  morale: 100,
  isInjured: false,
  injuryDaysRemaining: 0,
  isSuspended: false,
  suspensionMatches: 0,
  age: 22,
  teamId: 1,
  jerseyNumber: id,
  canonTier: 'common',
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  ...overrides,
})

const makeTeamWithLineup = (teamId: number, teamName: string): { team: Team; players: Player[] } => {
  const gk = makePlayer(teamId * 100 + 1, 'GK', { teamId })
  const df1 = makePlayer(teamId * 100 + 2, 'DF', { teamId })
  const df2 = makePlayer(teamId * 100 + 3, 'DF', { teamId })
  const df3 = makePlayer(teamId * 100 + 4, 'DF', { teamId })
  const df4 = makePlayer(teamId * 100 + 5, 'DF', { teamId })
  const md1 = makePlayer(teamId * 100 + 6, 'MD', { teamId })
  const md2 = makePlayer(teamId * 100 + 7, 'MD', { teamId })
  const md3 = makePlayer(teamId * 100 + 8, 'MD', { teamId })
  const md4 = makePlayer(teamId * 100 + 9, 'MD', { teamId })
  const fw1 = makePlayer(teamId * 100 + 10, 'FW', { teamId })
  const fw2 = makePlayer(teamId * 100 + 11, 'FW', { teamId })

  const players = [gk, df1, df2, df3, df4, md1, md2, md3, md4, fw1, fw2]

  const team: Team = {
    id: teamId,
    name: teamName,
    tier: 1,
    reputation: 50,
    budget: 100000,
    leagueId: 'league-1',
    captainId: gk.id,
    formation: makeFormation(),
    lineup: players.map((p) => ({
      playerId: p.id,
      assignedPosition: p.position,
      isStarter: true,
    })),
    playerIds: players.map((p) => p.id),
  }

  return { team, players }
}

const makeMatch = (): Match => ({
  id: 'match-1',
  leagueId: 'league-1',
  round: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  date: '2026-01-01',
  played: false,
  homeGoals: 0,
  awayGoals: 0,
  result: null,
})

const makeSnapshot = (id: number, name: string, formation: Formation = makeFormation()): TeamSnapshot => ({
  id,
  name,
  formation,
  forwardScore: 80,
  midfieldScore: 80,
  defenseScore: 80,
  goalkeeperScore: 80,
})

describe('buildSnapshot', () => {
  it('returns a TeamSnapshot with correct id and name', () => {
    const { team, players } = makeTeamWithLineup(1, 'Raimon')
    const snapshot = buildSnapshot(team, players)
    expect(snapshot.id).toBe(1)
    expect(snapshot.name).toBe('Raimon')
  })

  it('returns positive scores for a fully fielded lineup', () => {
    const { team, players } = makeTeamWithLineup(1, 'Raimon')
    const snapshot = buildSnapshot(team, players)
    expect(snapshot.forwardScore).toBeGreaterThan(0)
    expect(snapshot.midfieldScore).toBeGreaterThan(0)
    expect(snapshot.defenseScore).toBeGreaterThan(0)
    expect(snapshot.goalkeeperScore).toBeGreaterThan(0)
  })

  it('produces same result as buildTeamSnapshot', () => {
    const { team, players } = makeTeamWithLineup(1, 'Raimon')
    const s1 = buildSnapshot(team, players)
    const s2 = buildTeamSnapshot(team, players)
    expect(s1).toEqual(s2)
  })
})

describe('simulate', () => {
  it('returns a MatchResult with non-negative goal counts', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(result.homeGoals).toBeGreaterThanOrEqual(0)
    expect(result.awayGoals).toBeGreaterThanOrEqual(0)
  })

  it('returns an events array', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(Array.isArray(result.events)).toBe(true)
  })

  it('includes phase events (kick-off and full time)', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    const phaseEvents = result.events.filter((e) => e.type === 'PHASE')
    expect(phaseEvents.length).toBeGreaterThanOrEqual(2)
  })

  it('events are sorted by minute', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].minute).toBeGreaterThanOrEqual(result.events[i - 1].minute)
    }
  })

  it('possession sums to 100', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(result.homePossession + result.awayPossession).toBe(100)
  })

  it('saves are non-negative', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(result.homeSaves).toBeGreaterThanOrEqual(0)
    expect(result.awaySaves).toBeGreaterThanOrEqual(0)
  })

  it('returns numeric xG values', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(typeof result.homeXG).toBe('number')
    expect(typeof result.awayXG).toBe('number')
    expect(result.homeXG).toBeGreaterThanOrEqual(0)
    expect(result.awayXG).toBeGreaterThanOrEqual(0)
  })

  it('goal count in events matches the returned homeGoals + awayGoals total', () => {
    // Run multiple simulations to get at least one with goals (stochastic)
    const home = makeSnapshot(1, 'Raimon', makeFormation('OFFENSIVE'))
    const away = makeSnapshot(2, 'Teikoku', makeFormation('DEFENSIVE'))
    let totalGoalEvents = 0
    let totalGoals = 0
    const runs = 5
    for (let i = 0; i < runs; i++) {
      const result = simulate(home, away, makeMatch())
      totalGoalEvents += result.events.filter((e) => e.type === 'GOAL').length
      totalGoals += result.homeGoals + result.awayGoals
    }
    expect(totalGoalEvents).toBe(totalGoals)
  })
})
