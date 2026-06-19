import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as svc from '../services/profileService'
import { BASE_PROFILE_ID, PROFILE_FORMAT, PROFILE_KEY_PREFIX } from '../types/profile'
import type { Player } from '../types/player'

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

  it('renameProfile() throws on built-in profile', () => {
    svc.init()
    expect(() => svc.renameProfile(BASE_PROFILE_ID, 'Hacked')).toThrow()
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

  it('importProfile(overwrite=true) replaces an existing profile', () => {
    svc.init()
    const p = svc.createProfile('Original', 'desc', ['custom'])
    const json = svc.exportProfile(p.id)
    const parsed = svc.validateAndParseImport(json)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      // Modify the name on the in-memory profile then overwrite
      const modified = { ...parsed.profile, name: 'Overwritten' }
      svc.importProfile(modified, true)
      expect(svc.getProfile(p.id)!.name).toBe('Overwritten')
      expect(svc.getProfile(p.id)!.isBuiltIn).toBe(false)
    }
  })

  it('importProfile(overwrite=true) on base profile keeps isBuiltIn=true', () => {
    svc.init()
    const json = svc.exportProfile(BASE_PROFILE_ID)
    const parsed = svc.validateAndParseImport(json)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      // Try to overwrite base — isBuiltIn should be preserved
      svc.importProfile({ ...parsed.profile, isBuiltIn: false }, true)
      expect(svc.getProfile(BASE_PROFILE_ID)!.isBuiltIn).toBe(true)
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

  describe('updateProfileData', () => {
    it('replaces the players array while keeping other data unchanged', () => {
      svc.init()
      const p = svc.createProfile('EditorTest', 'desc', ['custom'])
      const original = svc.getProfile(p.id)!
      const fakePlayer = { id: 9001, name: 'Fake', nameRomaji: 'Fake' } as unknown as Player
      svc.updateProfileData(p.id, { players: [fakePlayer] })
      const updated = svc.getProfile(p.id)!
      expect(updated.data.players).toEqual([fakePlayer])
      // teams and leagues should remain unchanged
      expect(updated.data.teams).toEqual(original.data.teams)
      expect(updated.data.leagues).toEqual(original.data.leagues)
    })

    it('updates updatedAt to current time', () => {
      svc.init()
      const before = new Date().toISOString()
      const p = svc.createProfile('TimeTest', '', ['custom'])
      svc.updateProfileData(p.id, { leagues: [] })
      const updated = svc.getProfile(p.id)!
      expect(updated.updatedAt >= before).toBe(true)
    })

    it('throws if profile id does not exist', () => {
      svc.init()
      expect(() => svc.updateProfileData('no-such-id', { players: [] })).toThrow('Profile not found: no-such-id')
    })
  })
})
