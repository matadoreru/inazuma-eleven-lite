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
import MatchEventText from '../components/MatchEventText'

type Speed = 1 | 2 | 4
type SubReason = 'halftime' | 'injury' | 'tactical'

const SPEED_INTERVAL: Record<Speed, number> = { 1: 600, 2: 200, 4: 50 }
const MAX_SUBS = 3

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  GOAL:             'sports_soccer',
  SAVE:             'back_hand',
  MISS:             'close',
  CORNER:           'flag',
  YELLOW:           'square',
  RED:              'square',
  INJURY:           'healing',
  PHASE:            'flag',
  ET_START:         'more_time',
  ET_END:           'sports_score',
  PENALTY_SHOOTOUT: 'sports',
  STOPPAGE:         'add',
  TECHNIQUE:        'auto_awesome',
}

const EVENT_COLOR: Record<MatchEvent['type'], string> = {
  GOAL:             'text-yellow-400',
  SAVE:             'text-gold-500',
  MISS:             'text-gray-500',
  CORNER:           'text-cyan-400',
  YELLOW:           'text-yellow-400',
  RED:              'text-red-400',
  INJURY:           'text-orange-400',
  PHASE:            'text-gray-500',
  ET_START:         'text-yellow-400',
  ET_END:           'text-yellow-400',
  PENALTY_SHOOTOUT: 'text-orange-400',
  STOPPAGE:         'text-gray-400',
  TECHNIQUE:        'text-purple-400',
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
  const selectedStarterSlot = starters.find((slot) => slot.playerId === selectedStarterId)
  const selectedStarter = selectedStarterId ? players.find((player) => player.id === selectedStarterId) : null

  function handleSwap(benchId: number) {
    if (!selectedStarterId || !canMakeSub) return
    onSwap(selectedStarterId, benchId)
    setSelectedStarterId(null)
  }

  const isHalftime = reason === 'halftime'
  const isInjury = reason === 'injury'

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl h-[min(46rem,84vh)] overflow-hidden rounded-2xl border-2 border-gold-600/45 bg-[#0b0d12] shadow-2xl shadow-black flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-[#141821] border-b border-gold-600/35 px-5 py-4">
        {/* Reason banner */}
        {isInjury && (
          <div className="flex items-center justify-center gap-2 mb-3 py-2 bg-orange-950 border border-orange-600/60 rounded-lg">
            <span className="material-icons text-orange-400 leading-none" style={{ fontSize: '16px' }}>healing</span>
            <span className="text-orange-300 text-xs font-bold">Lesión — realiza un cambio</span>
          </div>
        )}
        {!isHalftime && !isInjury && (
          <div className="flex items-center justify-center gap-2 mb-3 py-2 bg-blue-950 border border-blue-600/50 rounded-lg">
            <span className="material-icons text-gold-500 leading-none" style={{ fontSize: '16px' }}>swap_horiz</span>
            <span className="text-gold-400 text-xs font-bold">Cambio táctico — {currentMinute}&apos;</span>
          </div>
        )}

        {/* Score */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">
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
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#0b0d12] overflow-y-auto md:overflow-hidden">
        {/* Starters */}
        <div className="min-h-[15rem] md:min-h-0 md:overflow-y-auto rounded-xl border border-red-500/25 bg-[#10141c] p-3">
          <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-3 rounded-lg bg-[#1a1115] px-3 py-2 border border-red-500/25">
            <span className="w-7 h-7 rounded-full bg-red-500 text-white font-black flex items-center justify-center">1</span>
            <div>
              <p className="text-red-200 text-sm font-black uppercase tracking-wide">Jugador que sale</p>
              <p className="text-gray-400 text-xs">Selecciona un titular</p>
            </div>
          </div>
          {(['GK', 'DF', 'MD', 'FW'] as Position[]).map((pos) => {
            const slots = byPos[pos]
            if (slots.length === 0) return null
            return (
              <div key={pos} className="mb-2">
                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1">{POS_LABEL[pos]}</p>
                {slots.map((slot) => {
                  const player = players.find((p) => p.id === slot.playerId)
                  if (!player) return null
                  const isSelected = selectedStarterId === player.id
                  const isInjuredTrigger = isInjury && injuredPlayerId === player.id
                  return (
                    <button
                      key={player.id}
                      onClick={() => setSelectedStarterId(isSelected ? null : player.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 transition-all text-left
                        ${isSelected
                          ? 'bg-blue-950 border-2 border-blue-400 shadow-lg shadow-blue-950'
                          : isInjuredTrigger
                          ? 'bg-orange-950 border border-orange-600 hover:border-orange-400'
                          : 'bg-[#1a1f2a] border border-gray-700 hover:border-gold-500'}`}
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-800 shrink-0 ring-1 ring-gray-600">
                        <img
                          src={player.spriteUrl}
                          alt={playerDisplayName(player, nameStyle)}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>
                      <span className="text-white text-sm font-bold flex-1 truncate">{playerDisplayName(player, nameStyle)}</span>
                      <PositionSprite position={player.position} size={14} />
                      {isInjuredTrigger && (
                        <span className="material-icons text-orange-400 leading-none shrink-0" style={{ fontSize: '14px' }}>healing</span>
                      )}
                      {isSelected && <Icon name="swap_horiz" size="xs" className="text-gold-500 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div className="min-h-[15rem] md:min-h-0 md:overflow-y-auto rounded-xl border border-green-500/25 bg-[#10141c] p-3">
            <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-3 rounded-lg bg-[#101a14] px-3 py-2 border border-green-500/25">
              <span className="w-7 h-7 rounded-full bg-green-500 text-green-950 font-black flex items-center justify-center">2</span>
              <div>
                <p className="text-green-200 text-sm font-black uppercase tracking-wide">Jugador que entra</p>
                <p className="text-gray-400 text-xs">
                  {selectedStarter
                    ? `Sustituto para ${playerDisplayName(selectedStarter, nameStyle)}`
                    : 'Primero elige quién sale'}
                </p>
              </div>
            </div>
            {bench.map((slot) => {
              const player = players.find((p) => p.id === slot.playerId)
              if (!player) return null
              const isPreInjured = player.isInjured
              const available = selectedStarterId !== null && canMakeSub && !isPreInjured
              const targetPosition = selectedStarterSlot?.assignedPosition as Position | undefined
              const fitsTarget = targetPosition
                ? player.position === targetPosition || player.positionAlt === targetPosition
                : false
              return (
                <button
                  key={player.id}
                  onClick={() => available && handleSwap(player.id)}
                  disabled={!available}
                  title={isPreInjured ? `${playerDisplayName(player, nameStyle)} está lesionado (${player.injuryDaysRemaining}d)` : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 transition-all text-left
                    ${isPreInjured
                      ? 'bg-orange-950 border border-orange-800 opacity-55 cursor-not-allowed'
                      : available
                      ? 'bg-[#18231c] border border-green-700 hover:border-green-400 hover:bg-green-950 cursor-pointer'
                      : 'bg-[#171b24] border border-gray-700 opacity-45 cursor-default'}`}
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-800 shrink-0 ring-1 ring-gray-600">
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
                  {available && targetPosition && (
                    <span className={`rounded-md border px-1.5 py-0.5 text-[0.65rem] font-black ${
                      fitsTarget
                        ? 'border-green-500/50 bg-green-950 text-green-300'
                        : 'border-amber-500/50 bg-amber-950 text-amber-300'
                    }`}>
                      → {POS_LABEL[targetPosition]}
                    </span>
                  )}
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
      <div className="shrink-0 p-4 border-t border-gold-600/25 bg-[#141821] flex items-center gap-3">
        <p className="hidden sm:block flex-1 text-xs text-gray-400">
          {canMakeSub ? `Te quedan ${MAX_SUBS - swapsUsed} cambios` : 'Has agotado todos los cambios'}
        </p>
        <button
          onClick={onClose}
          className="w-full sm:w-auto sm:min-w-64 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-base transition-colors"
        >
          <Icon name="play_arrow" size="sm" />
          {isHalftime ? 'Continuar 2ª parte' : 'Volver al partido'}
        </button>
      </div>
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
  const [extraTimeDone, setExtraTimeDone]       = useState(false)
  const [penaltyPhaseDone, setPenaltyPhaseDone] = useState(false)
  const [phaseOverlay, setPhaseOverlay]         = useState<{
    title: string; subtitle: string; buttonText: string
  } | null>(null)

  const handledInjuries = useRef<Set<string>>(new Set())
  const eventListRef    = useRef<HTMLDivElement>(null)

  const result        = pendingMatch?.result
  const events        = result?.events ?? []
  const isCupMatch    = pendingMatch?.isCupMatch ?? false
  const matchEndMinute = isCupMatch && result?.penalties ? 122
    : isCupMatch && result?.extraTime ? 121
    : 90
  const isFinished = currentMinute >= matchEndMinute

  // Tick
  useEffect(() => {
    if (!isPlaying || isFinished) return
    const id = setInterval(() => {
      setCurrentMinute((m) => (m >= matchEndMinute ? m : m + 1))
    }, SPEED_INTERVAL[speed])
    return () => clearInterval(id)
  }, [isPlaying, speed, isFinished, matchEndMinute])

  // Halftime detection — pause once when crossing minute 45
  useEffect(() => {
    if (currentMinute >= 45 && currentMinute < matchEndMinute && !halftimeDone) {
      setIsPlaying(false)
      setHalftimeDone(true)
      setSubReason('halftime')
      setInjuredForSub(undefined)
      setSubPanelOpen(true)
    }
  }, [currentMinute, halftimeDone, matchEndMinute])

  // Extra-time phase overlay
  useEffect(() => {
    if (!isCupMatch || !result?.extraTime) return
    if (currentMinute >= 90 && !extraTimeDone) {
      setIsPlaying(false)
      setExtraTimeDone(true)
      setPhaseOverlay({
        title: '¡Se va a prórroga!',
        subtitle: 'El partido está empatado. Se jugarán dos tiempos de 15 minutos.',
        buttonText: 'Continuar — Prórroga',
      })
    }
  }, [currentMinute, extraTimeDone, isCupMatch, result?.extraTime])

  // Penalty-phase overlay
  useEffect(() => {
    if (!isCupMatch || !result?.penalties) return
    if (currentMinute >= 120 && !penaltyPhaseDone) {
      setIsPlaying(false)
      setPenaltyPhaseDone(true)
      setPhaseOverlay({
        title: '¡Tanda de penaltis!',
        subtitle: 'El partido sigue empatado. Se decide desde el punto de penalty.',
        buttonText: 'Ver penaltis',
      })
    }
  }, [currentMinute, penaltyPhaseDone, isCupMatch, result?.penalties])

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
      <div className="h-full flex items-center justify-center bg-game">
        <p className="text-gray-400">Sin partido en curso.</p>
      </div>
    )
  }

  const allMatchesForLookup = [
    ...career.season.matches,
    ...(career.cup?.rounds.flatMap((r) => r.matches) ?? []),
  ]
  const match    = allMatchesForLookup.find((m) => m.id === pendingMatch.matchId)
  const homeTeam = match ? teams.find((t) => t.id === match.homeTeamId) : null
  const awayTeam = match ? teams.find((t) => t.id === match.awayTeamId) : null
  const userTeam = teams.find((t) => t.id === career.teamId)
  const isHome   = match?.homeTeamId === career.teamId

  const homeGoals = processedEvents.filter((e) => e.type === 'GOAL' && e.isHome).length
  const awayGoals = processedEvents.filter((e) => e.type === 'GOAL' && !e.isHome).length
  const userGoals = isHome ? homeGoals : awayGoals
  const oppGoals  = isHome ? awayGoals : homeGoals

  function handleSkip() {
    setCurrentMinute(matchEndMinute)
    setIsPlaying(false)
    setHalftimeDone(true)
    setExtraTimeDone(true)
    setPenaltyPhaseDone(true)
    setPhaseOverlay(null)
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
    <div className="h-full flex flex-col bg-game overflow-hidden relative">
      <div className="absolute inset-0 bg-dark-900/80 pointer-events-none" />
      <div className="relative flex flex-col h-full overflow-hidden">
      {/* Scoreboard */}
      <div className="bg-dark-900/90 border-b border-gold-600/30 px-5 py-5 shrink-0">
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={homeTeam?.name ?? 'Local'} badgeUrl={homeTeam?.badgeUrl} size="header" />
            <p className="text-white text-base font-bold text-center leading-tight">{homeTeam?.name ?? 'Local'}</p>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-white text-5xl font-extrabold tabular-nums">{homeGoals}</span>
              <span className="text-gray-500 text-3xl">-</span>
              <span className="text-white text-5xl font-extrabold tabular-nums">{awayGoals}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-300 text-sm">
              {isFinished ? (
                <>
                  <Icon name="sports_score" size="xs" className="text-gray-400" />
                  <span>Final</span>
                </>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-dark-500/80'}`} />
                  <span className="tabular-nums">{currentMinute}&apos;</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamBadgeImage teamName={awayTeam?.name ?? 'Visitante'} badgeUrl={awayTeam?.badgeUrl} size="header" />
            <p className="text-white text-base font-bold text-center leading-tight">{awayTeam?.name ?? 'Visitante'}</p>
          </div>
        </div>
      </div>

      {/* Event log */}
      <div ref={eventListRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
        {processedEvents.map((event, i) => {
          const isPhase = event.type === 'PHASE'
          const color   = EVENT_COLOR[event.type]
          const icon    = EVENT_ICON[event.type]
          const participants = event.participants?.length
            ? event.participants
            : event.playerSpriteUrl && event.playerId != null
              ? [{ playerId: event.playerId, playerName: event.playerName ?? '', playerSpriteUrl: event.playerSpriteUrl, isHome: event.isHome }]
              : []

          if (isPhase) {
            return (
              <div key={`${event.minute}-${i}`} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gold-600/20" />
                <span className="text-gray-300 text-sm font-black uppercase tracking-widest px-1">{event.text}</span>
                <div className="flex-1 h-px bg-gold-600/20" />
              </div>
            )
          }

          return (
            <div
              key={`${event.minute}-${event.type}-${i}`}
              className="flex items-center gap-4 py-4 border-b border-gold-600/15 animate-in fade-in duration-300"
            >
              <span className="text-gray-300 text-sm w-8 shrink-0 tabular-nums text-right">{event.minute}&apos;</span>

              {participants.length > 0 ? (
                <div className="flex items-center gap-2 shrink-0 px-1">
                  {participants.map((participant) => (
                    <div key={participant.playerId} className={`relative w-[72px] h-[72px] rounded-full bg-dark-800 shrink-0 ring-2 ring-dark-900 ${
                      event.type === 'GOAL' ? 'ring-yellow-500/60' :
                      event.type === 'RED' ? 'ring-red-500/60' : ''
                    }`} title={participant.playerName}>
                      <img
                        src={participant.playerSpriteUrl}
                        alt={participant.playerName}
                        className="w-full h-full object-cover rounded-full"
                        draggable={false}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className="absolute -left-1.5 -bottom-1.5 w-9 h-9 rounded-full bg-dark-900 ring-2 ring-gold-600/50 flex items-center justify-center">
                        <TeamBadgeImage
                          teamName={participant.isHome ? (homeTeam?.name ?? 'Local') : (awayTeam?.name ?? 'Visitante')}
                          badgeUrl={participant.isHome ? homeTeam?.badgeUrl : awayTeam?.badgeUrl}
                          size="overlay"
                        />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                null
              )}

              {participants.length === 0 && event.type === 'CORNER' && (
                <span className="w-16 h-16 rounded-full bg-dark-900/90 ring-2 ring-gold-600/40 flex items-center justify-center shrink-0">
                  <TeamBadgeImage
                    teamName={event.isHome ? (homeTeam?.name ?? 'Local') : (awayTeam?.name ?? 'Visitante')}
                    badgeUrl={event.isHome ? homeTeam?.badgeUrl : awayTeam?.badgeUrl}
                    size="event"
                  />
                </span>
              )}

              <span className="w-11 h-11 rounded-xl bg-dark-800/90 border border-gold-600/20 flex items-center justify-center shrink-0" title={event.type}>
                <span className={`material-icons ${color} leading-none`} style={{ fontSize: 28 }}>{icon}</span>
              </span>

              <span className={`flex-1 text-base leading-relaxed font-semibold ${
                event.type === 'GOAL'      ? 'text-yellow-300 font-bold' :
                event.type === 'RED'       ? 'text-red-300' :
                event.type === 'YELLOW'    ? 'text-yellow-200/80' :
                event.type === 'INJURY'    ? 'text-orange-300/80' :
                event.type === 'TECHNIQUE' ? 'text-purple-300' :
                'text-gray-100'
              }`}>
                <MatchEventText event={event} />
              </span>

            </div>
          )
        })}

        {isFinished && processedEvents.length > 0 && (
          <div className="pt-4 pb-2 flex justify-center">
            <span className="text-gray-400 text-sm uppercase tracking-widest border-t border-gold-600/15 pt-3 px-4">
              Partido finalizado
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-dark-800/80 border-t border-gold-600/20 px-4 py-3 shrink-0">
        {!isFinished ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-dark-700/80 hover:bg-dark-600/80 text-white transition-colors"
            >
              <Icon name={isPlaying ? 'pause' : 'play_arrow'} size="sm" />
            </button>

            <div className="flex gap-1">
              {([1, 2, 4] as Speed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-4 py-3 rounded-xl text-base font-bold transition-colors ${
                    speed === s ? 'bg-gold-600/25 text-gold-300 border border-gold-500/60' : 'bg-dark-700/80 text-gray-300 hover:bg-dark-600/80 border border-gold-600/15'
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
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                swapsUsed >= MAX_SUBS
                  ? 'bg-dark-800/50 text-gray-600 cursor-not-allowed'
                  : 'bg-dark-700/80 hover:bg-dark-600/80 text-gray-300'
              }`}
            >
              <Icon name="swap_horiz" size="sm" />
              <span className="tabular-nums">{swapsUsed}/{MAX_SUBS}</span>
            </button>

            <button
              onClick={handleSkip}
              className="ml-auto flex items-center gap-2 px-5 py-3 bg-dark-700/80 hover:bg-dark-600/80 text-gray-200 rounded-xl text-base font-medium border border-gold-600/20 transition-colors"
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

      {/* Phase-break overlay for ET and penalty transitions in cup matches */}
      {phaseOverlay && (
        <div className="fixed inset-0 z-[100] bg-dark-950/95 flex flex-col items-center justify-center gap-6 px-6">
          <span className="material-icons text-yellow-400 leading-none" style={{ fontSize: 64 }}>
            more_time
          </span>
          <h2 className="text-white text-2xl font-black text-center">{phaseOverlay.title}</h2>
          <p className="text-gray-400 text-sm text-center">{phaseOverlay.subtitle}</p>
          <button
            onClick={() => { setPhaseOverlay(null); setIsPlaying(true) }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-base transition-colors"
          >
            <Icon name="play_arrow" size="sm" />
            {phaseOverlay.buttonText}
          </button>
        </div>
      )}

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
    </div>
  )
}
