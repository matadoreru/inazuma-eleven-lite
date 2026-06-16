import { describe, it, expect } from 'vitest'
import { filterPlayers, calcTransferValue, buyPlayer } from '../services/transferService'
import type { Player } from '../types/player'
import type { Team, Formation } from '../types/team'
import type { Career } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { TransferFilter } from '../types/transfer'

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 1,
  name: 'Test Player',
  nameRomaji: 'Test Player',
  gender: 'Masculino',
  position: 'FW',
  positionAlt: null,
  element: 'FIRE',
  stats: { POT: 100, CON: 80, TEC: 90, PRE: 70, FIS: 85, AGI: 75, INT: 80, TOT: 83 },
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
  age: 20,
  teamId: 2,
  jerseyNumber: 10,
  ...overrides,
})

const makeFormation = (): Formation => ({
  id: 1,
  name: '4-4-2',
  tacticalType: 'BALANCED',
  GK: 1,
  DF: 4,
  MD: 4,
  FW: 2,
})

const makeTeam = (id: number, budget: number, playerIds: number[] = []): Team => ({
  id,
  name: `Team ${id}`,
  tier: 1,
  reputation: 50,
  budget,
  leagueId: 'league-1',
  captainId: 1,
  formation: makeFormation(),
  lineup: [],
  playerIds,
})

const makeCareer = (teamId: number): Career => ({
  id: 'career-1',
  managerName: 'Manager',
  managerAvatar: '/avatars/avatar-1.svg',
  teamId,
  season: {
    year: 2026,
    leagueId: 'league-1',
    teamIds: [teamId],
    matches: [],
    standings: [],
    currentDate: '2026-01-01',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    currentRound: 1,
    totalRounds: 30,
    finished: false,
  },
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
  inventory: { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] },
  allLeagueSeasons: {},
  cup: null,
  seasonStatus: 'active',
  lastSeasonReview: null,
  difficulty: DEFAULT_DIFFICULTY,
  createdAt: '2026-01-01',
  lastSavedAt: '2026-01-01',
})

const makeFilter = (overrides: Partial<TransferFilter> = {}): TransferFilter => ({
  position: 'ALL',
  element: 'ALL',
  minOverall: 0,
  maxPrice: 9_999_999,
  nameSearch: '',
  page: 0,
  pageSize: 15,
  ...overrides,
})

describe('calcTransferValue', () => {
  it('returns a positive number', () => {
    const player = makePlayer()
    expect(calcTransferValue(player)).toBeGreaterThan(0)
  })

  it('gives young players a higher value (ageFactor 1.4 for age <= 22)', () => {
    const young = makePlayer({ age: 20, stats: { POT: 100, CON: 80, TEC: 90, PRE: 70, FIS: 85, AGI: 75, INT: 80, TOT: 83 } })
    const old = makePlayer({ age: 33, stats: { POT: 100, CON: 80, TEC: 90, PRE: 70, FIS: 85, AGI: 75, INT: 80, TOT: 83 } })
    expect(calcTransferValue(young)).toBeGreaterThan(calcTransferValue(old))
  })

  it('gives high-potential players a higher value (potential > 80)', () => {
    const highPot = makePlayer({ career: { ...makePlayer().career, potential: 90 } })
    const lowPot = makePlayer({ career: { ...makePlayer().career, potential: 50 } })
    expect(calcTransferValue(highPot)).toBeGreaterThan(calcTransferValue(lowPot))
  })

  it('value is based on TOT stat', () => {
    const p1 = makePlayer({ stats: { ...makePlayer().stats, TOT: 100 } })
    const p2 = makePlayer({ stats: { ...makePlayer().stats, TOT: 50 } })
    expect(calcTransferValue(p1)).toBeGreaterThan(calcTransferValue(p2))
  })
})

describe('filterPlayers', () => {
  const players = [
    makePlayer({ id: 1, position: 'FW', element: 'FIRE', stats: { ...makePlayer().stats, TOT: 80 } }),
    makePlayer({ id: 2, position: 'GK', element: 'WIND', stats: { ...makePlayer().stats, TOT: 60 } }),
    makePlayer({ id: 3, position: 'MD', element: 'FIRE', stats: { ...makePlayer().stats, TOT: 75 } }),
    makePlayer({ id: 4, name: 'Mark Evans', nameRomaji: 'Mark Evans', position: 'GK', element: 'MOUNTAIN', stats: { ...makePlayer().stats, TOT: 70 } }),
  ]

  it('returns all players when filter is default (ALL)', () => {
    const result = filterPlayers(players, makeFilter())
    expect(result).toHaveLength(players.length)
  })

  it('filters by position', () => {
    const result = filterPlayers(players, makeFilter({ position: 'GK' }))
    expect(result.every((p) => p.position === 'GK')).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('filters by element', () => {
    const result = filterPlayers(players, makeFilter({ element: 'FIRE' }))
    expect(result.every((p) => p.element === 'FIRE')).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('filters by minOverall', () => {
    const result = filterPlayers(players, makeFilter({ minOverall: 75 }))
    expect(result.every((p) => p.stats.TOT >= 75)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('filters by maxPrice (excludes players whose transfer value exceeds limit)', () => {
    // Set a very low max price — only free agents (value 0) would pass; practically,
    // verify that a very high max allows all and a very low max blocks expensive players.
    const allPass = filterPlayers(players, makeFilter({ maxPrice: 9_999_999 }))
    expect(allPass).toHaveLength(players.length)

    const nonePass = filterPlayers(players, makeFilter({ maxPrice: 0 }))
    expect(nonePass).toHaveLength(0)
  })

  it('filters by name (case-insensitive)', () => {
    const result = filterPlayers(players, makeFilter({ nameSearch: 'mark' }))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(4)
  })

  it('filters by nameRomaji', () => {
    const result = filterPlayers(players, makeFilter({ nameSearch: 'evans' }))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(4)
  })

  it('can combine multiple filters', () => {
    const result = filterPlayers(players, makeFilter({ position: 'GK', element: 'WIND' }))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(2)
  })
})

describe('buyPlayer', () => {
  it('moves the player to the buying team', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { players: updatedPlayers } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    const bought = updatedPlayers.find((p) => p.id === 10)!
    expect(bought.teamId).toBe(1)
  })

  it('deducts the transfer amount from the buying team budget', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { teams: updatedTeams } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    const buyer = updatedTeams.find((t) => t.id === 1)!
    expect(buyer.budget).toBe(450_000)
  })

  it('adds the transfer amount to the selling team budget', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { teams: updatedTeams } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    const seller = updatedTeams.find((t) => t.id === 2)!
    expect(seller.budget).toBe(150_000)
  })

  it('adds player to buying team playerIds', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { teams: updatedTeams } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    const buyer = updatedTeams.find((t) => t.id === 1)!
    expect(buyer.playerIds).toContain(10)
  })

  it('removes player from selling team playerIds', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { teams: updatedTeams } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    const seller = updatedTeams.find((t) => t.id === 2)!
    expect(seller.playerIds).not.toContain(10)
  })

  it('returns unchanged state when budget is insufficient', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const poorTeam = makeTeam(1, 1_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const result = buyPlayer(10, 1, 50_000, career, [poorTeam, sellingTeam], [player])
    expect(result.players[0].teamId).toBe(2)
    expect(result.teams.find((t) => t.id === 1)!.budget).toBe(1_000)
  })

  it('records the transfer in career transferHistory', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { career: updatedCareer } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    expect(updatedCareer.transferHistory).toHaveLength(1)
    expect(updatedCareer.transferHistory[0].status).toBe('accepted')
    expect(updatedCareer.transferHistory[0].playerId).toBe(10)
    expect(updatedCareer.transferHistory[0].amount).toBe(50_000)
  })

  it('updates totalBudgetSpent when career team is the buyer', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const buyingTeam = makeTeam(1, 500_000, [])
    const sellingTeam = makeTeam(2, 100_000, [10])
    const career = makeCareer(1)

    const { career: updatedCareer } = buyPlayer(10, 1, 50_000, career, [buyingTeam, sellingTeam], [player])
    expect(updatedCareer.totalBudgetSpent).toBe(50_000)
  })
})
