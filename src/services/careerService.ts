import type {
  Career,
  Objective,
  ObjectiveType,
  ObjectiveCategory,
  ObjectiveDifficulty,
  ObjectiveReward,
  ObjectivePenalty,
  DifficultySettings,
} from '../types/career'
import type { PotentialAnalysis } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Team } from '../types/team'
import type { League } from '../types/competition'
import type { Player } from '../types/player'
import { initSeason, initLeagueSeason } from './seasonService'
import { initCup, deconflictCupSchedule } from './cupService'
import { addEvent } from './inboxService'
import { generatePotentialAnalysis } from './potentialService'
import { autoAssignJerseys } from './jerseyService'
import { EMPTY_INVENTORY } from '../types/inventory'

const CURRENT_YEAR = new Date().getFullYear()

function obj(
  type: ObjectiveType,
  description: string,
  target: number,
  reward: ObjectiveReward,
  penalty: ObjectivePenalty,
  isMandatory: boolean,
  category: ObjectiveCategory,
  difficulty: ObjectiveDifficulty,
  exclusionGroup?: string,
): Objective {
  return {
    id: crypto.randomUUID(),
    type,
    category,
    difficulty,
    exclusionGroup,
    description,
    target,
    current: 0,
    completed: false,
    failed: false,
    claimed: false,
    penaltyApplied: false,
    reward,
    penalty,
    isMandatory,
  }
}

function buildObjectives(team: Team, league: League): Objective[] {
  const objectives: Objective[] = []

  // --- SEASON objectives (mandatory main goal) ---
  if (team.tier <= 2) {
    objectives.push(obj(
      'WIN_LEAGUE',
      'Ganar el título de liga',
      1,
      { money: 500_000, reputation: 15 },
      { reputation: 12 },
      true,
      'SEASON', 'HARD', 'main_goal',
    ))
  } else if (league.relegationSlots > 0) {
    objectives.push(obj(
      'AVOID_RELEGATION',
      'Evitar el descenso esta temporada',
      1,
      { money: 100_000, reputation: 5 },
      { reputation: 10 },
      true,
      'SEASON', 'EASY', 'main_goal',
    ))
  } else {
    // League has no relegation — objective is to avoid the bottom positions
    const safeZone = Math.max(1, league.teamsCount - 2)
    objectives.push(obj(
      'TOP_N',
      `Terminar entre los ${safeZone} primeros`,
      safeZone,
      { money: 100_000, reputation: 5 },
      { reputation: 10 },
      true,
      'SEASON', 'EASY', 'main_goal',
    ))
  }

  // --- SEASON objectives (secondary) ---
  const pointsTarget = team.tier <= 2 ? 70 : team.tier === 3 ? 50 : 40
  objectives.push(obj(
    'EARN_POINTS',
    `Conseguir al menos ${pointsTarget} puntos`,
    pointsTarget,
    { money: 50_000, reputation: 3 },
    { reputation: 0 },
    false,
    'SEASON', 'NORMAL',
  ))

  const winTarget = Math.ceil(league.rounds * 0.45)
  objectives.push(obj(
    'WIN_MATCHES',
    `Ganar al menos ${winTarget} partidos`,
    winTarget,
    { money: 75_000, reputation: 3 },
    { reputation: 0 },
    false,
    'SEASON', 'NORMAL',
  ))

  const topN = team.tier <= 2 ? 3 : 5
  objectives.push(obj(
    'TOP_N',
    `Terminar entre los ${topN} primeros`,
    topN,
    { money: 200_000, reputation: 8 },
    { reputation: 0 },
    false,
    'SEASON', 'HARD', 'finish_position',
  ))

  // --- GENERAL objectives ---
  objectives.push(obj(
    'SCORE_GOALS',
    'Marcar al menos 30 goles en la temporada',
    30,
    { money: 40_000, reputation: 2 },
    { reputation: 0 },
    false,
    'GENERAL', 'NORMAL',
  ))
  objectives.push(obj(
    'CONCEDE_FEW',
    'Recibir menos de 25 goles en la temporada',
    25,
    { money: 60_000, reputation: 2 },
    { reputation: 0 },
    false,
    'GENERAL', 'NORMAL',
  ))

  return objectives
}

export function chooseTeam(teamId: number, teams: Team[]): Team {
  const team = teams.find((t) => t.id === teamId)
  if (!team) throw new Error(`Team ${teamId} not found`)
  return team
}

export function getObjectivesForTeam(team: Team, league: League): Objective[] {
  return buildObjectives(team, league)
}

export function createCareer(
  managerName: string,
  teamId: number,
  teams: Team[],
  leagues: League[],
  players: Player[],
  settings: DifficultySettings = DEFAULT_DIFFICULTY,
): { career: Career; teams: Team[]; players: Player[] } {
  const scaledTeams = teams.map((t) =>
    t.id === teamId
      ? { ...t, budget: Math.round(t.budget * settings.budgetMultiplier) }
      : t,
  )

  const team = chooseTeam(teamId, scaledTeams)
  const league = leagues.find((l) => l.id === team.leagueId)
  if (!league) throw new Error(`League ${team.leagueId} not found`)

  const season = initSeason(teamId, team.leagueId, scaledTeams, leagues, CURRENT_YEAR)
  const objectives = buildObjectives(team, league)

  // Initialize external leagues (all leagues except user's)
  const allLeagueSeasons: Career['allLeagueSeasons'] = {}
  for (const otherLeague of leagues) {
    if (otherLeague.id !== team.leagueId) {
      allLeagueSeasons[otherLeague.id] = initLeagueSeason(otherLeague.id, scaledTeams, leagues, CURRENT_YEAR)
    }
  }

  // Initialize cup and deconflict dates with all league schedules
  const allLeagueMatches = [
    ...season.matches,
    ...Object.values(allLeagueSeasons).flatMap((ls) => ls.matches),
  ]
  const cup = deconflictCupSchedule(initCup(scaledTeams, CURRENT_YEAR, season.startDate), allLeagueMatches)

  // Generate potential profiles for all players on the user's squad
  const playerPotential: Record<number, PotentialAnalysis> = {}
  for (const player of players.filter((p) => p.teamId === teamId)) {
    playerPotential[player.id] = generatePotentialAnalysis(player)
  }

  // Auto-assign jersey numbers (starting from 100) for squad players that have none (0)
  const assignedPlayers = autoAssignJerseys(team.playerIds, players)

  const now = new Date().toISOString().split('T')[0]

  let career: Career = {
    id: crypto.randomUUID(),
    managerName,
    managerAvatar: '',
    teamId,
    season,
    seasonNumber: 1,
    totalBudgetSpent: 0,
    totalBudgetEarned: 0,
    objectives,
    inbox: [],
    transferHistory: [],
    watchlist: [],
    seasonHistory: [],
    playerPotential,
    weeklyTrainingPlan: null,
    inventory: { ...EMPTY_INVENTORY },
    allLeagueSeasons,
    cup,
    seasonStatus: 'active',
    lastSeasonReview: null,
    outgoingNegotiations: [],
    incomingOffers: [],
    difficulty: settings,
    nameStyle: 'western',
    createdAt: now,
    lastSavedAt: now,
  }

  career = addEvent(
    'SEASON_START',
    `Temporada ${CURRENT_YEAR} comienza!`,
    `Bienvenido, ${managerName}! Ahora entrenas al ${team.name}. Buena suerte esta temporada!`,
    career,
  )

  return { career, teams: scaledTeams, players: assignedPlayers }
}
