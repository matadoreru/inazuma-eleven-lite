import { describe, it, expect } from 'vitest'
import { trainPlayer } from '../services/trainingService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'

function makePlayer(id = 1): Player {
  return {
    id,
    name: 'P',
    nameRomaji: 'P',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 10,
      potential: 80,
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

describe('trainPlayer with DifficultySettings', () => {
  it('gives +1 stat on Normal difficulty', () => {
    const players = [makePlayer(1)]
    const result = trainPlayer(1, 'TEC', players, DEFAULT_DIFFICULTY)
    expect(result[0].stats.TEC).toBe(51)
  })

  it('gives +2 stat at 2.0x multiplier', () => {
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 2.0 }
    const result = trainPlayer(1, 'TEC', [makePlayer(1)], settings)
    expect(result[0].stats.TEC).toBe(52)
  })

  it('gives at least +1 stat even at 0.1x multiplier (floor)', () => {
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 0.1 }
    const result = trainPlayer(1, 'TEC', [makePlayer(1)], settings)
    expect(result[0].stats.TEC).toBe(51)
  })

  it('does not train an injured player', () => {
    const p = { ...makePlayer(1), isInjured: true }
    const result = trainPlayer(1, 'TEC', [p], DEFAULT_DIFFICULTY)
    expect(result[0].stats.TEC).toBe(50)
  })
})
