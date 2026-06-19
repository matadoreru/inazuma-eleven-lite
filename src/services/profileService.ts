import { players as seedPlayers } from '../data/players'
import { teams as seedTeams } from '../data/teams'
import { leagues as seedLeagues } from '../data/leagues'
import { techniqueBooksCatalog as seedTechniques } from '../data/techniqueBooks'
import type { Profile, ProfileData, ProfileIndex } from '../types/profile'
import {
  BASE_PROFILE_ID,
  DEV_MODE_KEY,
  PROFILE_FORMAT,
  PROFILE_FORMAT_VERSION,
  PROFILE_INDEX_KEY,
  PROFILE_KEY_PREFIX,
} from '../types/profile'

function getIndex(): ProfileIndex {
  try {
    const raw = localStorage.getItem(PROFILE_INDEX_KEY)
    if (raw) return JSON.parse(raw) as ProfileIndex
  } catch { /* ignore */ }
  return { activeProfileId: BASE_PROFILE_ID, profileIds: [BASE_PROFILE_ID] }
}

function setIndex(index: ProfileIndex): void {
  localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index))
}

function profileKey(id: string): string {
  return `${PROFILE_KEY_PREFIX}${id}`
}

function readProfile(id: string): Profile | null {
  try {
    const raw = localStorage.getItem(profileKey(id))
    if (raw) return JSON.parse(raw) as Profile
  } catch { /* ignore */ }
  return null
}

function writeProfile(profile: Profile): void {
  localStorage.setItem(profileKey(profile.id), JSON.stringify(profile))
}

function buildBaseProfile(): Profile {
  const now = new Date().toISOString()
  return {
    id: BASE_PROFILE_ID,
    name: 'Perfil base',
    description: 'Datos oficiales del juego. No se puede eliminar.',
    version: '1.0.0',
    author: 'default',
    createdAt: now,
    updatedAt: now,
    tags: ['base'],
    isBuiltIn: true,
    data: {
      players: JSON.parse(JSON.stringify(seedPlayers)),
      teams: JSON.parse(JSON.stringify(seedTeams)),
      leagues: JSON.parse(JSON.stringify(seedLeagues)),
      techniques: JSON.parse(JSON.stringify(seedTechniques)),
    },
  }
}

export function init(): void {
  if (!readProfile(BASE_PROFILE_ID)) {
    writeProfile(buildBaseProfile())
  }
  const index = getIndex()
  if (!index.profileIds.includes(BASE_PROFILE_ID)) {
    setIndex({ ...index, profileIds: [BASE_PROFILE_ID, ...index.profileIds] })
  } else {
    setIndex(index)
  }
}

export function restoreBaseProfile(): void {
  writeProfile(buildBaseProfile())
}

export function listProfiles(): Profile[] {
  return getIndex()
    .profileIds
    .map((id) => readProfile(id))
    .filter((p): p is Profile => p !== null)
}

export function getProfile(id: string): Profile | null {
  return readProfile(id)
}

export function getActiveProfile(): Profile | null {
  return readProfile(getIndex().activeProfileId)
}

export function getActiveProfileData(): ProfileData {
  const profile = getActiveProfile()
  if (profile) return profile.data
  return {
    players: JSON.parse(JSON.stringify(seedPlayers)),
    teams: JSON.parse(JSON.stringify(seedTeams)),
    leagues: JSON.parse(JSON.stringify(seedLeagues)),
    techniques: JSON.parse(JSON.stringify(seedTechniques)),
  }
}

export function setActiveProfile(id: string): void {
  const index = getIndex()
  if (!index.profileIds.includes(id)) throw new Error(`Profile not found: ${id}`)
  setIndex({ ...index, activeProfileId: id })
}

export function createProfile(
  name: string,
  description: string,
  tags: Profile['tags'],
): Profile {
  const now = new Date().toISOString()
  const profile: Profile = {
    id: crypto.randomUUID(),
    name,
    description,
    version: '1.0.0',
    author: 'user',
    createdAt: now,
    updatedAt: now,
    tags,
    isBuiltIn: false,
    data: JSON.parse(JSON.stringify(getActiveProfileData())),
  }
  writeProfile(profile)
  const index = getIndex()
  setIndex({ ...index, profileIds: [...index.profileIds, profile.id] })
  return profile
}

export function duplicateProfile(id: string): Profile {
  const source = readProfile(id)
  if (!source) throw new Error(`Profile not found: ${id}`)
  const now = new Date().toISOString()
  const copy: Profile = {
    ...JSON.parse(JSON.stringify(source)),
    id: crypto.randomUUID(),
    name: `Copia de ${source.name}`,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  }
  writeProfile(copy)
  const index = getIndex()
  setIndex({ ...index, profileIds: [...index.profileIds, copy.id] })
  return copy
}

export function renameProfile(id: string, name: string): void {
  const profile = readProfile(id)
  if (!profile) throw new Error(`Profile not found: ${id}`)
  if (profile.isBuiltIn) throw new Error('Cannot rename built-in profile')
  writeProfile({ ...profile, name, updatedAt: new Date().toISOString() })
}

export function deleteProfile(id: string): void {
  const profile = readProfile(id)
  if (!profile) throw new Error(`Profile not found: ${id}`)
  if (profile.isBuiltIn) throw new Error('Cannot delete built-in profile')
  localStorage.removeItem(profileKey(id))
  const index = getIndex()
  const profileIds = index.profileIds.filter((pid) => pid !== id)
  const activeProfileId =
    index.activeProfileId === id ? BASE_PROFILE_ID : index.activeProfileId
  setIndex({ ...index, profileIds, activeProfileId })
}

export interface ProfileExport {
  format: string
  formatVersion: string
  profile: Profile
}

export function exportProfile(id: string): string {
  const profile = readProfile(id)
  if (!profile) throw new Error(`Profile not found: ${id}`)
  const bundle: ProfileExport = { format: PROFILE_FORMAT, formatVersion: PROFILE_FORMAT_VERSION, profile }
  return JSON.stringify(bundle, null, 2)
}

export type ImportResult =
  | { ok: true; profile: Profile; idConflict: boolean }
  | { ok: false; error: string }

export function validateAndParseImport(json: string): ImportResult {
  try {
    const bundle = JSON.parse(json) as Partial<ProfileExport>
    if (bundle.format !== PROFILE_FORMAT)
      return { ok: false, error: 'Formato de fichero no reconocido.' }
    if (bundle.formatVersion !== PROFILE_FORMAT_VERSION)
      return { ok: false, error: `Versión de formato no compatible: ${bundle.formatVersion}` }
    const p = bundle.profile
    if (!p?.id || !p.name || !p.data)
      return { ok: false, error: 'El fichero no contiene datos de perfil válidos.' }
    if (
      !Array.isArray(p.data.players) ||
      !Array.isArray(p.data.teams) ||
      !Array.isArray(p.data.leagues) ||
      !Array.isArray(p.data.techniques)
    )
      return { ok: false, error: 'El perfil no contiene los arrays de datos obligatorios.' }
    const idConflict = getIndex().profileIds.includes(p.id)
    return { ok: true, profile: p, idConflict }
  } catch {
    return { ok: false, error: 'El fichero no es un JSON válido.' }
  }
}

export function importProfile(profile: Profile, overwrite = false): void {
  const index = getIndex()
  const exists = index.profileIds.includes(profile.id)
  if (exists && !overwrite) throw new Error('Profile ID conflict — use overwrite=true')
  writeProfile({ ...profile, isBuiltIn: false })
  if (!exists) setIndex({ ...index, profileIds: [...index.profileIds, profile.id] })
}

export function isDevModeActive(): boolean {
  return localStorage.getItem(DEV_MODE_KEY) === '1'
}

export function enableDevMode(): void {
  localStorage.setItem(DEV_MODE_KEY, '1')
}

export function disableDevMode(): void {
  localStorage.removeItem(DEV_MODE_KEY)
}
