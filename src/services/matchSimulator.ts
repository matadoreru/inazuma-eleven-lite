import type { Team } from '../types/team'
import type { Player, Technique, Element } from '../types/player'
import type { Match, MatchResult, MatchEvent } from '../types/competition'
import type { TeamSnapshot, SnapshotPlayer } from '../types/team'
import { buildTeamSnapshot } from './formationService'
import { applyTechniqueStatBoosts, getTechniqueStatBoosts } from './techniqueService'

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

function pickTechnique(player: SnapshotPlayer | null, type: Technique['type']): Technique | null {
  if (!player?.techniques) return null
  return player.techniques
    .filter((t) => t.type === type)
    .sort((a, b) => b.POT - a.POT)[0] ?? null
}

// FIRE > WOOD > WIND > MOUNTAIN > FIRE
const ELEMENT_ADVANTAGES: Record<Element, Element> = {
  FIRE: 'WOOD', WOOD: 'WIND', WIND: 'MOUNTAIN', MOUNTAIN: 'FIRE',
}

function elementMatchupBonus(atkElement?: Element | '', defElement?: Element | ''): number {
  const normalizedAtk = atkElement || null
  const normalizedDef = defElement || null
  if (!normalizedAtk || !normalizedDef) return 0
  if (ELEMENT_ADVANTAGES[normalizedAtk] === normalizedDef) return 0.05
  if (ELEMENT_ADVANTAGES[normalizedDef] === normalizedAtk) return -0.05
  return 0
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
    ...(player ? { participants: [{
      playerId: player.id,
      playerName: nameStyle === 'japanese' ? player.nameRomaji : player.name,
      playerSpriteUrl: player.spriteUrl,
      isHome,
    }] } : {}),
  }
}

function eventParticipants(
  entries: Array<{ player: SnapshotPlayer | null; isHome: boolean }>,
  nameStyle: 'western' | 'japanese',
): NonNullable<MatchEvent['participants']> {
  const seen = new Set<number>()
  return entries.flatMap(({ player, isHome }) => {
    if (!player || seen.has(player.id)) return []
    seen.add(player.id)
    return [{
      playerId: player.id,
      playerName: nameStyle === 'japanese' ? player.nameRomaji : player.name,
      playerSpriteUrl: player.spriteUrl,
      isHome,
    }]
  })
}

function tacticalChanceBonus(snapshot: TeamSnapshot): number {
  const t = snapshot.formation.tacticalType
  if (t === 'MIDFIELD_CONTROL') return 0.012
  if (t === 'COUNTER_ATTACK') return 0.008
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

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function playerScore(
  player: SnapshotPlayer | null,
  weights: Partial<Record<Exclude<keyof Player['stats'], 'TOT'>, number>>,
  fallback: number,
  technique: Technique | null = null,
): number {
  if (!player?.stats) return fallback
  const passiveStats = (player.techniques ?? [])
    .filter((candidate) => candidate.type === 'Mejora')
    .reduce(
      (stats, improvement) => applyTechniqueStatBoosts(stats, getTechniqueStatBoosts(improvement)),
      player.stats,
    )
  const stats = technique
    ? applyTechniqueStatBoosts(passiveStats, getTechniqueStatBoosts(technique))
    : passiveStats
  let score = 0
  let totalWeight = 0
  for (const [key, weight] of Object.entries(weights)) {
    score += stats[key as keyof typeof weights]! * weight!
    totalWeight += weight!
  }
  return totalWeight > 0 ? score / totalWeight : fallback
}

function simulateHalf(
  attacker: TeamSnapshot,
  defender: TeamSnapshot,
  isHome: boolean,
  startMinute: number,
  nameStyle: 'western' | 'japanese' = 'western',
  intensityMultiplier = 1.0,
  duration = 45,
): { goals: number; shots: number; shotsOnTarget: number; xg: number; events: MatchEvent[] } {
  const attackerMod = applyTacticalModifiers(attacker)
  const defenderMod = applyTacticalModifiers(defender)

  let goals = 0
  let shots = 0
  let shotsOnTarget = 0
  let xg = 0
  const events: MatchEvent[] = []

  const atkStarters = attacker.starters ?? []
  const defStarters = defender.starters ?? []
  const atkFwMd = atkStarters.filter((p) => p.position === 'FW' || p.position === 'MD')
  const atkFw   = atkStarters.filter((p) => p.position === 'FW')
  const defDf   = defStarters.filter((p) => p.position === 'DF')
  const defGk   = defStarters.filter((p) => p.position === 'GK')

  // A dribbling technique improves progression, but does not directly guarantee a shot.
  const topMid = atkFwMd.find((p) => p.position === 'MD') ?? null
  const regateTech = pickTechnique(topMid ?? null, 'Regate')
  const regatePower = playerScore(topMid, { CON: 0.55, AGI: 0.30, TEC: 0.15 }, attackerMod.midfieldScore, regateTech)
  const normalProgression = playerScore(topMid, { CON: 0.55, AGI: 0.30, TEC: 0.15 }, attackerMod.midfieldScore)
  const creationPower = attackerMod.midfieldScore * 0.52 + attackerMod.forwardScore * 0.48 + (regatePower - normalProgression)
  const preventionPower = defenderMod.midfieldScore * 0.30 + defenderMod.defenseScore * 0.70
  const territory = sigmoid((creationPower - preventionPower + (isHome ? 2.5 : 0)) / 12)
  const shotChancePerMinute = clamp((0.025 + 0.22 * territory + tacticalChanceBonus(attackerMod)) * intensityMultiplier, 0.015, 0.27)

  // Resolve every virtual minute. Ratings decide the probability of each stage;
  // randomness decides only the individual duel, not an arbitrary final score.
  for (let offset = 0; offset < duration; offset++) {
    if (Math.random() >= shotChancePerMinute) continue
    const minute = startMinute + offset
    shots++

    const scorer = pickFrom(atkFwMd.length > 0 ? atkFwMd : atkStarters)
    const gk = pickFrom(defGk.length > 0 ? defGk : defStarters)
    const blocker = pickFrom(defDf.length > 0 ? defDf : defStarters)
    const atkTech = pickTechnique(scorer ?? null, 'Tiro')
    const blockTech = pickTechnique(blocker ?? null, 'Bloqueo')
    const gkTech = pickTechnique(gk ?? null, 'Parada')

    const finishingPower = playerScore(scorer, { POT: 0.55, TEC: 0.30, INT: 0.15 }, attackerMod.forwardScore, atkTech)
    const pressurePower = playerScore(blocker, { PRE: 0.50, FIS: 0.30, INT: 0.20 }, defenderMod.defenseScore, blockTech)
    const savePower = playerScore(gk, { PRE: 0.45, AGI: 0.25, FIS: 0.15, INT: 0.15 }, defenderMod.goalkeeperScore, gkTech)
    const onTargetProb = clamp(0.42 + (finishingPower - pressurePower) / 180, 0.18, 0.78)
    const goalProb = clamp(0.27 + (finishingPower - savePower) / 180 + tacticalGoalProbBonus(attackerMod), 0.06, 0.65)
    xg += onTargetProb * goalProb

    const onTarget = Math.random() < onTargetProb
    if (onTarget) {
      shotsOnTarget++
      const elemBonus  = elementMatchupBonus(
        atkTech?.element || scorer?.element,
        gkTech?.element  || gk?.element,
      )
      const adjustedGoalProb = clamp(goalProb + elemBonus, 0.06, 0.70)
      const scorerName = scorer ? (nameStyle === 'japanese' ? scorer.nameRomaji : scorer.name) : null

      if (Math.random() < adjustedGoalProb) {
        goals++
        const goalEvent = mkEvent(
          minute, 'GOAL', attacker.id,
          scorerName
            ? atkTech
              ? `${scorerName} chuta con ${atkTech.name} y marca.`
              : `¡Gol de ${scorerName}!`
            : `¡Gol de ${attacker.name}!`,
          isHome, scorer, nameStyle,
        )
        events.push(atkTech
          ? {
            ...goalEvent,
            techniqueName: atkTech.name,
            techniqueNames: [atkTech.name],
            techniques: [{ name: atkTech.name, type: atkTech.type, playerId: scorer?.id }],
            techniqueOutcome: 'success',
            techniqueElement: atkTech.element || undefined,
          }
          : goalEvent)
      } else {
        const gkName = gk ? (nameStyle === 'japanese' ? gk.nameRomaji : gk.name) : null
        const shotText = scorerName && atkTech
          ? `${scorerName} chuta con ${atkTech.name}, pero `
          : ''
        const saveEvent = mkEvent(
          minute, 'SAVE', defender.id,
          gkName
            ? gkTech
              ? `${shotText}${gkName} usa ${gkTech.name} para parar el disparo y lo consigue.`
              : shotText
                ? `${shotText}${gkName} para el disparo.`
                : `Parada de ${gkName}`
            : `Parada de ${defender.name}`,
          !isHome, gk, nameStyle,
        )
        saveEvent.participants = eventParticipants([
          { player: scorer, isHome },
          { player: gk, isHome: !isHome },
        ], nameStyle)
        const displayedTechnique = gkTech ?? atkTech
        events.push(displayedTechnique
          ? {
            ...saveEvent,
            techniqueName: displayedTechnique.name,
            techniqueNames: [atkTech?.name, gkTech?.name].filter((name): name is string => Boolean(name)),
            techniques: [
              ...(atkTech ? [{ name: atkTech.name, type: atkTech.type, playerId: scorer?.id }] : []),
              ...(gkTech ? [{ name: gkTech.name, type: gkTech.type, playerId: gk?.id }] : []),
            ],
            techniqueOutcome: 'success',
            techniqueElement: displayedTechnique.element || undefined,
          }
          : saveEvent)
      }
    } else {
      const shooter = scorer ?? pickFrom(atkFw.length > 0 ? atkFw : atkFwMd.length > 0 ? atkFwMd : atkStarters)
      const shooterName = shooter ? (nameStyle === 'japanese' ? shooter.nameRomaji : shooter.name) : null
      const shooterTech = shooter?.id === scorer?.id ? atkTech : pickTechnique(shooter, 'Tiro')
      const blockerName = blocker ? (nameStyle === 'japanese' ? blocker.nameRomaji : blocker.name) : null
      const missText = shooterName
        ? blockTech && blockerName
          ? `${shooterName}${shooterTech ? ` chuta con ${shooterTech.name}` : ' chuta'}, pero ${blockerName} usa ${blockTech.name} para bloquear el disparo y lo manda fuera.`
          : shooterTech
            ? `${shooterName} chuta con ${shooterTech.name} pero va fuera.`
            : `Disparo fuera de ${shooterName}`
        : 'Disparo fuera'
      const missEvent = mkEvent(
        minute, 'MISS', attacker.id,
        missText,
        isHome, shooter, nameStyle,
      )
      missEvent.participants = eventParticipants(
        blockTech
          ? [{ player: shooter, isHome }, { player: blocker, isHome: !isHome }]
          : [{ player: shooter, isHome }],
        nameStyle,
      )
      const displayedTechnique = blockTech ?? shooterTech
      events.push(displayedTechnique
        ? {
          ...missEvent,
          techniqueName: displayedTechnique.name,
          techniqueNames: [shooterTech?.name, blockTech?.name].filter((name): name is string => Boolean(name)),
          techniques: [
            ...(shooterTech ? [{ name: shooterTech.name, type: shooterTech.type, playerId: shooter?.id }] : []),
            ...(blockTech ? [{ name: blockTech.name, type: blockTech.type, playerId: blocker?.id }] : []),
          ],
          techniqueOutcome: blockTech ? 'success' : 'failure',
          techniqueElement: displayedTechnique.element || undefined,
        }
        : missEvent)
    }
  }

  return { goals, shots, shotsOnTarget, xg, events }
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

function generateCornerEvents(team: TeamSnapshot, count: number, isHome: boolean): MatchEvent[] {
  return Array.from({ length: count }, () => mkEvent(
    Math.floor(rand(2, 90)),
    'CORNER',
    team.id,
    `Córner para ${team.name}`,
    isHome,
  ))
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

  const possessionDelta = (homeTeam.midfieldScore - awayTeam.midfieldScore + 2.5) / 18
  const homePossession = Math.round(clamp(sigmoid(possessionDelta) * 100, 25, 75))
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

  const corners = [
    ...generateCornerEvents(homeTeam, homeCorners, true),
    ...generateCornerEvents(awayTeam, awayCorners, false),
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
    ...corners,
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

  // Extra time: exactly 2 × 15 virtual minutes at lower intensity.
  const et1Home = simulateHalf(homeTeam, awayTeam, true,  91, nameStyle, 0.75, 15)
  const et1Away = simulateHalf(awayTeam, homeTeam, false, 91, nameStyle, 0.75, 15)
  const et2Home = simulateHalf(homeTeam, awayTeam, true,  106, nameStyle, 0.75, 15)
  const et2Away = simulateHalf(awayTeam, homeTeam, false, 106, nameStyle, 0.75, 15)

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
  const updatedStoppage: NonNullable<MatchResult['stoppageTime']> = {
    firstHalf: regular.stoppageTime?.firstHalf ?? 0,
    secondHalf: regular.stoppageTime?.secondHalf ?? 0,
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
