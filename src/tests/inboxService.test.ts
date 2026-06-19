import { describe, it, expect } from 'vitest'
import { addEvent } from '../services/inboxService'
import type { Career } from '../types/career'

const makeCareer = (): Career => ({
  id: '1', managerName: 'Test', managerAvatar: '', teamId: 1,
  season: {} as any, seasonNumber: 1, totalBudgetSpent: 0, totalBudgetEarned: 0,
  objectives: [], inbox: [], transferHistory: [], watchlist: [], seasonHistory: [],
  playerPotential: {}, weeklyTrainingPlan: null, lastCompletedTrainingSlots: null,
  inventory: { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] },
  allLeagueSeasons: {}, cup: null, seasonStatus: 'active', lastSeasonReview: null,
  outgoingNegotiations: [], incomingOffers: [], difficulty: {} as any, nameStyle: 'western',
  createdAt: '2026-01-01', lastSavedAt: '2026-01-01',
})

describe('addEvent', () => {
  it('stores targetScreen and targetEntityId when provided', () => {
    const career = makeCareer()
    const result = addEvent('PLAYER_INJURED', 'Lesión', 'Jugador lesionado', career, undefined, 'squad', '42')
    expect(result.inbox[0].targetScreen).toBe('squad')
    expect(result.inbox[0].targetEntityId).toBe('42')
  })

  it('leaves targetScreen undefined when not provided', () => {
    const career = makeCareer()
    const result = addEvent('NEWS', 'Noticia', 'Cuerpo', career)
    expect(result.inbox[0].targetScreen).toBeUndefined()
  })
})
