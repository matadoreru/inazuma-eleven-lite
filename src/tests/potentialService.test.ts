import { describe, it, expect } from 'vitest'
import { calcAnalysisCost } from '../services/potentialService'
import type { DifficultySettings, PotentialAnalysis } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Team } from '../types/team'
import type { Player } from '../types/player'

function makeTeam(): Team {
  return {
    id: 1, name: 'T', tier: 2, reputation: 60, budget: 500_000,
    leagueId: 'first_division', captainId: 1,
    formation: { id: 1, name: '4-4-2', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 },
    lineup: [], playerIds: [],
    scoutLevel: 1,
    facilitiesLevel: 1,
  }
}

function makePlayer(): Player {
  return {
    id: 1, name: 'P', nameRomaji: 'P', gender: 'Masculino',
    position: 'MD', positionAlt: null, element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 5, potential: 60, growthRate: 1.0,
      contractStatus: 'contracted', marketValue: 100_000,
      salary: 500, experience: 0, trainingProgress: 0,
      trainingSessionsThisWeek: 0, positionAlt: null,
    },
    techniques: [], spriteUrl: '', stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0,
    isSuspended: false, suspensionMatches: 0,
    age: 22, teamId: 1, jerseyNumber: 1,
    canonTier: "common",
    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  } as Player
}

function makeAnalysis(): PotentialAnalysis {
  return {
    truePotential: 75, growthCurve: 'normal', developmentRisk: 'low',
    trainingAffinity: 1.0, matchAffinity: 1.0,
    uncertainty: 22, rangeMin: 53, rangeMax: 97,
    investmentTotal: 0, analysesCompleted: [], discovered: {},
  }
}

describe('calcAnalysisCost with scoutCostMultiplier', () => {
  it('returns a positive cost on Normal', () => {
    const cost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), DEFAULT_DIFFICULTY)
    expect(cost).toBeGreaterThan(0)
  })

  it('at 0.75x (Easy), cost is less than Normal', () => {
    const easySettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, scoutCostMultiplier: 0.75 }
    const normalCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), DEFAULT_DIFFICULTY)
    const easyCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), easySettings)
    expect(easyCost).toBeLessThan(normalCost)
  })

  it('at 1.5x (Hard), cost is more than Normal', () => {
    const hardSettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, scoutCostMultiplier: 1.5 }
    const normalCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), DEFAULT_DIFFICULTY)
    const hardCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), hardSettings)
    expect(hardCost).toBeGreaterThan(normalCost)
  })
})
