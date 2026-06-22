import type { Career } from './career'
import type { Player } from './player'
import type { Team } from './team'

export interface SaveSummary {
  teamName: string
  managerName: string
  managerAvatar: string
  seasonNumber: number
  leagueName: string
  currentDate: string
  leaguePosition: number
  budget: number
}

export interface SaveSlot {
  slot: number
  slotName: string
  schemaVersion: number
  savedAtUnix: number
  summary: SaveSummary
  profileId?: string
  profileName?: string
}

export interface SaveData {
  schemaVersion: number
  slotName: string
  savedAtUnix: number
  summary: SaveSummary
  career: Career
  players: Player[]
  teams: Team[]
  profileId?: string
  profileVersion?: string
  compact?: boolean
  playerOverrides?: Array<Partial<Player> & Pick<Player, 'id'>>
  teamOverrides?: Array<Partial<Team> & Pick<Team, 'id'>>
  playerIds?: number[]
  teamIds?: number[]
}

export const SAVE_SCHEMA_VERSION = 2
export const MAX_SAVE_SLOTS = 5
export const SAVE_KEY_PREFIX = 'iel_save_'
