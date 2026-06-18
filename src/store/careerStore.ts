import { create } from 'zustand'
import type { Screen } from '../App'
import type { Career } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'
import type { Player } from '../types/player'
import type { Team } from '../types/team'
import { MAX_CALLUP } from '../types/team'
import type { Match, MatchResult, MatchEvent } from '../types/competition'
import type { TransferFilter } from '../types/transfer'
import { DEFAULT_TRANSFER_FILTER } from '../types/transfer'
import type { LeagueSeason, SeasonStatus } from '../types/season'

// Seed data
import { players as seedPlayers } from '../data/players'
import { teams as seedTeams } from '../data/teams'
import { leagues as seedLeagues } from '../data/leagues'
import { formations as seedFormations, getFormationSlots } from '../data/formations'

// Services
import { createCareer, getObjectivesForTeam } from '../services/careerService'
import { save as saveSlot, load as loadSlot, loadAutoSave, clearAutoSave } from '../services/saveService'
import { simulate } from '../services/matchSimulator'
import { buildTeamSnapshot, applyFormation, rebalanceLineup } from '../services/formationService'
import { updateStandings, sortStandings } from '../services/standingsService'
import { trainPlayer as trainPlayerService, restPlayer as restPlayerService } from '../services/trainingService'
import {
  buyPlayer as buyPlayerService,
  sellPlayer as sellPlayerService,
  generateAIOffers,
  sanitizeAmount,
  initiateNegotiation as initiateNegotiationService,
  cancelNegotiation as cancelNegotiationService,
  respondToCounter as respondToCounterService,
  respondToPlayerCounter as respondToPlayerCounterService,
  resolveNegotiations as resolveNegotiationsService,
  confirmTransfer as confirmTransferService,
} from '../services/transferService'
import { checkObjectives, canClaimObjective } from '../services/objectiveService'
import { markRead, markAllRead, addEvent } from '../services/inboxService'
import { endSeason, initSeason, initLeagueSeason } from '../services/seasonService'
import { computeSeasonStats } from '../services/statsService'
import {
  advanceDay as advanceDayService,
  getNextMatch,
} from '../services/calendarService'
import {
  applyAnalysisTier,
  calcAnalysisCost,
  getNextAnalysisTier,
} from '../services/potentialService'
import { executeWeeklyPlan } from '../services/weeklyTrainingService'
import { cancelPositionChange as cancelPositionChangeService, startOrResetPositionChange, advancePositionChange } from '../services/positionChangeService'
import { learnTechnique as learnTechniqueService } from '../services/techniqueService'
import { getTechniqueBook } from '../data/techniqueBooks'
import { EMPTY_INVENTORY } from '../types/inventory'
import { generateMatchRewards } from '../services/rewardService'
import { equipItem as equipItemService, unequipItem as unequipItemService } from '../services/equipmentService'
import type { MatchReward } from '../types/reward'
import type { EquipmentSlot } from '../types/equipment'
import { drainStaminaAfterMatch, recoverStaminaForDays, daysBetween } from '../services/energyService'
import {
  initCup,
  deconflictCupSchedule,
  simulateCupMatch,
  advanceCupRound,
  getNextUserCupMatch,
  getUserCupRoundsWon,
} from '../services/cupService'
import { applyPromotionsRelegations } from '../services/promotionService'
import type { WeeklyTrainingSlot } from '../types/training'
import type { Position } from '../types/player'

// ---------------------------------------------------------------------------
// Pure helpers for external league / cup simulation
// ---------------------------------------------------------------------------

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function advanceSeasonToDate(season: Career['season'], targetDate: string): Career['season'] {
  if (targetDate <= season.currentDate) return season
  const upcoming = season.matches
    .filter((m) => !m.played && m.date >= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  const nextRound = upcoming.length > 0 ? upcoming[0].round : season.currentRound
  return { ...season, currentDate: targetDate, currentRound: nextRound }
}

// Snapshot with reputation-based fallback when team has no lineup
function buildNpcSnapshot(team: Team, players: Player[]) {
  const snap = buildTeamSnapshot(team, players)
  if (snap.forwardScore === 0 && snap.defenseScore === 0 && snap.midfieldScore === 0) {
    const base = team.reputation * 0.9
    return { ...snap, forwardScore: base, midfieldScore: base, defenseScore: base, goalkeeperScore: base }
  }
  return snap
}

function scaleNpcSnapshot(snap: ReturnType<typeof buildTeamSnapshot>, multiplier: number) {
  return {
    ...snap,
    forwardScore: snap.forwardScore * multiplier,
    midfieldScore: snap.midfieldScore * multiplier,
    defenseScore: snap.defenseScore * multiplier,
    goalkeeperScore: snap.goalkeeperScore * multiplier,
  }
}

function simulateLeagueMatchFn(match: Match, teams: Team[], players: Player[]): Match {
  const homeTeam = teams.find((t) => t.id === match.homeTeamId)
  const awayTeam = teams.find((t) => t.id === match.awayTeamId)
  if (!homeTeam || !awayTeam) return match
  const result = simulate(buildNpcSnapshot(homeTeam, players), buildNpcSnapshot(awayTeam, players), match)
  return { ...match, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals, result }
}

// Simulate all external league + NPC cup matches on a given date
function simulateExternalForDate(
  allLeagueSeasons: Record<string, LeagueSeason>,
  cup: Career['cup'],
  date: string,
  userTeamId: number,
  teams: Team[],
  players: Player[],
): { allLeagueSeasons: Record<string, LeagueSeason>; cup: Career['cup'] } {
  // External leagues
  const updatedLeagues: Record<string, LeagueSeason> = {}
  for (const [leagueId, ls] of Object.entries(allLeagueSeasons)) {
    if (ls.finished) { updatedLeagues[leagueId] = ls; continue }
    let changed = false
    let updatedMatches = ls.matches
    let updatedStandings = ls.standings
    for (let i = 0; i < updatedMatches.length; i++) {
      const m = updatedMatches[i]
      if (m.date === date && !m.played) {
        const sim = simulateLeagueMatchFn(m, teams, players)
        updatedMatches = updatedMatches.map((x, j) => (j === i ? sim : x))
        updatedStandings = updateStandings(updatedStandings, sim)
        changed = true
      }
    }
    if (changed) {
      const finished = updatedMatches.every((m) => m.played)
      updatedLeagues[leagueId] = { ...ls, matches: updatedMatches, standings: updatedStandings, finished }
    } else {
      updatedLeagues[leagueId] = ls
    }
  }

  // Cup NPC matches
  let updatedCup = cup
  if (cup && !cup.finished) {
    const roundIdx = cup.currentRoundIndex
    const round = cup.rounds[roundIdx]
    if (!round.finished) {
      let changed = false
      const updatedMatches = round.matches.map((m) => {
        if (
          m.date === date &&
          !m.played &&
          m.homeTeamId !== userTeamId &&
          m.awayTeamId !== userTeamId &&
          m.homeTeamId !== -1 &&
          m.awayTeamId !== -1
        ) {
          changed = true
          return simulateCupMatch(m, teams, players)
        }
        return m
      })
      if (changed) {
        const updatedRounds = cup.rounds.map((r, i) =>
          i === roundIdx ? { ...r, matches: updatedMatches } : r,
        )
        let next = { ...cup, rounds: updatedRounds }
        // Check if round is complete (all valid matches played)
        const allPlayed = updatedMatches
          .filter((m) => m.homeTeamId !== -1 && m.awayTeamId !== -1)
          .every((m) => m.played)
        if (allPlayed) next = advanceCupRound(next)
        updatedCup = next
      }
    }
  }

  return { allLeagueSeasons: updatedLeagues, cup: updatedCup }
}

export function computeSeasonStatus(
  career: Pick<Career, 'season' | 'allLeagueSeasons' | 'cup' | 'seasonStatus'>,
): SeasonStatus {
  if (career.seasonStatus === 'review') return 'review'
  const userDone = career.season.finished
  const externalDone = Object.values(career.allLeagueSeasons).every((ls) => ls.finished)
  const cupDone = !career.cup || career.cup.finished
  if (userDone && externalDone && cupDone) return 'all_finished'
  if (userDone) return 'user_finished'
  return 'active'
}

// ---------------------------------------------------------------------------
// Injury helpers
// ---------------------------------------------------------------------------

function randomInjuryDays(): number {
  const r = Math.random()
  if (r < 0.08) return Math.floor(Math.random() * 5) + 3    // 3-7 days  (8%)
  if (r < 0.85) return Math.floor(Math.random() * 9) + 12   // 12-20 days (77%)
  if (r < 0.97) return Math.floor(Math.random() * 20) + 21  // 21-40 days (12%)
  return Math.floor(Math.random() * 50) + 41                  // 41-90 days (3%)
}

function applyMatchInjuries(
  events: MatchEvent[],
  userTeamId: number,
  players: Player[],
): Player[] {
  const injuredIds = new Set(
    events
      .filter((e) => e.type === 'INJURY' && e.teamId === userTeamId && e.playerId != null)
      .map((e) => e.playerId!),
  )
  if (injuredIds.size === 0) return players
  return players.map((p) =>
    injuredIds.has(p.id) && !p.isInjured
      ? { ...p, isInjured: true, injuryDaysRemaining: randomInjuryDays() }
      : p,
  )
}

function advanceInjuryCountdown(players: Player[], days: number): Player[] {
  return players.map((p) => {
    if (!p.isInjured) return p
    const remaining = Math.max(0, p.injuryDaysRemaining - days)
    return { ...p, injuryDaysRemaining: remaining, isInjured: remaining > 0 }
  })
}

// ---------------------------------------------------------------------------
// Season-end logic (shared by commitMatchResult and advanceDay)
// ---------------------------------------------------------------------------

function applySeasonEnd(
  career: Career,
  teams: Team[],
  players: Player[],
  finalMatches: Career['season']['matches'],
  finalStandings: Career['season']['standings'],
): { career: Career; teams: Team[]; players: Player[] } {
  const finishedSeason = { ...career.season, matches: finalMatches, standings: finalStandings, finished: true }
  const seasonStats = computeSeasonStats(finishedSeason, career.teamId, career.seasonNumber)
  const seasonResult = endSeason(finishedSeason, teams, players, career.playerPotential, career.difficulty)
  let updatedPlayers = seasonResult.players
  let updatedTeams = seasonResult.teams
  let updatedCareer: Career = {
    ...career,
    season: finishedSeason,
    seasonHistory: [...career.seasonHistory, seasonStats],
  }
  const newStatus = computeSeasonStatus({ ...updatedCareer, season: finishedSeason })
  updatedCareer = { ...updatedCareer, seasonStatus: newStatus }
  updatedCareer = addEvent(
    'SEASON_END',
    'Temporada finalizada',
    'La temporada ha terminado. Consulta la clasificación para ver la tabla final.',
    updatedCareer,
  )
  const prevFailed = new Set(updatedCareer.objectives.filter((o) => o.failed).map((o) => o.id))
  updatedCareer = checkObjectives(updatedCareer, updatedCareer.season)
  const endFailed = updatedCareer.objectives.filter((o) => o.failed && !prevFailed.has(o.id))
  for (const obj of endFailed) {
    if (obj.isMandatory && !obj.penaltyApplied && obj.penalty.reputation > 0) {
      updatedTeams = updatedTeams.map((t) =>
        t.id === updatedCareer.teamId
          ? { ...t, reputation: Math.max(0, t.reputation - obj.penalty.reputation) }
          : t,
      )
      updatedCareer = {
        ...updatedCareer,
        objectives: updatedCareer.objectives.map((o) =>
          o.id === obj.id ? { ...o, penaltyApplied: true } : o,
        ),
      }
      updatedCareer = addEvent(
        'OBJECTIVE_FAILED',
        `Objetivo fallido: ${obj.description}`,
        `Penalización aplicada: -${obj.penalty.reputation} reputación al club.`,
        updatedCareer,
      )
    } else if (!obj.isMandatory) {
      updatedCareer = addEvent(
        'OBJECTIVE_FAILED',
        `Objetivo no conseguido: ${obj.description}`,
        'Este objetivo no era obligatorio, no hay penalización.',
        updatedCareer,
      )
    }
  }
  return { career: updatedCareer, teams: updatedTeams, players: updatedPlayers }
}

// ---------------------------------------------------------------------------
// Pure helper: apply a computed MatchResult to career/teams/players state
// ---------------------------------------------------------------------------
function commitMatchResult(
  matchId: string,
  result: MatchResult,
  career: Career,
  teams: Team[],
  players: Player[],
  isCupMatch = false,
): { career: Career; teams: Team[]; players: Player[] } {
  if (isCupMatch) {
    // Cup match commit: update the match in the cup rounds
    if (!career.cup) return { career, teams, players }
    const cupRoundIdx = career.cup.currentRoundIndex
    const cupRound = career.cup.rounds[cupRoundIdx]
    const matchIdx = cupRound.matches.findIndex((m) => m.id === matchId)
    if (matchIdx === -1) return { career, teams, players }
    const match = cupRound.matches[matchIdx]
    const updatedMatch = {
      ...match,
      played: true,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      result,
    }
    const userTeam = teams.find((t) => t.id === career.teamId)
    const starterIds = new Set(userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [])
    const benchIds = new Set(userTeam?.lineup.filter((s) => !s.isStarter).map((s) => s.playerId) ?? [])
    let updatedPlayers = drainStaminaAfterMatch(players, starterIds, benchIds, career.difficulty)
    updatedPlayers = updatedPlayers.map((p) => ({
      ...p,
      seasonStats: {
        ...p.seasonStats,
        minutesPlayed: p.seasonStats.minutesPlayed + (starterIds.has(p.id) ? 90 : benchIds.has(p.id) ? 45 : 0),
        matchesPlayed: p.seasonStats.matchesPlayed + (starterIds.has(p.id) || benchIds.has(p.id) ? 1 : 0),
      },
    }))
    updatedPlayers = applyMatchInjuries(result.events, career.teamId, updatedPlayers)

    const updatedRounds = career.cup.rounds.map((r, i) =>
      i === cupRoundIdx
        ? { ...r, matches: r.matches.map((m, j) => (j === matchIdx ? updatedMatch : m)) }
        : r,
    )
    let updatedCup = { ...career.cup, rounds: updatedRounds }

    // Check if round is now complete
    const currentRound = updatedRounds[cupRoundIdx]
    const allValid = currentRound.matches.filter((m) => m.homeTeamId !== -1 && m.awayTeamId !== -1)
    if (allValid.every((m) => m.played)) {
      updatedCup = advanceCupRound(updatedCup)
    }

    const homeTeamName = teams.find((t) => t.id === match.homeTeamId)?.name ?? 'Local'
    const awayTeamName = teams.find((t) => t.id === match.awayTeamId)?.name ?? 'Visitante'
    const matchTitle = `${homeTeamName} ${result.homeGoals} - ${result.awayGoals} ${awayTeamName} (Copa)`
    let updatedCareer: Career = {
      ...career,
      cup: updatedCup,
      seasonStatus: computeSeasonStatus({ ...career, cup: updatedCup }),
    }
    updatedCareer = addEvent('MATCH_RESULT', matchTitle, `Copa — ${matchTitle}`, updatedCareer, {
      matchId, homeGoals: result.homeGoals, awayGoals: result.awayGoals,
    }, 'match', matchId)
    return { career: updatedCareer, teams, players: updatedPlayers }
  }
  const match = career.season.matches.find((m) => m.id === matchId)
  if (!match) return { career, teams, players }

  const playedMatch = {
    ...match,
    played: true,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    result,
  }

  const updatedMatches = career.season.matches.map((m) =>
    m.id === matchId ? playedMatch : m,
  )

  // Track match minutes for user's team players
  const userTeam = teams.find((t) => t.id === career.teamId)
  const starterIds = new Set(userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [])
  const benchIds = new Set(userTeam?.lineup.filter((s) => !s.isStarter).map((s) => s.playerId) ?? [])
  const isUserMatch = match.homeTeamId === career.teamId || match.awayTeamId === career.teamId
  let updatedPlayers = isUserMatch
    ? players.map((p) => {
        if (!starterIds.has(p.id) && !benchIds.has(p.id)) return p
        return {
          ...p,
          seasonStats: {
            ...p.seasonStats,
            minutesPlayed: p.seasonStats.minutesPlayed + (starterIds.has(p.id) ? 90 : 45),
            matchesPlayed: p.seasonStats.matchesPlayed + 1,
          },
        }
      })
    : players
  if (isUserMatch) {
    updatedPlayers = drainStaminaAfterMatch(updatedPlayers, starterIds, benchIds, career.difficulty)
    updatedPlayers = applyMatchInjuries(result.events, career.teamId, updatedPlayers)

    const isHome = match.homeTeamId === career.teamId
    const goalsConceded = isHome ? result.awayGoals : result.homeGoals
    const isCleanSheet = goalsConceded === 0

    const goalsByPlayer: Record<number, number> = {}
    for (const e of result.events) {
      if (e.type === 'GOAL' && e.teamId === career.teamId && e.playerId != null) {
        goalsByPlayer[e.playerId] = (goalsByPlayer[e.playerId] ?? 0) + 1
      }
    }

    updatedPlayers = updatedPlayers.map((p) => {
      if (!starterIds.has(p.id)) return p
      const goalsDelta = goalsByPlayer[p.id] ?? 0
      const cleanSheetDelta =
        isCleanSheet && (p.position === 'GK' || p.position === 'DF') ? 1 : 0
      return {
        ...p,
        seasonStats: {
          ...p.seasonStats,
          goals: p.seasonStats.goals + goalsDelta,
          cleanSheets: p.seasonStats.cleanSheets + cleanSheetDelta,
        },
      }
    })
  }
  const updatedStandings = updateStandings(career.season.standings, playedMatch)

  const homeTeamName = teams.find((t) => t.id === match.homeTeamId)?.name ?? 'Local'
  const awayTeamName = teams.find((t) => t.id === match.awayTeamId)?.name ?? 'Visitante'
  const matchTitle = `${homeTeamName} ${result.homeGoals} - ${result.awayGoals} ${awayTeamName}`

  let updatedCareer: Career = {
    ...career,
    season: {
      ...career.season,
      matches: updatedMatches,
      standings: updatedStandings,
    },
  }

  updatedCareer = addEvent('MATCH_RESULT', matchTitle, `Resultado final: ${matchTitle}`, updatedCareer, {
    matchId,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
  }, 'match', matchId)

  // Add inbox events for newly injured players (user team only)
  if (isUserMatch) {
    const newlyInjured = result.events.filter(
      (e) => e.type === 'INJURY' && e.teamId === career.teamId && e.playerId != null,
    )
    for (const injEvent of newlyInjured) {
      updatedCareer = addEvent(
        'PLAYER_INJURED',
        `Lesión: ${injEvent.playerName ?? 'Jugador'}`,
        `${injEvent.playerName ?? 'Un jugador'} ha salido lesionado del partido.`,
        updatedCareer,
        { playerId: injEvent.playerId },
        'squad',
        String(injEvent.playerId),
      )
    }
  }

  // Track state before objective check
  const prevCompleted = new Set(updatedCareer.objectives.filter((o) => o.completed).map((o) => o.id))
  const prevFailed = new Set(updatedCareer.objectives.filter((o) => o.failed).map((o) => o.id))
  updatedCareer = checkObjectives(updatedCareer, updatedCareer.season)

  const newlyCompleted = updatedCareer.objectives.filter(
    (o) => o.completed && !prevCompleted.has(o.id),
  )
  const newlyFailed = updatedCareer.objectives.filter(
    (o) => o.failed && !prevFailed.has(o.id),
  )

  // Notify user about newly completed objectives (reward must be claimed manually)
  let updatedTeams = teams
  for (const obj of newlyCompleted) {
    const moneyStr = obj.reward.money >= 1_000
      ? `€${(obj.reward.money / 1_000).toFixed(0)}K`
      : `€${obj.reward.money}`
    const repStr = obj.reward.reputation > 0 ? ` + ${obj.reward.reputation} reputación` : ''
    updatedCareer = addEvent(
      'OBJECTIVE_COMPLETE',
      `Objetivo completado: ${obj.description}`,
      `Reclama tu recompensa (${moneyStr}${repStr}) en el panel de objetivos.`,
      updatedCareer,
      undefined,
      'career_home',
    )
  }

  // Apply reputation penalty for newly failed mandatory objectives (once only)
  for (const obj of newlyFailed) {
    if (obj.isMandatory && !obj.penaltyApplied && obj.penalty.reputation > 0) {
      updatedTeams = updatedTeams.map((t) =>
        t.id === updatedCareer.teamId
          ? { ...t, reputation: Math.max(0, t.reputation - obj.penalty.reputation) }
          : t,
      )
      updatedCareer = {
        ...updatedCareer,
        objectives: updatedCareer.objectives.map((o) =>
          o.id === obj.id ? { ...o, penaltyApplied: true } : o,
        ),
      }
      updatedCareer = addEvent(
        'OBJECTIVE_FAILED',
        `Objetivo fallido: ${obj.description}`,
        `Penalización aplicada: -${obj.penalty.reputation} reputación al club.`,
        updatedCareer,
      )
    } else if (!obj.isMandatory) {
      updatedCareer = addEvent(
        'OBJECTIVE_FAILED',
        `Objetivo no conseguido: ${obj.description}`,
        'Este objetivo no era obligatorio, no hay penalización.',
        updatedCareer,
      )
    }
  }

  // Season end is deferred: NPC vs NPC matches on the same date haven't been
  // simulated yet. advanceDay() will detect when all matches are played and
  // call applySeasonEnd() at that point.

  return { career: updatedCareer, teams: updatedTeams, players: updatedPlayers }
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------
interface CareerState {
  screen: Screen
  previousScreen: Screen | null
  selectedPlayerId: number | null
  selectedMatchId: string | null

  career: Career | null
  players: Player[]
  teams: Team[]

  activeTransferFilter: TransferFilter
  isSimulating: boolean
  lastMatchResult: MatchResult | null
  pendingMatch: { matchId: string; result: MatchResult; isCupMatch?: boolean } | null
  pendingRewards: MatchReward[] | null

  // UI panels (global overlay state)
  uiPanel: 'notifications' | 'settings' | null

  // Navigation
  navigate(screen: Screen): void
  selectPlayer(playerId: number): void
  selectMatch(matchId: string): void
  setUIPanel(panel: 'notifications' | 'settings' | null): void

  // Career lifecycle
  startNewCareer(managerName: string, teamId: number, managerAvatar?: string, difficulty?: DifficultySettings, customTeamInput?: { team: Team; squadPlayerIds: number[] }, nameStyle?: 'western' | 'japanese'): void
  loadCareer(slot: number): void
  saveCareer(slot: number, slotName: string): void
  exitToMainMenu(): void
  restoreAutoSave(): boolean

  // Match — quick simulation
  simulateMatch(matchId: string): void

  // Match — live simulation
  startLiveMatch(matchId: string): void
  commitLiveMatch(): void

  // Calendar
  advanceDay(): void
  advanceToNextMatch(): void

  // Cup
  simulateCupMatch(matchId: string): void
  startLiveCupMatch(matchId: string): void

  // Season lifecycle
  closeSeason(): void
  startNewSeason(): void
  simulateAllRemainingAndClose(): void

  // Training (legacy — kept for backward compatibility)
  trainPlayer(playerId: number, stat: keyof import('../types/player').Stats): void
  restPlayer(playerId: number): void

  // Weekly training (new FIFA-style system)
  setWeeklyTrainingSlot(slot: WeeklyTrainingSlot): void
  removeWeeklyTrainingSlot(playerId: number): void
  commitWeeklyTraining(): void

  // Technique teaching
  teachTechnique(playerId: number, bookId: string, replaceIndex?: number): void

  // Position change (separate system, max 2 concurrent)
  startPositionChange(playerId: number, targetPosition: Position): 'ok' | 'limit_reached' | 'already_active'
  cancelPositionChange(playerId: number): void

  // Transfer
  setTransferFilter(filter: Partial<TransferFilter>): void
  buyPlayer(playerId: number, amount: number): void
  sellPlayer(playerId: number, toTeamId: number, amount: number): void
  acceptTransferOffer(offerId: string): void
  rejectTransferOffer(offerId: string): void
  initiateTransferNegotiation(playerId: number, amount: number): void
  respondToCounterOffer(negotiationId: string, action: 'accept_counter' | 'reject' | 'counter', newAmount?: number): void
  respondToPlayerCounterOffer(negotiationId: string, action: 'accept' | 'reject'): void
  cancelNegotiation(negotiationId: string): void
  confirmTransfer(negotiationId: string): void
  dismissNegotiation(negotiationId: string): void

  // Formation
  applyFormation(formationId: number): void
  updateStarters(slots: (number | null)[], formation: import('../types/team').Formation): void
  setCaptain(playerId: number): void
  setKeyPlayer(playerId: number | null): void
  swapLineupPlayers(starterId: number, benchId: number): void

  // Callup management
  callUpPlayer(playerId: number): boolean  // returns false if at limit
  removeCallupPlayer(playerId: number): void
  swapCallup(playerOutId: number, playerInId: number): void

  // Jersey numbers
  changeJerseyNumber(playerId: number, newNumber: number): 'ok' | 'conflict'
  swapJerseyNumbers(playerAId: number, playerBId: number): void

  // Potential analysis — applies next tier, cost computed internally
  analyzePlayerPotential(playerId: number, _investment?: number): void

  // Inbox
  markInboxRead(eventId: string): void
  markAllInboxRead(): void
  deleteInboxEvent(eventId: string): void
  deleteAllInboxEvents(): void

  // Objectives
  checkObjectives(): void
  claimObjective(objectiveId: string): void

  // Match rewards
  claimReward(reward: MatchReward): void

  // Equipment
  equipItem(playerId: number, itemId: string): void
  unequipItem(playerId: number, slot: EquipmentSlot): void
}

export const useCareerStore = create<CareerState>()((set, get) => ({
  screen: 'main_menu',
  previousScreen: null,
  selectedPlayerId: null,
  selectedMatchId: null,
  career: null,
  players: [],
  teams: [],
  activeTransferFilter: { ...DEFAULT_TRANSFER_FILTER },
  isSimulating: false,
  lastMatchResult: null,
  pendingMatch: null,
  pendingRewards: null,
  uiPanel: null,

  navigate(screen) {
    set((state) => ({ screen, previousScreen: state.screen }))
  },

  selectPlayer(playerId) {
    set({ selectedPlayerId: playerId })
  },

  setUIPanel(panel) {
    set({ uiPanel: panel })
  },

  selectMatch(matchId) {
    set({ selectedMatchId: matchId })
  },

  startNewCareer(managerName, teamId, managerAvatar = '/avatars/avatar-1.svg', difficulty = DEFAULT_DIFFICULTY, customTeamInput?: { team: Team; squadPlayerIds: number[] }, nameStyle: 'western' | 'japanese' = 'western') {
    const playersCopy: Player[] = JSON.parse(JSON.stringify(seedPlayers))
      .map((p: Player) => ({ ...p, seasonStats: p.seasonStats ?? { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 } }))
    const teamsCopy: Team[] = JSON.parse(JSON.stringify(seedTeams))
      .map((t: Team) => ({
        ...t,
        scoutLevel: t.scoutLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
        facilitiesLevel: t.facilitiesLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
      }))
    const leaguesCopy = JSON.parse(JSON.stringify(seedLeagues))

    let resolvedTeamId = teamId
    if (customTeamInput) {
      const { team: customTeam, squadPlayerIds } = customTeamInput
      teamsCopy.push({
        ...customTeam,
        scoutLevel: customTeam.scoutLevel ?? Math.max(1, Math.ceil(customTeam.reputation / 20)),
        facilitiesLevel: customTeam.facilitiesLevel ?? Math.max(1, Math.ceil(customTeam.reputation / 20)),
      })
      for (let i = 0; i < playersCopy.length; i++) {
        if (squadPlayerIds.includes(playersCopy[i].id)) {
          playersCopy[i] = { ...playersCopy[i], teamId: customTeam.id }
        }
      }
      resolvedTeamId = customTeam.id
    }

    const { career, teams: newTeams, players: newPlayers } = createCareer(managerName, resolvedTeamId, teamsCopy, leaguesCopy, playersCopy, difficulty)
    career.managerAvatar = managerAvatar
    career.nameStyle = nameStyle

    set({
      career,
      players: newPlayers,
      teams: newTeams,
      screen: 'career_home',
      lastMatchResult: null,
      pendingMatch: null,
      selectedPlayerId: null,
      selectedMatchId: null,
      activeTransferFilter: { ...DEFAULT_TRANSFER_FILTER },
    })
  },

  loadCareer(slot) {
    const data = loadSlot(slot)
    if (!data) return
    // Normalize fields that may be missing in older saves
    const players = data.players.map((p: Player) => ({
      ...p,
      seasonStats: p.seasonStats ?? { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
      improvementTechniques: p.improvementTechniques ?? [],
      career: {
        ...p.career,
        positionChangePlan: p.career.positionChangePlan ?? null,
      },
    }))
    const teams = data.teams.map((t: Team) => ({
      ...t,
      scoutLevel: t.scoutLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
      facilitiesLevel: t.facilitiesLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
    }))
    set({
      career: {
        ...data.career,
        playerPotential: data.career.playerPotential ?? {},
        weeklyTrainingPlan: data.career.weeklyTrainingPlan ?? null,
        inventory: data.career.inventory ?? { ...EMPTY_INVENTORY },
        allLeagueSeasons: data.career.allLeagueSeasons ?? {},
        cup: data.career.cup ?? null,
        seasonStatus: data.career.seasonStatus ?? 'active',
        lastSeasonReview: data.career.lastSeasonReview ?? null,
        outgoingNegotiations: data.career.outgoingNegotiations ?? [],
        nameStyle: data.career.nameStyle ?? 'western',
      },
      players,
      teams,
      screen: 'career_home',
      lastMatchResult: null,
      pendingMatch: null,
      selectedPlayerId: null,
      selectedMatchId: null,
      activeTransferFilter: { ...DEFAULT_TRANSFER_FILTER },
    })
  },

  saveCareer(slot, slotName) {
    const { career, players, teams } = get()
    if (!career) return
    saveSlot(slot, slotName, career, players, teams)
  },

  exitToMainMenu() {
    clearAutoSave()
    set({
      career: null,
      players: [],
      teams: [],
      screen: 'main_menu',
      lastMatchResult: null,
      pendingMatch: null,
      pendingRewards: null,
      selectedPlayerId: null,
      selectedMatchId: null,
      uiPanel: null,
    })
  },

  restoreAutoSave() {
    try {
      const data = loadAutoSave()
      if (!data) return false
      const players = data.players.map((p: Player) => ({
        ...p,
        seasonStats: p.seasonStats ?? { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
        improvementTechniques: p.improvementTechniques ?? [],
        career: { ...p.career, positionChangePlan: p.career.positionChangePlan ?? null },
      }))
      const teams = data.teams.map((t: Team) => ({
        ...t,
        scoutLevel: t.scoutLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
        facilitiesLevel: t.facilitiesLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
      }))
      set({
        career: {
          ...data.career,
          difficulty: data.career.difficulty ?? DEFAULT_DIFFICULTY,
          nameStyle: data.career.nameStyle ?? 'western',
          playerPotential: data.career.playerPotential ?? {},
          weeklyTrainingPlan: data.career.weeklyTrainingPlan ?? null,
          inventory: data.career.inventory ?? { ...EMPTY_INVENTORY },
          allLeagueSeasons: data.career.allLeagueSeasons ?? {},
          cup: data.career.cup ?? null,
          seasonStatus: data.career.seasonStatus ?? 'active',
          lastSeasonReview: data.career.lastSeasonReview ?? null,
          outgoingNegotiations: data.career.outgoingNegotiations ?? [],
        },
        players,
        teams,
        screen: 'career_home',
        lastMatchResult: null,
        pendingMatch: null,
        selectedPlayerId: null,
        selectedMatchId: null,
        activeTransferFilter: { ...DEFAULT_TRANSFER_FILTER },
      })
      return true
    } catch {
      clearAutoSave()
      return false
    }
  },

  // --- Quick simulation ---
  simulateMatch(matchId) {
    const { career, players, teams } = get()
    if (!career) return

    const match = career.season.matches.find((m) => m.id === matchId)
    if (!match || match.played) return
    if (match.date > career.season.currentDate) return

    set({ isSimulating: true })

    const homeTeamData = teams.find((t) => t.id === match.homeTeamId)
    const awayTeamData = teams.find((t) => t.id === match.awayTeamId)
    if (!homeTeamData || !awayTeamData) {
      set({ isSimulating: false })
      return
    }

    const aiMult = career.difficulty.aiStrengthMultiplier
    const homeIsUser = match.homeTeamId === career.teamId
    const rawHome = buildTeamSnapshot(homeTeamData, players)
    const rawAway = buildTeamSnapshot(awayTeamData, players)
    const homeSnapshot = homeIsUser ? rawHome : scaleNpcSnapshot(rawHome, aiMult)
    const awaySnapshot = !homeIsUser ? rawAway : scaleNpcSnapshot(rawAway, aiMult)
    const result = simulate(homeSnapshot, awaySnapshot, match, career.nameStyle)

    const committed = commitMatchResult(matchId, result, career, teams, players)

    const isUserMatch = match.homeTeamId === career.teamId || match.awayTeamId === career.teamId
    const userTeam = teams.find((t) => t.id === career.teamId)
    const rivalTeam = teams.find((t) => t.id !== career.teamId && (t.id === match.homeTeamId || t.id === match.awayTeamId))
    const starterIds = new Set(userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [])
    const starters = players.filter((p) => starterIds.has(p.id))
    const rewards = isUserMatch && userTeam && rivalTeam
      ? generateMatchRewards(match, userTeam, rivalTeam, starters, career.difficulty.rewardChoices, result, career.nameStyle)
      : null

    set({
      career: committed.career,
      players: committed.players,
      teams: committed.teams,
      isSimulating: false,
      lastMatchResult: result,
      selectedMatchId: matchId,
      pendingRewards: rewards,
    })
  },

  // --- Live simulation: compute result, hold as pending ---
  startLiveMatch(matchId) {
    const { career, players, teams } = get()
    if (!career) return

    const match = career.season.matches.find((m) => m.id === matchId)
    if (!match || match.played) return
    if (match.date > career.season.currentDate) return

    const homeTeamData = teams.find((t) => t.id === match.homeTeamId)
    const awayTeamData = teams.find((t) => t.id === match.awayTeamId)
    if (!homeTeamData || !awayTeamData) return

    const aiMult = career.difficulty.aiStrengthMultiplier
    const homeIsUser = match.homeTeamId === career.teamId
    const rawHome = buildTeamSnapshot(homeTeamData, players)
    const rawAway = buildTeamSnapshot(awayTeamData, players)
    const homeSnapshot = homeIsUser ? rawHome : scaleNpcSnapshot(rawHome, aiMult)
    const awaySnapshot = !homeIsUser ? rawAway : scaleNpcSnapshot(rawAway, aiMult)
    const result = simulate(homeSnapshot, awaySnapshot, match, career.nameStyle)

    set({ pendingMatch: { matchId, result }, selectedMatchId: matchId })
  },

  // --- Live simulation: commit pending result to career state ---
  commitLiveMatch() {
    const { career, players, teams, pendingMatch } = get()
    if (!career || !pendingMatch) return

    const match = pendingMatch.isCupMatch
      ? career.cup?.rounds[career.cup.currentRoundIndex]?.matches.find((m) => m.id === pendingMatch.matchId)
      : career.season.matches.find((m) => m.id === pendingMatch.matchId)

    const committed = commitMatchResult(
      pendingMatch.matchId,
      pendingMatch.result,
      career,
      teams,
      players,
      pendingMatch.isCupMatch,
    )

    const userTeam = teams.find((t) => t.id === career.teamId)
    const rivalTeam = match
      ? teams.find((t) => t.id !== career.teamId && (t.id === match.homeTeamId || t.id === match.awayTeamId))
      : undefined
    const starterIds = new Set(userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [])
    const starters = players.filter((p) => starterIds.has(p.id))
    const rewards = match && userTeam && rivalTeam
      ? generateMatchRewards(match, userTeam, rivalTeam, starters, career.difficulty.rewardChoices, pendingMatch.result, career.nameStyle)
      : null

    set({
      career: committed.career,
      players: committed.players,
      teams: committed.teams,
      lastMatchResult: pendingMatch.result,
      pendingMatch: null,
      pendingRewards: rewards,
    })

    // 20% chance to generate AI transfer offers after each match
    if (Math.random() < 0.20) {
      const state = get()
      if (!state.career) return
      const offers = generateAIOffers(state.career, state.teams, state.players)
      if (offers.length === 0) return

      let updatedCareer = state.career
      for (const offer of offers) {
        const fmt = (n: number) =>
          n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` :
          n >= 1_000 ? `€${(n / 1_000).toFixed(0)}K` : `€${n}`

        updatedCareer = addEvent(
          'TRANSFER_OFFER',
          `Oferta de ${offer.fromTeamName}`,
          `${offer.fromTeamName} ofrece ${fmt(offer.amount)} por ${offer.playerName}.`,
          updatedCareer,
          {
            offerId: offer.id,
            fromTeamId: offer.fromTeamId,
            fromTeamName: offer.fromTeamName,
            playerId: offer.playerId,
            playerName: offer.playerName,
            amount: offer.amount,
          },
          'transfers',
        )
      }
      set({ career: updatedCareer })
    }
  },

  // --- Calendar ---
  advanceDay() {
    const { career, players, teams } = get()
    if (!career) return

    // Block if today has an unplayed user league match
    const todayLeagueMatch = career.season.matches.find(
      (m) =>
        m.date === career.season.currentDate &&
        !m.played &&
        (m.homeTeamId === career.teamId || m.awayTeamId === career.teamId),
    )
    // Block if today has an unplayed user cup match
    const todayCupMatch = getNextUserCupMatch(career.cup, career.teamId, career.season.currentDate)
    // Only block on cup when user's league is still active — once league is done, let days advance freely
    const todayCupMatchIsToday = !career.season.finished && todayCupMatch?.date === career.season.currentDate
    if (todayLeagueMatch || todayCupMatchIsToday) return

    const currentDateStr = career.season.currentDate
    const nextDate = addDaysStr(currentDateStr, 1)

    // Simulate NPC vs NPC matches in user's league for current date (before leaving it)
    let seasonMatches = career.season.matches
    let seasonStandings = career.season.standings
    for (const m of seasonMatches) {
      if (m.date === currentDateStr && !m.played &&
          m.homeTeamId !== career.teamId && m.awayTeamId !== career.teamId) {
        const simmed = simulateLeagueMatchFn(m, teams, players)
        seasonMatches = seasonMatches.map((x) => x.id === m.id ? simmed : x)
        seasonStandings = updateStandings(seasonStandings, simmed)
      }
    }

    // Simulate external leagues for the new date
    const { allLeagueSeasons, cup } = simulateExternalForDate(
      career.allLeagueSeasons,
      career.cup,
      nextDate,
      career.teamId,
      teams,
      players,
    )

    const updatedSeason = advanceDayService({ ...career.season, matches: seasonMatches, standings: seasonStandings })
    const recoveredPlayers = recoverStaminaForDays(players, 1, career.difficulty.staminaRecoveryPerDay)
    const advancedPlayers = advanceInjuryCountdown(
      recoveredPlayers.map((p) =>
        p.career.positionChangePlan && !p.career.positionChangePlan.completed
          ? advancePositionChange(p, 1)
          : p,
      ),
      1,
    )

    // Check if user's season is now fully finished (all matches played including NPC)
    const allNowPlayed = seasonMatches.every((m) => m.played)
    if (allNowPlayed && !career.season.finished) {
      const base: Career = { ...career, season: updatedSeason, allLeagueSeasons, cup }
      const finished = applySeasonEnd(base, teams, advancedPlayers, seasonMatches, seasonStandings)
      set({ career: finished.career, players: finished.players, teams: finished.teams })
      return
    }

    const preNegCareer: Career = {
      ...career,
      season: updatedSeason,
      allLeagueSeasons,
      cup,
      seasonStatus: computeSeasonStatus({ ...career, season: updatedSeason, allLeagueSeasons, cup }),
    }
    const negResult = resolveNegotiationsService(preNegCareer, nextDate, advancedPlayers, teams)
    set({ career: negResult.career, players: negResult.players, teams: negResult.teams })
  },

  advanceToNextMatch() {
    const { career, players, teams } = get()
    if (!career) return

    const prevDate = career.season.currentDate

    // Find next user match: league or cup, whichever is earlier
    const nextLeague = getNextMatch(career.season, career.teamId)
    const nextCup = getNextUserCupMatch(career.cup, career.teamId, '9999-12-31')
    const candidates = [nextLeague, nextCup]
      .filter((m): m is Match => m !== null && m.date > prevDate)
      .sort((a, b) => a.date.localeCompare(b.date))

    const target = candidates[0]
    if (!target) return

    const targetDate = target.date

    // Simulate external leagues + NPC vs NPC in user's league for each skipped day
    let allLeagueSeasons = career.allLeagueSeasons
    let cup = career.cup
    let seasonMatches = career.season.matches
    let seasonStandings = career.season.standings
    const days = daysBetween(prevDate, targetDate)
    for (let d = 1; d <= days; d++) {
      // Simulate NPC vs NPC for the day being left (prevDate + d - 1)
      const leavingDate = addDaysStr(prevDate, d - 1)
      for (const m of seasonMatches) {
        if (m.date === leavingDate && !m.played &&
            m.homeTeamId !== career.teamId && m.awayTeamId !== career.teamId) {
          const simmed = simulateLeagueMatchFn(m, teams, players)
          seasonMatches = seasonMatches.map((x) => x.id === m.id ? simmed : x)
          seasonStandings = updateStandings(seasonStandings, simmed)
        }
      }
      // Simulate external leagues for the day being entered
      const date = addDaysStr(prevDate, d)
      const sim = simulateExternalForDate(allLeagueSeasons, cup, date, career.teamId, teams, players)
      allLeagueSeasons = sim.allLeagueSeasons
      cup = sim.cup
    }

    const updatedSeason = advanceSeasonToDate(
      { ...career.season, matches: seasonMatches, standings: seasonStandings },
      targetDate,
    )
    const recoveredPlayers = recoverStaminaForDays(players, days, career.difficulty.staminaRecoveryPerDay)
    const advancedPlayers = advanceInjuryCountdown(
      recoveredPlayers.map((p) =>
        p.career.positionChangePlan && !p.career.positionChangePlan.completed
          ? advancePositionChange(p, days)
          : p,
      ),
      days,
    )

    const preNegCareer: Career = {
      ...career,
      season: updatedSeason,
      allLeagueSeasons,
      cup,
      seasonStatus: computeSeasonStatus({ ...career, season: updatedSeason, allLeagueSeasons, cup }),
    }
    const negResult = resolveNegotiationsService(preNegCareer, targetDate, advancedPlayers, teams)
    set({ career: negResult.career, players: negResult.players, teams: negResult.teams })
  },

  // --- Training ---
  trainPlayer(playerId, stat) {
    const { career, players } = get()
    if (!career) return
    const updatedPlayers = trainPlayerService(playerId, stat, players, career.difficulty)
    set({ players: updatedPlayers })
  },

  restPlayer(playerId) {
    const { players } = get()
    const updatedPlayers = restPlayerService(playerId, players)
    set({ players: updatedPlayers })
  },

  // --- Weekly training (new FIFA-style) ---
  setWeeklyTrainingSlot(slot) {
    const { career } = get()
    if (!career) return
    const plan = career.weeklyTrainingPlan ?? {
      slots: [],
      weekStartDate: career.season.currentDate,
      executed: false,
    }
    // Replace if player already has a slot, otherwise append (max 5)
    const existing = plan.slots.findIndex((s) => s.playerId === slot.playerId)
    let newSlots: WeeklyTrainingSlot[]
    if (existing !== -1) {
      newSlots = plan.slots.map((s, i) => (i === existing ? slot : s))
    } else if (plan.slots.length < 5) {
      newSlots = [...plan.slots, slot]
    } else {
      return  // plan full
    }
    set({ career: { ...career, weeklyTrainingPlan: { ...plan, slots: newSlots } } })
  },

  removeWeeklyTrainingSlot(playerId) {
    const { career } = get()
    if (!career || !career.weeklyTrainingPlan) return
    const plan = career.weeklyTrainingPlan
    set({
      career: {
        ...career,
        weeklyTrainingPlan: {
          ...plan,
          slots: plan.slots.filter((s) => s.playerId !== playerId),
        },
      },
    })
  },

  commitWeeklyTraining() {
    const { career, players } = get()
    if (!career || !career.weeklyTrainingPlan) return
    if (career.weeklyTrainingPlan.slots.length === 0) return

    const { players: updatedPlayers, career: updatedCareer } = executeWeeklyPlan(
      career.weeklyTrainingPlan,
      players,
      career,
      career.difficulty,
    )

    // Advance date by 7 days
    const [y, m, d] = updatedCareer.season.currentDate.split('-').map(Number)
    const next = new Date(y, m - 1, d)
    next.setDate(next.getDate() + 7)
    const newDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`

    set({
      players: updatedPlayers,
      career: {
        ...updatedCareer,
        weeklyTrainingPlan: null,
        season: { ...updatedCareer.season, currentDate: newDate },
      },
    })
  },

  // --- Technique teaching ---
  teachTechnique(playerId, bookId, replaceIndex) {
    const { career, players } = get()
    if (!career) return
    const book = getTechniqueBook(bookId)
    if (!book) return
    const playerIdx = players.findIndex((p) => p.id === playerId)
    if (playerIdx === -1) return

    const result = learnTechniqueService(players[playerIdx], book, career.inventory, replaceIndex)
    const newPlayers = players.map((p) => (p.id === playerId ? result.player : p))
    set({ players: newPlayers, career: { ...career, inventory: result.inventory } })
  },

  // --- Position change ---
  startPositionChange(playerId, targetPosition) {
    const { career, players } = get()
    if (!career) return 'ok'
    const activePlans = players.filter(
      (p) => p.id !== playerId && p.career.positionChangePlan && !p.career.positionChangePlan.completed,
    )
    if (activePlans.length >= 2) return 'limit_reached'
    const player = players.find((p) => p.id === playerId)
    if (!player) return 'ok'
    if (player.career.positionChangePlan && !player.career.positionChangePlan.completed) {
      // Already has an active plan — treated as replacing it
    }
    const updated = startOrResetPositionChange(player, targetPosition, career.season.currentDate, career.difficulty)
    set({ players: players.map((p) => (p.id === playerId ? updated : p)) })
    return 'ok'
  },

  cancelPositionChange(playerId) {
    const { players } = get()
    const newPlayers = players.map((p) =>
      p.id === playerId ? cancelPositionChangeService(p) : p,
    )
    set({ players: newPlayers })
  },

  // --- Transfer ---
  setTransferFilter(filter) {
    set((state) => ({
      activeTransferFilter: { ...state.activeTransferFilter, ...filter },
    }))
  },

  buyPlayer(playerId, amount) {
    const { career, teams, players } = get()
    if (!career) return
    const safe = sanitizeAmount(amount)
    if (safe === null) return
    const result = buyPlayerService(playerId, career.teamId, safe, career, teams, players)
    set({ career: result.career, teams: result.teams, players: result.players })
  },

  sellPlayer(playerId, toTeamId, amount) {
    const { career, teams, players } = get()
    if (!career) return
    const safe = sanitizeAmount(amount)
    if (safe === null) return
    const result = sellPlayerService(playerId, toTeamId, safe, career, teams, players)
    set({ career: result.career, teams: result.teams, players: result.players })
  },

  acceptTransferOffer(offerId) {
    const { career } = get()
    if (!career) return

    const offerEvent = career.inbox.find(
      (e) => e.type === 'TRANSFER_OFFER' && e.data?.offerId === offerId,
    )
    if (!offerEvent || !offerEvent.data) return

    const playerId = offerEvent.data.playerId as number
    const toTeamId = offerEvent.data.fromTeamId as number
    const rawAmount = offerEvent.data.amount as number
    const safe = sanitizeAmount(rawAmount)
    if (safe === null) return

    get().sellPlayer(playerId, toTeamId, safe)

    const { career: updatedCareer } = get()
    if (!updatedCareer) return
    set({ career: markRead(offerEvent.id, updatedCareer) })
  },

  rejectTransferOffer(offerId) {
    const { career } = get()
    if (!career) return
    const offerEvent = career.inbox.find(
      (e) => e.type === 'TRANSFER_OFFER' && e.data?.offerId === offerId,
    )
    if (!offerEvent) return
    set({ career: markRead(offerEvent.id, career) })
  },

  initiateTransferNegotiation(playerId, amount) {
    const { career, players, teams } = get()
    if (!career) return
    const updated = initiateNegotiationService(playerId, amount, career, players, teams, career.nameStyle)
    if (updated) set({ career: updated })
  },

  respondToCounterOffer(negotiationId, action, newAmount) {
    const { career } = get()
    if (!career) return
    const updated = respondToCounterService(negotiationId, action, career, newAmount)
    set({ career: updated })
  },

  respondToPlayerCounterOffer(negotiationId, action) {
    const { career } = get()
    if (!career) return
    const updated = respondToPlayerCounterService(negotiationId, action, career)
    set({ career: updated })
  },

  cancelNegotiation(negotiationId) {
    const { career } = get()
    if (!career) return
    const updated = cancelNegotiationService(negotiationId, career)
    set({ career: updated })
  },

  confirmTransfer(negotiationId) {
    const { career, players, teams } = get()
    if (!career) return
    const result = confirmTransferService(negotiationId, career, players, teams)
    set({ career: result.career, players: result.players, teams: result.teams })
  },

  dismissNegotiation(negotiationId) {
    const { career } = get()
    if (!career) return
    const neg = career.outgoingNegotiations.find((n) => n.id === negotiationId)
    if (!neg || (neg.phase !== 'failed' && neg.phase !== 'cancelled')) return
    set({
      career: {
        ...career,
        outgoingNegotiations: career.outgoingNegotiations.filter((n) => n.id !== negotiationId),
      },
    })
  },

  // --- Formation ---
  applyFormation(formationId) {
    const { career, teams, players } = get()
    if (!career) return
    const newFormation = seedFormations.find((f) => f.id === formationId)
    if (!newFormation) return
    set({
      teams: teams.map((t) =>
        t.id === career.teamId ? rebalanceLineup(t, newFormation, players) : t,
      ),
    })
  },

  updateStarters(slots, formation) {
    const { career, teams } = get()
    if (!career) return
    const userTeam = teams.find((t) => t.id === career.teamId)
    if (!userTeam) return

    const starterIds = new Set(slots.filter((id): id is number => id !== null))
    const formSlots = getFormationSlots(formation)
    const newStarters: import('../types/team').LineupSlot[] = []
    for (let i = 0; i < slots.length; i++) {
      const pid = slots[i]
      if (pid !== null && formSlots[i]) {
        newStarters.push({ playerId: pid, assignedPosition: formSlots[i].position, isStarter: true })
      }
    }
    const bench = userTeam.lineup
      .filter((s) => !starterIds.has(s.playerId))
      .map((s) => ({ ...s, isStarter: false }))

    set({
      teams: teams.map((t) =>
        t.id === career.teamId ? { ...t, lineup: [...newStarters, ...bench] } : t,
      ),
    })
  },

  swapLineupPlayers(starterId, benchId) {
    const { career, teams } = get()
    if (!career) return
    const userTeam = teams.find((t) => t.id === career.teamId)
    if (!userTeam) return
    const starterSlot = userTeam.lineup.find((s) => s.playerId === starterId && s.isStarter)
    const benchSlot   = userTeam.lineup.find((s) => s.playerId === benchId && !s.isStarter)
    if (!starterSlot || !benchSlot) return
    const newLineup = userTeam.lineup.map((slot) => {
      if (slot.playerId === starterId) return { ...slot, playerId: starterId, isStarter: false }
      if (slot.playerId === benchId)   return { ...starterSlot, playerId: benchId }
      return slot
    })
    set({ teams: teams.map((t) => t.id === career.teamId ? { ...t, lineup: newLineup } : t) })
  },

  setCaptain(playerId) {
    const { career, teams } = get()
    if (!career) return
    set({ teams: teams.map((t) => t.id === career.teamId ? { ...t, captainId: playerId } : t) })
  },

  setKeyPlayer(playerId) {
    const { career, teams } = get()
    if (!career) return
    set({
      teams: teams.map((t) =>
        t.id === career.teamId ? { ...t, keyPlayerId: playerId ?? undefined } : t,
      ),
    })
  },

  // --- Callup management ---
  callUpPlayer(playerId) {
    const { career, teams, players } = get()
    if (!career) return false
    const userTeam = teams.find((t) => t.id === career.teamId)
    if (!userTeam) return false
    if (userTeam.lineup.some((s) => s.playerId === playerId)) return true
    if (userTeam.lineup.length >= MAX_CALLUP) return false
    const player = players.find((p) => p.id === playerId)
    if (!player) return false
    const newSlot: import('../types/team').LineupSlot = {
      playerId,
      assignedPosition: player.position,
      isStarter: false,
    }
    set({
      teams: teams.map((t) =>
        t.id === career.teamId
          ? { ...t, lineup: [...t.lineup, newSlot] }
          : t,
      ),
    })
    return true
  },

  removeCallupPlayer(playerId) {
    const { career, teams } = get()
    if (!career) return
    const userTeam = teams.find((t) => t.id === career.teamId)
    if (!userTeam) return
    const slot = userTeam.lineup.find((s) => s.playerId === playerId)
    if (!slot || slot.isStarter) return
    set({
      teams: teams.map((t) =>
        t.id === career.teamId
          ? { ...t, lineup: t.lineup.filter((s) => s.playerId !== playerId) }
          : t,
      ),
    })
  },

  swapCallup(playerOutId, playerInId) {
    const { career, teams, players } = get()
    if (!career) return
    const userTeam = teams.find((t) => t.id === career.teamId)
    if (!userTeam) return
    const slotOut = userTeam.lineup.find((s) => s.playerId === playerOutId)
    if (!slotOut || slotOut.isStarter) return
    const playerIn = players.find((p) => p.id === playerInId)
    if (!playerIn) return
    const newSlot: import('../types/team').LineupSlot = {
      playerId: playerInId,
      assignedPosition: playerIn.position,
      isStarter: false,
    }
    set({
      teams: teams.map((t) =>
        t.id === career.teamId
          ? {
              ...t,
              lineup: t.lineup
                .filter((s) => s.playerId !== playerOutId)
                .concat(newSlot),
            }
          : t,
      ),
    })
  },

  // --- Jersey numbers ---
  changeJerseyNumber(playerId, newNumber) {
    const { players } = get()
    const conflict = players.find((p) => p.jerseyNumber === newNumber && p.id !== playerId)
    if (conflict) return 'conflict'
    set({ players: players.map((p) => p.id === playerId ? { ...p, jerseyNumber: newNumber } : p) })
    return 'ok'
  },

  swapJerseyNumbers(playerAId, playerBId) {
    const { players } = get()
    const a = players.find((p) => p.id === playerAId)
    const b = players.find((p) => p.id === playerBId)
    if (!a || !b) return
    const numA = a.jerseyNumber
    const numB = b.jerseyNumber
    set({
      players: players.map((p) => {
        if (p.id === playerAId) return { ...p, jerseyNumber: numB }
        if (p.id === playerBId) return { ...p, jerseyNumber: numA }
        return p
      }),
    })
  },

  // --- Potential analysis ---
  analyzePlayerPotential(playerId, _investment) {
    const { career, teams, players } = get()
    if (!career) return
    const userTeam = teams.find((t) => t.id === career.teamId)
    if (!userTeam) return
    const existing = career.playerPotential?.[playerId]
    if (!existing) return
    const nextTier = getNextAnalysisTier(existing)
    if (!nextTier) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    const cost = calcAnalysisCost(nextTier, existing, userTeam, player, career.difficulty)
    if (userTeam.budget < cost) return
    const updated = applyAnalysisTier(
      existing,
      nextTier,
      userTeam,
      player,
      player.seasonStats.minutesPlayed,
      career.difficulty,
    )
    set({
      career: {
        ...career,
        playerPotential: { ...career.playerPotential, [playerId]: updated },
      },
      teams: teams.map((t) =>
        t.id === career.teamId ? { ...t, budget: t.budget - cost } : t,
      ),
    })
  },

  // --- Inbox ---
  markInboxRead(eventId) {
    const { career } = get()
    if (!career) return
    set({ career: markRead(eventId, career) })
  },

  markAllInboxRead() {
    const { career } = get()
    if (!career) return
    set({ career: markAllRead(career) })
  },

  deleteInboxEvent(eventId) {
    const { career } = get()
    if (!career) return
    set({ career: { ...career, inbox: career.inbox.filter((e) => e.id !== eventId) } })
  },

  deleteAllInboxEvents() {
    const { career } = get()
    if (!career) return
    set({ career: { ...career, inbox: [] } })
  },

  // --- Match rewards ---
  claimReward(reward) {
    const { career, players, teams } = get()
    if (!career) return

    if (reward.type === 'money' && reward.moneyAmount) {
      const updatedTeams = teams.map((t) =>
        t.id === career.teamId ? { ...t, budget: t.budget + reward.moneyAmount! } : t,
      )
      set({ teams: updatedTeams, pendingRewards: null })
    } else if (reward.type === 'stat_boost' && reward.statBoost) {
      const { playerId, stat, amount } = reward.statBoost
      const updatedPlayers = players.map((p) => {
        if (p.id !== playerId) return p
        const newStats = { ...p.stats, [stat]: (p.stats[stat] ?? 0) + amount }
        newStats.TOT = Object.entries(newStats)
          .filter(([k]) => k !== 'TOT')
          .reduce((s, [, v]) => s + (v as number), 0)
        return { ...p, stats: newStats }
      })
      set({ players: updatedPlayers, pendingRewards: null })
    } else if (reward.type === 'technique_book' && reward.techniqueBook) {
      const book = reward.techniqueBook
      const updatedInventory = {
        ...career.inventory,
        techniqueBooks: {
          ...career.inventory.techniqueBooks,
          [book.id]: (career.inventory.techniqueBooks[book.id] ?? 0) + 1,
        },
        generatedBooks: {
          ...career.inventory.generatedBooks,
          [book.id]: book,
        },
      }
      set({ career: { ...career, inventory: updatedInventory }, pendingRewards: null })
    } else if (reward.type === 'equipment' && reward.equipmentItem) {
      const updatedInventory = {
        ...career.inventory,
        equipmentItems: [...career.inventory.equipmentItems, reward.equipmentItem],
      }
      set({ career: { ...career, inventory: updatedInventory }, pendingRewards: null })
    } else {
      set({ pendingRewards: null })
    }
  },

  // --- Equipment ---
  equipItem(playerId, itemId) {
    const { career, players } = get()
    if (!career) return
    const player = players.find((p) => p.id === playerId)
    const item = career.inventory.equipmentItems.find((i) => i.id === itemId)
    if (!player || !item) return
    const result = equipItemService(player, item, career.inventory)
    set({
      players: players.map((p) => (p.id === playerId ? result.player : p)),
      career: { ...career, inventory: result.inventory },
    })
  },

  unequipItem(playerId, slot) {
    const { career, players } = get()
    if (!career) return
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    const result = unequipItemService(player, slot, career.inventory)
    set({
      players: players.map((p) => (p.id === playerId ? result.player : p)),
      career: { ...career, inventory: result.inventory },
    })
  },

  // --- Objectives ---
  checkObjectives() {
    const { career } = get()
    if (!career) return
    set({ career: checkObjectives(career, career.season) })
  },

  claimObjective(objectiveId) {
    const { career, teams } = get()
    if (!career) return
    const obj = career.objectives.find((o) => o.id === objectiveId)
    if (!obj || !canClaimObjective(obj)) return

    const updatedObjectives = career.objectives.map((o) =>
      o.id === objectiveId ? { ...o, claimed: true } : o,
    )
    const updatedTeams = teams.map((t) => {
      if (t.id !== career.teamId) return t
      return {
        ...t,
        budget: t.budget + obj.reward.money,
        reputation: Math.min(100, t.reputation + obj.reward.reputation),
      }
    })
    set({ career: { ...career, objectives: updatedObjectives }, teams: updatedTeams })
  },

  // --- Cup ---
  simulateCupMatch(matchId) {
    const { career, players, teams } = get()
    if (!career?.cup) return
    const round = career.cup.rounds[career.cup.currentRoundIndex]
    const match = round.matches.find((m) => m.id === matchId)
    if (!match || match.played) return
    if (match.date > career.season.currentDate) return

    const homeTeam = teams.find((t) => t.id === match.homeTeamId)
    const awayTeam = teams.find((t) => t.id === match.awayTeamId)
    if (!homeTeam || !awayTeam) return

    set({ isSimulating: true })
    const aiMult = career.difficulty.aiStrengthMultiplier
    const homeIsUser = match.homeTeamId === career.teamId
    const rawHomeSnap = buildTeamSnapshot(homeTeam, players)
    const rawAwaySnap = buildTeamSnapshot(awayTeam, players)
    const homeSnap = homeIsUser ? rawHomeSnap : scaleNpcSnapshot(rawHomeSnap, aiMult)
    const awaySnap = !homeIsUser ? rawAwaySnap : scaleNpcSnapshot(rawAwaySnap, aiMult)
    const result = simulate(homeSnap, awaySnap, match, career.nameStyle)

    const committed = commitMatchResult(matchId, result, career, teams, players, true)

    const userTeam = teams.find((t) => t.id === career.teamId)
    const rivalTeam = teams.find((t) => t.id !== career.teamId && (t.id === match.homeTeamId || t.id === match.awayTeamId))
    const starterIds = new Set(userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [])
    const starters = players.filter((p) => starterIds.has(p.id))
    const rewards = userTeam && rivalTeam
      ? generateMatchRewards(match, userTeam, rivalTeam, starters, career.difficulty.rewardChoices, result, career.nameStyle)
      : null

    set({
      career: committed.career,
      players: committed.players,
      teams: committed.teams,
      isSimulating: false,
      lastMatchResult: result,
      selectedMatchId: matchId,
      pendingRewards: rewards,
    })
  },

  startLiveCupMatch(matchId) {
    const { career, players, teams } = get()
    if (!career?.cup) return
    const round = career.cup.rounds[career.cup.currentRoundIndex]
    const match = round.matches.find((m) => m.id === matchId)
    if (!match || match.played) return
    if (match.date > career.season.currentDate) return

    const homeTeam = teams.find((t) => t.id === match.homeTeamId)
    const awayTeam = teams.find((t) => t.id === match.awayTeamId)
    if (!homeTeam || !awayTeam) return

    const aiMult = career.difficulty.aiStrengthMultiplier
    const homeIsUser = match.homeTeamId === career.teamId
    const rawHomeSnap = buildTeamSnapshot(homeTeam, players)
    const rawAwaySnap = buildTeamSnapshot(awayTeam, players)
    const homeSnap = homeIsUser ? rawHomeSnap : scaleNpcSnapshot(rawHomeSnap, aiMult)
    const awaySnap = !homeIsUser ? rawAwaySnap : scaleNpcSnapshot(rawAwaySnap, aiMult)
    const result = simulate(homeSnap, awaySnap, match, career.nameStyle)
    set({ pendingMatch: { matchId, result, isCupMatch: true }, selectedMatchId: matchId })
  },

  // --- Season lifecycle ---
  closeSeason() {
    const { career, teams } = get()
    if (!career || career.seasonStatus !== 'all_finished') return

    const leagues = seedLeagues
    const { teams: updatedTeams, promotedIds, relegatedIds } =
      applyPromotionsRelegations(teams, leagues, career.season, career.allLeagueSeasons)

    // Compute user outcome
    const sorted = sortStandings(career.season.standings)
    const userPos = sorted.findIndex((r) => r.teamId === career.teamId) + 1
    const userOutcome = promotedIds.includes(career.teamId)
      ? 'promoted'
      : relegatedIds.includes(career.teamId)
      ? 'relegated'
      : 'stayed'

    // Count completed objectives
    const completedObj = career.objectives.filter((o) => o.completed).length
    const totalObj = career.objectives.length

    const userLeague = leagues.find((l) => l.id === career.season.leagueId)
    const review: import('../types/season').SeasonReview = {
      seasonNumber: career.seasonNumber,
      year: career.season.year,
      leagueId: career.season.leagueId,
      leagueName: userLeague?.name ?? career.season.leagueId,
      finalPosition: userPos,
      totalTeams: sorted.length,
      userOutcome,
      promotedTeamIds: promotedIds,
      relegatedTeamIds: relegatedIds,
      cupWinnerId: career.cup?.winnerId ?? null,
      userCupRoundsWon: getUserCupRoundsWon(career.cup, career.teamId),
      objectives: { completed: completedObj, total: totalObj },
    }

    let updatedCareer: Career = {
      ...career,
      seasonStatus: 'review',
      lastSeasonReview: review,
    }
    updatedCareer = addEvent(
      'SEASON_END',
      `Fin de temporada ${career.seasonNumber}`,
      `Posición final: #${userPos}. ${userOutcome === 'promoted' ? '¡ASCENSO!' : userOutcome === 'relegated' ? 'Descenso.' : 'Mantenéis la categoría.'}`,
      updatedCareer,
    )

    set({ career: updatedCareer, teams: updatedTeams, screen: 'season_review' })
  },

  startNewSeason() {
    const { career, players, teams } = get()
    if (!career || career.seasonStatus !== 'review') return

    const leagues = seedLeagues
    const newSeasonNumber = career.seasonNumber + 1
    const newYear = career.season.year + 1

    const userTeam = teams.find((t) => t.id === career.teamId)
    const newLeagueId = userTeam?.leagueId ?? career.season.leagueId
    const league = leagues.find((l) => l.id === newLeagueId)

    // New user season
    const newSeason = initSeason(career.teamId, newLeagueId, teams, leagues, newYear)

    // New external league seasons
    const newAllLeagueSeasons: Career['allLeagueSeasons'] = {}
    for (const otherLeague of leagues) {
      if (otherLeague.id !== newLeagueId) {
        newAllLeagueSeasons[otherLeague.id] = initLeagueSeason(otherLeague.id, teams, leagues, newYear)
      }
    }

    // New cup — deconflict dates against all league schedules
    const newAllLeagueMatches = [
      ...newSeason.matches,
      ...Object.values(newAllLeagueSeasons).flatMap((ls) => ls.matches),
    ]
    const newCup = deconflictCupSchedule(initCup(teams, newYear, newSeason.startDate), newAllLeagueMatches)

    // New objectives
    const newObjectives = league && userTeam ? getObjectivesForTeam(userTeam, league) : career.objectives

    // Reset player season stats
    const resetPlayers = players.map((p) => ({
      ...p,
      seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
    }))

    let updatedCareer: Career = {
      ...career,
      season: newSeason,
      seasonNumber: newSeasonNumber,
      allLeagueSeasons: newAllLeagueSeasons,
      cup: newCup,
      seasonStatus: 'active',
      lastSeasonReview: null,
      objectives: newObjectives,
      weeklyTrainingPlan: null,
    }
    updatedCareer = addEvent(
      'SEASON_START',
      `Temporada ${newSeasonNumber} comienza`,
      `Nueva temporada ${newYear} en ${league?.name ?? newLeagueId}. ¡Buena suerte!`,
      updatedCareer,
    )

    set({ career: updatedCareer, players: resetPlayers, screen: 'career_home' })
  },

  simulateAllRemainingAndClose() {
    const MAX_ITER = 200
    for (let i = 0; i < MAX_ITER; i++) {
      const { career } = get()
      if (!career) break
      const status = computeSeasonStatus(career)
      if (status === 'all_finished' || status === 'review') break
      get().advanceDay()
    }
    // After loop, close if ready
    const { career } = get()
    if (career && computeSeasonStatus(career) === 'all_finished') {
      get().closeSeason()
    }
  },
}))
