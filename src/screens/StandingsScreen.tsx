import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TeamNameInline from '../components/TeamNameInline'
import { sortStandings } from '../services/standingsService'
import { leagues } from '../data/leagues'
import type { League } from '../types/competition'
import type { Cup } from '../types/season'
import type { Team } from '../types/team'

type PositionZone = 'promotion' | 'relegation' | null

function getPositionZone(pos: number, league: League | undefined): PositionZone {
  if (!league) return null
  if (league.promotionSlots > 0 && pos <= league.promotionSlots) return 'promotion'
  if (league.relegationSlots > 0 && pos > league.teamsCount - league.relegationSlots) return 'relegation'
  return null
}

function CupBracket({ cup, teams, userTeamId }: { cup: Cup | null; teams: Team[]; userTeamId: number }) {
  if (!cup) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">
        Copa no disponible esta temporada
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {cup.rounds.map((round) => (
        <div key={round.name}>
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-700 sticky top-0">
            <span className="material-icons text-yellow-500" style={{ fontSize: 16 }}>emoji_events</span>
            <h3 className="text-gray-300 text-xs font-bold uppercase tracking-wider">{round.name}</h3>
            {round.finished && (
              <span className="text-[0.55rem] font-bold px-1.5 py-px rounded bg-green-900/40 text-green-400 uppercase">Terminada</span>
            )}
          </div>
          <div className="divide-y divide-gray-700/40">
            {round.matches.map((match) => {
              const home = teams.find((t) => t.id === match.homeTeamId)
              const away = teams.find((t) => t.id === match.awayTeamId)
              const isUserHome = match.homeTeamId === userTeamId
              const isUserAway = match.awayTeamId === userTeamId
              const isUser = isUserHome || isUserAway
              return (
                <div
                  key={match.id}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm ${isUser ? 'bg-blue-900/20' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    {match.homeTeamId === -1
                      ? <span className="text-gray-500">—</span>
                      : <TeamNameInline
                          teamName={home?.name ?? `Equipo ${match.homeTeamId}`}
                          badgeUrl={home?.badgeUrl}
                          textClassName={isUserHome ? 'text-blue-200 font-semibold' : 'text-white'}
                        />
                    }
                  </div>
                  <div className="shrink-0 min-w-[44px] text-center">
                    {match.played ? (
                      <span className="text-white font-black tabular-nums">{match.homeGoals}–{match.awayGoals}</span>
                    ) : (
                      <span className="text-gray-600 text-xs font-bold">VS</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {match.awayTeamId === -1
                      ? <span className="text-gray-500 block text-right">—</span>
                      : <TeamNameInline
                          teamName={away?.name ?? `Equipo ${match.awayTeamId}`}
                          badgeUrl={away?.badgeUrl}
                          align="right"
                          textClassName={isUserAway ? 'text-blue-200 font-semibold' : 'text-white'}
                        />
                    }
                  </div>
                </div>
              )
            })}
            {round.matches.length === 0 && (
              <div className="px-4 py-3 text-gray-600 text-xs">Pendiente de sorteo</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StandingsScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<string>(career?.season.leagueId ?? '')

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const activeStandings = activeTab === career.season.leagueId
    ? career.season.standings
    : career.allLeagueSeasons[activeTab]?.standings ?? []
  const sorted = sortStandings(activeStandings)
  const activeLeague = leagues.find((l) => l.id === activeTab)

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Clasificación" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700 px-2 gap-0 shrink-0 overflow-x-auto bg-gray-900">
            {leagues.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveTab(l.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                  ${activeTab === l.id
                    ? 'text-white border-blue-500'
                    : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'}`}
              >
                {l.name}
                {l.id === career.season.leagueId && (
                  <span className="ml-1.5 text-[0.5rem] font-black text-blue-400 uppercase tracking-wide">Tu liga</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('cup')}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                ${activeTab === 'cup'
                  ? 'text-white border-yellow-500'
                  : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'}`}
            >
              Copa
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'cup' ? (
              <CupBracket cup={career.cup ?? null} teams={teams} userTeamId={career.teamId} />
            ) : (
              <div className="p-4">
                <h1 className="text-white text-xl font-bold mb-4">
                  {leagues.find((l) => l.id === activeTab)?.name ?? activeTab} — Temporada {career.season.year}
                </h1>

                {activeStandings.length === 0 ? (
                  <div className="bg-gray-800 rounded-xl border border-gray-700 py-8 text-center text-gray-500 text-sm">
                    Sin datos de clasificación disponibles
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                    {/* Header */}
                    <div className="grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 bg-gray-900 px-3 py-2 text-gray-400 text-xs font-semibold uppercase tracking-wide">
                      <span className="w-8 text-center">#</span>
                      <span className="px-2">Equipo</span>
                      <span className="w-8 text-center">P</span>
                      <span className="w-8 text-center">V</span>
                      <span className="w-8 text-center">E</span>
                      <span className="w-8 text-center">D</span>
                      <span className="w-10 text-center">GF</span>
                      <span className="w-10 text-center">GC</span>
                      <span className="w-10 text-center">DG</span>
                      <span className="w-10 text-center font-bold text-white">Pts</span>
                    </div>

                    {/* Zone legend */}
                    {(activeLeague?.promotionSlots ?? 0) > 0 && (
                      <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-700 bg-gray-900/60 text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-green-500/70 shrink-0" />
                          Ascenso
                        </span>
                        {(activeLeague?.relegationSlots ?? 0) > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70 shrink-0" />
                            Descenso
                          </span>
                        )}
                      </div>
                    )}
                    {(activeLeague?.promotionSlots ?? 0) === 0 && (activeLeague?.relegationSlots ?? 0) > 0 && (
                      <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-700 bg-gray-900/60 text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70 shrink-0" />
                          Descenso
                        </span>
                      </div>
                    )}

                    {/* Rows */}
                    {sorted.map((row, idx) => {
                      const isUserTeam = row.teamId === career.teamId
                      const team = teams.find((t) => t.id === row.teamId)
                      const zone = getPositionZone(idx + 1, activeLeague)
                      const zoneBorder = zone === 'promotion' ? 'border-l-green-500' : zone === 'relegation' ? 'border-l-red-500' : ''
                      const zoneBg = zone === 'promotion' ? 'bg-green-900/10' : zone === 'relegation' ? 'bg-red-900/10' : ''
                      return (
                        <div
                          key={row.teamId}
                          className={`grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 px-3 py-2.5 border-t border-gray-700 text-sm items-center border-l-2
                            ${isUserTeam ? 'bg-blue-900/40 border-l-blue-500' : `${zoneBg} ${zoneBorder || 'border-l-transparent'} hover:bg-gray-700/50 transition-colors`}`}
                        >
                          <span className={`w-8 text-center font-bold ${isUserTeam ? 'text-blue-300' : 'text-gray-400'}`}>
                            {idx + 1}
                          </span>
                          <div className="px-2 min-w-0">
                            <TeamNameInline
                              teamName={row.teamName}
                              badgeUrl={team?.badgeUrl}
                              textClassName={`${isUserTeam ? 'text-blue-200' : 'text-white'}`}
                            />
                          </div>
                          <span className="w-8 text-center text-gray-300">{row.played}</span>
                          <span className="w-8 text-center text-green-400">{row.won}</span>
                          <span className="w-8 text-center text-yellow-400">{row.drawn}</span>
                          <span className="w-8 text-center text-red-400">{row.lost}</span>
                          <span className="w-10 text-center text-gray-300">{row.goalsFor}</span>
                          <span className="w-10 text-center text-gray-300">{row.goalsAgainst}</span>
                          <span className={`w-10 text-center ${row.goalDiff > 0 ? 'text-green-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                          </span>
                          <span className={`w-10 text-center font-bold text-lg ${isUserTeam ? 'text-blue-300' : 'text-white'}`}>
                            {row.points}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
