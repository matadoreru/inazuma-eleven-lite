import { describe, it, expect } from 'vitest'
import { computeSeasonStatus } from '../store/careerStore'

// We test the pure helper by re-exporting it.
describe('computeSeasonStatus', () => {
  it('returns all_finished when the current date reaches the final season day', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      teamId: 1,
      season: { currentDate: '2026-06-01', endDate: '2026-06-01', matches: [] } as any,
      allLeagueSeasons: {},
      cup: null,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('all_finished')
  })

  it('returns user_finished when the final day is reached but NPC matches on that day are still pending', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      teamId: 1,
      season: { currentDate: '2026-06-10', endDate: '2026-06-01', matches: [] } as any,
      allLeagueSeasons: {
        ext: { matches: [{ date: '2026-06-10' }], standings: [], teamIds: [], leagueId: 'ext', totalRounds: 1, finished: false },
      } as any,
      cup: null,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('user_finished')
  })

  it('returns user_finished when the user has no more matches before the final day', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      teamId: 1,
      season: { currentDate: '2026-05-20', endDate: '2026-06-01', matches: [] } as any,
      allLeagueSeasons: {},
      cup: null,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('user_finished')
  })

  it('returns active when the user still has pending matches', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      teamId: 1,
      season: {
        currentDate: '2026-05-20',
        endDate: '2026-06-01',
        matches: [{ played: false, date: '2026-05-25', homeTeamId: 1, awayTeamId: 2 }],
      } as any,
      allLeagueSeasons: {},
      cup: null,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('active')
  })
})
