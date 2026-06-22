import { describe, it, expect } from 'vitest'
import {
  advancePositionChange,
  calcPositionChangeDays,
  getPositionChangeTargets,
  startOrResetPositionChange,
} from '../services/positionChangeService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'P',
    nameRomaji: 'P',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 130, TOT: 50 },
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
    ...overrides,
  } as Player
}

describe('calcPositionChangeDays with DifficultySettings', () => {
  it('returns 0 if current and target position are the same', () => {
    const player = makePlayer({ position: 'MD' })
    expect(calcPositionChangeDays(player, 'MD', DEFAULT_DIFFICULTY)).toBe(0)
  })

  it('at 0.75x (Easy), adjacent change takes fewer days than Normal', () => {
    const player = makePlayer({ position: 'MD' })
    const easySettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, positionChangeDaysMultiplier: 0.75 }
    const normalDays = calcPositionChangeDays(player, 'FW', DEFAULT_DIFFICULTY)
    const easyDays = calcPositionChangeDays(player, 'FW', easySettings)
    expect(easyDays).toBeLessThan(normalDays)
  })

  it('at 1.5x (Hard), adjacent change takes more days than Normal', () => {
    const player = makePlayer({ position: 'MD' })
    const hardSettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, positionChangeDaysMultiplier: 1.5 }
    const normalDays = calcPositionChangeDays(player, 'FW', DEFAULT_DIFFICULTY)
    const hardDays = calcPositionChangeDays(player, 'FW', hardSettings)
    expect(hardDays).toBeGreaterThan(normalDays)
  })

  it('result is always within [14, 84] bounds', () => {
    const player = makePlayer({ position: 'MD' })
    const extremeSettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, positionChangeDaysMultiplier: 0.1 }
    const days = calcPositionChangeDays(player, 'GK', extremeSettings)
    expect(days).toBeGreaterThanOrEqual(14)
    expect(days).toBeLessThanOrEqual(84)
  })
})

describe('position change targets', () => {
  it.each([
    ['GK', ['DF', 'MD', 'FW']],
    ['DF', ['GK', 'MD', 'FW']],
    ['MD', ['GK', 'DF', 'FW']],
    ['FW', ['GK', 'DF', 'MD']],
  ] as const)('allows %s to change to every role except its current one', (current, expected) => {
    expect(getPositionChangeTargets(current)).toEqual(expected)
  })

  it('starts every valid destination for a defender', () => {
    const defender = makePlayer({ position: 'DF' })
    for (const target of getPositionChangeTargets('DF')) {
      const updated = startOrResetPositionChange(defender, target, '2026-01-01', DEFAULT_DIFFICULTY)
      expect(updated.career.positionChangePlan?.targetPosition).toBe(target)
    }
  })

  it('promotes the target to primary position and keeps the old role as alternate', () => {
    const defender = makePlayer({ position: 'DF', positionAlt: 'MD' })
    const training = startOrResetPositionChange(defender, 'FW', '2026-01-01', DEFAULT_DIFFICULTY)
    const completed = advancePositionChange(training, training.career.positionChangePlan!.daysRequired)
    expect(completed.position).toBe('FW')
    expect(completed.positionAlt).toBe('DF')
    expect(completed.career.positionAlt).toBe('DF')
    expect(completed.career.positionChangePlan?.completed).toBe(true)
  })

  it('allows promoting an existing alternate role to primary position', () => {
    const defender = makePlayer({ position: 'DF', positionAlt: 'MD' })
    const training = startOrResetPositionChange(defender, 'MD', '2026-01-01', DEFAULT_DIFFICULTY)
    expect(training.career.positionChangePlan?.targetPosition).toBe('MD')
  })
})
