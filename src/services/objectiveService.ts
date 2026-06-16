import type { Career, Objective, ObjectiveStatus } from '../types/career'
import type { Season } from '../types/competition'
import { sortStandings } from './standingsService'

function updateObjectiveProgress(objective: Objective, career: Career, season: Season): Objective {
  if (objective.completed || objective.failed || objective.claimed) return objective

  const standings = sortStandings(season.standings)
  const teamRow = standings.find((r) => r.teamId === career.teamId)
  const position = standings.findIndex((r) => r.teamId === career.teamId) + 1
  const totalTeams = standings.length

  switch (objective.type) {
    case 'EARN_POINTS':
      return { ...objective, current: teamRow?.points ?? 0 }

    case 'WIN_MATCHES':
      return { ...objective, current: teamRow?.won ?? 0 }

    case 'SCORE_GOALS':
      return { ...objective, current: teamRow?.goalsFor ?? 0 }

    case 'CONCEDE_FEW':
      return { ...objective, current: teamRow?.goalsAgainst ?? 0 }

    case 'TOP_N':
      return { ...objective, current: position }

    case 'AVOID_RELEGATION': {
      if (season.finished) {
        const relegationZone = totalTeams - 2
        return { ...objective, current: position <= relegationZone ? 1 : 0 }
      }
      return objective
    }

    case 'WIN_LEAGUE': {
      if (season.finished) {
        return { ...objective, current: position === 1 ? 1 : 0 }
      }
      return objective
    }

    default:
      return objective
  }
}

function isObjectiveAchieved(objective: Objective): boolean {
  switch (objective.type) {
    case 'CONCEDE_FEW':
      return objective.current <= objective.target
    case 'TOP_N':
      return objective.current > 0 && objective.current <= objective.target
    default:
      return objective.current >= objective.target
  }
}

function isObjectiveFailed(objective: Objective, season: Season): boolean {
  if (objective.completed || objective.claimed) return false

  // MATCH objectives fail immediately when the match is played (handled externally)
  if (objective.category === 'MATCH') return false

  // SEASON and GENERAL objectives fail at season end if not achieved
  if (!season.finished) return false

  return !isObjectiveAchieved(objective)
}

export function getObjectiveStatus(objective: Objective): ObjectiveStatus {
  if (objective.claimed) return 'claimed'
  if (objective.failed) return 'failed'
  if (objective.completed) return 'completed'
  if (objective.current > 0) return 'in_progress'
  return 'not_started'
}

export function canClaimObjective(objective: Objective): boolean {
  return objective.completed && !objective.failed && !objective.claimed
}

// Some objectives can only be definitively achieved at season end because their
// outcome depends on the final state (position, total goals conceded). Monotonically
// increasing objectives (goals scored, wins, points) are safe to complete mid-season.
function canCompleteBeforeSeasonEnd(objective: Objective): boolean {
  return objective.type === 'EARN_POINTS' ||
    objective.type === 'WIN_MATCHES' ||
    objective.type === 'SCORE_GOALS'
}

export function checkObjectives(career: Career, season: Season): Career {
  const updatedObjectives = career.objectives.map((obj) => {
    const updated = updateObjectiveProgress(obj, career, season)

    // Only mark completed if it's the right moment to evaluate this objective type.
    // Non-monotonic objectives (TOP_N, CONCEDE_FEW, WIN_LEAGUE, AVOID_RELEGATION)
    // must wait for season end to avoid premature completion.
    const readyToComplete = canCompleteBeforeSeasonEnd(updated) || season.finished
    if (!updated.completed && !updated.failed && readyToComplete && isObjectiveAchieved(updated)) {
      return { ...updated, completed: true }
    }

    // Mark failed (at season end for SEASON/GENERAL; never auto-fail MATCH objectives here)
    if (!updated.completed && !updated.failed && isObjectiveFailed(updated, season)) {
      return { ...updated, failed: true }
    }

    return updated
  })

  return { ...career, objectives: updatedObjectives }
}

export function completeObjective(objectiveId: string, career: Career): Career {
  return {
    ...career,
    objectives: career.objectives.map((obj) =>
      obj.id === objectiveId ? { ...obj, completed: true, failed: false } : obj,
    ),
  }
}

export function failObjective(objectiveId: string, career: Career): Career {
  return {
    ...career,
    objectives: career.objectives.map((obj) =>
      obj.id === objectiveId ? { ...obj, failed: true, completed: false } : obj,
    ),
  }
}
