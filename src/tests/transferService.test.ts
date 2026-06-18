import { describe, it, expect } from 'vitest'
import { filterPlayers, calcTransferValue, buyPlayer, sanitizeAmount, MAX_TRANSFER_VALUE, evaluateClubOffer, evaluatePlayerDecision, initiateNegotiation, cancelNegotiation, respondToCounter, resolveNegotiations } from '../services/transferService'
import type { OutgoingNegotiation } from '../types/career'
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
  canonTier: 'common',
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
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
  outgoingNegotiations: [],
  difficulty: DEFAULT_DIFFICULTY,
  createdAt: '2026-01-01',
  lastSavedAt: '2026-01-01',
})

const makeFilter = (overrides: Partial<TransferFilter> = {}): TransferFilter => ({
  position: 'ALL',
  element: 'ALL',
  minMedia: 0,
  maxPrice: 9_999_999,
  nameSearch: '',
  teamSearch: '',
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

  it('filters by minMedia', () => {
    const result = filterPlayers(players, makeFilter({ minMedia: 75 }))
    expect(result.every((p) => {
      const total = Object.values(p.stats).reduce((a, b) => a + b, 0)
      return Math.round(total / 7) >= 75
    })).toBe(true)
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

describe('sanitizeAmount', () => {
  it('returns null for NaN', () => {
    expect(sanitizeAmount(NaN)).toBeNull()
  })
  it('returns null for Infinity', () => {
    expect(sanitizeAmount(Infinity)).toBeNull()
  })
  it('returns null for 0', () => {
    expect(sanitizeAmount(0)).toBeNull()
  })
  it('returns null for negative values', () => {
    expect(sanitizeAmount(-500)).toBeNull()
  })
  it('returns null for amounts above MAX_TRANSFER_VALUE', () => {
    expect(sanitizeAmount(MAX_TRANSFER_VALUE + 1)).toBeNull()
  })
  it('returns rounded integer for valid amounts', () => {
    expect(sanitizeAmount(100_000.7)).toBe(100_001)
  })
  it('returns MAX_TRANSFER_VALUE exactly when at the cap', () => {
    expect(sanitizeAmount(MAX_TRANSFER_VALUE)).toBe(MAX_TRANSFER_VALUE)
  })
  it('accepts string numbers', () => {
    expect(sanitizeAmount('50000')).toBe(50_000)
  })
})

describe('calcTransferValue — new factors', () => {
  // Base: TOT=50, age=25, potential=50, common, no performance, healthy
  // base=50000, ageFactor=1.2 (≤26), potentialFactor=1.0, canon=1.0, perf=1.0, injury=1.0
  // Expected: 50000 * 1.2 = 60000
  it('baseline: TOT=50, age=25, potential=50, common', () => {
    const p = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    expect(calcTransferValue(p)).toBe(60_000)
  })

  it('legendary canon multiplies by 2.2', () => {
    const common = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'common' })
    const legendary = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'legendary' })
    expect(calcTransferValue(legendary)).toBe(Math.round(calcTransferValue(common) * 2.2))
  })

  it('epic canon multiplies by 1.6', () => {
    const common = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'common' })
    const epic = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'epic' })
    expect(calcTransferValue(epic)).toBe(Math.round(calcTransferValue(common) * 1.6))
  })

  it('rare canon multiplies by 1.3', () => {
    const common = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'common' })
    const rare = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'rare' })
    expect(calcTransferValue(rare)).toBe(Math.round(calcTransferValue(common) * 1.3))
  })

  it('injured player is worth 15% less', () => {
    const healthy = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, isInjured: false })
    const injured = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, isInjured: true })
    expect(calcTransferValue(injured)).toBe(Math.round(calcTransferValue(healthy) * 0.85))
  })

  it('10 goals add 10% performance bonus', () => {
    const noGoals = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const scorer = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, seasonStats: { goals: 10, assists: 0, cleanSheets: 0, matchesPlayed: 10, minutesPlayed: 900 } })
    expect(calcTransferValue(scorer)).toBe(Math.round(calcTransferValue(noGoals) * 1.10))
  })

  it('performance bonus is capped at 30%', () => {
    // 100 goals → would be 100% bonus but caps at 30%
    const big = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, seasonStats: { goals: 100, assists: 0, cleanSheets: 0, matchesPlayed: 30, minutesPlayed: 2700 } })
    const cap = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, seasonStats: { goals: 30, assists: 0, cleanSheets: 0, matchesPlayed: 30, minutesPlayed: 2700 } })
    expect(calcTransferValue(big)).toBe(calcTransferValue(cap))
  })

  it('starter ctx adds 10% importance bonus', () => {
    const p = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const base = calcTransferValue(p)
    expect(calcTransferValue(p, { lineupStatus: 'starter' })).toBe(Math.round(base * 1.1))
  })

  it('uncalled ctx reduces value by 5%', () => {
    const p = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const base = calcTransferValue(p)
    expect(calcTransferValue(p, { lineupStatus: 'uncalled' })).toBe(Math.round(base * 0.95))
  })

  it('never exceeds MAX_TRANSFER_VALUE', () => {
    const p = makePlayer({ age: 18, stats: { ...makePlayer().stats, TOT: 300 }, career: { ...makePlayer().career, potential: 99 }, canonTier: 'legendary', seasonStats: { goals: 100, assists: 100, cleanSheets: 100, matchesPlayed: 40, minutesPlayed: 3600 } })
    expect(calcTransferValue(p)).toBeLessThanOrEqual(MAX_TRANSFER_VALUE)
  })
})

// ─── helpers ────────────────────────────────────────────────────────────────

const makeNegotiation = (overrides: Partial<OutgoingNegotiation> = {}): OutgoingNegotiation => ({
  id: 'neg-1',
  playerId: 10,
  playerName: 'Test Player',
  targetClubId: 2,
  targetClubName: 'Team 2',
  phase: 'club_pending',
  currentOffer: 50_000,
  offerRound: 1,
  isFreeAgent: false,
  resolutionDate: '2026-01-03',
  ...overrides,
})

// ─── evaluateClubOffer ───────────────────────────────────────────────────────

describe('evaluateClubOffer', () => {
  it('rejects when offer is below 70% of market value', () => {
    const player = makePlayer({ id: 10, teamId: 2, age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11, 12])
    const players = [
      player,
      makePlayer({ id: 11, teamId: 2, position: 'FW' }),
      makePlayer({ id: 12, teamId: 2, position: 'FW' }),
    ]
    const marketValue = calcTransferValue(player) // ~60000
    const result = evaluateClubOffer(Math.round(marketValue * 0.5), player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('reject')
  })

  it('rejects when critical-position player has no replacement (GK with 0 other GKs)', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'GK' })
    const sellingTeam = makeTeam(2, 100_000, [10]) // only GK
    const players = [player]
    const marketValue = calcTransferValue(player)
    const result = evaluateClubOffer(marketValue * 2, player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('reject')
  })

  it('accepts when offer meets threshold (enough replacements, matching rep)', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'FW', age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11, 12, 13]) // 3 other FWs
    const players = [
      player,
      makePlayer({ id: 11, teamId: 2, position: 'FW' }),
      makePlayer({ id: 12, teamId: 2, position: 'FW' }),
      makePlayer({ id: 13, teamId: 2, position: 'FW' }),
    ]
    // Threshold = marketValue * reputationFactor (rep=50 → 1.25) * no replacement penalty
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * (1 + 50 / 200))
    const result = evaluateClubOffer(threshold, player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('accept')
  })

  it('returns counter when offer is in 85%–99% of threshold', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'FW', age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11, 12, 13])
    const players = [
      player,
      makePlayer({ id: 11, teamId: 2, position: 'FW' }),
      makePlayer({ id: 12, teamId: 2, position: 'FW' }),
      makePlayer({ id: 13, teamId: 2, position: 'FW' }),
    ]
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * (1 + 50 / 200))
    const offerAt90Pct = Math.round(threshold * 0.90)
    const result = evaluateClubOffer(offerAt90Pct, player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('counter')
    if (result.decision === 'counter') {
      expect(result.counterAmount).toBe(Math.round(threshold * 1.05))
    }
  })

  it('applies replacement penalty when only 1 same-position player remains', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'FW', age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11]) // only 1 other FW
    const players = [player, makePlayer({ id: 11, teamId: 2, position: 'FW' })]
    const marketValue = calcTransferValue(player)
    // With penalty: threshold = marketValue * repFactor * 1.15
    const threshold = Math.round(marketValue * (1 + 50 / 200) * 1.15)
    // Offer at exactly marketValue * repFactor (would accept without penalty) → now rejected
    const offerWithoutPenalty = Math.round(marketValue * (1 + 50 / 200))
    const result = evaluateClubOffer(offerWithoutPenalty, player, sellingTeam, players, [sellingTeam])
    // Should not be accept since threshold is higher now
    expect(['reject', 'counter'].includes(result.decision)).toBe(true)
    // Offer at full threshold with penalty → accept
    const result2 = evaluateClubOffer(threshold, player, sellingTeam, players, [sellingTeam])
    expect(result2.decision).toBe('accept')
  })
})

// ─── evaluatePlayerDecision ──────────────────────────────────────────────────

describe('evaluatePlayerDecision', () => {
  it('player with TOT < 65 always accepts regardless of team reputation', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 60 } })
    const poorTeam = makeTeam(1, 100_000)
    poorTeam.reputation = 10
    expect(evaluatePlayerDecision(player, poorTeam)).toBe('accept')
  })

  it('player TOT 65–74: accepts if buyingTeam.reputation >= 30', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 70 } })
    const goodTeam = { ...makeTeam(1, 100_000), reputation: 30 }
    const badTeam = { ...makeTeam(1, 100_000), reputation: 29 }
    expect(evaluatePlayerDecision(player, goodTeam)).toBe('accept')
    expect(evaluatePlayerDecision(player, badTeam)).toBe('reject')
  })

  it('player TOT 75–84: accepts if buyingTeam.reputation >= 50', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 80 } })
    const goodTeam = { ...makeTeam(1, 100_000), reputation: 50 }
    const badTeam = { ...makeTeam(1, 100_000), reputation: 49 }
    expect(evaluatePlayerDecision(player, goodTeam)).toBe('accept')
    expect(evaluatePlayerDecision(player, badTeam)).toBe('reject')
  })

  it('player TOT >= 85: accepts if buyingTeam.reputation >= 70', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 90 } })
    const goodTeam = { ...makeTeam(1, 100_000), reputation: 70 }
    const badTeam = { ...makeTeam(1, 100_000), reputation: 69 }
    expect(evaluatePlayerDecision(player, goodTeam)).toBe('accept')
    expect(evaluatePlayerDecision(player, badTeam)).toBe('reject')
  })
})

// ─── initiateNegotiation ────────────────────────────────────────────────────

describe('initiateNegotiation', () => {
  it('returns null when player is in user team', () => {
    const player = makePlayer({ id: 10, teamId: 1 })
    const career = makeCareer(1)
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000, [10])])
    expect(result).toBeNull()
  })

  it('returns null when active negotiation already exists for player', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ playerId: 10, phase: 'club_pending' })],
    }
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])
    expect(result).toBeNull()
  })

  it('returns null for invalid offer amount', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = makeCareer(1)
    expect(initiateNegotiation(10, -1, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])).toBeNull()
    expect(initiateNegotiation(10, 0, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])).toBeNull()
  })

  it('creates club_pending negotiation for player with a club', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = makeCareer(1)
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])
    expect(result).not.toBeNull()
    expect(result!.outgoingNegotiations).toHaveLength(1)
    expect(result!.outgoingNegotiations[0].phase).toBe('club_pending')
    expect(result!.outgoingNegotiations[0].offerRound).toBe(1)
    expect(result!.outgoingNegotiations[0].isFreeAgent).toBe(false)
  })

  it('creates player_pending negotiation for free agent (teamId null)', () => {
    const player = makePlayer({ id: 10, teamId: null as unknown as number })
    const career = makeCareer(1)
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000)])
    expect(result).not.toBeNull()
    expect(result!.outgoingNegotiations[0].phase).toBe('player_pending')
    expect(result!.outgoingNegotiations[0].isFreeAgent).toBe(true)
  })

  it('sets resolutionDate 2 or 3 days after current date', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = { ...makeCareer(1), season: { ...makeCareer(1).season, currentDate: '2026-03-01' } }
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])
    expect(result).not.toBeNull()
    expect(['2026-03-03', '2026-03-04'].includes(result!.outgoingNegotiations[0].resolutionDate)).toBe(true)
  })
})

// ─── cancelNegotiation ──────────────────────────────────────────────────────

describe('cancelNegotiation', () => {
  it('sets the negotiation phase to cancelled', () => {
    const career = { ...makeCareer(1), outgoingNegotiations: [makeNegotiation({ id: 'neg-1', phase: 'club_pending' })] }
    const result = cancelNegotiation('neg-1', career)
    expect(result.outgoingNegotiations[0].phase).toBe('cancelled')
  })

  it('leaves other negotiations untouched', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [
        makeNegotiation({ id: 'neg-1', phase: 'club_pending' }),
        makeNegotiation({ id: 'neg-2', phase: 'player_pending' }),
      ],
    }
    const result = cancelNegotiation('neg-1', career)
    expect(result.outgoingNegotiations[1].phase).toBe('player_pending')
  })
})

// ─── respondToCounter ────────────────────────────────────────────────────────

describe('respondToCounter', () => {
  const baseCareer = {
    ...makeCareer(1),
    season: { ...makeCareer(1).season, currentDate: '2026-03-01' },
    outgoingNegotiations: [
      makeNegotiation({ id: 'neg-1', phase: 'club_pending', counterAmount: 75_000, offerRound: 1 }),
    ],
  }

  it('accept_counter moves to player_pending and clears counterAmount', () => {
    const result = respondToCounter('neg-1', 'accept_counter', baseCareer)
    const neg = result.outgoingNegotiations[0]
    expect(neg.phase).toBe('player_pending')
    expect(neg.counterAmount).toBeUndefined()
    expect(neg.currentOffer).toBe(75_000)
  })

  it('reject sets phase to failed', () => {
    const result = respondToCounter('neg-1', 'reject', baseCareer)
    expect(result.outgoingNegotiations[0].phase).toBe('failed')
  })

  it('counter increments offerRound and sets new resolutionDate', () => {
    const result = respondToCounter('neg-1', 'counter', baseCareer, 65_000)
    const neg = result.outgoingNegotiations[0]
    expect(neg.offerRound).toBe(2)
    expect(neg.currentOffer).toBe(65_000)
    expect(neg.counterAmount).toBeUndefined()
    expect(['2026-03-03', '2026-03-04'].includes(neg.resolutionDate)).toBe(true)
  })

  it('counter is blocked when offerRound >= 3', () => {
    const career = {
      ...baseCareer,
      outgoingNegotiations: [makeNegotiation({ id: 'neg-1', phase: 'club_pending', counterAmount: 75_000, offerRound: 3 })],
    }
    const result = respondToCounter('neg-1', 'counter', career, 70_000)
    // Returns unchanged career
    expect(result.outgoingNegotiations[0].offerRound).toBe(3)
  })

  it('returns unchanged career when negotiation has no counterAmount', () => {
    const career = {
      ...baseCareer,
      outgoingNegotiations: [makeNegotiation({ id: 'neg-1', phase: 'club_pending' })],
    }
    const result = respondToCounter('neg-1', 'accept_counter', career)
    expect(result).toBe(career)
  })
})

describe('resolveNegotiations', () => {
  const userTeam = makeTeam(1, 1_000_000, [])
  const sellingTeam = { ...makeTeam(2, 100_000, [10, 11, 12]), reputation: 50 }
  const player = makePlayer({
    id: 10,
    teamId: 2,
    position: 'FW',
    age: 25,
    stats: { ...makePlayer().stats, TOT: 50 },
    career: { ...makePlayer().career, potential: 50 },
  })
  const otherFW1 = makePlayer({ id: 11, teamId: 2, position: 'FW' })
  const otherFW2 = makePlayer({ id: 12, teamId: 2, position: 'FW' })
  const allPlayers = [player, otherFW1, otherFW2]

  it('skips negotiations where resolutionDate is in the future', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', resolutionDate: '2026-01-05' })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('club_pending')
  })

  it('skips club_pending when counterAmount is set (waiting for user)', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', counterAmount: 80_000, resolutionDate: '2026-01-01' })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].counterAmount).toBe(80_000)
  })

  it('club_pending resolves to player_pending when club accepts (high offer)', () => {
    // Threshold = calcTransferValue(player) * (1 + 50/200) * 1.0 (3 same-pos → no penalty)
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * 1.25)
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', currentOffer: threshold, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    const neg = result.career.outgoingNegotiations[0]
    expect(neg.phase).toBe('player_pending')
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_CLUB_ACCEPTED')).toBe(true)
  })

  it('club_pending sets counterAmount when club makes counter-offer', () => {
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * 1.25)
    const offerAt90pct = Math.round(threshold * 0.90)
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', currentOffer: offerAt90pct, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    const neg = result.career.outgoingNegotiations[0]
    expect(neg.counterAmount).toBeDefined()
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_CLUB_COUNTER')).toBe(true)
  })

  it('club_pending sets failed when club rejects (low offer)', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', currentOffer: 1_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('failed')
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_CLUB_REJECTED')).toBe(true)
  })

  it('player_pending resolves to player_accepted when player accepts (low TOT, any rep)', () => {
    const lowTotPlayer = makePlayer({ id: 10, teamId: 2, stats: { ...makePlayer().stats, TOT: 50 } })
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'player_pending', currentOffer: 50_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', [lowTotPlayer, otherFW1, otherFW2], [userTeam, sellingTeam])
    // Player accepted → waits for user confirmation
    expect(result.career.outgoingNegotiations[0].phase).toBe('player_accepted')
    // Player not yet moved (transfer pending user confirmation)
    const notTransferred = result.players.find((p) => p.id === 10)
    expect(notTransferred?.teamId).toBe(2)
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_PLAYER_ACCEPTED')).toBe(true)
  })

  it('player_pending sets failed when player rejects (high TOT, low rep)', () => {
    const starPlayer = makePlayer({ id: 10, teamId: 2, stats: { ...makePlayer().stats, TOT: 90 } })
    const poorRepTeam = { ...userTeam, reputation: 30 } // < 70 needed for TOT 90
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'player_pending', currentOffer: 50_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', [starPlayer, otherFW1, otherFW2], [poorRepTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('failed')
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_PLAYER_REJECTED')).toBe(true)
  })

  it('player_pending fails gracefully when user team has insufficient budget', () => {
    const brokTeam = { ...userTeam, budget: 100 }
    const lowTotPlayer = makePlayer({ id: 10, teamId: 2, stats: { ...makePlayer().stats, TOT: 50 } })
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'player_pending', currentOffer: 500_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', [lowTotPlayer, otherFW1, otherFW2], [brokTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('failed')
    // Player NOT transferred
    const p = result.players.find((p) => p.id === 10)
    expect(p?.teamId).toBe(2)
  })
})
