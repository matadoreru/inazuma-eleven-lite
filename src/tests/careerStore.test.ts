import { afterEach, describe, expect, it } from 'vitest'
import { useCareerStore } from '../store/careerStore'
import type { Career } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Match, League } from '../types/competition'
import type { Team, Formation } from '../types/team'

const makeFormation = (): Formation => ({
  id: 1,
  name: '4-4-2',
  tacticalType: 'BALANCED',
  GK: 1,
  DF: 4,
  MD: 4,
  FW: 2,
})

const makeTeam = (id: number, leagueId: string): Team => ({
  id,
  name: `Team ${id}`,
  tier: 1,
  reputation: 50,
  budget: 100000,
  leagueId,
  captainId: id,
  formation: makeFormation(),
  lineup: [],
  playerIds: [],
})

const makeLeague = (id: string, level: number): League => ({
  id,
  name: id,
  level,
  promotionTo: null,
  relegationTo: null,
  promotionSlots: 0,
  relegationSlots: 0,
  teamsCount: 2,
  rounds: 2,
})

const makeMatch = (id: string, date: string, homeTeamId: number, awayTeamId: number, leagueId = 'league-2'): Match => ({
  id,
  leagueId,
  round: 1,
  homeTeamId,
  awayTeamId,
  date,
  played: false,
  homeGoals: 0,
  awayGoals: 0,
  result: null,
})

const makeCareer = (externalMatches: Match[]): Career => ({
  id: 'career-1',
  managerName: 'Manager',
  managerAvatar: '/avatars/avatar-1.svg',
  teamId: 1,
  season: {
    year: 2026,
    leagueId: 'league-1',
    teamIds: [1, 2],
    matches: [
      {
        id: 'user-finished-match',
        leagueId: 'league-1',
        round: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        date: '2026-08-10',
        played: true,
        homeGoals: 1,
        awayGoals: 0,
        result: null,
      },
    ],
    standings: [],
    currentDate: '2026-08-10',
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    currentRound: 1,
    totalRounds: 2,
    finished: true,
  },
  seasonNumber: 1,
  totalBudgetSpent: 0,
  totalBudgetEarned: 0,
  objectives: [],
  inbox: [],
  transferHistory: [],
  watchlist: [],
  seasonHistory: [],
  playerPotential: {},
  weeklyTrainingPlan: null,
  lastCompletedTrainingSlots: null,
  inventory: { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] },
  allLeagueSeasons: {
    'league-2': {
      leagueId: 'league-2',
      teamIds: [3, 4],
      matches: externalMatches,
      standings: [],
      totalRounds: 1,
      finished: false,
    },
  },
  cup: null,
  seasonStatus: 'user_finished',
  lastSeasonReview: null,
  outgoingNegotiations: [],
  incomingOffers: [],
  difficulty: DEFAULT_DIFFICULTY,
  nameStyle: 'western',
  createdAt: '2026-08-01',
  lastSavedAt: '2026-08-01',
})

const testLeagues: League[] = [
  makeLeague('league-1', 1),
  makeLeague('league-2', 2),
]

afterEach(() => {
  useCareerStore.setState({
    screen: 'main_menu',
    previousScreen: null,
    selectedPlayerId: null,
    selectedMatchId: null,
    career: null,
    players: [],
    teams: [],
    leagues: [],
    isSimulating: false,
    lastMatchResult: null,
    pendingMatch: null,
    pendingRewards: null,
    rewardBeingEquipped: null,
    uiPanel: null,
  })
})

describe('careerStore season end flow', () => {
  it('advanceDay resolves pending external matches and transitions to season review', () => {
    useCareerStore.setState({
      career: {
        ...makeCareer([makeMatch('ext-today', '2026-08-10', 3, 4)]),
        season: { ...makeCareer([makeMatch('ext-today', '2026-08-10', 3, 4)]).season, currentDate: '2026-08-09' },
      },
      players: [],
      teams: [makeTeam(1, 'league-1'), makeTeam(2, 'league-1'), makeTeam(3, 'league-2'), makeTeam(4, 'league-2')],
      leagues: testLeagues,
      screen: 'career_home',
    })

    useCareerStore.getState().advanceDay()

    const state = useCareerStore.getState()
    expect(state.career?.allLeagueSeasons['league-2'].matches[0].played).toBe(true)
    expect(state.career?.allLeagueSeasons['league-2'].finished).toBe(true)
    expect(state.career?.seasonStatus).toBe('review')
    expect(state.screen).toBe('season_review')
  })

  it('advanceToNextMatch falls back to the next external event after the user league ends', () => {
    useCareerStore.setState({
      career: makeCareer([makeMatch('ext-future', '2026-08-15', 3, 4)]),
      players: [],
      teams: [makeTeam(1, 'league-1'), makeTeam(2, 'league-1'), makeTeam(3, 'league-2'), makeTeam(4, 'league-2')],
      leagues: testLeagues,
      screen: 'career_home',
    })

    useCareerStore.getState().advanceToNextMatch()

    const state = useCareerStore.getState()
    expect(state.career?.season.currentDate).toBe('2026-08-15')
    expect(state.career?.allLeagueSeasons['league-2'].matches[0].played).toBe(true)
    expect(state.career?.allLeagueSeasons['league-2'].finished).toBe(true)
  })

  it('simulateAllRemainingAndClose starts the next season automatically', () => {
    useCareerStore.setState({
      career: makeCareer([makeMatch('ext-future', '2026-08-15', 3, 4)]),
      players: [],
      teams: [makeTeam(1, 'league-1'), makeTeam(2, 'league-1'), makeTeam(3, 'league-2'), makeTeam(4, 'league-2')],
      leagues: testLeagues,
      screen: 'career_home',
    })

    useCareerStore.getState().simulateAllRemainingAndClose()

    const state = useCareerStore.getState()
    expect(state.career?.seasonNumber).toBe(2)
    expect(state.career?.season.year).toBe(2027)
    expect(state.career?.seasonStatus).toBe('active')
    expect(state.screen).toBe('career_home')
  })
})
