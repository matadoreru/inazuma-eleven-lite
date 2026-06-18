import { useCareerStore } from '../store/careerStore'
import GameLayout from '../components/GameLayout'
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

function UserFinishedBanner({ onAdvanceDay, onAdvanceToNextMatch, onSimulateAll }: {
  onAdvanceDay: () => void
  onAdvanceToNextMatch: () => void
  onSimulateAll: () => void
}) {
  return (
    <div className="panel p-4 flex flex-col gap-3 border-blue-500/40">
      <div className="flex items-center gap-2">
        <Icon name="schedule" size="sm" className="text-gold-500" />
        <p className="text-gold-400 font-semibold text-sm">Tu liga ha terminado</p>
      </div>
      <p className="text-gray-400 text-xs">
        Otras competiciones siguen en curso. Avanza días para simularlas o simúlalas todas de golpe.
      </p>
      <div className="flex gap-2">
        <button onClick={onAdvanceDay} className="btn-secondary flex-1 py-2">
          +1 día
        </button>
        <button onClick={onAdvanceToNextMatch} className="flex-1 py-2 bg-blue-800/60 hover:bg-blue-700/70 text-gold-400 text-xs font-semibold rounded border border-blue-600/40 hover:border-blue-500 transition-colors uppercase tracking-wide">
          Sig. evento
        </button>
      </div>
      <button
        onClick={onSimulateAll}
        className="w-full py-2.5 bg-green-800/60 hover:bg-green-700/70 text-green-300 text-xs font-semibold rounded border border-green-600/40 hover:border-green-500 transition-colors uppercase tracking-wide flex items-center justify-center gap-1.5"
      >
        <Icon name="fast_forward" size="xs" />
        Simular todo y cerrar temporada
      </button>
    </div>
  )
}

function AllFinishedBanner({ onCloseSeason }: { onCloseSeason: () => void }) {
  return (
    <div className="panel p-5 flex flex-col gap-4 border-green-600/40">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-600/40 flex items-center justify-center">
          <Icon name="check_circle" size="md" className="text-green-400" />
        </div>
        <div>
          <p className="text-green-300 font-bold text-sm">Todas las competiciones han terminado</p>
          <p className="text-gray-400 text-xs mt-0.5">La temporada está lista para cerrarse</p>
        </div>
      </div>
      <button
        onClick={onCloseSeason}
        className="w-full bg-green-800/60 hover:bg-green-700/70 text-green-300 text-xs font-semibold py-3 rounded border border-green-600/40 hover:border-green-500 flex items-center justify-center gap-2 transition-colors uppercase tracking-wide"
      >
        <Icon name="done_all" size="sm" />
        Cerrar temporada · Ver resumen
      </button>
    </div>
  )
}

function NextMatchSection({
  match, isCupMatch, teams, currentDate, userTeamId, isSimulating, onQuickSim, onLiveSim,
}: {
  match: Match; isCupMatch: boolean; teams: Team[]; currentDate: string
  userTeamId: number; isSimulating: boolean; onQuickSim: () => void; onLiveSim: () => void
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

export default function CareerHomeScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const simulateMatch = useCareerStore((s) => s.simulateMatch)
  const simulateCupMatch = useCareerStore((s) => s.simulateCupMatch)
  const startLiveMatch = useCareerStore((s) => s.startLiveMatch)
  const startLiveCupMatch = useCareerStore((s) => s.startLiveCupMatch)
  const advanceDay = useCareerStore((s) => s.advanceDay)
  const advanceToNextMatch = useCareerStore((s) => s.advanceToNextMatch)
  const closeSeason = useCareerStore((s) => s.closeSeason)
  const simulateAllRemainingAndClose = useCareerStore((s) => s.simulateAllRemainingAndClose)
  const navigate = useCareerStore((s) => s.navigate)
  const isSimulating = useCareerStore((s) => s.isSimulating)

  if (!career) {
    return (
      <GameLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-400">No hay carrera activa.</p>
        </div>
      </GameLayout>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)
  const budget = userTeam?.budget ?? 0

  const sortedStandings = sortStandings(career.season.standings)
  const leaguePosition = sortedStandings.findIndex((r) => r.teamId === career.teamId) + 1
  const teamRow = sortedStandings.find((r) => r.teamId === career.teamId)

  const seasonStatus = career.seasonStatus

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
    if (nextMatch.isCup) { simulateCupMatch(nextMatch.match.id); navigate('match') }
    else { simulateMatch(nextMatch.match.id); navigate('match') }
  }

  function handleLiveSim() {
    if (!nextMatch) return
    if (nextMatch.isCup) { startLiveCupMatch(nextMatch.match.id); navigate('match_live') }
    else { startLiveMatch(nextMatch.match.id); navigate('match_live') }
  }

  return (
    <GameLayout>
      <main className="h-full overflow-y-auto p-4 space-y-4">

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Temporada', value: String(career.seasonNumber), color: 'text-white' },
            { label: 'Posición', value: leaguePosition > 0 ? `#${leaguePosition}` : '--', color: 'text-gold-400' },
            { label: 'Puntos', value: String(teamRow?.points ?? 0), color: 'text-white' },
            { label: 'Presupuesto', value: formatBudget(budget), color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="panel px-4 py-3">
              <p className="label-muted mb-1">{label}</p>
              <p className={`text-lg font-extrabold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Season banners */}
        {seasonStatus === 'all_finished' && <AllFinishedBanner onCloseSeason={closeSeason} />}
        {seasonStatus === 'user_finished' && (
          <UserFinishedBanner onAdvanceDay={advanceDay} onAdvanceToNextMatch={advanceToNextMatch} onSimulateAll={simulateAllRemainingAndClose} />
        )}

        {/* Main panels */}
        {(seasonStatus === 'active' || seasonStatus === 'user_finished') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seasonStatus === 'active' && (
              <DayAdvancePanel
                currentDate={career.season.currentDate}
                teamId={career.teamId}
                matches={career.season.matches}
                onAdvanceDay={advanceDay}
                onAdvanceToNextMatch={advanceToNextMatch}
                hasNextMatch={!!nextMatch}
              />
            )}

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
              <div className="panel p-6 flex flex-col items-center justify-center gap-2 text-center">
                <Icon name="sports_soccer" size="lg" className="text-gray-600" />
                <p className="text-gray-500 text-sm">No hay partidos pendientes</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Objectives */}
        <ObjectivesPanel />
      </main>
    </GameLayout>
  )
}
