import { describe, it, expect } from 'vitest'
import { drainStaminaAfterMatch } from '../services/energyService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'

function makePlayer(id: number): Player {
  return {
    id,
    name: `P${id}`,
    nameRomaji: `P${id}`,
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 5,
      potential: 60,
      growthRate: 1.0,
      contractStatus: 'contracted',
      marketValue: 10000,
      salary: 500,
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
    jerseyNumber: 1,
  } as Player
}

const normalSettings: DifficultySettings = DEFAULT_DIFFICULTY
const easySettings: DifficultySettings = {
  ...DEFAULT_DIFFICULTY,
  starterStaminaDrain: 20,
  benchStaminaDrain: 6,
}
const hardSettings: DifficultySettings = {
  ...DEFAULT_DIFFICULTY,
  starterStaminaDrain: 30,
  benchStaminaDrain: 10,
}

describe('drainStaminaAfterMatch', () => {
  it('drains starterStaminaDrain from starters (normal)', () => {
    const players = [makePlayer(1)]
    const starters = new Set([1])
    const bench = new Set<number>()
    const result = drainStaminaAfterMatch(players, starters, bench, normalSettings)
    expect(result[0].stamina).toBe(100 - 25)
  })

  it('drains benchStaminaDrain from bench (normal)', () => {
    const players = [makePlayer(1)]
    const starters = new Set<number>()
    const bench = new Set([1])
    const result = drainStaminaAfterMatch(players, starters, bench, normalSettings)
    expect(result[0].stamina).toBe(100 - 8)
  })

  it('uses easy settings (starterStaminaDrain=20)', () => {
    const players = [makePlayer(1)]
    const starters = new Set([1])
    const result = drainStaminaAfterMatch(players, starters, new Set(), easySettings)
    expect(result[0].stamina).toBe(100 - 20)
  })

  it('uses hard settings (starterStaminaDrain=30)', () => {
    const players = [makePlayer(1)]
    const starters = new Set([1])
    const result = drainStaminaAfterMatch(players, starters, new Set(), hardSettings)
    expect(result[0].stamina).toBe(100 - 30)
  })

  it('does not drain players not in starter or bench', () => {
    const players = [makePlayer(1)]
    const result = drainStaminaAfterMatch(players, new Set(), new Set(), normalSettings)
    expect(result[0].stamina).toBe(100)
  })

  it('clamps stamina to 0 (cannot go negative)', () => {
    const p = { ...makePlayer(1), stamina: 5 }
    const result = drainStaminaAfterMatch([p], new Set([1]), new Set(), normalSettings)
    expect(result[0].stamina).toBe(0)
  })
})
