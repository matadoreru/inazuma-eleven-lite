import { describe, expect, it } from 'vitest'
import { getStartingLineupWarnings, isPlayerOutOfPosition, lineupHasIssues, validateStartingLineup } from '../services/lineupValidationService'
import type { Player } from '../types/player'
import type { Team } from '../types/team'

const player = {
  id: 1,
  name: 'Jugador',
  nameRomaji: 'Player',
  position: 'DF',
  positionAlt: 'MD',
  isInjured: false,
  injuryDaysRemaining: 0,
} as Player

const team = {
  id: 1,
  lineup: [{ playerId: 1, assignedPosition: 'FW', isStarter: true }],
} as Team

describe('lineup validation', () => {
  it('accepts the primary and alternate positions', () => {
    expect(isPlayerOutOfPosition(player, 'DF')).toBe(false)
    expect(isPlayerOutOfPosition(player, 'MD')).toBe(false)
    expect(isPlayerOutOfPosition(player, 'FW')).toBe(true)
  })

  it('reports injured and out-of-position starters with their lineup slot', () => {
    const injured = { ...player, isInjured: true, injuryDaysRemaining: 8 }
    expect(getStartingLineupWarnings(team, [injured])).toEqual([{
      player: injured,
      assignedPosition: 'FW',
      isInjured: true,
      isOutOfPosition: true,
      injuryPenaltyPercent: 75,
      positionPenaltyPercent: 35,
      totalPenaltyPercent: 84,
    }])
  })

  it('ignores substitutes', () => {
    const benchTeam = { ...team, lineup: [{ ...team.lineup[0], isStarter: false }] }
    expect(getStartingLineupWarnings(benchTeam, [{ ...player, isInjured: true }])).toEqual([])
  })

  it('returns injured and out-of-position starters together', () => {
    const injured = { ...player, id: 1, isInjured: true, injuryDaysRemaining: 6 }
    const misplaced = { ...player, id: 2, position: 'FW' as const, positionAlt: null }
    const mixedTeam = {
      ...team,
      lineup: [
        { playerId: 1, assignedPosition: 'DF' as const, isStarter: true },
        { playerId: 2, assignedPosition: 'GK' as const, isStarter: true },
      ],
    }

    const warnings = getStartingLineupWarnings(mixedTeam, [injured, misplaced])
    expect(warnings).toHaveLength(2)
    expect(warnings.find((warning) => warning.player.id === 1)?.isInjured).toBe(true)
    expect(warnings.find((warning) => warning.player.id === 2)?.isOutOfPosition).toBe(true)
    expect(warnings.find((warning) => warning.player.id === 1)?.injuryPenaltyPercent).toBe(75)
    expect(warnings.find((warning) => warning.player.id === 2)?.positionPenaltyPercent).toBe(70)
  })

  it('warns when fewer than 11 valid unique starters are selected', () => {
    const tenPlayers = Array.from({ length: 10 }, (_, index) => ({ ...player, id: index + 1 }))
    const incompleteTeam = {
      ...team,
      lineup: tenPlayers.map((current) => ({
        playerId: current.id,
        assignedPosition: 'DF' as const,
        isStarter: true,
      })),
    }

    const validation = validateStartingLineup(incompleteTeam, tenPlayers)

    expect(validation.starterCount).toBe(10)
    expect(validation.requiredCount).toBe(11)
    expect(validation.missingStarters).toBe(1)
    expect(lineupHasIssues(validation)).toBe(true)
  })

  it('does not count the same player twice toward the required eleven', () => {
    const duplicatedTeam = {
      ...team,
      lineup: Array.from({ length: 11 }, () => ({
        playerId: player.id,
        assignedPosition: 'DF' as const,
        isStarter: true,
      })),
    }

    expect(validateStartingLineup(duplicatedTeam, [player]).starterCount).toBe(1)
  })
})
