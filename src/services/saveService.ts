import type { Career } from '../types/career'
import type { Player } from '../types/player'
import type { Team } from '../types/team'
import type { SaveSlot, SaveData, SaveSummary } from '../types/save'
import { SAVE_SCHEMA_VERSION, MAX_SAVE_SLOTS, SAVE_KEY_PREFIX } from '../types/save'
import { DEFAULT_DIFFICULTY } from '../types/career'
import { sortStandings } from './standingsService'
import { getActiveProfile, getActiveProfileData, getProfile } from './profileService'

type EntityWithId = { id: number }
type EntityOverride<T extends EntityWithId> = Partial<T> & Pick<T, 'id'>

function compactEntities<T extends EntityWithId>(current: T[], baseline: T[]): EntityOverride<T>[] {
  const baselineById = new Map(baseline.map((entity) => [entity.id, entity]))
  return current.map((entity) => {
    const base = baselineById.get(entity.id)
    if (!base) return { ...entity }
    const override: Record<string, unknown> = { id: entity.id }
    for (const [key, value] of Object.entries(entity)) {
      if (key === 'id') continue
      if (JSON.stringify(value) !== JSON.stringify(base[key as keyof T])) override[key] = value
    }
    return override as EntityOverride<T>
  }).filter((override) => Object.keys(override).length > 1)
}

function expandEntities<T extends EntityWithId>(baseline: T[], overrides: EntityOverride<T>[], includedIds?: number[]): T[] {
  const overridesById = new Map(overrides.map((override) => [override.id, override]))
  const included = includedIds ? new Set(includedIds) : null
  const expanded = baseline
    .filter((entity) => !included || included.has(entity.id))
    .map((entity) => ({ ...entity, ...(overridesById.get(entity.id) ?? {}) }))
  const baselineIds = new Set(baseline.map((entity) => entity.id))
  for (const override of overrides) {
    if (!baselineIds.has(override.id)) expanded.push(override as T)
  }
  return expanded
}

function compactState(players: Player[], teams: Team[]) {
  const baseline = getActiveProfileData()
  return {
    playerOverrides: compactEntities(players, baseline.players),
    teamOverrides: compactEntities(teams, baseline.teams),
    playerIds: players.map((player) => player.id),
    teamIds: teams.map((team) => team.id),
  }
}

function expandSaveData(data: SaveData): SaveData {
  if (!data.compact) return data
  const profileData = (data.profileId ? getProfile(data.profileId)?.data : null) ?? getActiveProfileData()
  return {
    ...data,
    players: expandEntities(profileData.players, data.playerOverrides ?? [], data.playerIds),
    teams: expandEntities(profileData.teams, data.teamOverrides ?? [], data.teamIds),
  }
}

function buildSummary(career: Career, players: Player[], teams: Team[]): SaveSummary {
  const team = teams.find((t) => t.id === career.teamId)
  const sorted = sortStandings(career.season.standings)
  const position = sorted.findIndex((r) => r.teamId === career.teamId) + 1

  return {
    teamName: team?.name ?? 'Unknown',
    managerName: career.managerName,
    managerAvatar: career.managerAvatar ?? '/avatars/avatar-1.svg',
    seasonNumber: career.seasonNumber,
    leagueName: career.season.leagueId,
    currentDate: career.season.currentDate,
    leaguePosition: position > 0 ? position : sorted.length,
    budget: team?.budget ?? 0,
  }
}

function getKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}${slot}`
}

export function save(
  slot: number,
  slotName: string,
  career: Career,
  players: Player[],
  teams: Team[],
): void {
  if (slot < 0 || slot >= MAX_SAVE_SLOTS) throw new Error(`Invalid save slot: ${slot}`)

  const now = Date.now()
  const summary = buildSummary(career, players, teams)
  const activeProfile = getActiveProfile()
  const compact = compactState(players, teams)

  const updatedCareer: Career = {
    ...career,
    lastSavedAt: new Date(now).toISOString().split('T')[0],
  }

  const data: SaveData = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    slotName,
    savedAtUnix: now,
    summary,
    career: updatedCareer,
    players: [],
    teams: [],
    profileId: activeProfile?.id,
    profileVersion: activeProfile?.version,
    compact: true,
    ...compact,
  }

  const serialized = JSON.stringify(data)
  try {
    localStorage.setItem(getKey(slot), serialized)
  } catch (error) {
    // Prefer an explicit manual save over the replaceable session autosave.
    localStorage.removeItem(AUTOSAVE_KEY)
    localStorage.setItem(getKey(slot), serialized)
  }
}

export function load(slot: number): SaveData | null {
  const raw = localStorage.getItem(getKey(slot))
  if (!raw) return null
  try {
    const data = expandSaveData(JSON.parse(raw) as SaveData)
    // Migration: old saves have no difficulty field
    if (!data.career.difficulty) {
      data.career = { ...data.career, difficulty: DEFAULT_DIFFICULTY }
    }
    return data
  } catch {
    return null
  }
}

export function listSaves(): SaveSlot[] {
  const slots: SaveSlot[] = []
  for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
    const raw = localStorage.getItem(getKey(i))
    if (!raw) continue
    try {
      const data = JSON.parse(raw) as SaveData
      slots.push({
        slot: i,
        slotName: data.slotName,
        schemaVersion: data.schemaVersion,
        savedAtUnix: data.savedAtUnix,
        summary: data.summary,
        profileId: data.profileId,
        profileName: undefined,
      })
    } catch {
      // Skip corrupted save
    }
  }
  return slots
}

export function deleteSave(slot: number): void {
  localStorage.removeItem(getKey(slot))
}

// ─── Auto-save (session persistence) ─────────────────────────────────────────

const AUTOSAVE_KEY = 'iel_autosave'

interface AutoSaveData {
  career: Career
  players: Player[]
  teams: Team[]
  compact?: boolean
  playerOverrides?: Array<Partial<Player> & Pick<Player, 'id'>>
  teamOverrides?: Array<Partial<Team> & Pick<Team, 'id'>>
  playerIds?: number[]
  teamIds?: number[]
  profileId?: string
}

export function autoSave(career: Career, players: Player[], teams: Team[]): void {
  try {
    const activeProfile = getActiveProfile()
    const data: AutoSaveData = {
      career,
      players: [],
      teams: [],
      compact: true,
      profileId: activeProfile?.id,
      ...compactState(players, teams),
    }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data))
  } catch { /* storage full or unavailable */ }
}

export function loadAutoSave(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as AutoSaveData
    if (!data.career || !data.players || !data.teams) return null
    if (data.compact) {
      const profileData = (data.profileId ? getProfile(data.profileId)?.data : null) ?? getActiveProfileData()
      data.players = expandEntities(profileData.players, data.playerOverrides ?? [], data.playerIds)
      data.teams = expandEntities(profileData.teams, data.teamOverrides ?? [], data.teamIds)
    }
    return data
  } catch {
    return null
  }
}

export function clearAutoSave(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY) } catch { /* ignore */ }
}
