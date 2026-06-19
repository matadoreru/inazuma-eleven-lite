import { describe, it, expect } from 'vitest'
import { checkObjectives, completeObjective, failObjective } from '../services/objectiveService'
import { getObjectivesForTeam } from '../services/careerService'
import type { Career, Objective } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Season, StandingRow } from '../types/competition'
import type { Team } from '../types/team'
import type { League } from '../types/competition'

const makeStandingRow = (teamId: number, overrides: Partial<StandingRow> = {}): StandingRow => ({
  teamId,
  teamName: `Team ${teamId}`,
  played: 10,
  won: 6,
  drawn: 2,
  lost: 2,
  goalsFor: 18,
  goalsAgainst: 10,
  goalDiff: 8,
  points: 20,
  ...overrides,
})

const makeSeason = (overrides: Partial<Season> = {}): Season => ({
  year: 2026,
  leagueId: 'league-1',
  teamIds: [1, 2, 3, 4],
  matches: [],
  standings: [
    makeStandingRow(1, { points: 20, goalDiff: 8, goalsFor: 18, won: 6 }),
    makeStandingRow(2, { points: 15, goalDiff: 3, goalsFor: 12, won: 4 }),
    makeStandingRow(3, { points: 10, goalDiff: 0, goalsFor: 8, won: 3 }),
    makeStandingRow(4, { points: 5, goalDiff: -5, goalsFor: 5, won: 1 }),
  ],
  currentDate: '2026-06-01',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  currentRound: 10,
  totalRounds: 30,
  finished: false,
  ...overrides,
})

const makeObjective = (overrides: Partial<Objective> = {}): Objective => ({
  id: 'obj-1',
  type: 'EARN_POINTS',
  description: 'Earn 30 points',
  target: 30,
  current: 0,
  completed: false,
  failed: false,
  claimed: false,
  penaltyApplied: false,
  reward: { money: 10000, reputation: 0 },
  penalty: { reputation: 0 },
  isMandatory: true,
  ...overrides,
})

const makeCareer = (overrides: Partial<Career> = {}): Career => ({
  id: 'career-1',
  managerName: 'Manager',
  managerAvatar: '/avatars/avatar-1.svg',
  teamId: 1,
  season: makeSeason(),
  seasonNumber: 1,
  totalBudgetSpent: 0,
  totalBudgetEarned: 0,
  objectives: [],
  inbox: [],
  transferHistory: [],
  watchlist: [],
  seasonHistory: [],
  playerPotential: {},
  weeklyTrainingPlan: null,
  lastCompletedTrainingSlots: null,
  inventory: { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] },
  allLeagueSeasons: {},
  cup: null,
  seasonStatus: 'active',
  lastSeasonReview: null,
  outgoingNegotiations: [],
  incomingOffers: [],
  difficulty: DEFAULT_DIFFICULTY,
  nameStyle: 'western' as const,
  createdAt: '2026-01-01',
  lastSavedAt: '2026-01-01',
  ...overrides,
})

const makeLeague = (rounds: number, teamsCount: number): League => ({
  id: 'test', name: 'Liga Test', level: 2, promotionTo: null, relegationTo: null,
  promotionSlots: 0, relegationSlots: 2, teamsCount, rounds,
})

const makeTeam = (tier: number): Team => ({
  id: 1, name: 'Test FC', tier, reputation: 50, budget: 1_000_000,
  leagueId: 'test', captainId: 1, formation: {} as any, lineup: [], playerIds: [],
})

describe('checkObjectives', () => {
  it('updates EARN_POINTS objective with current team points', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'EARN_POINTS', target: 30, current: 0 })],
    })
    const season = makeSeason() // team 1 has 20 points

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(20)
  })

  it('marks EARN_POINTS objective completed when target is reached', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'EARN_POINTS', target: 20, current: 0 })],
    })
    const season = makeSeason() // team 1 has exactly 20 points

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].completed).toBe(true)
  })

  it('does not mark objective completed when target is not yet reached', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'EARN_POINTS', target: 50, current: 0 })],
    })
    const season = makeSeason() // team 1 has 20 points

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].completed).toBe(false)
  })

  it('updates WIN_MATCHES objective with wins count', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'WIN_MATCHES', target: 10, current: 0 })],
    })
    const season = makeSeason() // team 1 has 6 wins

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(6)
  })

  it('updates SCORE_GOALS objective with goals scored', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'SCORE_GOALS', target: 20, current: 0 })],
    })
    const season = makeSeason() // team 1 has 18 goals

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(18)
  })

  it('updates CONCEDE_FEW progress mid-season but does not complete it', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'CONCEDE_FEW', target: 15, current: 0 })],
    })
    // season.finished = false — cannot confirm final goals-against tally yet
    const season = makeSeason({ finished: false })

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(10)
    // Must NOT complete mid-season: team could still concede more goals
    expect(updated.objectives[0].completed).toBe(false)
  })

  it('completes CONCEDE_FEW at season end when target is met', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'CONCEDE_FEW', target: 15, current: 0 })],
    })
    const season = makeSeason({ finished: true }) // team 1 has 10 goals against

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(10)
    expect(updated.objectives[0].completed).toBe(true)
  })

  it('updates TOP_N progress mid-season but does not complete it', () => {
    const career = makeCareer({
      teamId: 2,
      objectives: [makeObjective({ type: 'TOP_N', target: 2, current: 0 })],
    })
    // Team 2 is in position 2, but the season is not over yet
    const season = makeSeason({ finished: false })

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(2)
    // Must NOT complete mid-season: position can still change before the final match
    expect(updated.objectives[0].completed).toBe(false)
  })

  it('completes TOP_N at season end when position is met', () => {
    const career = makeCareer({
      teamId: 2,
      objectives: [makeObjective({ type: 'TOP_N', target: 2, current: 0 })],
    })
    const season = makeSeason({ finished: true }) // team 2 finishes 2nd

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(2)
    expect(updated.objectives[0].completed).toBe(true)
  })

  it('does not alter already-completed objectives', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'EARN_POINTS', target: 5, current: 5, completed: true })],
    })
    const season = makeSeason()

    const updated = checkObjectives(career, season)
    // current should remain unchanged (objective skipped)
    expect(updated.objectives[0].current).toBe(5)
  })

  it('does not alter already-failed objectives', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'EARN_POINTS', target: 5, current: 0, failed: true })],
    })
    const season = makeSeason()

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(0)
  })

  it('handles WIN_LEAGUE on a finished season', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'WIN_LEAGUE', target: 1, current: 0 })],
    })
    const season = makeSeason({ finished: true }) // team 1 is 1st

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].current).toBe(1)
    expect(updated.objectives[0].completed).toBe(true)
  })

  it('does not trigger WIN_LEAGUE completion on an unfinished season', () => {
    const career = makeCareer({
      teamId: 1,
      objectives: [makeObjective({ type: 'WIN_LEAGUE', target: 1, current: 0 })],
    })
    const season = makeSeason({ finished: false })

    const updated = checkObjectives(career, season)
    expect(updated.objectives[0].completed).toBe(false)
  })

  it('does not mutate the original career', () => {
    const objective = makeObjective({ type: 'EARN_POINTS', target: 30, current: 0 })
    const career = makeCareer({ objectives: [objective] })
    const season = makeSeason()

    checkObjectives(career, season)
    expect(career.objectives[0].current).toBe(0)
  })
})

describe('completeObjective', () => {
  it('marks the matching objective as completed', () => {
    const career = makeCareer({
      objectives: [makeObjective({ id: 'obj-a', completed: false })],
    })
    const updated = completeObjective('obj-a', career)
    expect(updated.objectives[0].completed).toBe(true)
  })

  it('sets failed to false when marking completed', () => {
    const career = makeCareer({
      objectives: [makeObjective({ id: 'obj-a', completed: false, failed: true })],
    })
    const updated = completeObjective('obj-a', career)
    expect(updated.objectives[0].failed).toBe(false)
  })

  it('does not affect other objectives', () => {
    const career = makeCareer({
      objectives: [
        makeObjective({ id: 'obj-a' }),
        makeObjective({ id: 'obj-b', completed: false }),
      ],
    })
    const updated = completeObjective('obj-a', career)
    expect(updated.objectives[1].completed).toBe(false)
  })

  it('does not mutate the original career', () => {
    const career = makeCareer({
      objectives: [makeObjective({ id: 'obj-a', completed: false })],
    })
    completeObjective('obj-a', career)
    expect(career.objectives[0].completed).toBe(false)
  })
})

describe('failObjective', () => {
  it('marks the matching objective as failed', () => {
    const career = makeCareer({
      objectives: [makeObjective({ id: 'obj-a', failed: false })],
    })
    const updated = failObjective('obj-a', career)
    expect(updated.objectives[0].failed).toBe(true)
  })

  it('sets completed to false when marking failed', () => {
    const career = makeCareer({
      objectives: [makeObjective({ id: 'obj-a', completed: true, failed: false })],
    })
    const updated = failObjective('obj-a', career)
    expect(updated.objectives[0].completed).toBe(false)
  })

  it('does not affect other objectives', () => {
    const career = makeCareer({
      objectives: [
        makeObjective({ id: 'obj-a' }),
        makeObjective({ id: 'obj-b', failed: false }),
      ],
    })
    const updated = failObjective('obj-a', career)
    expect(updated.objectives[1].failed).toBe(false)
  })

  it('does not mutate the original career', () => {
    const career = makeCareer({
      objectives: [makeObjective({ id: 'obj-a', failed: false })],
    })
    failObjective('obj-a', career)
    expect(career.objectives[0].failed).toBe(false)
  })
})

describe('getObjectivesForTeam — scaled targets', () => {
  it('score goals target scales with league rounds', () => {
    const short = getObjectivesForTeam(makeTeam(3), makeLeague(14, 8))
    const long  = getObjectivesForTeam(makeTeam(3), makeLeague(38, 20))
    const shortGoals = short.find(o => o.type === 'SCORE_GOALS')!.target
    const longGoals  = long.find(o => o.type === 'SCORE_GOALS')!.target
    expect(shortGoals).toBeLessThan(longGoals)
    // Short league (14 rounds) should never demand 30 goals
    expect(shortGoals).toBeLessThan(25)
  })

  it('hard difficulty produces higher targets than easy', () => {
    const easy = getObjectivesForTeam(makeTeam(3), makeLeague(20, 10), 'easy')
    const hard = getObjectivesForTeam(makeTeam(3), makeLeague(20, 10), 'hard')
    const easyWins = easy.find(o => o.type === 'WIN_MATCHES')!.target
    const hardWins = hard.find(o => o.type === 'WIN_MATCHES')!.target
    expect(hardWins).toBeGreaterThan(easyWins)
  })

  it('no target exceeds the mathematical maximum for the season', () => {
    const objs = getObjectivesForTeam(makeTeam(3), makeLeague(14, 8), 'very_hard')
    const wins = objs.find(o => o.type === 'WIN_MATCHES')!.target
    expect(wins).toBeLessThanOrEqual(14)
  })

  it('objectives have correct groupType', () => {
    const objs = getObjectivesForTeam(makeTeam(3), makeLeague(20, 10))
    const seasonEnd  = objs.filter(o => o.groupType === 'season_end')
    const continuous = objs.filter(o => o.groupType === 'continuous')
    expect(seasonEnd.length).toBeGreaterThan(0)
    expect(continuous.length).toBeGreaterThan(0)
  })
})
