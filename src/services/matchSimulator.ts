import type { Team } from '../types/team'
import type { Player } from '../types/player'
import type { Match, MatchResult, MatchEvent } from '../types/competition'
import type { TeamSnapshot, SnapshotPlayer } from '../types/team'
import { buildTeamSnapshot } from './formationService'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pickFrom<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function calcStoppageTime(halfEvents: MatchEvent[]): number {
  const injuries = halfEvents.filter((e) => e.type === 'INJURY').length
  const goals    = halfEvents.filter((e) => e.type === 'GOAL').length
  const yellows  = halfEvents.filter((e) => e.type === 'YELLOW').length
  const reds     = halfEvents.filter((e) => e.type === 'RED').length
  const raw = 1 + injuries * 1.5 + goals * 0.5 + yellows * 0.3 + reds * 1.0
  return Math.min(7, Math.max(1, Math.round(raw)))
}

function mkEvent(
  minute: number,
  type: MatchEvent['type'],
  teamId: number,
  text: string,
  isHome: boolean,
  player: SnapshotPlayer | null = null,
  nameStyle: 'western' | 'japanese' = 'western',
): MatchEvent {
  return {
    minute,
    type,
    teamId,
    text,
    isHome,
    ...(player ? { playerId: player.id, playerName: nameStyle === 'japanese' ? player.nameRomaji : player.name, playerSpriteUrl: player.spriteUrl } : {}),
  }
}

function tacticalChanceBonus(snapshot: TeamSnapshot): number {
  const t = snapshot.formation.tacticalType
  if (t === 'MIDFIELD_CONTROL') return 0.45
  if (t === 'COUNTER_ATTACK') return 0.20
  return 0
}

function tacticalGoalProbBonus(snapshot: TeamSnapshot): number {
  const t = snapshot.formation.tacticalType
  if (t === 'COUNTER_ATTACK') return 0.025
  return 0
}

function applyTacticalModifiers(snapshot: TeamSnapshot): TeamSnapshot {
  const t = snapshot.formation.tacticalType
  let { forwardScore, midfieldScore, defenseScore, goalkeeperScore } = snapshot

  switch (t) {
    case 'OFFENSIVE':
      forwardScore *= 1.06
      defenseScore *= 0.97
      break
    case 'DEFENSIVE':
      defenseScore *= 1.06
      forwardScore *= 0.97
      break
    case 'HIGH_PRESS':
      midfieldScore *= 1.05
      forwardScore *= 1.02
      break
    default:
      break
  }

  return { ...snapshot, forwardScore, midfieldScore, defenseScore, goalkeeperScore }
}

function calcAvgScore(snapshot: TeamSnapshot): number {
  return (snapshot.forwardScore + snapshot.midfieldScore + snapshot.defenseScore + snapshot.goalkeeperScore) / 4
}

function simulateHalf(
  attacker: TeamSnapshot,
  defender: TeamSnapshot,
  isHome: boolean,
  startMinute: number,
  nameStyle: 'western' | 'japanese' = 'western',
  goalProbMultiplier = 1.0,
): { goals: number; shots: number; shotsOnTarget: number; xg: number; events: MatchEvent[] } {
  const attackerMod = applyTacticalModifiers(attacker)
  const defenderMod = applyTacticalModifiers(defender)

  const avgAtk = calcAvgScore(attackerMod)
  const avgDef = calcAvgScore(defenderMod)

  const creationPower =
    attackerMod.forwardScore * 0.42 +
    attackerMod.midfieldScore * 0.43 +
    attackerMod.defenseScore * 0.05 +
    avgAtk * 0.10

  const preventionPower =
    defenderMod.midfieldScore * 0.28 +
    defenderMod.defenseScore * 0.47 +
    defenderMod.goalkeeperScore * 0.25

  const scoreBonus = clamp((creationPower - preventionPower) / 14, -3.5, 3.5)
  const homeBonus = isHome ? 0.65 : 0
  const chanceBonus = tacticalChanceBonus(attackerMod)
  const variance = rand(-1.1, 1.1)
  const baseChances = 5.5 + scoreBonus + homeBonus + chanceBonus + variance
  const chances = Math.max(0, Math.round(baseChances / 2))

  const finishingPower =
    attackerMod.forwardScore * 0.62 +
    attackerMod.midfieldScore * 0.25 +
    avgAtk * 0.13

  const savePower =
    defenderMod.goalkeeperScore * 0.55 +
    defenderMod.defenseScore * 0.35 +
    defenderMod.midfieldScore * 0.10

  const strengthDelta = clamp((finishingPower - savePower) / 165, -0.10, 0.11)
  const goalProbBonus = tacticalGoalProbBonus(attackerMod)
  const goalProb = clamp((0.20 + strengthDelta + goalProbBonus) * goalProbMultiplier, 0.06, 0.75)

  let goals = 0
  let shotsOnTarget = 0
  let xg = 0
  const events: MatchEvent[] = []
  const minuteStep = Math.floor(45 / Math.max(1, chances))

  const atkStarters = attacker.starters ?? []
  const defStarters = defender.starters ?? []
  const atkFwMd = atkStarters.filter((p) => p.position === 'FW' || p.position === 'MD')
  const atkFw   = atkStarters.filter((p) => p.position === 'FW')
  const defGk   = defStarters.filter((p) => p.position === 'GK')

  for (let i = 0; i < chances; i++) {
    const minute = startMinute + Math.min(44, i * minuteStep + Math.floor(rand(0, minuteStep)))
    xg += goalProb

    const onTarget = Math.random() < 0.55
    if (onTarget) {
      shotsOnTarget++
      if (Math.random() < goalProb) {
        goals++
        const scorer = pickFrom(atkFwMd.length > 0 ? atkFwMd : atkStarters)
        const scorerName = scorer ? (nameStyle === 'japanese' ? scorer.nameRomaji : scorer.name) : null
        events.push(mkEvent(
          minute, 'GOAL', attacker.id,
          scorerName ? `¡Gol de ${scorerName}!` : `¡Gol de ${attacker.name}!`,
          isHome, scorer, nameStyle,
        ))
      } else {
        const gk = pickFrom(defGk.length > 0 ? defGk : defStarters)
        const gkName = gk ? (nameStyle === 'japanese' ? gk.nameRomaji : gk.name) : null
        events.push(mkEvent(
          minute, 'SAVE', defender.id,
          gkName ? `Parada de ${gkName}` : `Parada de ${defender.name}`,
          !isHome, gk, nameStyle,
        ))
      }
    } else {
      const shooter = pickFrom(atkFw.length > 0 ? atkFw : atkFwMd.length > 0 ? atkFwMd : atkStarters)
      const shooterName = shooter ? (nameStyle === 'japanese' ? shooter.nameRomaji : shooter.name) : null
      events.push(mkEvent(
        minute, 'MISS', attacker.id,
        shooterName ? `Disparo fuera de ${shooterName}` : 'Disparo fuera',
        isHome, shooter, nameStyle,
      ))
    }
  }

  return { goals, shots: chances, shotsOnTarget, xg, events }
}

function generateDisciplinaryEvents(
  team: TeamSnapshot,
  yellows: number,
  reds: number,
  isHome: boolean,
  nameStyle: 'western' | 'japanese' = 'western',
): MatchEvent[] {
  const events: MatchEvent[] = []
  const starters = team.starters ?? []
  const dfMd = starters.filter((p) => p.position === 'DF' || p.position === 'MD')
  const pool = dfMd.length > 0 ? dfMd : starters
  const used = new Set<number>()

  for (let i = 0; i < yellows; i++) {
    const available = pool.filter((p) => !used.has(p.id))
    const player = pickFrom(available.length > 0 ? available : pool)
    if (player) used.add(player.id)
    const pName = player ? (nameStyle === 'japanese' ? player.nameRomaji : player.name) : null
    events.push(mkEvent(
      Math.floor(rand(5, 89)), 'YELLOW', team.id,
      pName ? `Tarjeta amarilla para ${pName}` : 'Tarjeta amarilla',
      isHome, player, nameStyle,
    ))
  }

  if (reds > 0) {
    const player = pickFrom(pool)
    const pName = player ? (nameStyle === 'japanese' ? player.nameRomaji : player.name) : null
    events.push(mkEvent(
      Math.floor(rand(30, 88)), 'RED', team.id,
      pName ? `Tarjeta roja para ${pName}` : 'Tarjeta roja',
      isHome, player, nameStyle,
    ))
  }

  if (starters.length > 0 && Math.random() < 0.15) {
    const player = pickFrom(starters)
    const pName = player ? (nameStyle === 'japanese' ? player.nameRomaji : player.name) : null
    events.push(mkEvent(
      Math.floor(rand(10, 85)), 'INJURY', team.id,
      pName ? `${pName} sale lesionado` : 'Lesión',
      isHome, player, nameStyle,
    ))
  }

  return events
}

export function simulate(homeTeam: TeamSnapshot, awayTeam: TeamSnapshot, match: Match, nameStyle: 'western' | 'japanese' = 'western'): MatchResult {
  const h1Home = simulateHalf(homeTeam, awayTeam, true, 1, nameStyle)
  const h1Away = simulateHalf(awayTeam, homeTeam, false, 1, nameStyle)
  const h2Home = simulateHalf(homeTeam, awayTeam, true, 46, nameStyle)
  const h2Away = simulateHalf(awayTeam, homeTeam, false, 46, nameStyle)

  const homeGoals = h1Home.goals + h2Home.goals
  const awayGoals = h1Away.goals + h2Away.goals
  const homeShots = h1Home.shots + h2Home.shots
  const awayShots = h1Away.shots + h2Away.shots
  const homeShotsOnTarget = h1Home.shotsOnTarget + h2Home.shotsOnTarget
  const awayShotsOnTarget = h1Away.shotsOnTarget + h2Away.shotsOnTarget
  const homeXG = h1Home.xg + h2Home.xg
  const awayXG = h1Away.xg + h2Away.xg

  const totalCreation =
    (homeTeam.midfieldScore + homeTeam.forwardScore) +
    (awayTeam.midfieldScore + awayTeam.forwardScore)
  const homeCreation = homeTeam.midfieldScore + homeTeam.forwardScore
  const homePossession = totalCreation > 0 ? Math.round((homeCreation / totalCreation) * 100) : 50
  const awayPossession = 100 - homePossession

  const homeFouls = Math.floor(rand(6, 18))
  const awayFouls = Math.floor(rand(6, 18))
  const homeYellows = Math.floor(rand(0, 4))
  const awayYellows = Math.floor(rand(0, 4))
  const homeReds = Math.random() < 0.05 ? 1 : 0
  const awayReds = Math.random() < 0.05 ? 1 : 0
  const homeCorners = Math.floor(rand(2, 12))
  const awayCorners = Math.floor(rand(2, 12))
  const homeSaves = awayShotsOnTarget - awayGoals
  const awaySaves = homeShotsOnTarget - homeGoals

  const phaseEvents: MatchEvent[] = [
    { minute: 1,  type: 'PHASE', teamId: match.homeTeamId, text: '¡Saque inicial!',             isHome: true },
    { minute: 45, type: 'PHASE', teamId: match.homeTeamId, text: 'Descanso.',                   isHome: true },
    { minute: 46, type: 'PHASE', teamId: match.homeTeamId, text: '¡Comienza la segunda parte!', isHome: true },
    { minute: 90, type: 'PHASE', teamId: match.homeTeamId, text: '¡Pitido final!',              isHome: true },
  ]

  const disciplinary = [
    ...generateDisciplinaryEvents(homeTeam, homeYellows, homeReds, true, nameStyle),
    ...generateDisciplinaryEvents(awayTeam, awayYellows, awayReds, false, nameStyle),
  ]

  const h1Stoppage = calcStoppageTime([...h1Home.events, ...h1Away.events])
  const h2Stoppage = calcStoppageTime([...h2Home.events, ...h2Away.events])

  const stoppageEvents: MatchEvent[] = [
    { minute: 45, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${h1Stoppage} min de añadido`, isHome: true },
    { minute: 90, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${h2Stoppage} min de añadido`, isHome: true },
  ]

  const allEvents: MatchEvent[] = [
    ...phaseEvents,
    ...h1Home.events,
    ...h1Away.events,
    ...h2Home.events,
    ...h2Away.events,
    ...disciplinary,
    ...stoppageEvents,
  ].sort((a, b) => a.minute - b.minute)

  return {
    homeGoals,
    awayGoals,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homePossession,
    awayPossession,
    homeFouls,
    awayFouls,
    homeYellows,
    awayYellows,
    homeReds,
    awayReds,
    homeCorners,
    awayCorners,
    homeSaves: Math.max(0, homeSaves),
    awaySaves: Math.max(0, awaySaves),
    homeXG: Math.round(homeXG * 100) / 100,
    awayXG: Math.round(awayXG * 100) / 100,
    events: allEvents,
    stoppageTime: { firstHalf: h1Stoppage, secondHalf: h2Stoppage },
  }
}

function simulatePenalties(
  homeSnap: TeamSnapshot,
  awaySnap: TeamSnapshot,
  match: Match,
): { homeScore: number; awayScore: number; winnerId: number } {
  // Higher GK score = better save probability (range ~15–45%)
  const homeSaveProb = clamp(0.15 + homeSnap.goalkeeperScore / 500, 0.15, 0.45)
  const awaySaveProb = clamp(0.15 + awaySnap.goalkeeperScore / 500, 0.15, 0.45)

  let homeScore = 0
  let awayScore = 0

  for (let i = 0; i < 5; i++) {
    if (Math.random() > awaySaveProb) homeScore++
    if (Math.random() > homeSaveProb) awayScore++
  }

  // Sudden death if still level after 5
  let sd = 0
  while (homeScore === awayScore && sd < 20) {
    if (Math.random() > awaySaveProb) homeScore++
    if (Math.random() > homeSaveProb) awayScore++
    sd++
  }

  // Break infinite tie edge case
  if (homeScore === awayScore) homeScore++

  return {
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? match.homeTeamId : match.awayTeamId,
  }
}

export function simulateCupTiebreak(
  homeTeam: TeamSnapshot,
  awayTeam: TeamSnapshot,
  match: Match,
  nameStyle: 'western' | 'japanese' = 'western',
): MatchResult {
  const regular = simulate(homeTeam, awayTeam, match, nameStyle)
  if (regular.homeGoals !== regular.awayGoals) return regular

  // Extra time: 2 × 15 min at 60% intensity
  const et1Home = simulateHalf(homeTeam, awayTeam, true,  91, nameStyle, 0.60)
  const et1Away = simulateHalf(awayTeam, homeTeam, false, 91, nameStyle, 0.60)
  const et2Home = simulateHalf(homeTeam, awayTeam, true,  106, nameStyle, 0.60)
  const et2Away = simulateHalf(awayTeam, homeTeam, false, 106, nameStyle, 0.60)

  const etHomeGoals = et1Home.goals + et2Home.goals
  const etAwayGoals = et1Away.goals + et2Away.goals
  const extraTime = { homeGoals: etHomeGoals, awayGoals: etAwayGoals }

  const etStoppage1 = calcStoppageTime([...et1Home.events, ...et1Away.events])
  const etStoppage2 = calcStoppageTime([...et2Home.events, ...et2Away.events])

  const etEvents: MatchEvent[] = [
    { minute: 90,  type: 'ET_START', teamId: match.homeTeamId, text: 'Comienza la prórroga', isHome: true },
    ...et1Home.events, ...et1Away.events,
    { minute: 105, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${etStoppage1} min`, isHome: true },
    { minute: 106, type: 'ET_START', teamId: match.homeTeamId, text: 'Segunda parte de prórroga', isHome: true },
    ...et2Home.events, ...et2Away.events,
    { minute: 120, type: 'ET_END',   teamId: match.homeTeamId, text: 'Final de la prórroga', isHome: true },
    { minute: 120, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${etStoppage2} min`, isHome: true },
  ]

  const updatedEvents = [...regular.events, ...etEvents].sort((a, b) => a.minute - b.minute)
  const updatedStoppage = {
    ...regular.stoppageTime,
    etFirst: etStoppage1,
    etSecond: etStoppage2,
  }

  if (etHomeGoals !== etAwayGoals) {
    return { ...regular, extraTime, stoppageTime: updatedStoppage, events: updatedEvents }
  }

  // Penalties
  const penalties = simulatePenalties(homeTeam, awayTeam, match)
  const penaltyEvent: MatchEvent = {
    minute: 121, type: 'PENALTY_SHOOTOUT', teamId: match.homeTeamId, isHome: true,
    text: `Penaltis: ${penalties.homeScore}–${penalties.awayScore} — Gana ${penalties.winnerId === match.homeTeamId ? homeTeam.name : awayTeam.name}`,
  }
  return {
    ...regular,
    extraTime,
    penalties,
    stoppageTime: updatedStoppage,
    events: [...updatedEvents, penaltyEvent],
  }
}

export function buildSnapshot(team: Team, players: Player[]): TeamSnapshot {
  return buildTeamSnapshot(team, players)
}
