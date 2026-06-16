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
}

export interface SaveData {
  schemaVersion: number
  slotName: string
  savedAtUnix: number
  summary: SaveSummary
  career: Career
  players: Player[]
  teams: Team[]
}

export const SAVE_SCHEMA_VERSION = 1
export const MAX_SAVE_SLOTS = 5
export const SAVE_KEY_PREFIX = 'iel_save_'
