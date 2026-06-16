import type { Player } from '../types/player'
import type { DifficultySettings } from '../types/career'

export const STARTER_STAMINA_DRAIN = 25
export const BENCH_STAMINA_DRAIN = 8
export const DEFAULT_STAMINA_RECOVERY_PER_DAY = 7

// Thresholds for energy state
const STAMINA_FRESH = 70
const STAMINA_TIRED = 40

export type EnergyState = 'fresh' | 'tired' | 'exhausted'

export function getEnergyState(stamina: number): EnergyState {
  if (stamina >= STAMINA_FRESH) return 'fresh'
  if (stamina >= STAMINA_TIRED) return 'tired'
  return 'exhausted'
}

// Multiplier applied to match performance scores based on stamina
export function staminaPerformanceMultiplier(stamina: number): number {
  const state = getEnergyState(stamina)
  if (state === 'fresh') return 1.0
  if (state === 'tired') return 0.95
  return 0.85
}

// Applied after a match: drain stamina for starters and bench
export function drainStaminaAfterMatch(
  players: Player[],
  starterIds: Set<number>,
  benchIds: Set<number>,
  settings: DifficultySettings,
): Player[] {
  return players.map((p) => {
    if (starterIds.has(p.id)) {
      return { ...p, stamina: Math.max(0, p.stamina - settings.starterStaminaDrain) }
    }
    if (benchIds.has(p.id)) {
      return { ...p, stamina: Math.max(0, p.stamina - settings.benchStaminaDrain) }
    }
    return p
  })
}

// Applied when days pass: recover stamina for all players
export function recoverStaminaForDays(
  players: Player[],
  days: number,
  recoveryPerDay: number = DEFAULT_STAMINA_RECOVERY_PER_DAY,
): Player[] {
  const total = recoveryPerDay * days
  return players.map((p) => ({
    ...p,
    stamina: Math.min(100, p.stamina + total),
  }))
}

// Count days between two YYYY-MM-DD strings
export function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}
