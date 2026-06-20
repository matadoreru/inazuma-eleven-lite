import type { Season } from './competition'
import type { WeeklyTrainingPlan, WeeklyTrainingSlot } from './training'
import type { ClubInventory } from './inventory'
import type { LeagueSeason, Cup, SeasonStatus, SeasonReview } from './season'

export type ObjectiveGroupType = 'season_end' | 'continuous' | 'match'

export type ObjectiveType =
  | 'WIN_LEAGUE'
  | 'TOP_N'
  | 'AVOID_RELEGATION'
  | 'WIN_MATCHES'
  | 'SCORE_GOALS'
  | 'CONCEDE_FEW'
  | 'DEVELOP_YOUTH'
  | 'EARN_POINTS'

export type ObjectiveCategory = 'MATCH' | 'SEASON' | 'GENERAL'
export type ObjectiveDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'VERY_HARD'
export type ObjectiveStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'claimed'

export interface ObjectiveReward {
  money: number
  reputation: number
}

export interface ObjectivePenalty {
  reputation: number
}

export interface Objective {
  id: string
  type: ObjectiveType
  category?: ObjectiveCategory
  difficulty?: ObjectiveDifficulty
  exclusionGroup?: string
  groupType?: ObjectiveGroupType
  description: string
  target: number
  current: number
  completed: boolean
  failed: boolean
  claimed: boolean
  penaltyApplied: boolean
  reward: ObjectiveReward
  penalty: ObjectivePenalty
  isMandatory: boolean
}

export type InboxEventType =
  | 'SEASON_START'
  | 'SEASON_END'
  | 'MATCH_RESULT'
  | 'OBJECTIVE_COMPLETE'
  | 'OBJECTIVE_FAILED'
  | 'TRANSFER_OFFER'
  | 'TRANSFER_ACCEPTED'
  | 'TRANSFER_REJECTED'
  | 'PLAYER_INJURED'
  | 'PLAYER_RECOVERED'
  | 'PLAYER_GROWTH'
  | 'NEWS'
  | 'OUTGOING_TRANSFER_CLUB_ACCEPTED'
  | 'OUTGOING_TRANSFER_CLUB_REJECTED'
  | 'OUTGOING_TRANSFER_CLUB_COUNTER'
  | 'OUTGOING_TRANSFER_PLAYER_ACCEPTED'
  | 'OUTGOING_TRANSFER_PLAYER_REJECTED'
  | 'TRAINING_AVAILABLE'

export interface InboxEvent {
  id: string
  type: InboxEventType
  title: string
  body: string
  date: string
  read: boolean
  data?: Record<string, unknown>
  targetScreen?: string      // Screen name to navigate to on click
  targetEntityId?: string    // e.g. playerId or matchId as string
}

export interface TransferOffer {
  id: string
  fromTeamId: number
  fromTeamName: string
  playerId: number
  playerName: string
  amount: number
  date: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface IncomingOffer {
  id: string
  fromTeamId: number
  fromTeamName: string
  playerId: number
  amount: number
  date: string
  status: 'pending' | 'accepted' | 'rejected' | 'budget_failed' | 'counter_sent' | 'counter_accepted' | 'counter_rejected'
  counterAmount?: number
  counterResolutionDate?: string
}

// ─── Transfer Negotiations ────────────────────────────────────────────────────

export type NegotiationPhase =
  | 'club_pending'      // waiting for rival club response
  | 'player_pending'    // club accepted; waiting for player decision
  | 'player_counter'    // free agent made a counter-offer; waiting for user response
  | 'player_accepted'   // player said yes; waiting for user to confirm
  | 'completed'         // transfer completed successfully
  | 'failed'            // rejected definitively
  | 'cancelled'         // cancelled by user

export type NegotiationFailureReason =
  | 'club_rejected'
  | 'player_rejected'
  | 'player_unavailable'
  | 'budget_failed'

export interface OutgoingNegotiation {
  id: string
  playerId: number
  playerName: string
  targetClubId: number | null   // null = free agent
  targetClubName: string
  phase: NegotiationPhase
  currentOffer: number          // current amount offered
  counterAmount?: number        // club counter-offer, if pending
  offerRound: number            // 1–3 (initial + max 2 counters)
  isFreeAgent: boolean
  resolutionDate: string        // ISO date when this phase resolves
  failureReason?: NegotiationFailureReason
}

export interface CareerSeasonStats {
  seasonNumber: number
  year: number
  leagueId: string
  finalPosition: number
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  winRate: number
  avgPossession: number
  cleanSheets: number
  bestWinStreak: number
}

// ─── Potential Analysis ──────────────────────────────────────────────────────

export type GrowthCurve = 'early' | 'normal' | 'late'
export type DevelopmentRisk = 'low' | 'medium' | 'high'

// The five scouting tiers, unlocked in order
export type AnalysisTier = 'basic' | 'advanced' | 'performance' | 'development' | 'full'

export const ANALYSIS_TIER_ORDER: AnalysisTier[] = [
  'basic',
  'advanced',
  'performance',
  'development',
  'full',
]

// Information progressively revealed through analysis
export interface PotentialDiscovered {
  growthCurve?: GrowthCurve         // revealed by: advanced
  developmentRisk?: DevelopmentRisk // revealed by: development
  trainingAffinity?: number         // revealed by: development (0.7–1.4 multiplier)
  matchAffinity?: number            // revealed by: performance (0.7–1.4 multiplier)
  strengthsFutures?: string[]       // revealed by: full (e.g. ["Técnica", "Control"])
  recommendation?: string           // revealed by: full (scout advice text)
}

export interface PotentialAnalysis {
  // Core hidden data — never exposed to the user directly
  truePotential: number          // 35–99 scale (career.potential range)
  growthCurve: GrowthCurve       // affects how growth changes with age
  developmentRisk: DevelopmentRisk
  trainingAffinity: number       // 0.7–1.4 multiplier for training gains
  matchAffinity: number          // 0.7–1.4 multiplier for match-based growth

  // Visible range (always contains truePotential)
  uncertainty: number            // current half-range; starts wide, narrows with analysis
  rangeMin: number               // truePotential - uncertainty (floored at 1)
  rangeMax: number               // truePotential + uncertainty (capped at 99)

  // Accumulated analysis state
  investmentTotal: number        // total spent on scouting
  analysesCompleted: AnalysisTier[]

  // What the club has actually discovered
  discovered: PotentialDiscovered
}

// ─── Difficulty ─────────────────────────────────────────────────────────────

export interface DifficultySettings {
  aiStrengthMultiplier: number         // 0.7–1.3   | scales NPC team strength in user matches
  staminaRecoveryPerDay: number        // 3–15 pts  | stamina recovered per calendar day
  starterStaminaDrain: number          // 15–35 pts | stamina lost per match (starter)
  benchStaminaDrain: number            // 4–15 pts  | stamina lost per match (bench)
  trainingGainMultiplier: number       // 0.5–2.0x  | scales weekly plan + manual training
  seasonGrowthMultiplier: number       // 0.5–2.0x  | scales end-of-season stat growth
  positionChangeDaysMultiplier: number // 0.5–2.0x  | scales position-change duration
  transferCostMultiplier: number       // 0.5–2.0x  | scales buy price paid by user
  budgetMultiplier: number             // 0.5–2.0x  | scales team's starting budget
  scoutCostMultiplier: number          // 0.5–2.0x  | scales potential analysis costs
  rewardChoices: 1 | 2 | 3            // reward options offered after each match
}

export const DIFFICULTY_PRESETS: Record<'easy' | 'normal' | 'hard', DifficultySettings> = {
  easy: {
    aiStrengthMultiplier: 0.85,
    staminaRecoveryPerDay: 10,
    starterStaminaDrain: 20,
    benchStaminaDrain: 6,
    trainingGainMultiplier: 1.4,
    seasonGrowthMultiplier: 1.25,
    positionChangeDaysMultiplier: 0.75,
    transferCostMultiplier: 0.8,
    budgetMultiplier: 1.25,
    scoutCostMultiplier: 0.75,
    rewardChoices: 3,
  },
  normal: {
    aiStrengthMultiplier: 1.0,
    staminaRecoveryPerDay: 7,
    starterStaminaDrain: 25,
    benchStaminaDrain: 8,
    trainingGainMultiplier: 1.0,
    seasonGrowthMultiplier: 1.0,
    positionChangeDaysMultiplier: 1.0,
    transferCostMultiplier: 1.0,
    budgetMultiplier: 1.0,
    scoutCostMultiplier: 1.0,
    rewardChoices: 2,
  },
  hard: {
    aiStrengthMultiplier: 1.2,
    staminaRecoveryPerDay: 5,
    starterStaminaDrain: 30,
    benchStaminaDrain: 10,
    trainingGainMultiplier: 0.75,
    seasonGrowthMultiplier: 0.8,
    positionChangeDaysMultiplier: 1.5,
    transferCostMultiplier: 1.25,
    budgetMultiplier: 0.8,
    scoutCostMultiplier: 1.5,
    rewardChoices: 1,
  },
}

export const DEFAULT_DIFFICULTY: DifficultySettings = DIFFICULTY_PRESETS.normal

// ─── Career ─────────────────────────────────────────────────────────────────

export interface Career {
  id: string
  managerName: string
  managerAvatar: string
  teamId: number
  season: Season
  seasonNumber: number
  totalBudgetSpent: number
  totalBudgetEarned: number
  objectives: Objective[]
  inbox: InboxEvent[]
  transferHistory: TransferOffer[]
  watchlist: number[]
  seasonHistory: CareerSeasonStats[]
  playerPotential: Record<number, PotentialAnalysis>
  weeklyTrainingPlan: WeeklyTrainingPlan | null
  lastCompletedTrainingSlots: WeeklyTrainingSlot[] | null
  inventory: ClubInventory
  // Multi-season / multi-competition fields
  allLeagueSeasons: Record<string, LeagueSeason>  // external leagues (not user's), keyed by leagueId
  cup: Cup | null
  seasonStatus: SeasonStatus
  lastSeasonReview: SeasonReview | null
  outgoingNegotiations: OutgoingNegotiation[]
  incomingOffers: IncomingOffer[]
  difficulty: DifficultySettings
  objectiveDifficulty?: 'easy' | 'normal' | 'hard' | 'very_hard'
  nameStyle: 'western' | 'japanese'
  createdAt: string
  lastSavedAt: string
}
