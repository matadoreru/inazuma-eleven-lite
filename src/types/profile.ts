import type { Player } from './player'
import type { Team } from './team'
import type { League } from './competition'
import type { TechniqueBook } from './inventory'

export type ProfileTag = 'base' | 'custom' | 'debug' | 'experimental'

export interface ProfileData {
  players: Player[]
  teams: Team[]
  leagues: League[]
  techniques: TechniqueBook[]
}

export interface Profile {
  id: string
  name: string
  description: string
  version: string
  author: string
  createdAt: string
  updatedAt: string
  tags: ProfileTag[]
  isBuiltIn: boolean
  data: ProfileData
}

export interface ProfileIndex {
  activeProfileId: string
  profileIds: string[]
}

export const PROFILE_FORMAT = 'inazuma-eleven-lite-profile'
export const PROFILE_FORMAT_VERSION = '1.0.0'
export const BASE_PROFILE_ID = 'base'
export const PROFILE_INDEX_KEY = 'iel_profile_index'
export const PROFILE_KEY_PREFIX = 'iel_profile_'
export const DEV_MODE_KEY = 'iel_dev_mode'
