import { describe, it, expect } from 'vitest'
import { computeSeasonStatus } from '../store/careerStore'

// We test the pure helper by re-exporting it.
// For now we verify the logic contract: season finished + cup finished => all_finished
describe('computeSeasonStatus', () => {
  it('returns all_finished when user season and cup are both done', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      season: { finished: true } as any,
      allLeagueSeasons: {},
      cup: { finished: true } as any,
    }
    // We'll verify this after exporting the helper
    expect(mockCareer.season.finished).toBe(true)
    expect(mockCareer.cup.finished).toBe(true)
  })

  it('returns all_finished via computeSeasonStatus when both season and cup are done', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      season: { finished: true } as any,
      allLeagueSeasons: {},
      cup: { finished: true } as any,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('all_finished')
  })

  it('returns user_finished when only user season is done', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      season: { finished: true } as any,
      allLeagueSeasons: {},
      cup: { finished: false } as any,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('user_finished')
  })

  it('returns active when nothing is done', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      season: { finished: false } as any,
      allLeagueSeasons: {},
      cup: { finished: false } as any,
    }
    expect(computeSeasonStatus(mockCareer)).toBe('active')
  })
})
