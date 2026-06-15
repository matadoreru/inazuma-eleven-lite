import type { Season } from './competition'
import type { WeeklyTrainingPlan } from './training'
import type { ClubInventory } from './inventory'
import type { LeagueSeason, Cup, SeasonStatus, SeasonReview } from './season'

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

export interface InboxEvent {
  id: string
  type: InboxEventType
  title: string
  body: string
  date: string
  read: boolean
  data?: Record<string, unknown>
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
  inventory: ClubInventory
  // Multi-season / multi-competition fields
  allLeagueSeasons: Record<string, LeagueSeason>  // external leagues (not user's), keyed by leagueId
  cup: Cup | null
  seasonStatus: SeasonStatus
  lastSeasonReview: SeasonReview | null
  rewardChoices: 1 | 2 | 3
  createdAt: string
  lastSavedAt: string
}
