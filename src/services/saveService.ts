import type { Career } from '../types/career'
import type { Player } from '../types/player'
import type { Team } from '../types/team'
import type { SaveSlot, SaveData, SaveSummary } from '../types/save'
import { SAVE_SCHEMA_VERSION, MAX_SAVE_SLOTS, SAVE_KEY_PREFIX } from '../types/save'
import { DEFAULT_DIFFICULTY } from '../types/career'
import { sortStandings } from './standingsService'

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
    players,
    teams,
  }

  localStorage.setItem(getKey(slot), JSON.stringify(data))
}

export function load(slot: number): SaveData | null {
  const raw = localStorage.getItem(getKey(slot))
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as SaveData
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
}

export function autoSave(career: Career, players: Player[], teams: Team[]): void {
  try {
    const data: AutoSaveData = { career, players, teams }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data))
  } catch { /* storage full or unavailable */ }
}

export function loadAutoSave(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as AutoSaveData
    if (!data.career || !data.players || !data.teams) return null
    return data
  } catch {
    return null
  }
}

export function clearAutoSave(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY) } catch { /* ignore */ }
}
