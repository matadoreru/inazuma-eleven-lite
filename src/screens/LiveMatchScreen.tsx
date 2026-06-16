import { useEffect, useRef, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TeamBadgeImage from '../components/TeamBadgeImage'
import Icon from '../components/Icon'
import PositionSprite from '../components/PositionSprite'
import type { MatchEvent } from '../types/competition'
import type { Team } from '../types/team'
import type { Player, Position } from '../types/player'

type Speed = 1 | 2 | 4

const SPEED_INTERVAL: Record<Speed, number> = {
  1: 600,
  2: 200,
  4: 50,
}

const MATCH_DURATION = 90

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  GOAL:   'sports_soccer',
  SAVE:   'back_hand',
  MISS:   'close',
  YELLOW: 'square',
  RED:    'square',
  INJURY: 'healing',
  PHASE:  'flag',
}

const EVENT_COLOR: Record<MatchEvent['type'], string> = {
  GOAL:   'text-yellow-400',
  SAVE:   'text-blue-400',
  MISS:   'text-gray-500',
  YELLOW: 'text-yellow-400',
  RED:    'text-red-400',
  INJURY: 'text-orange-400',
  PHASE:  'text-gray-500',
}

const POS_LABEL: Record<Position, string> = { GK: 'PR', DF: 'DF', MD: 'MD', FW: 'DL' }

// ─── Halftime substitution panel ─────────────────────────────────────────────

function HalftimePanel({
  userTeam,
  players,
  userGoals,
  oppGoals,
  onSwap,
  onClose,
}: {
  userTeam: Team
  players: Player[]
  userGoals: number
  oppGoals: number
  onSwap: (starterId: number, benchId: number) => void
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [swapsUsed, setSwapsUsed] = useState(0)
  const MAX_SUBS = 3

  const starters = userTeam.lineup.filter((s) => s.isStarter)
  const bench = userTeam.lineup.filter((s) => !s.isStarter)

  const byPos: Record<Position, typeof starters> = { GK: [], DF: [], MD: [], FW: [] }
  for (const s of starters) {
    byPos[s.assignedPosition as Position]?.push(s)
  }

  function handleSwap(benchId: number) {
    if (!selectedId || swapsUsed >= MAX_SUBS) return
    onSwap(selectedId, benchId)
    setSwapsUsed((n) => n + 1)
    setSelectedId(null)
  }

  return (
    <div className="absolute inset-0 z-50 bg-gray-950/98 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-amber-400 text-[0.6rem] font-black uppercase tracking-widest">⏸ Descanso</span>
          <span className="text-white text-2xl font-black tabular-nums">{userGoals} – {oppGoals}</span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs">
            {selectedId ? 'Selecciona un reserva para cambiar' : 'Selecciona un titular para sustituir'}
          </p>
          <span className={`text-xs font-bold tabular-nums ${swapsUsed >= MAX_SUBS ? 'text-red-400' : 'text-gray-400'}`}>
            {swapsUsed} / {MAX_SUBS} cambios
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Starters by position */}
        {(['GK', 'DF', 'MD', 'FW'] as Position[]).map((pos) => {
          const slots = byPos[pos]
          if (slots.length === 0) return null
          return (
            <div key={pos}>
              <p className="text-gray-600 text-[0.5rem] font-black uppercase tracking-widest mb-1.5">
                {POS_LABEL[pos]}
              </p>
              {slots.map((slot) => {
                const player = players.find((p) => p.id === slot.playerId)
                if (!player) return null
                const isSelected = selectedId === player.id
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelectedId(isSelected ? null : player.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 transition-all
                      ${isSelected
                        ? 'bg-blue-600/30 border border-blue-500/70'
                        : 'bg-gray-800/60 border border-gray-700/50 hover:border-gray-600'}`}
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0">
                      <img
                        src={player.spriteUrl}
                        alt={player.nameRomaji}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <span className="text-white text-sm font-medium flex-1 text-left truncate">{player.nameRomaji}</span>
                    <PositionSprite position={player.position} size={14} />
                    {isSelected && <Icon name="swap_horiz" size="xs" className="text-blue-400 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )
        })}

        {/* Bench */}
        {bench.length > 0 && (
          <div>
            <p className="text-gray-600 text-[0.5rem] font-black uppercase tracking-widest mb-1.5">Reservas</p>
            {bench.map((slot) => {
              const player = players.find((p) => p.id === slot.playerId)
              if (!player) return null
              const canSwap = selectedId !== null && swapsUsed < MAX_SUBS
              return (
                <button
                  key={player.id}
                  onClick={() => handleSwap(player.id)}
                  disabled={!canSwap}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 transition-all
                    ${canSwap
                      ? 'bg-green-900/25 border border-green-700/50 hover:border-green-500/80 cursor-pointer'
                      : 'bg-gray-800/30 border border-gray-700/30 opacity-45 cursor-default'}`}
                >
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0">
                    <img
                      src={player.spriteUrl}
                      alt={player.nameRomaji}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <span className="text-white text-sm font-medium flex-1 text-left truncate">{player.nameRomaji}</span>
                  <PositionSprite position={player.position} size={14} />
                  {canSwap && <Icon name="arrow_upward" size="xs" className="text-green-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-4 border-t border-gray-700/60 bg-gray-900">
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-base transition-colors"
        >
          <Icon name="play_arrow" size="sm" />
          Continuar 2ª parte
        </button>
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LiveMatchScreen() {
  const career       = useCareerStore((s) => s.career)
  const teams        = useCareerStore((s) => s.teams)
  const players      = useCareerStore((s) => s.players)
  const pendingMatch = useCareerStore((s) => s.pendingMatch)
  const commitLiveMatch    = useCareerStore((s) => s.commitLiveMatch)
  const swapLineupPlayers  = useCareerStore((s) => s.swapLineupPlayers)
  const navigate     = useCareerStore((s) => s.navigate)

  const [currentMinute, setCurrentMinute]     = useState(0)
  const [isPlaying, setIsPlaying]             = useState(true)
  const [speed, setSpeed]                     = useState<Speed>(1)
  const [halftimeDone, setHalftimeDone]       = useState(false)
  const [halftimeOpen, setHalftimeOpen]       = useState(false)
  const eventListRef = useRef<HTMLDivElement>(null)

  const result   = pendingMatch?.result
  const events   = result?.events ?? []
  const isFinished = currentMinute >= MATCH_DURATION

  // Tick
  useEffect(() => {
    if (!isPlaying || isFinished) return
    const id = setInterval(() => {
      setCurrentMinute((m) => (m >= MATCH_DURATION ? m : m + 1))
    }, SPEED_INTERVAL[speed])
    return () => clearInterval(id)
  }, [isPlaying, speed, isFinished])

  // Halftime detection — pause once when crossing minute 45
  useEffect(() => {
    if (currentMinute >= 45 && currentMinute < MATCH_DURATION && !halftimeDone) {
      setIsPlaying(false)
      setHalftimeDone(true)
      setHalftimeOpen(true)
    }
  }, [currentMinute, halftimeDone])

  // Auto-scroll
  const processedEvents = events.filter((e) => e.minute <= currentMinute)
  const prevCount = useRef(0)
  useEffect(() => {
    if (processedEvents.length > prevCount.current && eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight
    }
    prevCount.current = processedEvents.length
  }, [processedEvents.length])

  if (!career || !pendingMatch || !result) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">Sin partido en curso.</p>
      </div>
    )
  }

  const match    = career.season.matches.find((m) => m.id === pendingMatch.matchId)
  const homeTeam = match ? teams.find((t) => t.id === match.homeTeamId) : null
  const awayTeam = match ? teams.find((t) => t.id === match.awayTeamId) : null
  const userTeam = teams.find((t) => t.id === career.teamId)
  const isHome   = match?.homeTeamId === career.teamId

  const homeGoals = processedEvents.filter((e) => e.type === 'GOAL' && e.isHome).length
  const awayGoals = processedEvents.filter((e) => e.type === 'GOAL' && !e.isHome).length
  const userGoals = isHome ? homeGoals : awayGoals
  const oppGoals  = isHome ? awayGoals : homeGoals

  function handleSkip() {
    setCurrentMinute(MATCH_DURATION)
    setIsPlaying(false)
    setHalftimeDone(true)
    setHalftimeOpen(false)
  }

  function handleFinish() {
    commitLiveMatch()
    navigate('match')
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden relative">
      {/* Scoreboard */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-4 shrink-0">
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={homeTeam?.name ?? 'Local'} badgeUrl={homeTeam?.badgeUrl} size="md" />
            <p className="text-white text-sm font-bold text-center leading-tight">{homeTeam?.name ?? 'Local'}</p>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-white text-4xl font-extrabold tabular-nums">{homeGoals}</span>
              <span className="text-gray-500 text-2xl">-</span>
              <span className="text-white text-4xl font-extrabold tabular-nums">{awayGoals}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              {isFinished ? (
                <>
                  <Icon name="sports_score" size="xs" className="text-gray-400" />
                  <span>Final</span>
                </>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="tabular-nums">{currentMinute}&apos;</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={awayTeam?.name ?? 'Visitante'} badgeUrl={awayTeam?.badgeUrl} size="md" />
            <p className="text-white text-sm font-bold text-center leading-tight">{awayTeam?.name ?? 'Visitante'}</p>
          </div>
        </div>
      </div>

      {/* Event log */}
      <div ref={eventListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
        {processedEvents.map((event, i) => {
          const isPhase = event.type === 'PHASE'
          const color   = EVENT_COLOR[event.type]
          const icon    = EVENT_ICON[event.type]

          if (isPhase) {
            return (
              <div key={`${event.minute}-${i}`} className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-gray-700/50" />
                <span className="text-gray-500 text-[0.5625rem] font-black uppercase tracking-widest px-1">
                  {event.text}
                </span>
                <div className="flex-1 h-px bg-gray-700/50" />
              </div>
            )
          }

          return (
            <div
              key={`${event.minute}-${event.type}-${i}`}
              className="flex items-center gap-2.5 py-1.5 animate-in fade-in duration-300"
            >
              <span className="text-gray-600 text-[0.5625rem] w-6 shrink-0 tabular-nums text-right">
                {event.minute}&apos;
              </span>

              {event.playerSpriteUrl ? (
                <div className={`w-7 h-7 rounded-full overflow-hidden bg-gray-800 shrink-0 ring-1 ${
                  event.type === 'GOAL' ? 'ring-yellow-500/60' :
                  event.type === 'RED'  ? 'ring-red-500/60' :
                  'ring-gray-700'
                }`}>
                  <img
                    src={event.playerSpriteUrl}
                    alt={event.playerName}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ) : (
                <span className={`material-icons ${color} shrink-0 leading-none`} style={{ fontSize: 16 }}>{icon}</span>
              )}

              <span className={`flex-1 text-[0.6875rem] leading-snug font-medium ${
                event.type === 'GOAL'   ? 'text-yellow-300 font-bold' :
                event.type === 'RED'    ? 'text-red-300' :
                event.type === 'YELLOW' ? 'text-yellow-200/80' :
                event.type === 'INJURY' ? 'text-orange-300/80' :
                'text-gray-300'
              }`}>
                {event.text}
              </span>

              {event.playerSpriteUrl && (
                <span className={`material-icons ${color} shrink-0 leading-none`} style={{ fontSize: 11 }}>{icon}</span>
              )}
            </div>
          )
        })}

        {isFinished && processedEvents.length > 0 && (
          <div className="pt-4 pb-2 flex justify-center">
            <span className="text-gray-500 text-[0.5625rem] uppercase tracking-widest border-t border-gray-700/60 pt-3 px-4">
              Partido finalizado
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 shrink-0">
        {!isFinished ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              <Icon name={isPlaying ? 'pause' : 'play_arrow'} size="sm" />
            </button>

            <div className="flex gap-1">
              {([1, 2, 4] as Speed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    speed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  x{s}
                </button>
              ))}
            </div>

            <button
              onClick={handleSkip}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              <Icon name="skip_next" size="sm" />
              Saltar al final
            </button>
          </div>
        ) : (
          <button
            onClick={handleFinish}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-base transition-colors"
          >
            <Icon name="check_circle" size="sm" />
            Ver resultado
          </button>
        )}
      </div>

      {/* Halftime substitution overlay */}
      {halftimeOpen && userTeam && (
        <HalftimePanel
          userTeam={userTeam}
          players={players}
          userGoals={userGoals}
          oppGoals={oppGoals}
          onSwap={(starterId, benchId) => swapLineupPlayers(starterId, benchId)}
          onClose={() => {
            setHalftimeOpen(false)
            setIsPlaying(true)
          }}
        />
      )}
    </div>
  )
}
