import { describe, it, expect } from 'vitest'
import { calcMatchDifficulty, calcRewardQuality, difficultyToTier, generateMatchRewards, rewardQualityToRarity } from '../services/rewardService'
import type { Match } from '../types/competition'
import type { Team } from '../types/team'
import type { Player } from '../types/player'

function makeTeam(rep: number, id = 1): Team {
  return {
    id,
    name: `Team${id}`,
    tier: 1,
    reputation: rep,
    budget: 100_000,
    leagueId: 'first_division',
    captainId: 1,
    formation: { id: 1, name: '4-4-2', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 },
    lineup: [],
    playerIds: [],
  }
}

function makeMatch(type: 'league' | 'cup' = 'league'): Match {
  return {
    id: 'm1',
    leagueId: 'first_division',
    type,
    round: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    date: '2026-01-01',
    played: false,
    homeGoals: 0,
    awayGoals: 0,
    result: null,
  }
}

function makePlayer(id: number, position: Player['position'] = 'FW'): Player {
  return {
    id,
    name: `Player ${id}`,
    nameRomaji: `Player ${id}`,
    gender: 'Masculino',
    position,
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 10,
      potential: 80,
      growthRate: 1,
      contractStatus: 'contracted',
      marketValue: 100_000,
      salary: 5_000,
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
    jerseyNumber: id,
  }
}

describe('calcMatchDifficulty', () => {
  it('returns 0 when rival is weaker (rival=40, user=80)', () => {
    expect(calcMatchDifficulty(40, 80, false)).toBe(0)
  })

  it('returns 0 when equal, league match (both 70)', () => {
    expect(calcMatchDifficulty(70, 70, false)).toBe(0)
  })

  it('adds 0.25 for cup match (equal reps, cup → 0.25)', () => {
    expect(calcMatchDifficulty(70, 70, true)).toBeCloseTo(0.25, 5)
  })

  it('adds cup bonus without exceeding cap (rival=100, user=0, cup=true → 1.25)', () => {
    expect(calcMatchDifficulty(100, 0, true)).toBe(1.25)
  })

  it('proportional to gap (rival=80, user=60, league → ~0.2)', () => {
    expect(calcMatchDifficulty(80, 60, false)).toBeCloseTo(0.2, 5)
  })
})

describe('difficultyToTier', () => {
  it('0 → 1', () => {
    expect(difficultyToTier(0)).toBe(1)
  })

  it('0.49 → 1', () => {
    expect(difficultyToTier(0.49)).toBe(1)
  })

  it('0.5 → 2', () => {
    expect(difficultyToTier(0.5)).toBe(2)
  })

  it('0.99 → 2', () => {
    expect(difficultyToTier(0.99)).toBe(2)
  })

  it('1.0 → 3', () => {
    expect(difficultyToTier(1.0)).toBe(3)
  })

  it('1.5 → 3', () => {
    expect(difficultyToTier(1.5)).toBe(3)
  })
})

describe('calcRewardQuality', () => {
  it('boosts rewards a lot on victory', () => {
    expect(calcRewardQuality(0.6, 'win', 2)).toBeCloseTo(1.4, 5)
  })

  it('slightly lowers rewards on draw', () => {
    expect(calcRewardQuality(0.6, 'draw', 0)).toBeCloseTo(0.55, 5)
  })

  it('heavily penalizes rewards on loss', () => {
    expect(calcRewardQuality(0.9, 'loss', 3)).toBeCloseTo(0, 5)
  })
})

describe('rewardQualityToRarity', () => {
  it('maps low quality to common', () => {
    expect(rewardQualityToRarity(0.1)).toBe('common')
  })

  it('maps medium quality to special', () => {
    expect(rewardQualityToRarity(0.6)).toBe('special')
  })

  it('maps top quality to legendary', () => {
    expect(rewardQualityToRarity(1.4)).toBe('legendary')
  })
})

describe('generateMatchRewards', () => {
  const match = makeMatch('league')
  const userTeam = makeTeam(70, 1)
  const rivalTeam = makeTeam(80, 2)
  const starters = [makePlayer(1, 'FW'), makePlayer(2, 'MD'), makePlayer(3, 'GK')]

  it('returns exactly rewardChoices items (3)', () => {
    const rewards = generateMatchRewards(match, userTeam, rivalTeam, starters, 3)
    expect(rewards).toHaveLength(3)
  })

  it('returns exactly rewardChoices items (2)', () => {
    const rewards = generateMatchRewards(match, userTeam, rivalTeam, starters, 2)
    expect(rewards).toHaveLength(2)
  })

  it('returns exactly rewardChoices items (1)', () => {
    const rewards = generateMatchRewards(match, userTeam, rivalTeam, starters, 1)
    expect(rewards).toHaveLength(1)
  })

  it('all rewards have valid type (run 10 times)', () => {
    const validTypes = new Set(['technique_book', 'money', 'stat_boost', 'equipment'])
    for (let i = 0; i < 10; i++) {
      const rewards = generateMatchRewards(match, userTeam, rivalTeam, starters, 3)
      for (const reward of rewards) {
        expect(validTypes.has(reward.type)).toBe(true)
      }
    }
  })

  it('money reward has positive moneyAmount (run 20 times)', () => {
    let found = false
    for (let i = 0; i < 20; i++) {
      const rewards = generateMatchRewards(match, userTeam, rivalTeam, starters, 4)
      const moneyReward = rewards.find(r => r.type === 'money')
      if (moneyReward) {
        found = true
        expect(moneyReward.moneyAmount).toBeDefined()
        expect(moneyReward.moneyAmount!).toBeGreaterThan(0)
      }
    }
    // At least one run should produce a money reward across 20 iterations with 4 choices
    expect(found).toBe(true)
  })

  it('equipment reward has valid slot (run 20 times)', () => {
    const validSlots = new Set(['gloves', 'boots', 'pendant', 'bracelet'])
    let found = false
    for (let i = 0; i < 20; i++) {
      const rewards = generateMatchRewards(match, userTeam, rivalTeam, starters, 4)
      const equipReward = rewards.find(r => r.type === 'equipment')
      if (equipReward) {
        found = true
        expect(equipReward.equipmentItem).toBeDefined()
        expect(validSlots.has(equipReward.equipmentItem!.slot)).toBe(true)
      }
    }
    expect(found).toBe(true)
  })

  it('upgrades all reward ranges after a hard win', () => {
    const hardMatch = makeMatch('cup')
    const rewards = generateMatchRewards(
      hardMatch,
      makeTeam(40, 1),
      makeTeam(100, 2),
      starters,
      4,
      { homeGoals: 3, awayGoals: 0 },
    )

    expect(rewards.every((r) => r.rarity === 'legendary')).toBe(true)
    expect(rewards.find((r) => r.type === 'money')?.moneyAmount).toBeGreaterThanOrEqual(75_000)
    expect(rewards.find((r) => r.type === 'equipment')?.equipmentItem?.tier).toBe(3)
    expect(rewards.find((r) => r.type === 'technique_book')?.techniqueBook?.technique.POT).toBeGreaterThanOrEqual(82)
    expect(rewards.find((r) => r.type === 'stat_boost')?.statBoost?.amount).toBeGreaterThanOrEqual(6)
  })

  it('downgrades all reward ranges after a hard loss', () => {
    const hardMatch = makeMatch('cup')
    const rewards = generateMatchRewards(
      hardMatch,
      makeTeam(40, 1),
      makeTeam(100, 2),
      starters,
      4,
      { homeGoals: 0, awayGoals: 3 },
    )

    expect(rewards.every((r) => r.rarity === 'common')).toBe(true)
    expect(rewards.find((r) => r.type === 'money')?.moneyAmount).toBeLessThanOrEqual(15_000)
    expect(rewards.find((r) => r.type === 'equipment')?.equipmentItem?.tier).toBe(1)
    expect(rewards.find((r) => r.type === 'technique_book')?.techniqueBook?.technique.POT).toBeLessThanOrEqual(28)
    expect(rewards.find((r) => r.type === 'stat_boost')?.statBoost?.amount).toBeLessThanOrEqual(2)
  })
})
