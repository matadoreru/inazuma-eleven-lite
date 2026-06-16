import type { Player, Stats } from '../types/player'
import type { Career, DifficultySettings } from '../types/career'
import type { WeeklyTrainingPlan } from '../types/training'
import { advancePositionChange } from './positionChangeService'
import { learnTechnique, canLearn } from './techniqueService'
import { getTechniqueBook } from '../data/techniqueBooks'

// Stat gain per training week (adjusted by trainingAffinity if analysed)
const STAT_GAIN_PER_WEEK = 2
// Stamina cost for a training week
const STAT_TRAINING_STAMINA_COST = 15
// Rest stamina recovery per week
const REST_STAMINA_GAIN = 30
const REST_MORALE_GAIN = 10

function getTrainingAffinity(playerId: number, career: Career): number {
  const analysis = career.playerPotential?.[playerId]
  return analysis?.discovered?.trainingAffinity ?? 1.0
}

export function executeWeeklyPlan(
  plan: WeeklyTrainingPlan,
  players: Player[],
  career: Career,
  settings: DifficultySettings,
): { players: Player[]; career: Career } {
  let updatedPlayers = [...players]
  let updatedCareer = career

  for (const slot of plan.slots) {
    const idx = updatedPlayers.findIndex((p) => p.id === slot.playerId)
    if (idx === -1) continue
    let player = updatedPlayers[idx]

    switch (slot.trainingType) {
      case 'stat': {
        if (!slot.statTarget) break
        if (player.isInjured || player.stamina < 10) break

        const affinity = getTrainingAffinity(player.id, updatedCareer)
        const gain = Math.max(1, Math.round(STAT_GAIN_PER_WEEK * settings.trainingGainMultiplier * affinity))
        const cap = player.career.maxLevel * 10
        const current = player.stats[slot.statTarget as keyof Stats]
        const newVal = Math.min(current + gain, cap)
        const newStats = { ...player.stats, [slot.statTarget]: newVal }
        // Recalculate TOT
        const { POT, CON, TEC, PRE, FIS, AGI, INT } = newStats
        newStats.TOT = Math.round((POT + CON + TEC + PRE + FIS + AGI + INT) / 7)

        player = {
          ...player,
          stats: newStats,
          stamina: Math.max(0, player.stamina - STAT_TRAINING_STAMINA_COST),
          career: {
            ...player.career,
            trainingProgress: player.career.trainingProgress + gain,
            experience: player.career.experience + 10,
          },
        }
        break
      }

      case 'technique':
      case 'improvement_technique': {
        if (!slot.techniqueBookId) break
        const book = getTechniqueBook(slot.techniqueBookId)
        if (!book) break

        const check = canLearn(player, book, updatedCareer.inventory)
        if (check !== 'ok') break

        const result = learnTechnique(player, book, updatedCareer.inventory)
        player = result.player
        updatedCareer = { ...updatedCareer, inventory: result.inventory }
        player = {
          ...player,
          career: { ...player.career, experience: player.career.experience + 20 },
        }
        break
      }

      case 'rest': {
        player = {
          ...player,
          stamina: Math.min(100, player.stamina + REST_STAMINA_GAIN),
          morale: Math.min(100, player.morale + REST_MORALE_GAIN),
        }
        break
      }
    }

    const newArr = [...updatedPlayers]
    newArr[idx] = player
    updatedPlayers = newArr
  }

  return {
    players: updatedPlayers,
    career: {
      ...updatedCareer,
      weeklyTrainingPlan: { ...plan, executed: true },
    },
  }
}
