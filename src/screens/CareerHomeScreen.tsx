import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import ObjectivesPanel from '../components/ObjectivesPanel'
import MatchPreviewPanel from '../components/MatchPreviewPanel'
import DayAdvancePanel from '../components/DayAdvancePanel'
import Icon from '../components/Icon'
import { getNextMatch } from '../services/calendarService'
import { getNextUserCupMatch } from '../services/cupService'
import { sortStandings } from '../services/standingsService'
import { leagues } from '../data/leagues'
import type { Match } from '../types/competition'
import type { Team } from '../types/team'

function formatBudget(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

// ─── Season phase banners ──────────────────────────────────────────────────────

function UserFinishedBanner({ onAdvanceDay, onAdvanceToNextMatch }: {
  onAdvanceDay: () => void
  onAdvanceToNextMatch: () => void
}) {
  return (
    <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon name="schedule" size="sm" className="text-blue-400" />
        <p className="text-blue-300 font-semibold text-sm">Tu liga ha terminado</p>
      </div>
      <p className="text-gray-400 text-xs">
        Otras competiciones siguen en curso. Avanza días para simularlas.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onAdvanceDay}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-2 rounded-lg transition-colors"
        >
          +1 día
        </button>
        <button
          onClick={onAdvanceToNextMatch}
          className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium py-2 rounded-lg transition-colors"
        >
          Avanzar al siguiente evento
        </button>
      </div>
    </div>
  )
}

function AllFinishedBanner({ onCloseSeason }: { onCloseSeason: () => void }) {
  return (
    <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <Icon name="check_circle" size="md" className="text-green-400" />
        </div>
        <div>
          <p className="text-green-300 font-bold">Todas las competiciones han terminado</p>
          <p className="text-gray-400 text-xs mt-0.5">La temporada está lista para cerrarse</p>
        </div>
      </div>
      <button
        onClick={onCloseSeason}
        className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        <Icon name="done_all" size="sm" />
        Cerrar temporada y ver resumen
      </button>
    </div>
  )
}

// ─── Next match panel (league or cup) ─────────────────────────────────────────

function NextMatchSection({
  match,
  isCupMatch,
  teams,
  currentDate,
  userTeamId,
  isSimulating,
  onQuickSim,
  onLiveSim,
}: {
  match: Match
  isCupMatch: boolean
  teams: Team[]
  currentDate: string
  userTeamId: number
  isSimulating: boolean
  onQuickSim: () => void
  onLiveSim: () => void
}) {
  const homeTeam = teams.find((t) => t.id === match.homeTeamId)
  const awayTeam = teams.find((t) => t.id === match.awayTeamId)
  if (!homeTeam || !awayTeam) return null

  const competitionLabel = isCupMatch
    ? `Copa · ${match.cupRound ?? 'Copa'}`
    : `${leagues.find((l) => l.id === match.leagueId)?.name ?? 'Liga'} · J${match.round}`

  return (
    <MatchPreviewPanel
      match={match}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      currentDate={currentDate}
      userTeamId={userTeamId}
      isSimulating={isSimulating}
      competitionLabel={competitionLabel}
      onQuickSim={onQuickSim}
      onLiveSim={onLiveSim}
    />
  )
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CareerHomeScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const simulateMatch = useCareerStore((s) => s.simulateMatch)
  const simulateCupMatch = useCareerStore((s) => s.simulateCupMatch)
  const startLiveMatch = useCareerStore((s) => s.startLiveMatch)
  const startLiveCupMatch = useCareerStore((s) => s.startLiveCupMatch)
  const advanceDay = useCareerStore((s) => s.advanceDay)
  const advanceToNextMatch = useCareerStore((s) => s.advanceToNextMatch)
  const closeSeason = useCareerStore((s) => s.closeSeason)
  const isSimulating = useCareerStore((s) => s.isSimulating)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)
  const teamName = userTeam?.name ?? 'Equipo'
  const budget = userTeam?.budget ?? 0

  const sortedStandings = sortStandings(career.season.standings)
  const leaguePosition = sortedStandings.findIndex((r) => r.teamId === career.teamId) + 1
  const teamRow = sortedStandings.find((r) => r.teamId === career.teamId)

  const seasonStatus = career.seasonStatus

  // Find next user match: league OR cup, whichever is earlier
  const nextLeagueMatch = getNextMatch(career.season, career.teamId)
  const nextCupMatch = getNextUserCupMatch(career.cup, career.teamId, '9999-12-31')
  const nextMatch: { match: Match; isCup: boolean } | null = (() => {
    if (nextLeagueMatch && nextCupMatch) {
      return nextLeagueMatch.date <= nextCupMatch.date
        ? { match: nextLeagueMatch, isCup: false }
        : { match: nextCupMatch, isCup: true }
    }
    if (nextLeagueMatch) return { match: nextLeagueMatch, isCup: false }
    if (nextCupMatch) return { match: nextCupMatch, isCup: true }
    return null
  })()

  function handleQuickSim() {
    if (!nextMatch) return
    if (nextMatch.isCup) {
      simulateCupMatch(nextMatch.match.id)
      navigate('match')
    } else {
      simulateMatch(nextMatch.match.id)
      navigate('match')
    }
  }

  function handleLiveSim() {
    if (!nextMatch) return
    if (nextMatch.isCup) {
      startLiveCupMatch(nextMatch.match.id)
      navigate('match_live')
    } else {
      startLiveMatch(nextMatch.match.id)
      navigate('match_live')
    }
  }

  const hasNextMatch = !!nextMatch

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title={teamName} badgeUrl={userTeam?.badgeUrl} />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />

        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Season stats bar */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-gray-400 text-xs mb-1">Temporada</p>
              <p className="text-white font-bold">{career.seasonNumber}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <Icon name="leaderboard" size="xs" />
                Posición
              </div>
              <p className="text-yellow-400 text-xl font-extrabold">
                {leaguePosition > 0 ? `#${leaguePosition}` : '--'}
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <Icon name="emoji_events" size="xs" />
                Puntos
              </div>
              <p className="text-white font-bold">{teamRow?.points ?? 0}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <Icon name="payments" size="xs" />
                Presupuesto
              </div>
              <p className="text-green-400 font-bold">{formatBudget(budget)}</p>
            </div>
          </div>

          {/* Season phase banners */}
          {seasonStatus === 'all_finished' && (
            <AllFinishedBanner onCloseSeason={closeSeason} />
          )}

          {seasonStatus === 'user_finished' && (
            <UserFinishedBanner
              onAdvanceDay={advanceDay}
              onAdvanceToNextMatch={advanceToNextMatch}
            />
          )}

          {/* Main panels (only shown when season is active or user_finished) */}
          {(seasonStatus === 'active' || seasonStatus === 'user_finished') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Day advance — only when season is active */}
              {seasonStatus === 'active' && (
                <DayAdvancePanel
                  currentDate={career.season.currentDate}
                  teamId={career.teamId}
                  matches={career.season.matches}
                  onAdvanceDay={advanceDay}
                  onAdvanceToNextMatch={advanceToNextMatch}
                  hasNextMatch={hasNextMatch}
                />
              )}

              {/* Next match */}
              {nextMatch ? (
                <NextMatchSection
                  match={nextMatch.match}
                  isCupMatch={nextMatch.isCup}
                  teams={teams}
                  currentDate={career.season.currentDate}
                  userTeamId={career.teamId}
                  isSimulating={isSimulating}
                  onQuickSim={handleQuickSim}
                  onLiveSim={handleLiveSim}
                />
              ) : seasonStatus === 'active' ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col items-center justify-center gap-2 text-center">
                  <Icon name="sports_soccer" size="lg" className="text-gray-600" />
                  <p className="text-gray-400 text-sm">No hay partidos pendientes</p>
                </div>
              ) : null}
            </div>
          )}

          {/* Objectives */}
          <ObjectivesPanel />
        </main>
      </div>
    </div>
  )
}
