import type { Position, Stats } from './player'

export type TrainingType = 'stat' | 'technique' | 'improvement_technique' | 'rest'

// Tracks an in-progress position change for a specific player
export interface PositionChangePlan {
  targetPosition: Position
  startDate: string      // 'YYYY-MM-DD'
  daysRequired: number
  daysCompleted: number
  completed: boolean
}

// One player's assignment in a given week
export interface WeeklyTrainingSlot {
  playerId: number
  trainingType: TrainingType
  statTarget?: keyof Stats         // used when trainingType === 'stat'
  positionTarget?: Position        // used when trainingType === 'position_change'
  techniqueBookId?: string         // used when trainingType === 'technique' | 'improvement_technique'
}

// The full weekly training plan (set by the manager, executed on commit)
export interface WeeklyTrainingPlan {
  slots: WeeklyTrainingSlot[]   // 0–MAX_TRAINING_SLOTS entries
  weekStartDate: string
  executed: boolean
}

export const MAX_TRAINING_SLOTS = 5
