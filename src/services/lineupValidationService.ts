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

export function isPlayerOutOfPosition(player: Player, assignedPosition: Position): boolean {
  return player.position !== assignedPosition && player.positionAlt !== assignedPosition
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
