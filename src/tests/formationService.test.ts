import { describe, it, expect } from 'vitest'
import {
  positionModifier,
  calcForwardScore,
  calcMidfieldScore,
  calcDefenseScore,
  calcGoalkeeperScore,
  applyFormation,
  buildTeamSnapshot,
} from '../services/formationService'
import type { Player } from '../types/player'
import type { Team, Formation } from '../types/team'

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
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
  ...overrides,
})

const makeFormation = (id: number, tacticalType: Formation['tacticalType'] = 'BALANCED'): Formation => ({
  id,
  name: '4-4-2',
  tacticalType,
  GK: 1,
  DF: 4,
  MD: 4,
  FW: 2,
})

const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 1,
  name: 'Raimon',
  tier: 1,
  reputation: 50,
  budget: 100000,
  leagueId: 'league-1',
  captainId: 1,
  formation: makeFormation(1),
  lineup: [],
  playerIds: [],
  ...overrides,
})

describe('positionModifier', () => {
  it('returns 1.0 when slot and player position match', () => {
    expect(positionModifier('FW', 'FW')).toBe(1.0)
    expect(positionModifier('MD', 'MD')).toBe(1.0)
    expect(positionModifier('DF', 'DF')).toBe(1.0)
    expect(positionModifier('GK', 'GK')).toBe(1.0)
  })

  it('returns 0.30 when GK is involved in a mismatch', () => {
    expect(positionModifier('GK', 'FW')).toBe(0.30)
    expect(positionModifier('FW', 'GK')).toBe(0.30)
    expect(positionModifier('GK', 'DF')).toBe(0.30)
  })

  it('returns 0.82 for adjacent positions (DF<->MD and MD<->FW)', () => {
    expect(positionModifier('DF', 'MD')).toBe(0.82)
    expect(positionModifier('MD', 'DF')).toBe(0.82)
    expect(positionModifier('MD', 'FW')).toBe(0.82)
    expect(positionModifier('FW', 'MD')).toBe(0.82)
  })

  it('returns 0.65 for non-adjacent, non-GK mismatches (DF<->FW)', () => {
    expect(positionModifier('DF', 'FW')).toBe(0.65)
    expect(positionModifier('FW', 'DF')).toBe(0.65)
  })
})

describe('calcForwardScore', () => {
  it('returns the correct weighted sum with modifier 1.0', () => {
    const player = makePlayer()
    const s = player.stats
    const expected = s.POT * 0.40 + s.TEC * 0.25 + s.CON * 0.15 + s.AGI * 0.10 + s.INT * 0.10
    expect(calcForwardScore(player, 1.0)).toBeCloseTo(expected)
  })

  it('scales linearly with modifier', () => {
    const player = makePlayer()
    const base = calcForwardScore(player, 1.0)
    expect(calcForwardScore(player, 0.82)).toBeCloseTo(base * 0.82)
    expect(calcForwardScore(player, 0.5)).toBeCloseTo(base * 0.5)
  })
})

describe('calcMidfieldScore', () => {
  it('returns the correct weighted sum with modifier 1.0', () => {
    const player = makePlayer()
    const s = player.stats
    const expected = s.CON * 0.30 + s.TEC * 0.25 + s.INT * 0.25 + s.PRE * 0.10 + s.AGI * 0.10
    expect(calcMidfieldScore(player, 1.0)).toBeCloseTo(expected)
  })
})

describe('calcDefenseScore', () => {
  it('returns the correct weighted sum with modifier 1.0', () => {
    const player = makePlayer()
    const s = player.stats
    const expected = s.PRE * 0.35 + s.FIS * 0.25 + s.INT * 0.20 + s.AGI * 0.10 + s.CON * 0.10
    expect(calcDefenseScore(player, 1.0)).toBeCloseTo(expected)
  })
})

describe('calcGoalkeeperScore', () => {
  it('returns the correct weighted sum with modifier 1.0', () => {
    const player = makePlayer()
    const s = player.stats
    const expected = s.PRE * 0.30 + s.AGI * 0.25 + s.FIS * 0.20 + s.INT * 0.15 + s.TEC * 0.10
    expect(calcGoalkeeperScore(player, 1.0)).toBeCloseTo(expected)
  })
})

describe('applyFormation', () => {
  it('changes the team formation when the formation id exists', () => {
    const team = makeTeam({ formation: makeFormation(1) })
    const formations = [makeFormation(1), makeFormation(2, 'OFFENSIVE')]
    const updated = applyFormation(team, 2, formations)
    expect(updated.formation.id).toBe(2)
    expect(updated.formation.tacticalType).toBe('OFFENSIVE')
  })

  it('returns the original team when formation id is not found', () => {
    const team = makeTeam({ formation: makeFormation(1) })
    const updated = applyFormation(team, 99, [makeFormation(1)])
    expect(updated).toBe(team)
  })

  it('does not mutate the original team', () => {
    const team = makeTeam({ formation: makeFormation(1) })
    const formations = [makeFormation(1), makeFormation(2, 'DEFENSIVE')]
    applyFormation(team, 2, formations)
    expect(team.formation.id).toBe(1)
  })
})

describe('buildTeamSnapshot', () => {
  it('returns a snapshot with correct id and name', () => {
    const team = makeTeam()
    const snapshot = buildTeamSnapshot(team, [])
    expect(snapshot.id).toBe(team.id)
    expect(snapshot.name).toBe(team.name)
    expect(snapshot.formation).toBe(team.formation)
  })

  it('computes scores of zero when lineup is empty', () => {
    const team = makeTeam()
    const snapshot = buildTeamSnapshot(team, [])
    expect(snapshot.forwardScore).toBe(0)
    expect(snapshot.midfieldScore).toBe(0)
    expect(snapshot.defenseScore).toBe(0)
    expect(snapshot.goalkeeperScore).toBe(0)
  })

  it('correctly computes forward score for a single FW starter', () => {
    const player = makePlayer({ id: 10, position: 'FW' })
    const team = makeTeam({
      lineup: [{ playerId: 10, assignedPosition: 'FW', isStarter: true }],
    })
    const snapshot = buildTeamSnapshot(team, [player])
    const expected = calcForwardScore(player, positionModifier('FW', 'FW'))
    expect(snapshot.forwardScore).toBeCloseTo(expected)
  })

  it('applies position modifier when player is out of position', () => {
    const player = makePlayer({ id: 10, position: 'MD' })
    const team = makeTeam({
      lineup: [{ playerId: 10, assignedPosition: 'FW', isStarter: true }],
    })
    const snapshot = buildTeamSnapshot(team, [player])
    const mod = positionModifier('FW', 'MD') // should be 0.82
    const expected = calcForwardScore(player, mod)
    expect(snapshot.forwardScore).toBeCloseTo(expected)
  })

  it('averages scores across multiple starters in the same slot', () => {
    const fw1 = makePlayer({ id: 1, position: 'FW' })
    const fw2 = makePlayer({ id: 2, position: 'FW', stats: { ...makePlayer().stats, POT: 50 } })
    const team = makeTeam({
      lineup: [
        { playerId: 1, assignedPosition: 'FW', isStarter: true },
        { playerId: 2, assignedPosition: 'FW', isStarter: true },
      ],
    })
    const snapshot = buildTeamSnapshot(team, [fw1, fw2])
    const score1 = calcForwardScore(fw1, 1.0)
    const score2 = calcForwardScore(fw2, 1.0)
    expect(snapshot.forwardScore).toBeCloseTo((score1 + score2) / 2)
  })

  it('ignores non-starter slots', () => {
    const player = makePlayer({ id: 10, position: 'FW' })
    const team = makeTeam({
      lineup: [{ playerId: 10, assignedPosition: 'FW', isStarter: false }],
    })
    const snapshot = buildTeamSnapshot(team, [player])
    expect(snapshot.forwardScore).toBe(0)
  })

  it('applies equipment stat bonuses to snapshot scores', () => {
    const base = makePlayer({ id: 10, position: 'FW' })
    const equipped = makePlayer({
      id: 10,
      position: 'FW',
      equipment: { gloves: null, boots: { id: 'b1', slot: 'boots', name: 'Test', statBonuses: { POT: 10 }, tier: 1 }, pendant: null, bracelet: null },
    })
    const team = makeTeam({ lineup: [{ playerId: 10, assignedPosition: 'FW', isStarter: true }] })
    const baseSnapshot = buildTeamSnapshot(team, [base])
    const equippedSnapshot = buildTeamSnapshot(team, [equipped])
    // +10 POT with weight 0.40 = +4.0 to forward score
    expect(equippedSnapshot.forwardScore).toBeCloseTo(baseSnapshot.forwardScore + 4.0)
  })
})
