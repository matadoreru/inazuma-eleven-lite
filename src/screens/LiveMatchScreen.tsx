import { useEffect, useRef, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TeamBadgeImage from '../components/TeamBadgeImage'
import Icon from '../components/Icon'
import PositionSprite from '../components/PositionSprite'
import type { MatchEvent } from '../types/competition'
import type { Team } from '../types/team'
import type { Player, Position } from '../types/player'
import { playerDisplayName } from '../types/player'
import { useNameStyle } from '../hooks/useNameStyle'

type Speed = 1 | 2 | 4
type SubReason = 'halftime' | 'injury' | 'tactical'

const SPEED_INTERVAL: Record<Speed, number> = { 1: 600, 2: 200, 4: 50 }
const MATCH_DURATION = 90
const MAX_SUBS = 3

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

// ─── Substitution panel ───────────────────────────────────────────────────────

function SubstitutionPanel({
  reason,
  injuredPlayerId,
  swapsUsed,
  matchExclusions,
  userTeam,
  players,
  userGoals,
  oppGoals,
  currentMinute,
  onSwap,
  onClose,
}: {
  reason: SubReason
  injuredPlayerId?: number
  swapsUsed: number
  matchExclusions: Set<number>
  userTeam: Team
  players: Player[]
  userGoals: number
  oppGoals: number
  currentMinute: number
  onSwap: (starterId: number, benchId: number) => void
  onClose: () => void
}) {
  const nameStyle = useNameStyle()
  const [selectedStarterId, setSelectedStarterId] = useState<number | null>(injuredPlayerId ?? null)

  const starters = userTeam.lineup.filter((s) => s.isStarter && !matchExclusions.has(s.playerId))
  const bench = userTeam.lineup.filter((s) => !s.isStarter && !matchExclusions.has(s.playerId))

  const byPos: Record<Position, typeof starters> = { GK: [], DF: [], MD: [], FW: [] }
  for (const s of starters) byPos[s.assignedPosition as Position]?.push(s)

  const canMakeSub = swapsUsed < MAX_SUBS

  function handleSwap(benchId: number) {
    if (!selectedStarterId || !canMakeSub) return
    onSwap(selectedStarterId, benchId)
    setSelectedStarterId(null)
  }

  const isHalftime = reason === 'halftime'
  const isInjury = reason === 'injury'

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-gray-900 border-b border-gray-700 px-4 py-3">
        {/* Reason banner */}
        {isInjury && (
          <div className="flex items-center justify-center gap-2 mb-2 py-1.5 bg-orange-900/30 border border-orange-700/40 rounded-lg">
            <span className="material-icons text-orange-400 leading-none" style={{ fontSize: '16px' }}>healing</span>
            <span className="text-orange-300 text-xs font-bold">Lesión — realiza un cambio</span>
          </div>
        )}
        {!isHalftime && !isInjury && (
          <div className="flex items-center justify-center gap-2 mb-2 py-1.5 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <span className="material-icons text-blue-400 leading-none" style={{ fontSize: '16px' }}>swap_horiz</span>
            <span className="text-blue-300 text-xs font-bold">Cambio táctico — {currentMinute}&apos;</span>
          </div>
        )}

        {/* Score */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">
              {selectedStarterId ? 'Selecciona un reserva para cambiar' : 'Selecciona un titular para sustituir'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xl font-black tabular-nums">{userGoals} – {oppGoals}</span>
            <span className={`text-xs font-bold tabular-nums ${!canMakeSub ? 'text-red-400' : 'text-gray-400'}`}>
              {swapsUsed} / {MAX_SUBS} cambios
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Starters */}
        <div>
          <p className="text-gray-500 text-[0.5rem] font-black uppercase tracking-widest mb-2">Titulares en campo</p>
          {(['GK', 'DF', 'MD', 'FW'] as Position[]).map((pos) => {
            const slots = byPos[pos]
            if (slots.length === 0) return null
            return (
              <div key={pos} className="mb-2">
                <p className="text-gray-600 text-[0.45rem] font-black uppercase tracking-widest mb-1">{POS_LABEL[pos]}</p>
                {slots.map((slot) => {
                  const player = players.find((p) => p.id === slot.playerId)
                  if (!player) return null
                  const isSelected = selectedStarterId === player.id
                  const isInjuredTrigger = isInjury && injuredPlayerId === player.id
                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedStarterId(isSelected ? null : player.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 transition-all text-left
                        ${isSelected
                          ? 'bg-blue-600/30 border border-blue-500/70'
                          : isInjuredTrigger
                          ? 'bg-orange-900/25 border border-orange-700/50 hover:border-orange-600'
                          : 'bg-gray-800/60 border border-gray-700/50 hover:border-gray-600'}`}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0">
                        <img
                          src={player.spriteUrl}
                          alt={playerDisplayName(player, nameStyle)}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                      <span className="text-white text-sm font-medium flex-1 truncate">{playerDisplayName(player, nameStyle)}</span>
                      <PositionSprite position={player.position} size={14} />
                      {isInjuredTrigger && (
                        <span className="material-icons text-orange-400 leading-none shrink-0" style={{ fontSize: '14px' }}>healing</span>
                      )}
                      {isSelected && <Icon name="swap_horiz" size="xs" className="text-blue-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div>
            <p className="text-gray-500 text-[0.5rem] font-black uppercase tracking-widest mb-2">Reservas disponibles</p>
            {bench.map((slot) => {
              const player = players.find((p) => p.id === slot.playerId)
              if (!player) return null
              const isPreInjured = player.isInjured
              const available = selectedStarterId !== null && canMakeSub && !isPreInjured
              return (
                <button
                  key={player.id}
                  onClick={() => available && handleSwap(player.id)}
                  disabled={!available}
                  title={isPreInjured ? `${playerDisplayName(player, nameStyle)} está lesionado (${player.injuryDaysRemaining}d)` : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1 transition-all
                    ${isPreInjured
                      ? 'bg-orange-950/20 border border-orange-900/30 opacity-50 cursor-not-allowed'
                      : available
                      ? 'bg-green-900/25 border border-green-700/50 hover:border-green-500/80 cursor-pointer'
                      : 'bg-gray-800/30 border border-gray-700/30 opacity-45 cursor-default'}`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 shrink-0">
                    <img
                      src={player.spriteUrl}
                      alt={playerDisplayName(player, nameStyle)}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <span className={`text-sm font-medium flex-1 truncate ${isPreInjured ? 'text-orange-400/70' : 'text-white'}`}>
                    {playerDisplayName(player, nameStyle)}
                  </span>
                  <PositionSprite position={player.position} size={14} />
                  {isPreInjured && (
                    <span className="material-icons text-orange-500 leading-none shrink-0" style={{ fontSize: '13px' }}>healing</span>
                  )}
                  {available && !isPreInjured && (
                    <Icon name="arrow_upward" size="xs" className="text-green-400 shrink-0" />
                  )}
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
          {isHalftime ? 'Continuar 2ª parte' : 'Volver al partido'}
        </button>
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LiveMatchScreen() {
  const career           = useCareerStore((s) => s.career)
  const teams            = useCareerStore((s) => s.teams)
  const players          = useCareerStore((s) => s.players)
  const pendingMatch     = useCareerStore((s) => s.pendingMatch)
  const commitLiveMatch  = useCareerStore((s) => s.commitLiveMatch)
  const swapLineupPlayers = useCareerStore((s) => s.swapLineupPlayers)
  const navigate         = useCareerStore((s) => s.navigate)

  const [currentMinute, setCurrentMinute] = useState(0)
  const [isPlaying, setIsPlaying]         = useState(true)
  const [speed, setSpeed]                 = useState<Speed>(1)
  const [halftimeDone, setHalftimeDone]   = useState(false)

  // Substitution state (lifted from panel)
  const [subPanelOpen, setSubPanelOpen]     = useState(false)
  const [subReason, setSubReason]           = useState<SubReason>('halftime')
  const [injuredForSub, setInjuredForSub]   = useState<number | undefined>(undefined)
  const [swapsUsed, setSwapsUsed]           = useState(0)
  const [matchExclusions, setMatchExclusions] = useState<Set<number>>(new Set())

  const handledInjuries = useRef<Set<string>>(new Set())
  const eventListRef    = useRef<HTMLDivElement>(null)

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
      setSubReason('halftime')
      setInjuredForSub(undefined)
      setSubPanelOpen(true)
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

  // Injury event detection for user team
  useEffect(() => {
    if (!career) return
    for (const e of processedEvents) {
      if (e.type !== 'INJURY' || e.teamId !== career.teamId || e.playerId === undefined) continue
      const key = `${e.minute}-${e.playerId}`
      if (handledInjuries.current.has(key)) continue
      handledInjuries.current.add(key)
      setIsPlaying(false)
      setSubReason('injury')
      setInjuredForSub(e.playerId)
      setSubPanelOpen(true)
      break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedEvents.length])

  // Red card: auto-exclude the expelled player
  useEffect(() => {
    if (!career) return
    const newExclusions = new Set(matchExclusions)
    let changed = false
    for (const e of processedEvents) {
      if (e.type === 'RED' && e.teamId === career.teamId && e.playerId !== undefined) {
        if (!newExclusions.has(e.playerId)) {
          newExclusions.add(e.playerId)
          changed = true
        }
      }
    }
    if (changed) setMatchExclusions(newExclusions)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSubPanelOpen(false)
  }

  function handleFinish() {
    commitLiveMatch()
    navigate('match')
  }

  function handleOpenTactical() {
    setIsPlaying(false)
    setSubReason('tactical')
    setInjuredForSub(undefined)
    setSubPanelOpen(true)
  }

  function handleSwap(starterId: number, benchId: number) {
    swapLineupPlayers(starterId, benchId)
    setSwapsUsed((n) => n + 1)
    setMatchExclusions((prev) => new Set([...prev, starterId]))
  }

  function handleClosePanel() {
    setSubPanelOpen(false)
    if (subReason !== 'halftime' || !isFinished) setIsPlaying(true)
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
                <span className="text-gray-500 text-[0.5625rem] font-black uppercase tracking-widest px-1">{event.text}</span>
                <div className="flex-1 h-px bg-gray-700/50" />
              </div>
            )
          }

          return (
            <div
              key={`${event.minute}-${event.type}-${i}`}
              className="flex items-center gap-2.5 py-1.5 animate-in fade-in duration-300"
            >
              <span className="text-gray-600 text-[0.5625rem] w-6 shrink-0 tabular-nums text-right">{event.minute}&apos;</span>

              {event.playerSpriteUrl ? (
                <div className={`w-7 h-7 rounded-full overflow-hidden bg-gray-800 shrink-0 ring-1 ${
                  event.type === 'GOAL' ? 'ring-yellow-500/60' :
                  event.type === 'RED'  ? 'ring-red-500/60' : 'ring-gray-700'
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

            {/* Tactical sub button */}
            <button
              onClick={handleOpenTactical}
              disabled={swapsUsed >= MAX_SUBS}
              title={swapsUsed >= MAX_SUBS ? 'No quedan cambios' : `Realizar cambio (${swapsUsed}/${MAX_SUBS})`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                swapsUsed >= MAX_SUBS
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <Icon name="swap_horiz" size="sm" />
              <span className="tabular-nums">{swapsUsed}/{MAX_SUBS}</span>
            </button>

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

      {/* Substitution overlay */}
      {subPanelOpen && userTeam && (
        <SubstitutionPanel
          reason={subReason}
          injuredPlayerId={injuredForSub}
          swapsUsed={swapsUsed}
          matchExclusions={matchExclusions}
          userTeam={userTeam}
          players={players}
          userGoals={userGoals}
          oppGoals={oppGoals}
          currentMinute={currentMinute}
          onSwap={handleSwap}
          onClose={handleClosePanel}
        />
      )}
    </div>
  )
}
