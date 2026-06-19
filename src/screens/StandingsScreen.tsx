import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
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
          <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-900 border-b border-gold-600/30 sticky top-0 z-10">
            <span className="material-icons text-yellow-500" style={{ fontSize: 16 }}>emoji_events</span>
            <h3 className="text-gray-200 text-xs font-bold uppercase tracking-wider">{round.name}</h3>
            {round.finished && (
              <span className="text-[0.55rem] font-bold px-1.5 py-px rounded bg-green-900/60 text-green-400 uppercase">Terminada</span>
            )}
          </div>
          <div className="divide-y divide-gold-600/15">
            {round.matches.map((match) => {
              const home = teams.find((t) => t.id === match.homeTeamId)
              const away = teams.find((t) => t.id === match.awayTeamId)
              const isUserHome = match.homeTeamId === userTeamId
              const isUserAway = match.awayTeamId === userTeamId
              const isUser = isUserHome || isUserAway
              const dateStr = match.date ? match.date.slice(5).replace('-', '/') : null
              return (
                <div
                  key={match.id}
                  className={`flex items-center gap-2 px-4 py-3 text-sm ${isUser ? 'bg-blue-900/25 border-l-2 border-l-blue-500/60' : 'bg-dark-800/60 hover:bg-dark-700/50 transition-colors'}`}
                >
                  {dateStr && (
                    <span className="text-gray-600 text-[0.5rem] tabular-nums shrink-0 w-10 font-pixel">{dateStr}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    {match.homeTeamId === -1
                      ? <span className="text-gray-600">—</span>
                      : <TeamNameInline
                          teamName={home?.name ?? `Equipo ${match.homeTeamId}`}
                          badgeUrl={home?.badgeUrl}
                          textClassName={isUserHome ? 'text-gold-300 font-semibold' : 'text-gray-200'}
                        />
                    }
                  </div>
                  <div className="shrink-0 min-w-[44px] text-center">
                    {match.played ? (
                      <span className={`font-black tabular-nums ${isUser ? 'text-white text-base' : 'text-gray-200'}`}>{match.homeGoals}–{match.awayGoals}</span>
                    ) : (
                      <span className="text-gray-600 text-xs font-black">VS</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {match.awayTeamId === -1
                      ? <span className="text-gray-600 block text-right">—</span>
                      : <TeamNameInline
                          teamName={away?.name ?? `Equipo ${match.awayTeamId}`}
                          badgeUrl={away?.badgeUrl}
                          align="right"
                          textClassName={isUserAway ? 'text-gold-300 font-semibold' : 'text-gray-200'}
                        />
                    }
                  </div>
                </div>
              )
            })}
            {round.matches.length === 0 && (
              <div className="px-4 py-4 text-gray-600 text-xs bg-dark-800/60">Pendiente de sorteo</div>
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
      <div className="h-full flex items-center justify-center bg-dark-900/80">
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
    <GameLayout>
      <main className="h-full flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gold-600/30 px-2 gap-0 shrink-0 overflow-x-auto bg-dark-900/80">
            {leagues.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveTab(l.id)}
                className={`px-4 py-2.5 text-[0.45rem] font-pixel uppercase tracking-wide whitespace-nowrap transition-colors border-b-2 -mb-px
                  ${activeTab === l.id
                    ? 'text-gold-400 border-gold-500'
                    : 'text-gray-500 border-transparent hover:text-gold-400 hover:border-gold-600/50'}`}
              >
                {l.name}
                {l.id === career.season.leagueId && (
                  <span className="ml-1.5 text-[0.4rem] text-gold-500">★</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('cup')}
              className={`px-4 py-2.5 text-[0.45rem] font-pixel uppercase tracking-wide whitespace-nowrap transition-colors border-b-2 -mb-px
                ${activeTab === 'cup'
                  ? 'text-gold-400 border-gold-500'
                  : 'text-gray-500 border-transparent hover:text-gold-400 hover:border-gold-600/50'}`}
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
                {activeStandings.length === 0 ? (
                  <div className="panel py-8 text-center text-gray-500 text-sm">
                    Sin datos de clasificación disponibles
                  </div>
                ) : (
                  <div className="panel overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 bg-dark-900/60 px-3 py-2 text-gold-600 text-[0.45rem] font-pixel uppercase tracking-widest border-b border-gold-600/30">
                      <span className="w-8 text-center">#</span>
                      <span className="px-2">Equipo</span>
                      <span className="w-8 text-center">P</span>
                      <span className="w-8 text-center">V</span>
                      <span className="w-8 text-center">E</span>
                      <span className="w-8 text-center">D</span>
                      <span className="w-10 text-center">GF</span>
                      <span className="w-10 text-center">GC</span>
                      <span className="w-10 text-center">DG</span>
                      <span className="w-10 text-center text-gold-400">Pts</span>
                    </div>

                    {/* Zone legend */}
                    {(activeLeague?.promotionSlots ?? 0) > 0 && (
                      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gold-600/20 bg-dark-900/40 text-[0.45rem] text-gray-500 font-pixel">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-green-500/70 shrink-0" />
                          Ascenso
                        </span>
                        {(activeLeague?.relegationSlots ?? 0) > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm bg-red-500/70 shrink-0" />
                            Descenso
                          </span>
                        )}
                      </div>
                    )}
                    {(activeLeague?.promotionSlots ?? 0) === 0 && (activeLeague?.relegationSlots ?? 0) > 0 && (
                      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-gold-600/20 bg-dark-900/40 text-[0.45rem] text-gray-500 font-pixel">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm bg-red-500/70 shrink-0" />
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
                          className={`grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 px-3 py-2.5 border-t border-gold-600/10 text-sm items-center border-l-2
                            ${isUserTeam ? 'bg-gold-600/10 border-l-gold-500' : `${zoneBg} ${zoneBorder || 'border-l-transparent'} hover:bg-dark-700/40 transition-colors`}`}
                        >
                          <span className={`w-8 text-center font-bold ${isUserTeam ? 'text-gold-400' : 'text-gray-500'}`}>
                            {idx + 1}
                          </span>
                          <div className="px-2 min-w-0">
                            <TeamNameInline
                              teamName={row.teamName}
                              badgeUrl={team?.badgeUrl}
                              textClassName={`${isUserTeam ? 'text-gold-300' : 'text-white'}`}
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
                          <span className={`w-10 text-center font-bold text-lg ${isUserTeam ? 'text-gold-400' : 'text-white'}`}>
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
    </GameLayout>
  )
}
