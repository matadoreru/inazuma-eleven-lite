export interface League {
  id: string
  name: string
  level: number
  promotionTo: string | null
  relegationTo: string | null
  promotionSlots: number
  relegationSlots: number
  teamsCount: number
  rounds: number
}

export interface Match {
  id: string
  leagueId: string
  type?: 'league' | 'cup'   // optional for backward compat with existing saves
  cupRound?: string          // cup round name when type === 'cup'
  round: number
  homeTeamId: number
  awayTeamId: number
  date: string
  played: boolean
  homeGoals: number
  awayGoals: number
  result: MatchResult | null
}

export interface MatchEvent {
  minute: number
  type: 'GOAL' | 'SAVE' | 'MISS' | 'YELLOW' | 'RED' | 'INJURY' | 'PHASE'
  teamId: number
  playerId?: number
  playerName?: string
  playerSpriteUrl?: string
  text: string
  isHome: boolean
}

export interface MatchResult {
  homeGoals: number
  awayGoals: number
  homeShots: number
  awayShots: number
  homeShotsOnTarget: number
  awayShotsOnTarget: number
  homePossession: number
  awayPossession: number
  homeFouls: number
  awayFouls: number
  homeYellows: number
  awayYellows: number
  homeReds: number
  awayReds: number
  homeCorners: number
  awayCorners: number
  homeSaves: number
  awaySaves: number
  homeXG: number
  awayXG: number
  events: MatchEvent[]
}

export interface StandingRow {
  teamId: number
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

export interface CalendarDay {
  date: string
  matches: Match[]
  isTrainingDay: boolean
  isRestDay: boolean
}

export interface Season {
  year: number
  leagueId: string
  teamIds: number[]
  matches: Match[]
  standings: StandingRow[]
  currentDate: string
  startDate: string
  endDate: string
  currentRound: number
  totalRounds: number
  finished: boolean
}
