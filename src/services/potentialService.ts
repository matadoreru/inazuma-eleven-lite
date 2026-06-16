import type {
  PotentialAnalysis,
  PotentialDiscovered,
  GrowthCurve,
  DevelopmentRisk,
  AnalysisTier,
  DifficultySettings,
} from '../types/career'
import { ANALYSIS_TIER_ORDER } from '../types/career'
import type { Player } from '../types/player'
import type { Team } from '../types/team'

// ─── Constants ──────────────────────────────────────────────────────────────

const INITIAL_UNCERTAINTY = 22  // half-range at career start (±22 → range of 44)
const MIN_UNCERTAINTY = 1       // narrowest achievable range (±1)

interface TierConfig {
  label: string
  description: string
  baseCost: number
  // Fraction of current uncertainty removed (before bonuses)
  baseReduction: number
  // Additional reduction when player has enough minutes (performance tier only)
  minutesBonus: number
  minMinutesForBonus: number
  reveals: (keyof PotentialDiscovered)[]
  minUncertaintyAfter: number
}

const TIER_CONFIG: Record<AnalysisTier, TierConfig> = {
  basic: {
    label: 'Análisis básico',
    description: 'Reduce el margen de incertidumbre inicial. Coste bajo.',
    baseCost: 25_000,
    baseReduction: 0.30,
    minutesBonus: 0,
    minMinutesForBonus: 0,
    reveals: [],
    minUncertaintyAfter: 8,
  },
  advanced: {
    label: 'Análisis avanzado',
    description: 'Análisis profundo. Revela la curva de crecimiento del jugador.',
    baseCost: 50_000,
    baseReduction: 0.35,
    minutesBonus: 0,
    minMinutesForBonus: 0,
    reveals: ['growthCurve'],
    minUncertaintyAfter: 5,
  },
  performance: {
    label: 'Análisis de rendimiento',
    description: 'Más efectivo con minutos jugados. Revela la afinidad con partidos.',
    baseCost: 40_000,
    baseReduction: 0.25,
    minutesBonus: 0.20,   // extra reduction if player has minutes
    minMinutesForBonus: 450,  // ~5 full matches
    reveals: ['matchAffinity'],
    minUncertaintyAfter: 3,
  },
  development: {
    label: 'Análisis de desarrollo',
    description: 'Evalúa el perfil de entrenamiento, afinidad y riesgo de desarrollo.',
    baseCost: 75_000,
    baseReduction: 0.40,
    minutesBonus: 0,
    minMinutesForBonus: 0,
    reveals: ['trainingAffinity', 'developmentRisk'],
    minUncertaintyAfter: 2,
  },
  full: {
    label: 'Informe completo',
    description: 'Informe exhaustivo. Revela fortalezas futuras y recomendaciones.',
    baseCost: 120_000,
    baseReduction: 0.60,
    minutesBonus: 0,
    minMinutesForBonus: 0,
    reveals: ['strengthsFutures', 'recommendation'],
    minUncertaintyAfter: MIN_UNCERTAINTY,
  },
}

// ─── Generation ─────────────────────────────────────────────────────────────

function weightedRand<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function generateGrowthCurve(age: number): GrowthCurve {
  // Younger players more likely to be late bloomers; older players peak early
  if (age <= 18) return weightedRand(['early', 'normal', 'late'], [0.20, 0.35, 0.45])
  if (age <= 22) return weightedRand(['early', 'normal', 'late'], [0.25, 0.45, 0.30])
  return weightedRand(['early', 'normal', 'late'], [0.40, 0.40, 0.20])
}

function generateDevelopmentRisk(): DevelopmentRisk {
  return weightedRand(['low', 'medium', 'high'], [0.40, 0.40, 0.20])
}

function generateAffinity(): number {
  // 0.75–1.35 range with normal-ish distribution
  return Math.round((0.75 + Math.random() * 0.60) * 100) / 100
}

function generateStrengths(player: Player): string[] {
  const all = ['Técnica', 'Control', 'Pase', 'Tiro', 'Físico', 'Agilidad', 'Inteligencia', 'Parada']
  const posStrengths: Record<string, string[]> = {
    GK: ['Parada', 'Agilidad', 'Inteligencia'],
    DF: ['Control', 'Físico', 'Inteligencia'],
    MD: ['Pase', 'Control', 'Técnica', 'Inteligencia'],
    FW: ['Tiro', 'Técnica', 'Agilidad'],
  }
  const primary = posStrengths[player.position] ?? posStrengths['MD']
  const secondary = all.filter((s) => !primary.includes(s))
  // Pick 2-3 strengths: mostly position-relevant with some randomness
  const picks = new Set<string>()
  while (picks.size < 2) picks.add(primary[Math.floor(Math.random() * primary.length)])
  if (Math.random() < 0.5) picks.add(secondary[Math.floor(Math.random() * secondary.length)])
  return [...picks]
}

function generateRecommendation(
  growthCurve: GrowthCurve,
  developmentRisk: DevelopmentRisk,
  trainingAffinity: number,
  matchAffinity: number,
): string {
  const parts: string[] = []
  if (growthCurve === 'late') parts.push('Es un jugador de explosión tardía, necesita tiempo.')
  if (growthCurve === 'early') parts.push('Ya está cerca de su techo, aprovéchalo ahora.')
  if (trainingAffinity >= 1.2) parts.push('Responde muy bien al entrenamiento.')
  if (matchAffinity >= 1.2) parts.push('Mejora mucho dando minutos en partidos.')
  if (developmentRisk === 'high') parts.push('Alto riesgo: puede no alcanzar su potencial.')
  if (developmentRisk === 'low') parts.push('Bajo riesgo de desarrollo.')
  return parts.length > 0 ? parts.join(' ') : 'Seguimiento estándar recomendado.'
}

export function generatePotentialAnalysis(player: Player): PotentialAnalysis {
  // truePotential correlates loosely with the player's career.potential seed value (±15 jitter)
  const base = Math.max(30, Math.min(99, player.career.potential))
  const jitter = Math.round((Math.random() - 0.5) * 30)  // ±15
  const truePotential = Math.max(30, Math.min(99, base + jitter))

  const growthCurve = generateGrowthCurve(player.age)
  const developmentRisk = generateDevelopmentRisk()
  const trainingAffinity = generateAffinity()
  const matchAffinity = generateAffinity()

  // Asymmetric initial range so the midpoint doesn't pinpoint the exact value
  const belowBias = Math.round(Math.random() * 8)   // 0–8 extra below
  const aboveBias = Math.round(Math.random() * 8)   // 0–8 extra above
  const uncertainty = INITIAL_UNCERTAINTY
  const rangeMin = Math.max(1, truePotential - uncertainty - belowBias)
  const rangeMax = Math.min(99, truePotential + uncertainty + aboveBias)

  return {
    truePotential,
    growthCurve,
    developmentRisk,
    trainingAffinity,
    matchAffinity,
    uncertainty,
    rangeMin,
    rangeMax,
    investmentTotal: 0,
    analysesCompleted: [],
    discovered: {},
  }
}

// ─── Analysis ────────────────────────────────────────────────────────────────

export function getNextAnalysisTier(analysis: PotentialAnalysis): AnalysisTier | null {
  for (const tier of ANALYSIS_TIER_ORDER) {
    if (!analysis.analysesCompleted.includes(tier)) return tier
  }
  return null
}

export function getTierConfig(tier: AnalysisTier): TierConfig {
  return TIER_CONFIG[tier]
}

function resolvedScoutLevel(team: Team): number {
  return team.scoutLevel ?? Math.max(1, Math.ceil(team.reputation / 20))
}

function resolvedFacilitiesLevel(team: Team): number {
  return team.facilitiesLevel ?? Math.max(1, Math.ceil(team.reputation / 20))
}

function effectiveScoutBonus(team: Team): number {
  // scoutLevel 1–5 → 0% to 20% extra reduction
  return ((resolvedScoutLevel(team) - 1) / 4) * 0.20
}

function facilitiesCostDiscount(team: Team): number {
  // facilitiesLevel 1–5 → 0% to 25% cost reduction
  return ((resolvedFacilitiesLevel(team) - 1) / 4) * 0.25
}

export function calcAnalysisCost(
  tier: AnalysisTier,
  analysis: PotentialAnalysis,
  team: Team,
  player: Player,
  settings: DifficultySettings,
): number {
  const cfg = TIER_CONFIG[tier]
  // Quality multiplier: higher-quality players cost more to scout
  const qualityMult = 0.8 + Math.min(1, player.career.marketValue / 500_000) * 0.4
  // Facilities discount
  const discount = facilitiesCostDiscount(team)
  // Diminishing returns: each completed analysis adds 10% to cost
  const repeatPenalty = 1 + analysis.analysesCompleted.length * 0.10
  return Math.round(cfg.baseCost * qualityMult * (1 - discount) * repeatPenalty * settings.scoutCostMultiplier)
}

function computeNewUncertainty(
  analysis: PotentialAnalysis,
  tier: AnalysisTier,
  team: Team,
  seasonMatchMinutes: number,
): number {
  const cfg = TIER_CONFIG[tier]
  // Base reduction + scout quality bonus
  let reductionRate = cfg.baseReduction + effectiveScoutBonus(team)
  // Minutes bonus for performance tier
  if (cfg.minutesBonus > 0 && seasonMatchMinutes >= cfg.minMinutesForBonus) {
    const minuteFactor = Math.min(1, seasonMatchMinutes / 2000)
    reductionRate += cfg.minutesBonus * minuteFactor
  }
  reductionRate = Math.min(0.75, reductionRate)  // cap at 75% per tier

  const newUncertainty = Math.max(
    cfg.minUncertaintyAfter,
    Math.round(analysis.uncertainty * (1 - reductionRate)),
  )
  return newUncertainty
}

export function previewAnalysisTier(
  analysis: PotentialAnalysis,
  tier: AnalysisTier,
  team: Team,
  seasonMatchMinutes: number,
): { uncertainty: number; rangeMin: number; rangeMax: number } {
  const newUncertainty = computeNewUncertainty(analysis, tier, team, seasonMatchMinutes)
  return {
    uncertainty: newUncertainty,
    rangeMin: Math.max(1, analysis.truePotential - newUncertainty),
    rangeMax: Math.min(99, analysis.truePotential + newUncertainty),
  }
}

export function applyAnalysisTier(
  analysis: PotentialAnalysis,
  tier: AnalysisTier,
  team: Team,
  player: Player,
  seasonMatchMinutes: number,
  settings: DifficultySettings,
): PotentialAnalysis {
  const cfg = TIER_CONFIG[tier]
  const cost = calcAnalysisCost(tier, analysis, team, player, settings)
  const newUncertainty = computeNewUncertainty(analysis, tier, team, seasonMatchMinutes)

  // Build discovered info by revealing tier-specific fields
  const newDiscovered: PotentialDiscovered = { ...analysis.discovered }
  for (const key of cfg.reveals) {
    switch (key) {
      case 'growthCurve':
        newDiscovered.growthCurve = analysis.growthCurve
        break
      case 'developmentRisk':
        newDiscovered.developmentRisk = analysis.developmentRisk
        break
      case 'trainingAffinity':
        newDiscovered.trainingAffinity = analysis.trainingAffinity
        break
      case 'matchAffinity':
        newDiscovered.matchAffinity = analysis.matchAffinity
        break
      case 'strengthsFutures':
        newDiscovered.strengthsFutures = generateStrengths(player)
        break
      case 'recommendation':
        newDiscovered.recommendation = generateRecommendation(
          analysis.growthCurve,
          analysis.developmentRisk,
          analysis.trainingAffinity,
          analysis.matchAffinity,
        )
        break
    }
  }

  return {
    ...analysis,
    uncertainty: newUncertainty,
    rangeMin: Math.max(1, analysis.truePotential - newUncertainty),
    rangeMax: Math.min(99, analysis.truePotential + newUncertainty),
    investmentTotal: analysis.investmentTotal + cost,
    analysesCompleted: [...analysis.analysesCompleted, tier],
    discovered: newDiscovered,
  }
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

export function getConfidenceLabel(uncertainty: number): string {
  if (uncertainty >= 15) return 'Baja'
  if (uncertainty >= 8) return 'Media'
  if (uncertainty >= 4) return 'Alta'
  return 'Muy alta'
}

export function getGrowthCurveLabel(curve: GrowthCurve): string {
  if (curve === 'early') return 'Explosión temprana'
  if (curve === 'late') return 'Explosión tardía'
  return 'Progresión normal'
}

export function getDevelopmentRiskLabel(risk: DevelopmentRisk): string {
  if (risk === 'low') return 'Bajo'
  if (risk === 'medium') return 'Medio'
  return 'Alto'
}

// ─── Growth integration ──────────────────────────────────────────────────────

export function calcAgeGrowthFactor(age: number, curve: GrowthCurve): number {
  switch (curve) {
    case 'early':
      if (age <= 20) return 1.35
      if (age <= 23) return 1.10
      if (age <= 27) return 0.70
      return 0.25
    case 'late':
      if (age <= 18) return 0.50
      if (age <= 22) return 0.85
      if (age <= 27) return 1.20
      return 1.40
    default: // normal
      if (age <= 22) return 1.15
      if (age <= 26) return 1.00
      if (age <= 30) return 0.75
      return 0.35
  }
}

// Returns effective growth multiplier considering ceiling and affinity.
// truePotential is on the same 1–99 scale as player.career.potential (average-stat-equivalent).
// We compare to average stats (TOT / 7 if TOT is the sum, or TOT directly if avg).
export function calcPotentialGrowthFactor(
  analysis: PotentialAnalysis,
  playerTOT: number,        // can be sum or average; passed from outside for flexibility
  seasonMatchMinutes: number,
  isTrainingGrowth: boolean,  // true = training, false = match/season
): number {
  const { truePotential, growthCurve, trainingAffinity, matchAffinity, developmentRisk } = analysis

  // Ceiling: use truePotential on 1–99 scale vs player.career.potential-equivalent
  // Since TOT in seed data is the sum and after recalc it's the average,
  // we use truePotential directly as a career-progress ceiling
  const headroom = Math.max(0, truePotential - playerTOT)
  const ceilingFactor = headroom <= 0 ? 0.05 : Math.min(1, headroom / 15)

  // Age/curve factor
  const ageFactor = calcAgeGrowthFactor(analysis.truePotential, growthCurve)

  // Affinity
  const affinity = isTrainingGrowth ? trainingAffinity : matchAffinity

  // Minutes factor for match-based growth
  const minutesFactor = isTrainingGrowth
    ? 1
    : Math.min(1, (seasonMatchMinutes / 1800))  // max benefit at 20 full matches

  // Development risk: high risk occasionally stalls growth
  let riskFactor = 1.0
  if (developmentRisk === 'high') riskFactor = Math.random() < 0.20 ? 0 : 1.0
  else if (developmentRisk === 'medium') riskFactor = Math.random() < 0.08 ? 0.5 : 1.0

  return ceilingFactor * ageFactor * affinity * minutesFactor * riskFactor
}
