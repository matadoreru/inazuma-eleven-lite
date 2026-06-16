import type { Player } from '../types/player'
import type { Stats } from '../types/player'
import type { DifficultySettings } from '../types/career'

export const MAX_TRAINING_SESSIONS_PER_WEEK = 3

export function calcFatigue(player: Player): number {
  // Fatigue is derived from stamina: lower stamina → higher fatigue (0–100 scale)
  return Math.max(0, 100 - player.stamina)
}

export function trainPlayer(playerId: number, stat: keyof Stats, players: Player[], settings: DifficultySettings): Player[] {
  return players.map((p) => {
    if (p.id !== playerId) return p
    if (p.career.trainingSessionsThisWeek >= MAX_TRAINING_SESSIONS_PER_WEEK) return p
    if (p.isInjured || p.stamina < 20) return p

    // Each training session improves the chosen stat, capped at maxLevel * 10
    const currentStatValue = p.stats[stat]
    const cap = stat === 'TOT' ? p.career.maxLevel * 10 : p.career.maxLevel * 10
    const gain = Math.max(1, Math.round(settings.trainingGainMultiplier))
    const newStatValue = Math.min(currentStatValue + gain, cap)

    // Recalculate TOT (average of all 7 base stats)
    const newStats = { ...p.stats, [stat]: newStatValue }
    if (stat !== 'TOT') {
      const { POT, CON, TEC, PRE, FIS, AGI, INT } = newStats
      newStats.TOT = Math.round((POT + CON + TEC + PRE + FIS + AGI + INT) / 7)
    }

    // Training costs stamina
    const staminaCost = 10 + Math.floor(calcFatigue(p) * 0.1)
    const newStamina = Math.max(0, p.stamina - staminaCost)

    return {
      ...p,
      stats: newStats,
      stamina: newStamina,
      career: {
        ...p.career,
        trainingSessionsThisWeek: p.career.trainingSessionsThisWeek + 1,
        trainingProgress: p.career.trainingProgress + 1,
        experience: p.career.experience + 10,
      },
    }
  })
}

export function restPlayer(playerId: number, players: Player[]): Player[] {
  return players.map((p) => {
    if (p.id !== playerId) return p
    return {
      ...p,
      stamina: Math.min(100, p.stamina + 30),
      morale: Math.min(100, p.morale + 5),
    }
  })
}

export function resetWeeklyTraining(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    career: {
      ...p.career,
      trainingSessionsThisWeek: 0,
    },
  }))
}
