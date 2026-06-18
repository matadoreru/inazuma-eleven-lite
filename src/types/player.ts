import type { PositionChangePlan } from './training'
import type { EquipmentItem, EquipmentSlot } from './equipment'

export type Position = 'GK' | 'DF' | 'MD' | 'FW'
export type Element = 'FIRE' | 'WOOD' | 'WIND' | 'MOUNTAIN'
export type Gender = 'Masculino' | 'Femenino'
export type GrowthType = 'early' | 'normal' | 'late'
export type CanonTier = 'common' | 'rare' | 'epic' | 'legendary'

export interface Stats {
  POT: number
  CON: number
  TEC: number
  PRE: number
  FIS: number
  AGI: number
  INT: number
  TOT: number
}

export interface Technique {
  id: number
  name: string
  type: 'Tiro' | 'Regate' | 'Bloqueo' | 'Parada' | 'Mejora'
  element: Element | ''
  POT: number
  PP: number
}

export interface PlayerCareer {
  maxLevel: number
  potential: number
  growthRate: number
  contractStatus: 'free' | 'contracted'
  marketValue: number
  salary: number
  experience: number
  trainingProgress: number
  trainingSessionsThisWeek: number
  positionAlt: Position | null
  positionChangePlan?: PositionChangePlan | null
}

export function statTotal(stats: Stats): number {
  return stats.POT + stats.CON + stats.TEC + stats.PRE + stats.FIS + stats.AGI + stats.INT
}

export function getPlayerStatsSummary(player: Player): { total: number; media: number } {
  const total = statTotal(player.stats)
  return { total, media: Math.round(total / 7) }
}

export function playerDisplayName(player: { name: string; nameRomaji: string }, nameStyle: 'western' | 'japanese'): string {
  return nameStyle === 'japanese' ? player.nameRomaji : player.name
}

export interface PlayerSeasonStats {
  goals: number
  assists: number
  cleanSheets: number
  matchesPlayed: number
  minutesPlayed: number
}

export interface Player {
  id: number
  name: string
  nameRomaji: string
  gender: Gender
  position: Position
  positionAlt: Position | null
  element: Element
  stats: Stats
  career: PlayerCareer
  techniques: Technique[]             // max 3 normal techniques (type !== 'Mejora')
  improvementTechniques?: Technique[] // max 2 improvement techniques (type === 'Mejora')
  equipment?: Record<EquipmentSlot, EquipmentItem | null>
  spriteUrl: string
  stamina: number
  morale: number
  isInjured: boolean
  injuryDaysRemaining: number
  isSuspended: boolean
  suspensionMatches: number
  age: number
  teamId: number | null
  jerseyNumber: number
  canonTier: CanonTier
  seasonStats: PlayerSeasonStats
}
