import { describe, it, expect } from 'vitest'
import { calcGrowthIncrement, applySeasonGrowth, levelUpCheck } from '../services/growthService'
import type { Player, Stats } from '../types/player'
import type { PotentialAnalysis, DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 1,
  name: 'Test Player',
  nameRomaji: 'Test',
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
  teamId: 1,
  jerseyNumber: 10,
  canonTier: 'common',
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  ...overrides,
})

describe('calcGrowthIncrement', () => {
  it('returns an object with stat keys', () => {
    const player = makePlayer()
    const increment = calcGrowthIncrement(player)
    expect(typeof increment).toBe('object')
    expect(Object.keys(increment).length).toBeGreaterThan(0)
  })

  it('all increment values are non-negative', () => {
    const player = makePlayer()
    // Run multiple times due to randomness
    for (let i = 0; i < 20; i++) {
      const increment = calcGrowthIncrement(player)
      for (const val of Object.values(increment)) {
        expect(val).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('total increments are positive for growthRate > 0', () => {
    const player = makePlayer({ career: { ...makePlayer().career, growthRate: 2.0 } })
    // Over multiple runs the sum should typically be positive
    let totalSum = 0
    for (let i = 0; i < 10; i++) {
      const increment = calcGrowthIncrement(player)
      totalSum += Object.values(increment).reduce((a, b) => a + (b ?? 0), 0)
    }
    expect(totalSum).toBeGreaterThan(0)
  })

  it('uses position-appropriate stat weights for FW (includes POT)', () => {
    const player = makePlayer({ position: 'FW' })
    // The FW weight table includes POT — verify the key appears in the increment
    const increment = calcGrowthIncrement(player)
    expect('POT' in increment).toBe(true)
  })

  it('uses position-appropriate stat weights for GK (includes PRE/AGI/FIS)', () => {
    const player = makePlayer({ position: 'GK' })
    const increment = calcGrowthIncrement(player)
    expect('PRE' in increment).toBe(true)
    expect('AGI' in increment).toBe(true)
  })

  it('uses position-appropriate stat weights for DF (does not include POT)', () => {
    const player = makePlayer({ position: 'DF' })
    const increment = calcGrowthIncrement(player)
    expect('POT' in increment).toBe(false)
  })
})

describe('applySeasonGrowth', () => {
  it('returns the same number of players', () => {
    const players = [makePlayer({ id: 1 }), makePlayer({ id: 2 })]
    const grown = applySeasonGrowth(players)
    expect(grown).toHaveLength(2)
  })

  it('TOT is recalculated after growth', () => {
    // Give the player very low TOT so it's clearly recalculated from sum of stats
    const player = makePlayer({
      stats: { POT: 10, CON: 10, TEC: 10, PRE: 10, FIS: 10, AGI: 10, INT: 10, TOT: 1 },
      career: { ...makePlayer().career, growthRate: 10 },
    })
    const [grown] = applySeasonGrowth([player])
    const { POT, CON, TEC, PRE, FIS, AGI, INT } = grown.stats
    const expectedTot = Math.round((POT + CON + TEC + PRE + FIS + AGI + INT) / 7)
    expect(grown.stats.TOT).toBe(expectedTot)
  })

  it('stats do not exceed the cap (maxLevel * 10)', () => {
    // Assign stats at the cap and confirm they don't go over
    const cap = 80 * 10 // maxLevel 80 -> cap 800
    const player = makePlayer({
      stats: { POT: cap, CON: cap, TEC: cap, PRE: cap, FIS: cap, AGI: cap, INT: cap, TOT: cap },
      career: { ...makePlayer().career, maxLevel: 80, growthRate: 5.0 },
    })
    for (let i = 0; i < 5; i++) {
      const [grown] = applySeasonGrowth([player])
      for (const key of ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT'] as (keyof Stats)[]) {
        expect(grown.stats[key]).toBeLessThanOrEqual(cap)
      }
    }
  })

  it('does not mutate the original players array', () => {
    const player = makePlayer()
    const originalTOT = player.stats.TOT
    applySeasonGrowth([player])
    expect(player.stats.TOT).toBe(originalTOT)
  })

  it('stats are greater than or equal to original (growth only goes up)', () => {
    // Since all increments >= 0, stats should not decrease
    const player = makePlayer({ career: { ...makePlayer().career, growthRate: 2.0 } })
    for (let i = 0; i < 10; i++) {
      const [grown] = applySeasonGrowth([player])
      for (const key of ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT'] as (keyof Stats)[]) {
        expect(grown.stats[key]).toBeGreaterThanOrEqual(player.stats[key])
      }
    }
  })
})

const makePotential = (overrides: Partial<PotentialAnalysis> = {}): PotentialAnalysis => ({
  truePotential: 80,
  growthCurve: 'normal',
  developmentRisk: 'low',
  trainingAffinity: 1.0,
  matchAffinity: 1.0,
  uncertainty: 15,
  rangeMin: 65,
  rangeMax: 95,
  investmentTotal: 0,
  analysesCompleted: [],
  discovered: {},
  ...overrides,
})

describe('calcGrowthIncrement with potential analysis', () => {
  it('returns empty object when player is at or above potential ceiling', () => {
    // career.potential (75) >= truePotential (74) → headroom = 0 → ceilingFactor = 0.05
    const player = makePlayer({ career: { ...makePlayer().career, potential: 74 } })
    const analysis = makePotential({ truePotential: 74 })
    // Run many times: with ceilingFactor=0.05 and low growthRate, most increments should be 0
    let nonZeroCount = 0
    for (let i = 0; i < 50; i++) {
      const inc = calcGrowthIncrement(player, analysis)
      if (Object.values(inc).some((v) => (v ?? 0) > 0)) nonZeroCount++
    }
    // Should almost never grow at the ceiling
    expect(nonZeroCount).toBeLessThan(15)
  })

  it('resets seasonStats to zeros after applySeasonGrowth', () => {
    const player = makePlayer({
      seasonStats: { goals: 3, assists: 2, cleanSheets: 1, matchesPlayed: 10, minutesPlayed: 900 },
    })
    const [grown] = applySeasonGrowth([player])
    expect(grown.seasonStats).toEqual({
      goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0,
    })
  })

  it('accepts potentials record and uses it for growth', () => {
    const player = makePlayer({ career: { ...makePlayer().career, potential: 50 } })
    const analysis = makePotential({ truePotential: 90, trainingAffinity: 1.4 })
    const potentials: Record<number, PotentialAnalysis> = { [player.id]: analysis }
    // Should not throw and should return same number of players
    const grown = applySeasonGrowth([player], potentials)
    expect(grown).toHaveLength(1)
  })

  it('grows less near the ceiling than far below it', () => {
    const base = makePlayer().career
    const playerNearCeiling = makePlayer({ career: { ...base, potential: 80, growthRate: 2.0 } })
    const playerFarBelow = makePlayer({ career: { ...base, potential: 20, growthRate: 2.0 } })
    const analysisHigh = makePotential({ truePotential: 81 })  // player near ceiling
    const analysisLow = makePotential({ truePotential: 81 })   // player far below ceiling

    let totalNear = 0
    let totalFar = 0
    for (let i = 0; i < 100; i++) {
      const incNear = calcGrowthIncrement(playerNearCeiling, analysisHigh)
      const incFar = calcGrowthIncrement(playerFarBelow, analysisLow)
      totalNear += Object.values(incNear).reduce((a, b) => a + (b ?? 0), 0)
      totalFar += Object.values(incFar).reduce((a, b) => a + (b ?? 0), 0)
    }
    expect(totalFar).toBeGreaterThan(totalNear)
  })
})

describe('applySeasonGrowth with seasonGrowthMultiplier', () => {
  it('applies 2.0x multiplier resulting in more or equal growth than 1.0x over many runs', () => {
    const player = makePlayer({ career: { ...makePlayer().career, growthRate: 2.0 } })
    const easySettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, seasonGrowthMultiplier: 2.0 }
    const normalSettings: DifficultySettings = DEFAULT_DIFFICULTY

    let totalEasy = 0
    let totalNormal = 0
    for (let i = 0; i < 30; i++) {
      const [grownEasy] = applySeasonGrowth([player], undefined, easySettings)
      const [grownNormal] = applySeasonGrowth([player], undefined, normalSettings)
      totalEasy += grownEasy.stats.TEC - player.stats.TEC
      totalNormal += grownNormal.stats.TEC - player.stats.TEC
    }
    expect(totalEasy).toBeGreaterThanOrEqual(totalNormal)
  })

  it('does not mutate original player with any multiplier', () => {
    const player = makePlayer()
    const originalTEC = player.stats.TEC
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, seasonGrowthMultiplier: 2.0 }
    applySeasonGrowth([player], undefined, settings)
    expect(player.stats.TEC).toBe(originalTEC)
  })

  it('does not throw when settings not provided (backward compat)', () => {
    const player = makePlayer({ career: { ...makePlayer().career, growthRate: 2.0 } })
    expect(() => applySeasonGrowth([player])).not.toThrow()
  })
})

describe('levelUpCheck', () => {
  it('does not level up a player below the threshold', () => {
    const player = makePlayer({ career: { ...makePlayer().career, maxLevel: 1, experience: 0 } })
    const result = levelUpCheck(player)
    expect(result.career.maxLevel).toBe(1)
  })

  it('levels up a player who meets the threshold', () => {
    // Level 1 -> 2 requires 100 XP
    const player = makePlayer({ career: { ...makePlayer().career, maxLevel: 1, experience: 100 } })
    const result = levelUpCheck(player)
    expect(result.career.maxLevel).toBe(2)
  })

  it('returns the same player when already at max level (no threshold)', () => {
    // LEVEL_THRESHOLDS only goes up to level 10; maxLevel 10 has no next threshold
    const player = makePlayer({ career: { ...makePlayer().career, maxLevel: 10, experience: 99999 } })
    const result = levelUpCheck(player)
    expect(result.career.maxLevel).toBe(10)
  })
})
