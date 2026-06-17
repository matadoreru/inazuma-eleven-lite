import type { Player, Stats } from '../types/player'
import type { PotentialAnalysis, DifficultySettings } from '../types/career'
import { calcPotentialGrowthFactor } from './potentialService'

// Experience thresholds for leveling up (cumulative)
const LEVEL_THRESHOLDS: Record<number, number> = {
  2: 100,
  3: 250,
  4: 500,
  5: 900,
  6: 1400,
  7: 2000,
  8: 2800,
  9: 3800,
  10: 5000,
}

function getNextLevelThreshold(currentLevel: number): number | null {
  const nextLevel = currentLevel + 1
  return LEVEL_THRESHOLDS[nextLevel] ?? null
}

// Stat weights by position
const POSITION_WEIGHTS: Record<string, Partial<Stats>> = {
  GK: { PRE: 0.25, AGI: 0.20, FIS: 0.20, INT: 0.20, TEC: 0.15 },
  DF: { PRE: 0.25, FIS: 0.25, INT: 0.20, AGI: 0.15, CON: 0.15 },
  MD: { CON: 0.25, TEC: 0.20, INT: 0.20, PRE: 0.20, AGI: 0.15 },
  FW: { POT: 0.30, TEC: 0.25, CON: 0.20, AGI: 0.15, INT: 0.10 },
}

export function calcGrowthIncrement(
  player: Player,
  analysis?: PotentialAnalysis,
): Partial<Stats> {
  let effectiveGrowthRate = player.career.growthRate

  if (analysis) {
    // Use career.potential as the reference TOT for ceiling comparison
    // (it's on the same 1–99 scale as truePotential)
    const potentialFactor = calcPotentialGrowthFactor(
      analysis,
      player.career.potential,
      player.seasonStats.minutesPlayed,
      true,  // training-based growth
    )
    effectiveGrowthRate = player.career.growthRate * potentialFactor
  }

  if (effectiveGrowthRate <= 0) return {}

  const totalPoints = effectiveGrowthRate * 2
  const posWeights = POSITION_WEIGHTS[player.position] ?? POSITION_WEIGHTS['MD']
  const increment: Partial<Stats> = {}

  for (const [stat, weight] of Object.entries(posWeights)) {
    const key = stat as keyof Stats
    const raw = totalPoints * (weight as number)
    const whole = Math.floor(raw)
    const frac = raw - whole
    increment[key] = whole + (Math.random() < frac ? 1 : 0)
  }

  return increment
}

export function levelUpCheck(player: Player): Player {
  const threshold = getNextLevelThreshold(player.career.maxLevel)
  if (threshold === null) return player
  if (player.career.experience < threshold) return player

  return {
    ...player,
    career: {
      ...player.career,
      maxLevel: player.career.maxLevel + 1,
    },
  }
}

export function applySeasonGrowth(
  players: Player[],
  potentials?: Record<number, PotentialAnalysis>,
  settings?: DifficultySettings,
): Player[] {
  return players.map((p) => {
    const analysis = potentials?.[p.id]
    const increment = calcGrowthIncrement(p, analysis)

    // Match-based bonus: if player has minutes and good matchAffinity, boost growth
    let matchMultiplier = 1.0
    if (analysis && p.seasonStats.minutesPlayed > 0) {
      const matchFactor = calcPotentialGrowthFactor(
        analysis,
        p.career.potential,
        p.seasonStats.minutesPlayed,
        false,  // match-based growth
      )
      // Blend: training increment * (1 + match bonus)
      matchMultiplier = 1 + Math.max(0, matchFactor - 0.5) * 0.40
    }

    const cap = p.career.maxLevel * 10
    const newStats = { ...p.stats }

    for (const [stat, delta] of Object.entries(increment)) {
      if (delta === undefined) continue
      const key = stat as keyof Stats
      if (key === 'TOT') continue
      const rawBoosted = Math.round((delta as number) * matchMultiplier)
      const boosted = Math.round(rawBoosted * (settings?.seasonGrowthMultiplier ?? 1.0))
      newStats[key] = Math.min(newStats[key] + boosted, cap)
    }

    const { POT, CON, TEC, PRE, FIS, AGI, INT } = newStats
    newStats.TOT = Math.round((POT + CON + TEC + PRE + FIS + AGI + INT) / 7)

    const grownPlayer: Player = {
      ...p,
      stats: newStats,
      seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },  // reset at season end
    }

    return levelUpCheck(grownPlayer)
  })
}
