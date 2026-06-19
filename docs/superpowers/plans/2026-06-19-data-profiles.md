# Data Profiles — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localStorage-based data profile system with a Developer Menu so players/teams/leagues/techniques can be swapped per profile, new careers use the active profile data, and profiles can be imported/exported as `.ielite-profile.json` files.

**Architecture:** Profiles are stored as full JSON blobs in localStorage (`iel_profile_{id}`), indexed by `iel_profile_index`. A built-in "base" profile snapshots the bundled TypeScript seed data on first run. The store gains a `leagues` field so all season lifecycle functions read from profile data instead of the hardcoded seed imports.

**Tech Stack:** React 18, TypeScript, Zustand, Vite, Vitest (jsdom), Tailwind CSS. Tests use `vi.stubGlobal('localStorage', mock)`.

## Global Constraints

- All localStorage keys use the `iel_` prefix.
- No new runtime dependencies — only what's already in `package.json`.
- `isBuiltIn: true` profiles can never be deleted, renamed, or overwritten by import.
- Phase 1 covers players, teams, leagues, techniques only. Items and objectives are hardcoded in services and are out of scope.
- Every new file follows existing code style: no comments unless non-obvious, no trailing summaries, Tailwind utility classes, `dark-*` palette from existing screens.
- Run `npm test` after each task to confirm no regressions.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/types/profile.ts` | **Create** | ProfileTag, ProfileData, Profile, ProfileIndex types + localStorage key constants |
| `src/services/profileService.ts` | **Create** | Profile CRUD, init, getActiveProfileData, import/export, dev mode toggle |
| `src/tests/profileService.test.ts` | **Create** | Vitest unit tests for profileService |
| `src/types/save.ts` | **Modify** | Add optional `profileId?: string`, `profileVersion?: string` to SaveData |
| `src/services/saveService.ts` | **Modify** | Include profileId/profileVersion from active profile when saving |
| `src/store/careerStore.ts` | **Modify** | Add `leagues: League[]` state field; startNewCareer/loadCareer/closeSeason/startNewSeason use profile data |
| `src/App.tsx` | **Modify** | Add `'dev_menu'` to Screen union; render `<DevMenuScreen />` |
| `src/screens/MainMenuScreen.tsx` | **Modify** | 5-tap version trigger for dev mode; "Menú Dev" button when active; call `profileService.init()` |
| `src/screens/DevMenuScreen.tsx` | **Create** | Full-screen developer menu with tab bar |
| `src/screens/DevProfilesScreen.tsx` | **Create** | Profile list with full CRUD, import/export |
| `src/screens/NewCareerScreen.tsx` | **Modify** | Use `profileService.getActiveProfileData()` instead of direct seed imports; show profile name on confirm |
| `src/screens/SaveLoadScreen.tsx` | **Modify** | Show warning badge if save's profileId not found in current profile index |

---

## Task 1: Profile Types + profileService + Tests

**Files:**
- Create: `src/types/profile.ts`
- Create: `src/services/profileService.ts`
- Create: `src/tests/profileService.test.ts`

**Interfaces:**
- Produces: `Profile`, `ProfileData`, `ProfileIndex`, `ProfileTag`, `BASE_PROFILE_ID`, `DEV_MODE_KEY`
- Produces: `init()`, `getActiveProfileData()`, `getActiveProfile()`, `listProfiles()`, `getProfile(id)`, `createProfile(name, desc, tags)`, `duplicateProfile(id)`, `renameProfile(id, name)`, `deleteProfile(id)`, `setActiveProfile(id)`, `exportProfile(id): string`, `validateAndParseImport(json): ImportResult`, `importProfile(profile, overwrite?)`, `isDevModeActive()`, `enableDevMode()`, `disableDevMode()`, `restoreBaseProfile()`

- [ ] **Step 1: Create `src/types/profile.ts`**

```typescript
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
```

- [ ] **Step 2: Create `src/services/profileService.ts`**

```typescript
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
      !Array.isArray(p.data.leagues)
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
```

- [ ] **Step 3: Write `src/tests/profileService.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as svc from '../services/profileService'
import { BASE_PROFILE_ID, PROFILE_FORMAT, PROFILE_KEY_PREFIX } from '../types/profile'

function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
}

describe('profileService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock())
  })

  it('init() creates the base profile on first run', () => {
    svc.init()
    const base = svc.getProfile(BASE_PROFILE_ID)
    expect(base).not.toBeNull()
    expect(base!.isBuiltIn).toBe(true)
    expect(base!.id).toBe(BASE_PROFILE_ID)
  })

  it('init() is idempotent — base appears once in index', () => {
    svc.init()
    svc.init()
    const profiles = svc.listProfiles()
    expect(profiles.filter((p) => p.id === BASE_PROFILE_ID).length).toBe(1)
  })

  it('getActiveProfileData() returns arrays after init', () => {
    svc.init()
    const data = svc.getActiveProfileData()
    expect(Array.isArray(data.players)).toBe(true)
    expect(Array.isArray(data.teams)).toBe(true)
    expect(Array.isArray(data.leagues)).toBe(true)
    expect(Array.isArray(data.techniques)).toBe(true)
  })

  it('createProfile() adds profile to index', () => {
    svc.init()
    const p = svc.createProfile('Test', 'desc', ['custom'])
    expect(p.isBuiltIn).toBe(false)
    expect(svc.listProfiles().some((x) => x.id === p.id)).toBe(true)
  })

  it('duplicateProfile() creates a copy with new ID', () => {
    svc.init()
    const copy = svc.duplicateProfile(BASE_PROFILE_ID)
    expect(copy.id).not.toBe(BASE_PROFILE_ID)
    expect(copy.name).toContain('Copia')
    expect(copy.isBuiltIn).toBe(false)
  })

  it('renameProfile() updates the name', () => {
    svc.init()
    const p = svc.createProfile('Original', '', ['custom'])
    svc.renameProfile(p.id, 'Renombrado')
    expect(svc.getProfile(p.id)!.name).toBe('Renombrado')
  })

  it('deleteProfile() removes profile from index and storage', () => {
    svc.init()
    const p = svc.createProfile('To delete', '', ['custom'])
    svc.deleteProfile(p.id)
    expect(svc.getProfile(p.id)).toBeNull()
    expect(svc.listProfiles().some((x) => x.id === p.id)).toBe(false)
  })

  it('deleteProfile() throws on built-in profile', () => {
    svc.init()
    expect(() => svc.deleteProfile(BASE_PROFILE_ID)).toThrow()
  })

  it('setActiveProfile() changes the active profile', () => {
    svc.init()
    const p = svc.createProfile('Custom', '', ['custom'])
    svc.setActiveProfile(p.id)
    expect(svc.getActiveProfile()!.id).toBe(p.id)
  })

  it('deleteProfile() when active falls back to base', () => {
    svc.init()
    const p = svc.createProfile('Custom', '', ['custom'])
    svc.setActiveProfile(p.id)
    svc.deleteProfile(p.id)
    expect(svc.getActiveProfile()!.id).toBe(BASE_PROFILE_ID)
  })

  it('setActiveProfile() throws for unknown ID', () => {
    svc.init()
    expect(() => svc.setActiveProfile('non-existent-id')).toThrow()
  })

  it('exportProfile() produces correct format wrapper', () => {
    svc.init()
    const json = svc.exportProfile(BASE_PROFILE_ID)
    const bundle = JSON.parse(json)
    expect(bundle.format).toBe(PROFILE_FORMAT)
    expect(bundle.formatVersion).toBe('1.0.0')
    expect(bundle.profile.id).toBe(BASE_PROFILE_ID)
  })

  it('validateAndParseImport() rejects unknown format', () => {
    const result = svc.validateAndParseImport(JSON.stringify({ format: 'wrong' }))
    expect(result.ok).toBe(false)
  })

  it('validateAndParseImport() rejects invalid JSON', () => {
    const result = svc.validateAndParseImport('not json{{')
    expect(result.ok).toBe(false)
  })

  it('validateAndParseImport() detects ID conflict', () => {
    svc.init()
    const json = svc.exportProfile(BASE_PROFILE_ID)
    const result = svc.validateAndParseImport(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.idConflict).toBe(true)
  })

  it('importProfile() adds a new profile', () => {
    svc.init()
    const p = svc.createProfile('Export me', '', ['custom'])
    const json = svc.exportProfile(p.id)
    // Delete the original to simulate fresh import
    svc.deleteProfile(p.id)
    const parsed = svc.validateAndParseImport(json)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      svc.importProfile(parsed.profile)
      expect(svc.getProfile(parsed.profile.id)).not.toBeNull()
    }
  })

  it('importProfile() with overwrite=false throws on conflict', () => {
    svc.init()
    const json = svc.exportProfile(BASE_PROFILE_ID)
    const parsed = svc.validateAndParseImport(json)
    if (parsed.ok) {
      expect(() => svc.importProfile(parsed.profile, false)).toThrow()
    }
  })

  it('isDevModeActive() returns false initially', () => {
    expect(svc.isDevModeActive()).toBe(false)
  })

  it('enableDevMode() / disableDevMode() toggle correctly', () => {
    svc.enableDevMode()
    expect(svc.isDevModeActive()).toBe(true)
    svc.disableDevMode()
    expect(svc.isDevModeActive()).toBe(false)
  })

  it('restoreBaseProfile() overwrites base data', () => {
    svc.init()
    svc.restoreBaseProfile()
    const base = svc.getProfile(BASE_PROFILE_ID)
    expect(base).not.toBeNull()
    expect(base!.isBuiltIn).toBe(true)
  })
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- profileService
```

Expected: all `profileService` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/profile.ts src/services/profileService.ts src/tests/profileService.test.ts
git commit -m "feat: add profile types, profileService, and tests"
```

---

## Task 2: Dev Mode Toggle + App Screen Wiring

**Files:**
- Modify: `src/App.tsx` — add `'dev_menu'` to Screen union, render `<DevMenuScreen />`
- Modify: `src/screens/MainMenuScreen.tsx` — 5-tap trigger, "Menú Dev" button, call `profileService.init()`

**Interfaces:**
- Consumes: `isDevModeActive()`, `enableDevMode()` from `profileService`
- Consumes: `init()` from `profileService`
- Produces: `Screen` type that includes `'dev_menu'`

- [ ] **Step 1: Add `'dev_menu'` to `src/App.tsx`**

In `src/App.tsx`, update the `Screen` type and add the DevMenuScreen import and render:

```typescript
// Add to the Screen union (line ~22):
export type Screen =
  | 'main_menu'
  | 'new_career'
  | 'career_home'
  | 'club'
  | 'squad'
  | 'player_detail'
  | 'formation'
  | 'training'
  | 'calendar'
  | 'match'
  | 'match_live'
  | 'standings'
  | 'transfers'
  | 'scout'
  | 'save_load'
  | 'season_review'
  | 'dev_menu'          // ← add this
```

Add to the imports at the top of `src/App.tsx`:
```typescript
import DevMenuScreen from './screens/DevMenuScreen'
```

Add to the JSX body (after `<SeasonReviewScreen />`):
```typescript
{screen === 'dev_menu' && <DevMenuScreen />}
```

- [ ] **Step 2: Update `src/screens/MainMenuScreen.tsx`**

Add these imports at the top (after existing imports):
```typescript
import { isDevModeActive, enableDevMode, init as initProfiles } from '../services/profileService'
```

Inside `MainMenuScreen`, before the `menuItems` definition, add:

```typescript
const [devMode, setDevMode] = useState(() => isDevModeActive())
const [tapCount, setTapCount] = useState(0)
const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  initProfiles()
}, [])

function handleVersionTap() {
  const next = tapCount + 1
  setTapCount(next)
  if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
  tapTimerRef.current = setTimeout(() => setTapCount(0), 3000)
  if (next >= 5) {
    enableDevMode()
    setDevMode(true)
    setTapCount(0)
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
  }
}
```

Also add `useRef` to the React import if not already present.

In the existing `menuItems` array, do NOT add dev menu here — it is rendered separately below.

In the JSX where the version is rendered, find the element displaying `APP_VERSION` and add `onClick={handleVersionTap}` and a cursor-pointer class. For example, wrap it:

```tsx
<button
  onClick={handleVersionTap}
  className="text-gray-600 text-xs select-none cursor-default focus:outline-none"
>
  {devMode && (
    <span className="mr-1.5 px-1 py-0.5 rounded text-[0.5rem] font-bold bg-orange-600/20 text-orange-400 uppercase tracking-wider">
      DEV
    </span>
  )}
  v{APP_VERSION}
</button>
```

In the `menuItems` array or just after the rendered menu list, add the dev menu button conditionally. Find where the menu list is rendered and add below it:

```tsx
{devMode && (
  <button
    onClick={() => navigate('dev_menu')}
    className="mt-2 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-orange-600/30 text-orange-400 hover:bg-orange-900/20 text-sm font-medium transition-colors"
  >
    <span className="material-icons text-base">developer_mode</span>
    Menú Dev
  </button>
)}
```

- [ ] **Step 3: Run tests to verify no regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/screens/MainMenuScreen.tsx
git commit -m "feat: add dev_menu screen type and 5-tap dev mode toggle"
```

---

## Task 3: DevMenuScreen + DevProfilesScreen

**Files:**
- Create: `src/screens/DevMenuScreen.tsx`
- Create: `src/screens/DevProfilesScreen.tsx`

**Interfaces:**
- Consumes: all `profileService` exports
- Consumes: `navigate` from `useCareerStore`
- Consumes: `Screen` (must include `'dev_menu'` from Task 2)

Note: `DevMenuScreen` is the outer shell (header, tab bar). `DevProfilesScreen` is the "Perfiles" tab content, rendered inside `DevMenuScreen`.

- [ ] **Step 1: Create `src/screens/DevMenuScreen.tsx`**

```typescript
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { disableDevMode } from '../services/profileService'
import GameLayout from '../components/GameLayout'
import Icon from '../components/Icon'
import DevProfilesScreen from './DevProfilesScreen'

type DevTab = 'profiles'

export default function DevMenuScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<DevTab>('profiles')

  function handleDisableDev() {
    disableDevMode()
    navigate('main_menu')
  }

  return (
    <GameLayout bg="menu" noNav>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <button
            onClick={() => navigate('main_menu')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <Icon name="arrow_back" size="sm" />
            Volver
          </button>
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-orange-600/20 text-orange-400 uppercase tracking-wider">
              DEV
            </span>
            <span className="text-white font-bold text-sm">Menú de Desarrollador</span>
          </div>
          <button
            onClick={handleDisableDev}
            className="text-red-500 hover:text-red-400 text-xs transition-colors"
          >
            Desactivar
          </button>
        </div>

        <div className="flex border-b border-gray-800 shrink-0">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'profiles'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Perfiles
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profiles' && <DevProfilesScreen />}
        </div>
      </div>
    </GameLayout>
  )
}
```

- [ ] **Step 2: Create `src/screens/DevProfilesScreen.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react'
import type { Profile } from '../types/profile'
import {
  listProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  duplicateProfile,
  renameProfile,
  deleteProfile,
  exportProfile,
  validateAndParseImport,
  importProfile,
  restoreBaseProfile,
} from '../services/profileService'
import Icon from '../components/Icon'

function ProfileTag({ tag }: { tag: Profile['tags'][number] }) {
  const colors: Record<string, string> = {
    base: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    custom: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    debug: 'bg-orange-900/40 text-orange-300 border-orange-700/40',
    experimental: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[0.55rem] font-semibold uppercase tracking-wide border ${colors[tag] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {tag}
    </span>
  )
}

function DataSummary({ data }: { data: Profile['data'] }) {
  return (
    <span className="text-gray-500 text-xs">
      {data.players.length} jugadores · {data.teams.length} equipos · {data.leagues.length} ligas
    </span>
  )
}

export default function DevProfilesScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createTags, setCreateTags] = useState<Profile['tags']>(['custom'])
  const [importError, setImportError] = useState<string | null>(null)
  const [importConflictProfile, setImportConflictProfile] = useState<Profile | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    setProfiles(listProfiles())
    setActiveId(getActiveProfile()?.id ?? null)
  }

  useEffect(() => { refresh() }, [])

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }

  function handleActivate(id: string) {
    setActiveProfile(id)
    refresh()
    showFeedback('Perfil activado.')
  }

  function handleDuplicate(id: string) {
    duplicateProfile(id)
    refresh()
    showFeedback('Perfil duplicado.')
  }

  function handleStartRename(profile: Profile) {
    setRenamingId(profile.id)
    setRenameValue(profile.name)
  }

  function handleConfirmRename(id: string) {
    if (renameValue.trim()) {
      renameProfile(id, renameValue.trim())
      refresh()
    }
    setRenamingId(null)
  }

  function handleDeleteConfirmed() {
    if (!confirmDeleteId) return
    deleteProfile(confirmDeleteId)
    setConfirmDeleteId(null)
    refresh()
    showFeedback('Perfil eliminado.')
  }

  function handleCreate() {
    if (!createName.trim()) return
    createProfile(createName.trim(), createDesc.trim(), createTags)
    setCreating(false)
    setCreateName('')
    setCreateDesc('')
    setCreateTags(['custom'])
    refresh()
    showFeedback('Perfil creado.')
  }

  function handleExport(id: string, name: string) {
    const json = exportProfile(id)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_')}.ielite-profile.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const json = ev.target?.result as string
      const result = validateAndParseImport(json)
      if (!result.ok) {
        setImportError(result.error)
        return
      }
      if (result.idConflict) {
        setImportConflictProfile(result.profile)
        return
      }
      importProfile(result.profile)
      refresh()
      showFeedback('Perfil importado.')
    }
    reader.readAsText(file)
  }

  function handleImportOverwrite() {
    if (!importConflictProfile) return
    importProfile(importConflictProfile, true)
    setImportConflictProfile(null)
    refresh()
    showFeedback('Perfil importado (sobreescrito).')
  }

  function handleRestore() {
    restoreBaseProfile()
    refresh()
    showFeedback('Perfil base restaurado.')
  }

  const confirmDeleteProfile = profiles.find((p) => p.id === confirmDeleteId)

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">

      {/* Feedback toast */}
      {feedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
          {feedback}
        </div>
      )}

      {/* Global actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Icon name="add" size="xs" />
          Nuevo perfil
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700/80 hover:bg-dark-600 border border-gray-700 text-gray-300 text-sm font-medium transition-colors"
        >
          <Icon name="upload" size="xs" />
          Importar
        </button>
        <button
          onClick={handleRestore}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700/80 hover:bg-dark-600 border border-gray-700 text-gray-300 text-sm font-medium transition-colors"
        >
          <Icon name="restore" size="xs" />
          Restaurar base
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.ielite-profile.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Import error */}
      {importError && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 flex items-start gap-2">
          <Icon name="error" size="sm" className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm">{importError}</p>
          </div>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-300">
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      {/* Import conflict modal */}
      {importConflictProfile && (
        <div className="bg-dark-800/90 border border-yellow-700/40 rounded-xl p-4 space-y-3">
          <p className="text-yellow-300 text-sm font-medium">
            Ya existe un perfil con el mismo ID: <strong>{importConflictProfile.name}</strong>
          </p>
          <p className="text-gray-400 text-xs">¿Quieres sobreescribirlo?</p>
          <div className="flex gap-2">
            <button
              onClick={handleImportOverwrite}
              className="px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-medium transition-colors"
            >
              Sobreescribir
            </button>
            <button
              onClick={() => setImportConflictProfile(null)}
              className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="bg-dark-800/70 border border-gold-600/20 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-semibold">Nuevo perfil</p>
          <input
            type="text"
            placeholder="Nombre del perfil"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            maxLength={60}
            className="w-full bg-dark-900/60 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            maxLength={120}
            className="w-full bg-dark-900/60 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div>
            <p className="text-gray-400 text-xs mb-2">Tipo</p>
            <div className="flex gap-2 flex-wrap">
              {(['custom', 'debug', 'experimental'] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setCreateTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    createTags.includes(tag)
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-dark-700/60 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!createName.trim()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-dark-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
            >
              Crear
            </button>
            <button
              onClick={() => { setCreating(false); setCreateName(''); setCreateDesc(''); setCreateTags(['custom']) }}
              className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteId && confirmDeleteProfile && (
        <div className="bg-dark-800/90 border border-red-700/40 rounded-xl p-4 space-y-3">
          <p className="text-red-300 text-sm font-medium">
            ¿Eliminar el perfil <strong>{confirmDeleteProfile.name}</strong>?
          </p>
          <p className="text-gray-400 text-xs">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteConfirmed}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              Eliminar
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Profile list */}
      <div className="space-y-3">
        {profiles.map((profile) => {
          const isActive = profile.id === activeId
          const isRenaming = renamingId === profile.id
          return (
            <div
              key={profile.id}
              className={`rounded-xl border p-4 transition-colors ${
                isActive
                  ? 'border-green-600/50 bg-green-900/10'
                  : 'border-gray-800 bg-dark-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-bold uppercase tracking-wide bg-green-700/30 text-green-400 border border-green-700/40">
                        Activo
                      </span>
                    )}
                    {profile.tags.map((tag) => (
                      <ProfileTag key={tag} tag={tag} />
                    ))}
                  </div>

                  {isRenaming ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename(profile.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        autoFocus
                        maxLength={60}
                        className="flex-1 bg-dark-900/60 border border-blue-500 rounded-lg px-2.5 py-1 text-white text-sm focus:outline-none"
                      />
                      <button
                        onClick={() => handleConfirmRename(profile.id)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="px-2 py-1 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 text-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-white font-semibold text-sm truncate">{profile.name}</p>
                  )}

                  {profile.description && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{profile.description}</p>
                  )}
                  <div className="mt-1.5">
                    <DataSummary data={profile.data} />
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mt-3 flex-wrap">
                {!isActive && (
                  <button
                    onClick={() => handleActivate(profile.id)}
                    className="px-2.5 py-1 rounded-lg bg-green-700/30 hover:bg-green-700/50 border border-green-700/40 text-green-400 text-xs font-medium transition-colors"
                  >
                    Activar
                  </button>
                )}
                <button
                  onClick={() => handleDuplicate(profile.id)}
                  className="px-2.5 py-1 rounded-lg bg-dark-700/60 hover:bg-dark-600 border border-gray-700 text-gray-300 text-xs transition-colors"
                >
                  Duplicar
                </button>
                {!profile.isBuiltIn && !isRenaming && (
                  <button
                    onClick={() => handleStartRename(profile)}
                    className="px-2.5 py-1 rounded-lg bg-dark-700/60 hover:bg-dark-600 border border-gray-700 text-gray-300 text-xs transition-colors"
                  >
                    Renombrar
                  </button>
                )}
                <button
                  onClick={() => handleExport(profile.id, profile.name)}
                  className="px-2.5 py-1 rounded-lg bg-dark-700/60 hover:bg-dark-600 border border-gray-700 text-gray-300 text-xs transition-colors"
                >
                  Exportar
                </button>
                {!profile.isBuiltIn && (
                  <button
                    onClick={() => setConfirmDeleteId(profile.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 text-xs transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests and verify no regressions**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/DevMenuScreen.tsx src/screens/DevProfilesScreen.tsx
git commit -m "feat: add DevMenuScreen and DevProfilesScreen with profile CRUD"
```

---

## Task 4: Store + NewCareerScreen Use Active Profile Data

**Files:**
- Modify: `src/store/careerStore.ts` — add `leagues: League[]` state; use `getActiveProfileData()` in `startNewCareer`/`loadCareer`; use `get().leagues` in `closeSeason`/`startNewSeason`
- Modify: `src/screens/NewCareerScreen.tsx` — replace direct seed imports with `getActiveProfileData()`; show profile name on confirm step

**Interfaces:**
- Consumes: `getActiveProfileData(): ProfileData`, `getActiveProfile(): Profile | null` from `profileService`
- Consumes: `leagues: League[]` now available on store state

- [ ] **Step 1: Update `src/store/careerStore.ts` — add `leagues` to state interface**

In the `CareerState` interface (around line 545), add:
```typescript
leagues: League[]
```

Also add `League` to the import from `../types/competition` if not already imported:
```typescript
import type { Match, MatchResult, MatchEvent, League } from '../types/competition'
```

- [ ] **Step 2: Update `careerStore.ts` — import `getActiveProfileData` and remove seed imports for players/teams/leagues**

Replace:
```typescript
// Seed data
import { players as seedPlayers } from '../data/players'
import { teams as seedTeams } from '../data/teams'
import { leagues as seedLeagues } from '../data/leagues'
import { formations as seedFormations, getFormationSlots } from '../data/formations'
```

With:
```typescript
// Seed data — formations only (players/teams/leagues come from active profile)
import { formations as seedFormations, getFormationSlots } from '../data/formations'
import { getActiveProfileData } from '../services/profileService'
```

- [ ] **Step 3: Update `careerStore.ts` — set initial `leagues: []` in `create()` call**

Find the `create<CareerState>()(...)` initial state object (around line ~650) and add:
```typescript
leagues: [],
```

- [ ] **Step 4: Update `careerStore.ts` — `startNewCareer` uses profile data**

Replace the three lines that read from seed data in `startNewCareer` (around line 704-712):
```typescript
const playersCopy: Player[] = JSON.parse(JSON.stringify(seedPlayers))
  .map(...)
const teamsCopy: Team[] = JSON.parse(JSON.stringify(seedTeams))
  .map(...)
const leaguesCopy = JSON.parse(JSON.stringify(seedLeagues))
```

With:
```typescript
const { players: seedP, teams: seedT, leagues: seedL } = getActiveProfileData()
const playersCopy: Player[] = JSON.parse(JSON.stringify(seedP))
  .map((p: Player) => ({ ...p, seasonStats: p.seasonStats ?? { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 } }))
const teamsCopy: Team[] = JSON.parse(JSON.stringify(seedT))
  .map((t: Team) => ({
    ...t,
    scoutLevel: t.scoutLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
    facilitiesLevel: t.facilitiesLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
  }))
const leaguesCopy: League[] = JSON.parse(JSON.stringify(seedL))
```

Also add `leagues: leaguesCopy` to the `set({...})` call at the end of `startNewCareer` (alongside `career`, `players`, `teams`):
```typescript
set({
  career,
  players: newPlayers,
  teams: newTeams,
  leagues: leaguesCopy,
  screen: 'career_home',
  // ... rest unchanged
})
```

- [ ] **Step 5: Update `careerStore.ts` — `loadCareer` sets `leagues` from profile data**

In `loadCareer(slot)`, after setting `career`, `players`, `teams`, also set:
```typescript
const { leagues: profileLeagues } = getActiveProfileData()
set({
  career: normalizedCareer,
  players,
  teams: data.teams,
  leagues: profileLeagues,
  // ... rest unchanged
})
```

(Find the `set({...})` call inside `loadCareer` and add `leagues: profileLeagues` to it.)

- [ ] **Step 6: Update `careerStore.ts` — `closeSeason` uses `get().leagues`**

In `closeSeason()` (around line 1836), replace:
```typescript
const leagues = seedLeagues
```
With:
```typescript
const leagues = get().leagues
```

- [ ] **Step 7: Update `careerStore.ts` — `startNewSeason` uses `get().leagues`**

In `startNewSeason()` (around line 1888), replace:
```typescript
const leagues = seedLeagues
```
With:
```typescript
const leagues = get().leagues
```

- [ ] **Step 8: Update `src/screens/NewCareerScreen.tsx` — use profile data**

Remove these two module-level imports:
```typescript
import { teams } from '../data/teams'
import { players } from '../data/players'
```

Add this import:
```typescript
import { getActiveProfileData, getActiveProfile } from '../services/profileService'
```

Inside the `NewCareerScreen` component, before the first `useState`, add:
```typescript
const profileData = useMemo(() => getActiveProfileData(), [])
const activeProfileName = useMemo(() => getActiveProfile()?.name ?? 'Perfil base', [])
const { teams, players } = profileData
```

(The `teams` and `players` destructured here now shadow the removed imports and are used throughout the component unchanged.)

- [ ] **Step 9: Update `src/screens/NewCareerScreen.tsx` — show profile name on confirm steps**

In the "Confirmar" step for existing team (around line 679, after the Dificultad block), add:
```tsx
<div className="bg-dark-900/40 rounded-xl border border-gold-600/20 p-3 flex items-center gap-2">
  <Icon name="layers" size="xs" className="text-gray-500 shrink-0" />
  <div>
    <p className="text-gray-400 text-[0.65rem] uppercase tracking-wide">Datos</p>
    <p className="text-gray-300 text-xs font-medium">{activeProfileName}</p>
  </div>
</div>
```

Add the same block to the "Confirmar" step for custom club (same location in the right column, around line 763+).

- [ ] **Step 10: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/store/careerStore.ts src/screens/NewCareerScreen.tsx
git commit -m "feat: store and NewCareer use active profile data; add leagues to store state"
```

---

## Task 5: Save Integration + SaveLoadScreen Warning

**Files:**
- Modify: `src/types/save.ts` — add optional `profileId?`, `profileVersion?` to `SaveData`
- Modify: `src/services/saveService.ts` — write profileId/profileVersion when saving
- Modify: `src/screens/SaveLoadScreen.tsx` — show warning if save's profileId not in profile index

**Interfaces:**
- Consumes: `getActiveProfile()` from `profileService`
- Consumes: `listProfiles()` from `profileService` (to check if a profileId exists)

- [ ] **Step 1: Update `src/types/save.ts`**

Add two optional fields to `SaveData`:
```typescript
export interface SaveData {
  schemaVersion: number
  slotName: string
  savedAtUnix: number
  summary: SaveSummary
  career: Career
  players: Player[]
  teams: Team[]
  profileId?: string      // which profile was active when saved
  profileVersion?: string // profile version at save time
}
```

Also add to `SaveSlot` so the summary includes it:
```typescript
export interface SaveSlot {
  slot: number
  slotName: string
  schemaVersion: number
  savedAtUnix: number
  summary: SaveSummary
  profileId?: string
  profileName?: string    // display name — stored so it shows even if profile is deleted
}
```

- [ ] **Step 2: Update `src/services/saveService.ts`**

Add import at the top:
```typescript
import { getActiveProfile } from './profileService'
```

In the `save()` function, before building the `data` object, add:
```typescript
const activeProfile = getActiveProfile()
```

Then include in the `data` object:
```typescript
const data: SaveData = {
  schemaVersion: SAVE_SCHEMA_VERSION,
  slotName,
  savedAtUnix: now,
  summary,
  career: updatedCareer,
  players,
  teams,
  profileId: activeProfile?.id,
  profileVersion: activeProfile?.version,
}
```

In `listSaves()`, update the `slots.push(...)` call to also expose `profileId` and `profileName` in the `SaveSlot`:
```typescript
slots.push({
  slot: i,
  slotName: data.slotName,
  schemaVersion: data.schemaVersion,
  savedAtUnix: data.savedAtUnix,
  summary: data.summary,
  profileId: data.profileId,
  profileName: undefined, // we don't store name in save — checked at display time
})
```

- [ ] **Step 3: Update `src/screens/SaveLoadScreen.tsx` — import profileService and check profileId**

Add import at the top:
```typescript
import { listProfiles } from '../services/profileService'
```

Inside `SaveLoadScreen`, add a state for available profile IDs:
```typescript
const [knownProfileIds, setKnownProfileIds] = useState<Set<string>>(() =>
  new Set(listProfiles().map((p) => p.id))
)
```

Update `refreshSaves` to also refresh profile IDs:
```typescript
function refreshSaves() {
  const filled = listSaves()
  const slots: (SaveSlot | null)[] = Array.from({ length: MAX_SAVE_SLOTS }, (_, i) =>
    filled.find((s) => s.slot === i) ?? null
  )
  setSaves(slots)
  setKnownProfileIds(new Set(listProfiles().map((p) => p.id)))
}
```

In the JSX where each save slot is rendered, after the slot name/date line, add a warning if the save has a `profileId` that is not in `knownProfileIds`:

```tsx
{slot.profileId && !knownProfileIds.has(slot.profileId) && (
  <div className="mt-1.5 flex items-center gap-1.5 text-yellow-500 text-xs">
    <span className="material-icons text-xs">warning</span>
    Perfil original no disponible ({slot.profileId.slice(0, 8)}…)
  </div>
)}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass. The `saveService.test.ts` tests may need updating if they assert the exact shape of `SaveData` — update them to allow optional `profileId`/`profileVersion` fields.

Check the existing `saveService.test.ts` — if any test does `expect(data).toEqual(...)` with a complete `SaveData` shape, add the optional fields or use `expect.objectContaining(...)`.

- [ ] **Step 5: Commit**

```bash
git add src/types/save.ts src/services/saveService.ts src/screens/SaveLoadScreen.tsx
git commit -m "feat: save data includes profileId; SaveLoadScreen warns on missing profile"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Perfil activo determina datos de nueva carrera | Task 4 |
| CRUD de perfiles (crear, duplicar, renombrar, eliminar) | Task 1 (service), Task 3 (UI) |
| Perfil base no se puede borrar | Task 1 (`isBuiltIn` guard) |
| Exportar perfil como JSON | Task 1 (service), Task 3 (UI) |
| Importar perfil desde fichero | Task 1 (service), Task 3 (UI) |
| Restaurar perfil base | Task 1 (service), Task 3 (UI) |
| Menú Dev accesible con 5 taps | Task 2 |
| Menú Dev oculto por flag localStorage | Task 2 |
| Desactivar modo dev desde Dev Menu | Task 3 (`DevMenuScreen`) |
| Nueva carrera muestra nombre del perfil activo | Task 4 Step 9 |
| Saves incluyen profileId/profileVersion | Task 5 |
| Aviso en SaveLoadScreen si perfil no existe | Task 5 |
| profileService.init() llamado al arrancar | Task 2 (in `MainMenuScreen.useEffect`) |
| leagues en store para toda la lifecycle | Task 4 Steps 1-7 |

**Placeholder scan:** No TBDs. Every step has complete code. ✓

**Type consistency:**
- `getActiveProfileData()` → returns `ProfileData` with `.players`, `.teams`, `.leagues`, `.techniques` ✓
- `getActiveProfile()` → returns `Profile | null` ✓
- `leagues: League[]` added to both interface and initial state ✓
- `SaveSlot` gains `profileId?: string`, `profileName?: string` ✓
- `SaveData` gains `profileId?: string`, `profileVersion?: string` ✓
- `ProfileTag` type = `'base' | 'custom' | 'debug' | 'experimental'` used consistently ✓
