import { describe, it, expect, beforeEach, vi } from 'vitest'
import { save, load, listSaves, deleteSave } from '../services/saveService'
import type { Career } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'
import type { Team, Formation } from '../types/team'
import type { StandingRow } from '../types/competition'
import { SAVE_KEY_PREFIX, MAX_SAVE_SLOTS } from '../types/save'

// ---- Minimal fixture factories ----

const makeFormation = (): Formation => ({
  id: 1,
  name: '4-4-2',
  tacticalType: 'BALANCED',
  GK: 1,
  DF: 4,
  MD: 4,
  FW: 2,
})

const makeTeam = (id: number): Team => ({
  id,
  name: `Team ${id}`,
  tier: 1,
  reputation: 50,
  budget: 100_000,
  leagueId: 'league-1',
  captainId: 1,
  formation: makeFormation(),
  lineup: [],
  playerIds: [],
})

const makeStandingRow = (teamId: number): StandingRow => ({
  teamId,
  teamName: `Team ${teamId}`,
  played: 2,
  won: 1,
  drawn: 0,
  lost: 1,
  goalsFor: 2,
  goalsAgainst: 3,
  goalDiff: -1,
  points: 3,
})

const makeCareer = (teamId: number = 1): Career => ({
  id: 'career-1',
  managerName: 'Manager',
  managerAvatar: '/avatars/avatar-1.svg',
  teamId,
  season: {
    year: 2026,
    leagueId: 'league-1',
    teamIds: [teamId],
    matches: [],
    standings: [makeStandingRow(teamId)],
    currentDate: '2026-06-01',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    currentRound: 5,
    totalRounds: 30,
    finished: false,
  },
  seasonNumber: 1,
  totalBudgetSpent: 0,
  totalBudgetEarned: 0,
  objectives: [],
  inbox: [],
  transferHistory: [],
  watchlist: [],
  seasonHistory: [],
  playerPotential: {},
  weeklyTrainingPlan: null,
  inventory: { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] },
  allLeagueSeasons: {},
  cup: null,
  seasonStatus: 'active',
  lastSeasonReview: null,
  outgoingNegotiations: [],
  difficulty: DEFAULT_DIFFICULTY,
  nameStyle: 'western' as const,
  createdAt: '2026-01-01',
  lastSavedAt: '2026-01-01',
})

const makePlayer = (): Player => ({
  id: 1,
  name: 'Test Player',
  nameRomaji: 'Test',
  gender: 'Masculino',
  position: 'FW',
  positionAlt: null,
  element: 'FIRE',
  stats: { POT: 100, CON: 80, TEC: 90, PRE: 70, FIS: 85, AGI: 75, INT: 80, TOT: 83 },
  career: {
    maxLevel: 80,
    potential: 75,
    growthRate: 1.2,
    contractStatus: 'contracted',
    marketValue: 50000,
    salary: 1000,
    experience: 0,
    trainingProgress: 0,
    trainingSessionsThisWeek: 0,
    positionAlt: null,
  },
  techniques: [],
  spriteUrl: '',
  stamina: 100,
  morale: 100,
  isInjured: false,
  injuryDaysRemaining: 0,
  isSuspended: false,
  suspensionMatches: 0,
  age: 20,
  teamId: 1,
  jerseyNumber: 10,
  canonTier: 'common',
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
})

// ---- localStorage mock ----

function createLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
}

describe('saveService', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>

  beforeEach(() => {
    localStorageMock = createLocalStorageMock()
    vi.stubGlobal('localStorage', localStorageMock)
  })

  describe('save', () => {
    it('stores data in localStorage at the correct key', () => {
      const career = makeCareer()
      save(0, 'Slot One', career, [makePlayer()], [makeTeam(1)])

      expect(localStorageMock.setItem).toHaveBeenCalledOnce()
      const [key] = localStorageMock.setItem.mock.calls[0]
      expect(key).toBe(`${SAVE_KEY_PREFIX}0`)
    })

    it('serialises valid JSON that can be parsed back', () => {
      const career = makeCareer()
      save(0, 'Slot One', career, [makePlayer()], [makeTeam(1)])

      const [, rawValue] = localStorageMock.setItem.mock.calls[0]
      expect(() => JSON.parse(rawValue)).not.toThrow()
    })

    it('stores the slotName in the serialised data', () => {
      const career = makeCareer()
      save(0, 'My Save', career, [makePlayer()], [makeTeam(1)])

      const [, rawValue] = localStorageMock.setItem.mock.calls[0]
      const data = JSON.parse(rawValue)
      expect(data.slotName).toBe('My Save')
    })

    it('throws when slot number is out of range', () => {
      const career = makeCareer()
      expect(() => save(-1, 'Bad', career, [], [])).toThrow()
      expect(() => save(MAX_SAVE_SLOTS, 'Bad', career, [], [])).toThrow()
    })
  })

  describe('load', () => {
    it('returns null when the slot is empty', () => {
      expect(load(0)).toBeNull()
    })

    it('returns parsed SaveData after a save', () => {
      const career = makeCareer()
      save(0, 'Test Save', career, [makePlayer()], [makeTeam(1)])

      // Repoint getItem to the stored value
      const rawValue = localStorageMock.setItem.mock.calls[0][1]
      localStorageMock.getItem.mockReturnValue(rawValue)

      const data = load(0)
      expect(data).not.toBeNull()
      expect(data!.slotName).toBe('Test Save')
    })

    it('returns null when the stored value is invalid JSON', () => {
      localStorageMock.getItem.mockReturnValue('not-valid-json{{{')
      expect(load(0)).toBeNull()
    })

    it('round-trips career, players and teams correctly', () => {
      const career = makeCareer()
      const players = [makePlayer()]
      const teams = [makeTeam(1)]

      save(0, 'RT Save', career, players, teams)

      const rawValue = localStorageMock.setItem.mock.calls[0][1]
      localStorageMock.getItem.mockReturnValue(rawValue)

      const data = load(0)
      expect(data!.players).toHaveLength(1)
      expect(data!.teams).toHaveLength(1)
      expect(data!.career.managerName).toBe('Manager')
    })
  })

  describe('listSaves', () => {
    it('returns an empty array when nothing is saved', () => {
      expect(listSaves()).toEqual([])
    })

    it('returns one slot for each saved slot', () => {
      const career = makeCareer()
      const savedValues: Record<string, string> = {}

      // Intercept setItem to capture values
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        savedValues[key] = value
      })
      localStorageMock.getItem.mockImplementation((key: string) => savedValues[key] ?? null)

      save(0, 'Slot 0', career, [], [makeTeam(1)])
      save(2, 'Slot 2', career, [], [makeTeam(1)])

      const slots = listSaves()
      expect(slots).toHaveLength(2)
      expect(slots.map((s) => s.slot).sort()).toEqual([0, 2])
    })

    it('each slot includes the correct slotName', () => {
      const career = makeCareer()
      const savedValues: Record<string, string> = {}

      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        savedValues[key] = value
      })
      localStorageMock.getItem.mockImplementation((key: string) => savedValues[key] ?? null)

      save(1, 'My Hero Save', career, [], [makeTeam(1)])

      const slots = listSaves()
      expect(slots[0].slotName).toBe('My Hero Save')
    })

    it('skips corrupted save slots silently', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === `${SAVE_KEY_PREFIX}1`) return 'corrupted{{{'
        return ''
      })
      const slots = listSaves()
      expect(slots).toHaveLength(0)
    })
  })

  describe('deleteSave', () => {
    it('calls removeItem with the correct key', () => {
      deleteSave(2)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(`${SAVE_KEY_PREFIX}2`)
    })

    it('results in load returning null after deletion', () => {
      const career = makeCareer()
      const savedValues: Record<string, string> = {}

      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        savedValues[key] = value
      })
      localStorageMock.getItem.mockImplementation((key: string) => savedValues[key] ?? null)
      localStorageMock.removeItem.mockImplementation((key: string) => {
        delete savedValues[key]
      })

      save(0, 'To Delete', career, [], [makeTeam(1)])
      deleteSave(0)

      expect(load(0)).toBeNull()
    })
  })
})
