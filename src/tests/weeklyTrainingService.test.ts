import { describe, it, expect } from 'vitest'
import { executeWeeklyPlan } from '../services/weeklyTrainingService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player, Stats } from '../types/player'
import type { WeeklyTrainingPlan } from '../types/training'
import type { Career } from '../types/career'

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
    canonTier: "common",
    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  } as Player
}

function makeCareer(settings: DifficultySettings = DEFAULT_DIFFICULTY): Career {
  return {
    id: 'c1',
    managerName: 'Test',
    managerAvatar: '',
    teamId: 1,
    season: {} as Career['season'],
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
    inventory: { techniqueBooks: {}, equipmentItems: [], generatedBooks: {} },
    allLeagueSeasons: {},
    cup: null,
    seasonStatus: 'active',
    lastSeasonReview: null,
    outgoingNegotiations: [],
    difficulty: settings,
    nameStyle: 'western' as const,
    createdAt: '2026-01-01',
    lastSavedAt: '2026-01-01',
  }
}

function makePlan(playerId: number, stat: keyof Stats): WeeklyTrainingPlan {
  return {
    slots: [{ playerId, trainingType: 'stat', statTarget: stat }],
    weekStartDate: '2026-01-01',
    executed: false,
  }
}

describe('executeWeeklyPlan stat training gain', () => {
  it('gives base gain of 2 on Normal difficulty', () => {
    const player = makePlayer(1)
    const plan = makePlan(1, 'TEC')
    const career = makeCareer(DEFAULT_DIFFICULTY)
    const { players } = executeWeeklyPlan(plan, [player], career, DEFAULT_DIFFICULTY)
    expect(players[0].stats.TEC).toBe(50 + 2)
  })

  it('gives more stat gain on Easy (1.4x → round(2*1.4)=3)', () => {
    const player = makePlayer(1)
    const plan = makePlan(1, 'TEC')
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 1.4 }
    const career = makeCareer(settings)
    const { players } = executeWeeklyPlan(plan, [player], career, settings)
    expect(players[0].stats.TEC).toBe(50 + 3)
  })

  it('gives min 1 stat gain at 0.5x (max(1, round(2*0.5))=1)', () => {
    const player = makePlayer(1)
    const plan = makePlan(1, 'TEC')
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 0.5 }
    const career = makeCareer(settings)
    const { players } = executeWeeklyPlan(plan, [player], career, settings)
    expect(players[0].stats.TEC).toBe(50 + 1)
  })
})
