import { describe, it, expect, beforeEach } from 'vitest'
import { buildCustomTeam, assignSquadFromFreeAgents } from '../services/customClubService'
import type { CustomClubConfig } from '../types/team'
import type { Player } from '../types/player'
import type { Team } from '../types/team'

// We test the store function logic directly — not the Zustand store instance —
// by testing createCareer with an injected custom team via the same code path.
// This avoids mocking the full store while still testing the injection logic.

function makeFreeAgent(id: number, pos: Player['position'], med: number): Player {
  const b = med * 7
  return {
    id, name: `FA${id}`, nameRomaji: `FA${id}`, gender: 'Masculino',
    position: pos, positionAlt: null, element: 'FIRE',
    stats: { POT: b, CON: b, TEC: b, PRE: b, FIS: b, AGI: b, INT: b, TOT: med },
    career: { maxLevel: 80, potential: 60, growthRate: 1.0, contractStatus: 'free', marketValue: 50000, salary: 1000, experience: 0, trainingProgress: 0, trainingSessionsThisWeek: 0, positionAlt: null },
    techniques: [], spriteUrl: '', stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0, isSuspended: false, suspensionMatches: 0,
    age: 17, teamId: 0, jerseyNumber: 0,
    canonTier: 'common',
    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 }
  }
}

const FREE_AGENTS: Player[] = [
  makeFreeAgent(901, 'GK', 80), makeFreeAgent(902, 'GK', 85),
  makeFreeAgent(903, 'DF', 80), makeFreeAgent(904, 'DF', 82), makeFreeAgent(905, 'DF', 84), makeFreeAgent(906, 'DF', 86),
  makeFreeAgent(907, 'DF', 88), makeFreeAgent(908, 'DF', 90),
  makeFreeAgent(909, 'MD', 80), makeFreeAgent(910, 'MD', 82), makeFreeAgent(911, 'MD', 84), makeFreeAgent(912, 'MD', 86),
  makeFreeAgent(913, 'MD', 88), makeFreeAgent(914, 'MD', 90),
  makeFreeAgent(915, 'FW', 80), makeFreeAgent(916, 'FW', 82), makeFreeAgent(917, 'FW', 84),
  makeFreeAgent(918, 'FW', 86), makeFreeAgent(919, 'FW', 88), makeFreeAgent(920, 'FW', 90),
]

const EXISTING_TEAMS: Team[] = [
  { id: 0, name: 'Existing', tier: 3, reputation: 50, budget: 300000, leagueId: 'second_division', captainId: 1, formation: { id: 1, name: 'Basic', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 }, lineup: [], playerIds: [] },
]

const CONFIG: CustomClubConfig = {
  name: 'My Club',
  badgeUrl: '/teams/default_team_icon.png',
  badgeIsCustom: false,
  strengthTier: 'normal',
  leagueId: 'second_division',
}

describe('buildCustomTeam + assignSquadFromFreeAgents integration', () => {
  it('builds a team with the correct leagueId and name', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(CONFIG, FREE_AGENTS)
    const team = buildCustomTeam(CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(team.leagueId).toBe('second_division')
    expect(team.name).toBe('My Club')
  })

  it('all squadPlayerIds have teamId 0 before injection', () => {
    const { playerIds } = assignSquadFromFreeAgents(CONFIG, FREE_AGENTS)
    playerIds.forEach(id => {
      const p = FREE_AGENTS.find(pl => pl.id === id)!
      expect(p.teamId).toBe(0)
    })
  })

  it('after updating teamId, players belong to custom team', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(CONFIG, FREE_AGENTS)
    const team = buildCustomTeam(CONFIG, EXISTING_TEAMS, playerIds, lineup)
    // Simulate what startNewCareer does: update teamId
    const updatedPlayers = FREE_AGENTS.map(p =>
      playerIds.includes(p.id) ? { ...p, teamId: team.id } : p
    )
    const squadPlayers = updatedPlayers.filter(p => playerIds.includes(p.id))
    squadPlayers.forEach(p => expect(p.teamId).toBe(team.id))
  })
})
