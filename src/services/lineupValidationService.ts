import type { Player, Position } from '../types/player'
import type { Team } from '../types/team'
import { INJURED_PERFORMANCE_MULTIPLIER, positionModifier } from './formationService'

export interface LineupWarning {
  player: Player
  assignedPosition: Position
  isInjured: boolean
  isOutOfPosition: boolean
  injuryPenaltyPercent: number
  positionPenaltyPercent: number
  totalPenaltyPercent: number
}

export interface LineupValidation {
  warnings: LineupWarning[]
  /** Number of starter slots filled with an existing player. */
  starterCount: number
  /** Number of starters the active formation requires (normally 11). */
  requiredCount: number
  /** How many starters are missing to complete the formation. */
  missingStarters: number
}

export const REQUIRED_STARTER_COUNT = 11

export function isPlayerOutOfPosition(player: Player, assignedPosition: Position): boolean {
  return player.position !== assignedPosition && player.positionAlt !== assignedPosition
}

export function getRequiredStarterCount(_team: Team): number {
  return REQUIRED_STARTER_COUNT
}

export function getStarterCount(team: Team, players: Player[]): number {
  const ids = new Set(players.map((player) => player.id))
  return new Set(
    team.lineup
      .filter((slot) => slot.isStarter && ids.has(slot.playerId))
      .map((slot) => slot.playerId),
  ).size
}

export function validateStartingLineup(team: Team, players: Player[]): LineupValidation {
  const starterCount = getStarterCount(team, players)
  const requiredCount = getRequiredStarterCount(team)
  return {
    warnings: getStartingLineupWarnings(team, players),
    starterCount,
    requiredCount,
    missingStarters: Math.max(0, requiredCount - starterCount),
  }
}

export function lineupHasIssues(validation: LineupValidation): boolean {
  return validation.warnings.length > 0 || validation.missingStarters > 0
}

export function getStartingLineupWarnings(team: Team, players: Player[]): LineupWarning[] {
  const playerById = new Map(players.map((player) => [player.id, player]))

  return team.lineup.flatMap((slot) => {
    if (!slot.isStarter) return []
    const player = playerById.get(slot.playerId)
    if (!player) return []
    const isInjured = player.isInjured
    const isOutOfPosition = isPlayerOutOfPosition(player, slot.assignedPosition)
    const positionMultiplier = positionModifier(slot.assignedPosition, player.position, player.positionAlt)
    const injuryMultiplier = isInjured ? INJURED_PERFORMANCE_MULTIPLIER : 1
    return isInjured || isOutOfPosition
      ? [{
        player,
        assignedPosition: slot.assignedPosition,
        isInjured,
        isOutOfPosition,
        injuryPenaltyPercent: isInjured ? Math.round((1 - INJURED_PERFORMANCE_MULTIPLIER) * 100) : 0,
        positionPenaltyPercent: isOutOfPosition ? Math.round((1 - positionMultiplier) * 100) : 0,
        totalPenaltyPercent: Math.round((1 - positionMultiplier * injuryMultiplier) * 100),
      }]
      : []
  })
}
