import type { Position, Element, Technique, Stats } from './player'

export const MAX_CALLUP = 25

export type TacticalType =
  | 'BALANCED'
  | 'DEFENSIVE'
  | 'OFFENSIVE'
  | 'MIDFIELD_CONTROL'
  | 'COUNTER_ATTACK'
  | 'HIGH_PRESS'

export interface FormationSlot {
  position: Position
  x: number  // 0–100 percentage from left
  y: number  // 0–100 percentage from top
}

export interface Formation {
  id: number
  name: string
  tacticalType: TacticalType
  GK: number
  DF: number
  MD: number
  FW: number
  slots?: FormationSlot[]
}

export interface LineupSlot {
  playerId: number
  assignedPosition: Position
  isStarter: boolean
  /** Exact visual slot in the active formation. Optional for legacy saves. */
  formationSlotIndex?: number
}

export interface Team {
  id: number
  name: string
  tier: number
  reputation: number
  budget: number
  leagueId: string
  captainId: number
  keyPlayerId?: number
  badgeUrl?: string
  formation: Formation
  lineup: LineupSlot[]
  playerIds: number[]
  scoutLevel?: number        // 1–5; affects analysis quality (initialized from reputation at career start)
  facilitiesLevel?: number   // 1–5; affects analysis cost (initialized from reputation at career start)
}

export interface SnapshotPlayer {
  id: number
  name: string
  nameRomaji: string
  spriteUrl: string
  position: Position
  element?: Element
  techniques?: Technique[]
  stats?: Stats
}

export interface TeamSnapshot {
  id: number
  name: string
  formation: Formation
  forwardScore: number
  midfieldScore: number
  defenseScore: number
  goalkeeperScore: number
  starters?: SnapshotPlayer[]
}

export type StrengthTier = 'weak' | 'normal' | 'strong' | 'very_strong'

export interface CustomClubConfig {
  name: string
  badgeUrl: string
  badgeIsCustom: boolean
  strengthTier: StrengthTier
  leagueId: string
}
