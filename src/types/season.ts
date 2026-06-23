import type { Match, StandingRow } from './competition'
import type { CareerSeasonStats } from './career'

// ─── Season status machine ────────────────────────────────────────────────────

export type SeasonStatus =
  | 'active'         // season in progress
  | 'user_finished'  // user has no more matches before the season final day
  | 'all_finished'   // season final day reached — ready to advance
  | 'review'         // season summary shown, waiting for user to start next season

// ─── Multi-league tracking ────────────────────────────────────────────────────

export interface LeagueSeason {
  leagueId: string
  teamIds: number[]
  matches: Match[]
  standings: StandingRow[]
  totalRounds: number
  finished: boolean
}

// ─── Cup (Copa del Rey style) ─────────────────────────────────────────────────

export const CUP_ROUND_NAMES = [
  'Previa',
  'Octavos de Final',
  'Cuartos de Final',
  'Semifinal',
  'Final',
] as const

export type CupRoundName = (typeof CUP_ROUND_NAMES)[number]

export interface CupRound {
  name: CupRoundName
  matches: Match[]
  finished: boolean
}

export interface Cup {
  year: number
  rounds: CupRound[]
  currentRoundIndex: number
  winnerId: number | null
  finished: boolean
}

// ─── Season review summary ────────────────────────────────────────────────────

export type UserSeasonOutcome = 'promoted' | 'relegated' | 'stayed'

export interface SeasonReview {
  seasonNumber: number
  year: number
  leagueId: string
  leagueName: string
  finalPosition: number
  totalTeams: number
  userOutcome: UserSeasonOutcome
  promotedTeamIds: number[]
  relegatedTeamIds: number[]
  cupWinnerId: number | null
  userCupRoundsWon: number  // 0 = eliminated in Previa, 4 = won the cup
  objectives: { completed: number; total: number }
  stats?: CareerSeasonStats
}
