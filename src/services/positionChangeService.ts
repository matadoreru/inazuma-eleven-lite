import type { Player, Position } from '../types/player'
import type { PositionChangePlan } from '../types/training'
import type { DifficultySettings } from '../types/career'

// ─── Duration calculation (FIFA-inspired) ────────────────────────────────────

// Whether two outfield positions are adjacent in the DF–MD–FW chain
function areAdjacent(a: Position, b: Position): boolean {
  const adj: Record<Position, Position[]> = {
    GK: [],
    DF: ['MD'],
    MD: ['DF', 'FW'],
    FW: ['MD'],
  }
  return adj[a].includes(b)
}

export function calcPositionChangeDays(player: Player, target: Position, settings: DifficultySettings): number {
  const current = player.position

  if (current === target) return 0

  // Base days by difficulty
  let base: number
  if (current === 'GK' || target === 'GK') {
    base = 56
  } else if (areAdjacent(current, target)) {
    base = 28
  } else {
    base = 42  // DF↔FW, non-adjacent outfield
  }

  // Speed modifier based on INT (higher INT = faster learner)
  const int = player.stats.INT
  const intModifier = int >= 180 ? 0.7 : int < 120 ? 1.3 : 1.0

  // Accelerated if the player already knows the target as positionAlt
  const altModifier = player.positionAlt === target ? 0.5 : 1.0

  const result = Math.round(base * intModifier * altModifier * settings.positionChangeDaysMultiplier)
  return Math.min(84, Math.max(14, result))
}

// ─── Plan management ─────────────────────────────────────────────────────────

export function startOrResetPositionChange(
  player: Player,
  target: Position,
  currentDate: string,
  settings: DifficultySettings,
): Player {
  if (player.position === target || player.positionAlt === target) return player

  const plan: PositionChangePlan = {
    targetPosition: target,
    startDate: currentDate,
    daysRequired: calcPositionChangeDays(player, target, settings),
    daysCompleted: 0,
    completed: false,
  }

  return {
    ...player,
    career: { ...player.career, positionChangePlan: plan },
  }
}

// Advances position change progress by `days`; completes and applies if done.
export function advancePositionChange(player: Player, days: number): Player {
  const plan = player.career.positionChangePlan
  if (!plan || plan.completed) return player

  const newCompleted = plan.daysCompleted + days

  if (newCompleted >= plan.daysRequired) {
    return {
      ...player,
      positionAlt: plan.targetPosition,
      career: {
        ...player.career,
        positionAlt: plan.targetPosition,  // keep in sync
        positionChangePlan: { ...plan, daysCompleted: plan.daysRequired, completed: true },
      },
    }
  }

  return {
    ...player,
    career: {
      ...player.career,
      positionChangePlan: { ...plan, daysCompleted: newCompleted },
    },
  }
}

export function cancelPositionChange(player: Player): Player {
  return {
    ...player,
    career: { ...player.career, positionChangePlan: null },
  }
}
