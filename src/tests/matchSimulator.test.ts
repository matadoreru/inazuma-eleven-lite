import { describe, it, expect } from 'vitest'
import { simulate, buildSnapshot, simulateCupTiebreak } from '../services/matchSimulator'
import { buildTeamSnapshot } from '../services/formationService'
import type { Team, Formation, TeamSnapshot } from '../types/team'
import type { Player } from '../types/player'
import type { Match } from '../types/competition'
import { players as seedPlayers } from '../data/players'
import { teams as seedTeams } from '../data/teams'
import { supertechniques } from '../data/supertechniques'

const makeFormation = (tacticalType: Formation['tacticalType'] = 'BALANCED'): Formation => ({
  id: 1,
  name: '4-4-2',
  tacticalType,
  GK: 1,
  DF: 4,
  MD: 4,
  FW: 2,
})

const makePlayer = (id: number, position: Player['position'], overrides: Partial<Player> = {}): Player => ({
  id,
  name: `Player ${id}`,
  nameRomaji: `Player${id}`,
  gender: 'Masculino',
  position,
  positionAlt: null,
  element: 'FIRE',
  stats: { POT: 80, CON: 80, TEC: 80, PRE: 80, FIS: 80, AGI: 80, INT: 80, TOT: 80 },
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
  age: 22,
  teamId: 1,
  jerseyNumber: id,
  canonTier: 'common',
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  ...overrides,
})

const makeTeamWithLineup = (teamId: number, teamName: string): { team: Team; players: Player[] } => {
  const gk = makePlayer(teamId * 100 + 1, 'GK', { teamId })
  const df1 = makePlayer(teamId * 100 + 2, 'DF', { teamId })
  const df2 = makePlayer(teamId * 100 + 3, 'DF', { teamId })
  const df3 = makePlayer(teamId * 100 + 4, 'DF', { teamId })
  const df4 = makePlayer(teamId * 100 + 5, 'DF', { teamId })
  const md1 = makePlayer(teamId * 100 + 6, 'MD', { teamId })
  const md2 = makePlayer(teamId * 100 + 7, 'MD', { teamId })
  const md3 = makePlayer(teamId * 100 + 8, 'MD', { teamId })
  const md4 = makePlayer(teamId * 100 + 9, 'MD', { teamId })
  const fw1 = makePlayer(teamId * 100 + 10, 'FW', { teamId })
  const fw2 = makePlayer(teamId * 100 + 11, 'FW', { teamId })

  const players = [gk, df1, df2, df3, df4, md1, md2, md3, md4, fw1, fw2]

  const team: Team = {
    id: teamId,
    name: teamName,
    tier: 1,
    reputation: 50,
    budget: 100000,
    leagueId: 'league-1',
    captainId: gk.id,
    formation: makeFormation(),
    lineup: players.map((p) => ({
      playerId: p.id,
      assignedPosition: p.position,
      isStarter: true,
    })),
    playerIds: players.map((p) => p.id),
  }

  return { team, players }
}

const makeMatch = (): Match => ({
  id: 'match-1',
  leagueId: 'league-1',
  round: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  date: '2026-01-01',
  played: false,
  homeGoals: 0,
  awayGoals: 0,
  result: null,
})

const makeSnapshot = (id: number, name: string, formation: Formation = makeFormation()): TeamSnapshot => ({
  id,
  name,
  formation,
  forwardScore: 80,
  midfieldScore: 80,
  defenseScore: 80,
  goalkeeperScore: 80,
})

describe('buildSnapshot', () => {
  it('returns a TeamSnapshot with correct id and name', () => {
    const { team, players } = makeTeamWithLineup(1, 'Raimon')
    const snapshot = buildSnapshot(team, players)
    expect(snapshot.id).toBe(1)
    expect(snapshot.name).toBe('Raimon')
  })

  it('returns positive scores for a fully fielded lineup', () => {
    const { team, players } = makeTeamWithLineup(1, 'Raimon')
    const snapshot = buildSnapshot(team, players)
    expect(snapshot.forwardScore).toBeGreaterThan(0)
    expect(snapshot.midfieldScore).toBeGreaterThan(0)
    expect(snapshot.defenseScore).toBeGreaterThan(0)
    expect(snapshot.goalkeeperScore).toBeGreaterThan(0)
  })

  it('produces same result as buildTeamSnapshot', () => {
    const { team, players } = makeTeamWithLineup(1, 'Raimon')
    const s1 = buildSnapshot(team, players)
    const s2 = buildTeamSnapshot(team, players)
    expect(s1).toEqual(s2)
  })
})

describe('simulate', () => {
  it('returns a MatchResult with non-negative goal counts', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(result.homeGoals).toBeGreaterThanOrEqual(0)
    expect(result.awayGoals).toBeGreaterThanOrEqual(0)
  })

  it('returns an events array', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(Array.isArray(result.events)).toBe(true)
  })

  it('includes phase events (kick-off and full time)', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    const phaseEvents = result.events.filter((e) => e.type === 'PHASE')
    expect(phaseEvents.length).toBeGreaterThanOrEqual(2)
  })

  it('events are sorted by minute', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].minute).toBeGreaterThanOrEqual(result.events[i - 1].minute)
    }
  })

  it('possession sums to 100', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(result.homePossession + result.awayPossession).toBe(100)
  })

  it('saves are non-negative', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(result.homeSaves).toBeGreaterThanOrEqual(0)
    expect(result.awaySaves).toBeGreaterThanOrEqual(0)
  })

  it('includes one corner event for every corner in the match statistics', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    const cornerEvents = result.events.filter((event) => event.type === 'CORNER')
    expect(cornerEvents).toHaveLength(result.homeCorners + result.awayCorners)
  })

  it('returns numeric xG values', () => {
    const home = makeSnapshot(1, 'Raimon')
    const away = makeSnapshot(2, 'Teikoku')
    const result = simulate(home, away, makeMatch())
    expect(typeof result.homeXG).toBe('number')
    expect(typeof result.awayXG).toBe('number')
    expect(result.homeXG).toBeGreaterThanOrEqual(0)
    expect(result.awayXG).toBeGreaterThanOrEqual(0)
  })

  it('goal count in events matches the returned homeGoals + awayGoals total', () => {
    // Run multiple simulations to get at least one with goals (stochastic)
    const home = makeSnapshot(1, 'Raimon', makeFormation('OFFENSIVE'))
    const away = makeSnapshot(2, 'Teikoku', makeFormation('DEFENSIVE'))
    let totalGoalEvents = 0
    let totalGoals = 0
    const runs = 5
    for (let i = 0; i < runs; i++) {
      const result = simulate(home, away, makeMatch())
      totalGoalEvents += result.events.filter((e) => e.type === 'GOAL').length
      totalGoals += result.homeGoals + result.awayGoals
    }
    expect(totalGoalEvents).toBe(totalGoals)
  })

  it('strongly favors an elite 99-rated team over a weak team across repeated simulations', () => {
    const elite = { ...makeSnapshot(1, 'Elite'), forwardScore: 99, midfieldScore: 99, defenseScore: 99, goalkeeperScore: 99 }
    const weak = { ...makeSnapshot(2, 'Weak'), forwardScore: 45, midfieldScore: 45, defenseScore: 45, goalkeeperScore: 45 }
    let wins = 0
    let draws = 0
    let goalsFor = 0
    let goalsAgainst = 0
    for (let i = 0; i < 500; i++) {
      const result = simulate(elite, weak, makeMatch())
      if (result.homeGoals > result.awayGoals) wins++
      if (result.homeGoals === result.awayGoals) draws++
      goalsFor += result.homeGoals
      goalsAgainst += result.awayGoals
    }
    expect(wins / 500).toBeGreaterThan(0.9)
    expect(draws / 500).toBeLessThan(0.08)
    expect(goalsFor).toBeGreaterThan(goalsAgainst * 8)
  })

  it('makes Inazuma Kids competitive after every starter is raised to at least 99', () => {
    const kids = seedTeams.find((team) => team.name === 'Inazuma Kids FC')!
    const boostedPlayers = seedPlayers.map((player) => {
      if (!kids.playerIds.includes(player.id)) return player
      const stats: Player['stats'] = {
        POT: 99, CON: 99, TEC: 99, PRE: 99, FIS: 99, AGI: 99, INT: 99, TOT: 99,
      }
      return { ...player, stats }
    })
    const eliteKids = buildTeamSnapshot(kids, boostedPlayers)
    const rivals = seedTeams.filter((team) => team.leagueId === kids.leagueId && team.id !== kids.id)
    let wins = 0
    let matches = 0
    for (const rival of rivals) {
      const rivalSnapshot = buildTeamSnapshot(rival, seedPlayers)
      for (let i = 0; i < 100; i++) {
        const match = { ...makeMatch(), homeTeamId: kids.id, awayTeamId: rival.id }
        const result = simulate(eliteKids, rivalSnapshot, match)
        if (result.homeGoals > result.awayGoals) wins++
        matches++
      }
    }
    expect(wins / matches).toBeGreaterThan(0.75)
  })
})

describe('technique simulation', () => {
  it('stores every seeded supertechnique and its stat effects in the separate catalog', () => {
    const catalog = Object.values(supertechniques)
    expect(catalog.length).toBeGreaterThan(0)
    expect(catalog.every((technique) => technique.statBoosts !== undefined)).toBe(true)
  })

  it('includes techniques in the shot event instead of generating a separate event', () => {
    const tech: import('../types/player').Technique = { id: 1, name: 'Gran Fuego', type: 'Tiro', element: 'FIRE', POT: 150, PP: 20 }
    const snapWithTech = (id: number) => ({
      id, name: `Team ${id}`, formation: { tacticalType: 'BALANCED' } as any,
      forwardScore: 80, midfieldScore: 80, defenseScore: 60, goalkeeperScore: 60,
      starters: [
        { id: 10, name: 'Striker', nameRomaji: 'Striker', spriteUrl: '', position: 'FW' as const, element: 'FIRE' as const, techniques: [tech] },
      ],
    })
    let foundCombinedTechnique = false
    for (let i = 0; i < 100; i++) {
      const match = { id: 'm1', leagueId: 'test', round: 1, homeTeamId: 1, awayTeamId: 2, date: '2026-01-01', played: false, homeGoals: 0, awayGoals: 0, result: null } as any
      const result = simulate(snapWithTech(1), snapWithTech(2), match)
      expect(result.events.some(e => e.type === 'TECHNIQUE')).toBe(false)
      if (result.events.some(e => e.techniqueName === tech.name && e.text.includes(tech.name))) {
        foundCombinedTechnique = true
        break
      }
    }
    expect(foundCombinedTechnique).toBe(true)
  })

  it('never attributes a technique to a player who does not know it', () => {
    const auditedTeams = seedTeams.slice(0, 6)
    const playerById = new Map(seedPlayers.map((player) => [player.id, player]))
    let auditedTechniques = 0

    for (const team of seedTeams) {
      const snapshot = buildTeamSnapshot(team, seedPlayers)
      for (const snapshotPlayer of snapshot.starters ?? []) {
        const profile = playerById.get(snapshotPlayer.id)!
        const knownTechniques = [...profile.techniques, ...(profile.improvementTechniques ?? [])]
        expect(snapshotPlayer.techniques).toEqual(knownTechniques)
      }
    }

    for (let index = 0; index < auditedTeams.length - 1; index++) {
      const homeTeam = auditedTeams[index]
      const awayTeam = auditedTeams[index + 1]
      const home = buildTeamSnapshot(homeTeam, seedPlayers)
      const away = buildTeamSnapshot(awayTeam, seedPlayers)
      const match = { ...makeMatch(), homeTeamId: homeTeam.id, awayTeamId: awayTeam.id }

      for (let run = 0; run < 20; run++) {
        const result = simulate(home, away, match)
        for (const event of result.events) {
          for (const technique of event.techniques ?? []) {
            auditedTechniques++
            expect(technique.playerId).toBeDefined()
            const owner = playerById.get(technique.playerId!)
            expect(owner, `${technique.name} no tiene un jugador válido`).toBeDefined()
            expect(
              [...owner!.techniques, ...(owner!.improvementTechniques ?? [])]
                .some((known) => known.name === technique.name && known.type === technique.type),
              `${owner!.name} no conoce ${technique.name}`,
            ).toBe(true)
          }
        }
      }
    }

    expect(auditedTechniques).toBeGreaterThan(0)
  })

  it('uses the explicit stat boosts stored on a shooting technique', () => {
    const base = {
      id: 10, name: 'Striker', nameRomaji: 'Striker', spriteUrl: '', position: 'FW' as const,
      element: 'FIRE' as const,
      stats: { POT: 60, CON: 60, TEC: 60, PRE: 60, FIS: 60, AGI: 60, INT: 60, TOT: 60 },
    }
    const technique = {
      id: 1, name: 'Test Shot', type: 'Tiro' as const, element: 'FIRE' as const,
      POT: 60, PP: 20, statBoosts: { POT: 15, TEC: 8 },
    }
    const withTechnique = { ...makeSnapshot(1, 'Tech'), starters: [{ ...base, techniques: [technique] }] }
    const withoutTechnique = { ...makeSnapshot(1, 'Plain'), starters: [{ ...base, techniques: [] }] }
    const keeper = {
      ...makeSnapshot(2, 'Keeper'),
      starters: [{ ...base, id: 20, name: 'Keeper', nameRomaji: 'Keeper', position: 'GK' as const, element: 'WOOD' as const, techniques: [] }],
    }
    let withGoals = 0
    let withoutGoals = 0
    for (let i = 0; i < 600; i++) {
      withGoals += simulate(withTechnique, keeper, makeMatch()).homeGoals
      withoutGoals += simulate(withoutTechnique, keeper, makeMatch()).homeGoals
    }
    expect(withGoals).toBeGreaterThan(withoutGoals * 1.1)
  })
})

describe('simulateCupTiebreak', () => {
  const match = { id: 'm1', leagueId: 'cup', type: 'cup', round: 1,
    homeTeamId: 1, awayTeamId: 2, date: '2026-01-01', played: false,
    homeGoals: 0, awayGoals: 0, result: null } as any
  const snap = (id: number) => ({
    id, name: `Team ${id}`, formation: { tacticalType: 'BALANCED' } as any,
    forwardScore: 70, midfieldScore: 70, defenseScore: 70, goalkeeperScore: 70, starters: [],
  })

  it('returns a winner even when regular time is a draw', () => {
    // Run 50 times — each must have a definitive winner
    for (let i = 0; i < 50; i++) {
      const result = simulateCupTiebreak(snap(1), snap(2), match)
      const totalHome = result.homeGoals + (result.extraTime?.homeGoals ?? 0)
      const totalAway = result.awayGoals + (result.extraTime?.awayGoals ?? 0)
      const penaltyWinner = result.penalties?.winnerId
      const hasWinner = totalHome !== totalAway || penaltyWinner !== undefined
      expect(hasWinner).toBe(true)
    }
  })

  it('includes ET_START event when match goes to extra time', () => {
    // Force identical teams to maximize draw probability; check event presence over many runs
    let foundET = false
    for (let i = 0; i < 200; i++) {
      const result = simulateCupTiebreak(snap(1), snap(2), match)
      if (result.events.some(e => e.type === 'ET_START')) { foundET = true; break }
    }
    expect(foundET).toBe(true)
  })
})
