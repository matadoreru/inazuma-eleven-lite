import { describe, it, expect } from 'vitest'
import { assignSquadFromFreeAgents, buildCustomTeam } from '../services/customClubService'
import type { Player } from '../types/player'
import type { Team } from '../types/team'
import type { CustomClubConfig } from '../types/team'

function makeFreeAgent(id: number, position: Player['position'], media: number): Player {
  const base = media * 7
  return {
    id,
    name: `Player ${id}`,
    nameRomaji: `Player ${id}`,
    gender: 'Masculino',
    position,
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: base, CON: base, TEC: base, PRE: base, FIS: base, AGI: base, INT: base, TOT: media },
    career: {
      maxLevel: 80, potential: 60, growthRate: 1.0, contractStatus: 'free',
      marketValue: 50000, salary: 1000, experience: 0, trainingProgress: 0,
      trainingSessionsThisWeek: 0, positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0,
    isSuspended: false, suspensionMatches: 0,
    age: 17,
    teamId: 0,
    jerseyNumber: 0,
    canonTier: 'common',
    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  }
}

function makeTeamedPlayer(id: number, position: Player['position'], media: number): Player {
  return { ...makeFreeAgent(id, position, media), teamId: 1, career: { ...makeFreeAgent(id, position, media).career, contractStatus: 'contracted' } }
}

// 40 free agents covering all positions and a range of medias
const FREE_AGENTS: Player[] = [
  // GKs
  makeFreeAgent(1001, 'GK', 72), makeFreeAgent(1002, 'GK', 76), makeFreeAgent(1003, 'GK', 80),
  makeFreeAgent(1004, 'GK', 84), makeFreeAgent(1005, 'GK', 88), makeFreeAgent(1006, 'GK', 92),
  makeFreeAgent(1007, 'GK', 96), makeFreeAgent(1008, 'GK', 100),
  // DFs
  makeFreeAgent(1009, 'DF', 71), makeFreeAgent(1010, 'DF', 74), makeFreeAgent(1011, 'DF', 77),
  makeFreeAgent(1012, 'DF', 80), makeFreeAgent(1013, 'DF', 83), makeFreeAgent(1014, 'DF', 86),
  makeFreeAgent(1015, 'DF', 89), makeFreeAgent(1016, 'DF', 92), makeFreeAgent(1017, 'DF', 95),
  makeFreeAgent(1018, 'DF', 98),
  // MDs
  makeFreeAgent(1019, 'MD', 72), makeFreeAgent(1020, 'MD', 75), makeFreeAgent(1021, 'MD', 78),
  makeFreeAgent(1022, 'MD', 81), makeFreeAgent(1023, 'MD', 84), makeFreeAgent(1024, 'MD', 87),
  makeFreeAgent(1025, 'MD', 90), makeFreeAgent(1026, 'MD', 93), makeFreeAgent(1027, 'MD', 96),
  makeFreeAgent(1028, 'MD', 99),
  // FWs
  makeFreeAgent(1029, 'FW', 73), makeFreeAgent(1030, 'FW', 76), makeFreeAgent(1031, 'FW', 79),
  makeFreeAgent(1032, 'FW', 82), makeFreeAgent(1033, 'FW', 85), makeFreeAgent(1034, 'FW', 88),
  makeFreeAgent(1035, 'FW', 91), makeFreeAgent(1036, 'FW', 94), makeFreeAgent(1037, 'FW', 97),
  makeFreeAgent(1038, 'FW', 100),
]

const TEAM_PLAYERS: Player[] = [
  makeTeamedPlayer(2001, 'GK', 90),
  makeTeamedPlayer(2002, 'FW', 95),
]

const ALL_PLAYERS = [...FREE_AGENTS, ...TEAM_PLAYERS]

const BASE_CONFIG: CustomClubConfig = {
  name: 'Test FC',
  badgeUrl: '/teams/default_team_icon.png',
  badgeIsCustom: false,
  strengthTier: 'normal',
  leagueId: 'second_division',
}

const EXISTING_TEAMS: Team[] = [
  {
    id: 0, name: 'Team A', tier: 3, reputation: 50, budget: 300000,
    leagueId: 'second_division', captainId: 2001,
    formation: { id: 1, name: 'Basic', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 },
    lineup: [], playerIds: [2001, 2002],
  },
]

describe('assignSquadFromFreeAgents', () => {
  it('returns only players with teamId 0', () => {
    const { playerIds } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    playerIds.forEach(id => {
      const p = ALL_PLAYERS.find(pl => pl.id === id)!
      expect(p.teamId).toBe(0)
    })
  })

  it('assigns at least 11 players (enough for a starting lineup)', () => {
    const { playerIds } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    expect(playerIds.length).toBeGreaterThanOrEqual(11)
  })

  it('lineup has exactly 11 starters', () => {
    const { lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const starters = lineup.filter(s => s.isStarter)
    expect(starters.length).toBe(11)
  })

  it('lineup starters include 1 GK, 4 DF, 4 MD, 2 FW', () => {
    const { lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const starters = lineup.filter(s => s.isStarter)
    expect(starters.filter(s => s.assignedPosition === 'GK').length).toBe(1)
    expect(starters.filter(s => s.assignedPosition === 'DF').length).toBe(4)
    expect(starters.filter(s => s.assignedPosition === 'MD').length).toBe(4)
    expect(starters.filter(s => s.assignedPosition === 'FW').length).toBe(2)
  })

  it('very_strong tier selects higher-media players than weak tier', () => {
    const { playerIds: strongIds } = assignSquadFromFreeAgents(
      { ...BASE_CONFIG, strengthTier: 'very_strong' }, ALL_PLAYERS)
    const { playerIds: weakIds } = assignSquadFromFreeAgents(
      { ...BASE_CONFIG, strengthTier: 'weak' }, ALL_PLAYERS)

    const avgMedia = (ids: number[]) => {
      const medias = ids.map(id => {
        const p = ALL_PLAYERS.find(pl => pl.id === id)!
        return Math.round((p.stats.POT + p.stats.CON + p.stats.TEC + p.stats.PRE + p.stats.FIS + p.stats.AGI + p.stats.INT) / 7)
      })
      return medias.reduce((a, b) => a + b, 0) / medias.length
    }
    expect(avgMedia(strongIds)).toBeGreaterThan(avgMedia(weakIds))
  })

  it('does not duplicate player IDs', () => {
    const { playerIds } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    expect(playerIds.length).toBe(new Set(playerIds).size)
  })
})

describe('buildCustomTeam', () => {
  it('returns a team with the correct name and badgeUrl', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const team = buildCustomTeam(BASE_CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(team.name).toBe('Test FC')
    expect(team.badgeUrl).toBe('/teams/default_team_icon.png')
  })

  it('returns a team ID one higher than the max existing ID', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const team = buildCustomTeam(BASE_CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(team.id).toBe(1)  // max existing is 0, so 0 + 1 = 1
  })

  it('assigns the correct leagueId', () => {
    const config = { ...BASE_CONFIG, leagueId: 'first_division' }
    const { playerIds, lineup } = assignSquadFromFreeAgents(config, ALL_PLAYERS)
    const team = buildCustomTeam(config, EXISTING_TEAMS, playerIds, lineup)
    expect(team.leagueId).toBe('first_division')
  })

  it('very_strong tier gives higher reputation than weak tier', () => {
    const { playerIds: ids1, lineup: l1 } = assignSquadFromFreeAgents({ ...BASE_CONFIG, strengthTier: 'very_strong' }, ALL_PLAYERS)
    const { playerIds: ids2, lineup: l2 } = assignSquadFromFreeAgents({ ...BASE_CONFIG, strengthTier: 'weak' }, ALL_PLAYERS)
    const strong = buildCustomTeam({ ...BASE_CONFIG, strengthTier: 'very_strong' }, EXISTING_TEAMS, ids1, l1)
    const weak = buildCustomTeam({ ...BASE_CONFIG, strengthTier: 'weak' }, EXISTING_TEAMS, ids2, l2)
    expect(strong.reputation).toBeGreaterThan(weak.reputation)
  })

  it('captainId is one of the assigned playerIds', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const team = buildCustomTeam(BASE_CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(playerIds).toContain(team.captainId)
  })
})
