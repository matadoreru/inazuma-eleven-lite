import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TeamBadgeImage from '../components/TeamBadgeImage'
import ObjectivesPanel from '../components/ObjectivesPanel'
import Icon from '../components/Icon'
import { getLeagueName } from '../utils/leagueUtils'
import { computeSeasonStats, computeGlobalStats } from '../services/statsService'
import { getPlayerStatsSummary, playerDisplayName } from '../types/player'
import { statColor } from '../components/StatBar'
import { useNameStyle } from '../hooks/useNameStyle'

type Tab = 'equipo' | 'estadisticas' | 'objetivos'

function StatCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-xl leading-none">{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function ReputationBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100)
  const color =
    value >= 70 ? 'bg-yellow-400' :
    value >= 40 ? 'bg-blue-500' :
    'bg-gray-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-300 text-sm font-medium tabular-nums whitespace-nowrap">{value} / {max}</span>
    </div>
  )
}

function SeasonStatsRow({ label, s, isCurrent = false }: {
  label: string
  s: ReturnType<typeof computeSeasonStats>
  isCurrent?: boolean
}) {
  const winPct = s.matchesPlayed > 0 ? (s.wins / s.matchesPlayed) * 100 : 0
  const goalDiffPositive = s.goalDiff >= 0

  return (
    <div className="border-b border-gray-800 last:border-0 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isCurrent && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
          <span className="text-white text-sm font-bold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">{getLeagueName(s.leagueId)}</span>
          {s.finalPosition > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              s.finalPosition === 1 ? 'bg-yellow-600/30 text-yellow-400' :
              s.finalPosition <= 3 ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700 text-gray-300'
            }`}>#{s.finalPosition}</span>
          )}
        </div>
      </div>

      {/* W / D / L block */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg py-2 text-center">
          <p className="text-green-400 text-2xl font-extrabold leading-none">{s.wins}</p>
          <p className="text-green-600 text-[0.625rem] font-semibold mt-0.5">VICTORIAS</p>
        </div>
        <div className="bg-gray-700/30 border border-gray-700 rounded-lg py-2 text-center">
          <p className="text-gray-300 text-2xl font-extrabold leading-none">{s.draws}</p>
          <p className="text-gray-500 text-[0.625rem] font-semibold mt-0.5">EMPATES</p>
        </div>
        <div className="bg-red-900/20 border border-red-800/30 rounded-lg py-2 text-center">
          <p className="text-red-400 text-2xl font-extrabold leading-none">{s.losses}</p>
          <p className="text-red-600 text-[0.625rem] font-semibold mt-0.5">DERROTAS</p>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-500 text-xs">% Victorias</span>
          <span className="text-white text-xs font-semibold">{s.winRate}%</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${winPct}%` }} />
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <p className="text-gray-500 mb-0.5">PJ</p>
          <p className="text-white font-semibold text-sm">{s.matchesPlayed}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">GF / GC</p>
          <p className="text-white font-semibold text-sm">{s.goalsFor} / {s.goalsAgainst}</p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">Dif.</p>
          <p className={`font-semibold text-sm ${goalDiffPositive ? 'text-green-400' : 'text-red-400'}`}>
            {goalDiffPositive ? '+' : ''}{s.goalDiff}
          </p>
        </div>
        <div>
          <p className="text-gray-500 mb-0.5">CS</p>
          <p className="text-white font-semibold text-sm">{s.cleanSheets}</p>
        </div>
      </div>
    </div>
  )
}

export default function ClubScreen() {
  const nameStyle = useNameStyle()
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)

  const [activeTab, setActiveTab] = useState<Tab>('equipo')

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
  const reputation = userTeam?.reputation ?? 0

  const squadPlayers = players.filter((p) => p.teamId === career.teamId)

  const positionCounts = {
    POR: squadPlayers.filter((p) => p.position === 'GK').length,
    DEF: squadPlayers.filter((p) => p.position === 'DF').length,
    MED: squadPlayers.filter((p) => p.position === 'MD').length,
    DEL: squadPlayers.filter((p) => p.position === 'FW').length,
  }

  const avgTOT =
    squadPlayers.length > 0
      ? Math.round(squadPlayers.reduce((sum, p) => sum + p.stats.TOT, 0) / squadPlayers.length)
      : 0

  const bestPlayer =
    squadPlayers.length > 0
      ? squadPlayers.reduce((best, p) => (p.stats.TOT > best.stats.TOT ? p : best))
      : null

  const leagueName = getLeagueName(career.season.leagueId)
  const claimableCount = career.objectives.filter((o) => o.completed && !o.claimed && !o.failed).length

  // Stats
  const currentStats = computeSeasonStats(career.season, career.teamId, career.seasonNumber)
  const globalStats = computeGlobalStats(career.seasonHistory, currentStats)

  const formatBudget = (n: number) =>
    n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` : `€${(n / 1_000).toFixed(0)}K`

  const posLabel: Record<string, string> = { GK: 'Portero', DF: 'Defensa', MD: 'Centrocampista', FW: 'Delantero' }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'equipo', label: 'Equipo', icon: 'groups' },
    { id: 'estadisticas', label: 'Estadísticas', icon: 'bar_chart' },
    { id: 'objetivos', label: 'Objetivos', icon: 'flag' },
  ]

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Club" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />

        <main className="flex-1 overflow-y-auto">

          {/* Club header */}
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-700 px-5 py-5">
            <div className="flex items-center gap-4">
              <TeamBadgeImage
                teamName={teamName}
                badgeUrl={userTeam?.badgeUrl}
                size="xl"
                className="drop-shadow-lg"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-white text-2xl font-extrabold leading-tight">{teamName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-400 text-sm">{leagueName}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-400 text-sm">Temporada {career.seasonNumber}</span>
                </div>
                <div className="mt-3 max-w-xs">
                  <div className="flex items-center gap-1 mb-1">
                    <Icon name="star" size="xs" className="text-yellow-400" />
                    <span className="text-gray-400 text-xs">Reputación</span>
                  </div>
                  <ReputationBar value={reputation} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-400 text-sm">Presupuesto</p>
                <p className="text-green-400 font-bold text-2xl">{formatBudget(budget)}</p>
                <p className="text-gray-500 text-sm mt-2">Formación</p>
                <p className="text-white font-semibold text-base">{userTeam?.formation.name ?? '--'}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 bg-gray-900 sticky top-0 z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon name={tab.icon} size="xs" />
                {tab.label}
                {tab.id === 'objetivos' && claimableCount > 0 && (
                  <span className="bg-green-700 text-white text-[0.5625rem] font-bold px-1 py-0.5 rounded-full leading-none ml-0.5">
                    {claimableCount}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 space-y-4">

            {/* === EQUIPO === */}
            {activeTab === 'equipo' && (
              <>
                {/* Best player */}
                {bestPlayer && (
                  <div>
                    <h2 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <Icon name="emoji_events" size="xs" className="text-yellow-400" />
                      Mejor jugador
                    </h2>
                    <div className="bg-gray-800 rounded-xl border border-yellow-800/30 p-3 flex items-center gap-3">
                      {bestPlayer.spriteUrl ? (
                        <img
                          src={bestPlayer.spriteUrl}
                          alt={playerDisplayName(bestPlayer, nameStyle)}
                          className="w-14 h-14 object-contain rounded-lg bg-gray-700 shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                          <Icon name="person" size="lg" className="text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-sm mb-0.5">{posLabel[bestPlayer.position] ?? bestPlayer.position}</p>
                        <p className="text-white font-bold text-lg leading-tight">{playerDisplayName(bestPlayer, nameStyle)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-extrabold leading-none" style={{ color: statColor(getPlayerStatsSummary(bestPlayer).media, 250) }}>{getPlayerStatsSummary(bestPlayer).media}</p>
                        <p className="text-gray-500 text-xs mt-1">Media</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Squad summary */}
                <div>
                  <h2 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Icon name="groups" size="xs" />
                    Plantilla
                  </h2>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {(Object.entries(positionCounts) as [string, number][]).map(([pos, count]) => (
                      <div key={pos} className="bg-gray-800 rounded-xl p-3 border border-gray-700 text-center">
                        <p className="text-gray-400 text-xs font-semibold">{pos}</p>
                        <p className="text-white text-2xl font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-xs">Media del equipo</p>
                      <p className="font-bold text-2xl" style={{ color: statColor(avgTOT, 250) }}>{avgTOT}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">Jugadores</p>
                      <p className="text-white font-bold text-2xl">{squadPlayers.length}</p>
                    </div>
                  </div>
                </div>

                {/* Manager */}
                <div>
                  <h2 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Icon name="manage_accounts" size="xs" />
                    Entrenador
                  </h2>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-3">
                    {career.managerAvatar ? (
                      <img src={career.managerAvatar} alt="Avatar" className="w-12 h-12 rounded-full bg-gray-700" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                        <Icon name="person" size="md" className="text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold text-base">{career.managerName}</p>
                      <p className="text-gray-400 text-sm mt-0.5">Temporada {career.seasonNumber}</p>
                      <p className="text-gray-500 text-sm">Carrera desde {career.createdAt}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* === ESTADÍSTICAS === */}
            {activeTab === 'estadisticas' && (
              <>
                {/* Global stats */}
                <div>
                  <h2 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Icon name="public" size="xs" />
                    Estadísticas globales
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <StatCell label="Temporadas" value={career.seasonHistory.length + 1} />
                    <StatCell label="Partidos" value={globalStats.matchesPlayed} />
                    <StatCell label="% Victorias" value={`${globalStats.winRate}%`} />
                    <StatCell label="Portería 0" value={globalStats.cleanSheets} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <StatCell label="Victorias" value={globalStats.wins} />
                    <StatCell label="Empates" value={globalStats.draws} />
                    <StatCell label="Derrotas" value={globalStats.losses} />
                    <StatCell label="Mejor racha" value={`${globalStats.bestWinStreak}V`} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCell label="Goles a favor" value={globalStats.goalsFor} />
                    <StatCell label="Goles en contra" value={globalStats.goalsAgainst} />
                    <StatCell
                      label="Diferencia"
                      value={`${globalStats.goalDiff >= 0 ? '+' : ''}${globalStats.goalDiff}`}
                    />
                  </div>
                </div>

                {/* Current season */}
                <div>
                  <h2 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <Icon name="today" size="xs" />
                    Temporada actual
                  </h2>
                  <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <SeasonStatsRow
                      label={`Temporada ${career.seasonNumber}`}
                      s={currentStats}
                      isCurrent
                    />
                  </div>
                </div>

                {/* Season history */}
                {career.seasonHistory.length > 0 && (
                  <div>
                    <h2 className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <Icon name="history" size="xs" />
                      Historial de temporadas
                    </h2>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                      {[...career.seasonHistory].reverse().map((s) => (
                        <SeasonStatsRow
                          key={s.seasonNumber}
                          label={`Temporada ${s.seasonNumber}`}
                          s={s}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* === OBJETIVOS === */}
            {activeTab === 'objetivos' && (
              <ObjectivesPanel />
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
