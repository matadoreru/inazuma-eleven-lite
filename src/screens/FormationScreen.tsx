import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { useCareerStore } from '../store/careerStore'
import GameLayout from '../components/GameLayout'
import PositionSprite from '../components/PositionSprite'
import Icon from '../components/Icon'
import { formations, getFormationSlots } from '../data/formations'
import type { Formation, LineupSlot } from '../types/team'
import type { Player, Position } from '../types/player'
import { getPlayerStatsSummary, playerDisplayName } from '../types/player'
import { statColor } from '../components/StatBar'
import { useNameStyle } from '../hooks/useNameStyle'

// ─── Neutral visual labels ───────────────────────────────────────────────────

const ELEMENT_SHORT: Record<string, string> = {
  FIRE: 'FUE',
  WOOD: 'BOS',
  WIND: 'VIE',
  MOUNTAIN: 'MNT',
}

// ─── Slot initialisation ─────────────────────────────────────────────────────

function initSlots(formation: Formation, lineup: LineupSlot[]): (number | null)[] {
  const slots = getFormationSlots(formation)
  const result = new Array<number | null>(slots.length).fill(null)
  const byPos: Record<Position, number[]> = { GK: [], DF: [], MD: [], FW: [] }
  for (const s of lineup) {
    if (s.isStarter) byPos[s.assignedPosition as Position]?.push(s.playerId)
  }
  for (let i = 0; i < slots.length; i++) {
    const next = byPos[slots[i].position].shift()
    if (next !== undefined) result[i] = next
  }
  return result
}

// ─── Drag overlay token ───────────────────────────────────────────────────────

function PlayerOverlayToken({ player }: { player: Player }) {
  const nameStyle = useNameStyle()
  const { media } = getPlayerStatsSummary(player)
  return (
    <div className="flex flex-col items-center gap-0.5 select-none drop-shadow-2xl opacity-95">
      <div className="relative">
        <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-gold-400 bg-dark-700/60 shadow-xl">
          <img
            src={player.spriteUrl}
            alt={playerDisplayName(player, nameStyle)}
            className="w-full h-full object-cover"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 bg-dark-900/90 rounded-full flex items-center justify-center px-1 shadow border border-gold-600/40">
          <span className="text-[0.5rem] font-black leading-none tabular-nums" style={{ color: statColor(media, 250) }}>
            {media}
          </span>
        </div>
      </div>
      <span className="text-white text-[0.5rem] font-semibold rounded px-1 py-0.5 max-w-[72px] text-center leading-tight bg-dark-900/90 border border-gold-600/40 shadow">
        {playerDisplayName(player, nameStyle)}
      </span>
    </div>
  )
}

// ─── Bench player row (draggable) ─────────────────────────────────────────────

function BenchPlayerRow({
  player,
  isCaptain,
  isKeyPlayer,
  onPlayerClick,
}: {
  player: Player
  isCaptain: boolean
  isKeyPlayer: boolean
  onPlayerClick?: (playerId: number) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bench-player-${player.id}`,
    data: { playerId: player.id, isStarter: false },
  })

  const nameStyle = useNameStyle()
  const { media } = getPlayerStatsSummary(player)

  return (
    <div
      ref={setNodeRef}
      className={`relative flex items-center gap-3 pl-4 pr-3 py-3 border-b border-l-2 border-b-gold-600/15 border-l-gold-600/35 select-none
        cursor-grab active:cursor-grabbing transition-colors transition-opacity
        ${isDragging ? 'opacity-0' : 'hover:bg-dark-700/25 hover:border-l-gold-400/70'}`}
      onClick={() => onPlayerClick?.(player.id)}
      {...attributes}
      {...listeners}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <img
          src={player.spriteUrl}
          alt={playerDisplayName(player, nameStyle)}
          className="w-10 h-10 rounded-full object-cover bg-dark-700/60"
          draggable={false}
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='16' fill='%234b5563'/%3E%3C/svg%3E"
          }}
        />
        {isCaptain && (
          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-yellow-400 rounded-full flex items-center justify-center shadow">
            <span className="text-black text-[0.4375rem] font-black leading-none">C</span>
          </div>
        )}
        {isKeyPlayer && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-400 rounded-full flex items-center justify-center shadow">
            <span className="material-icons text-white select-none leading-none" style={{ fontSize: '8px' }}>star</span>
          </div>
        )}
      </div>

      {/* Name + position + neutral element label */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate leading-tight">{playerDisplayName(player, nameStyle)}</p>
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <PositionSprite position={player.position} size={16} />
          {player.element && (
            <span className="text-[0.45rem] font-bold px-1 py-px rounded leading-none border border-gold-600/25 bg-dark-900/70 text-gold-300/80">
              {ELEMENT_SHORT[player.element] ?? player.element}
            </span>
          )}
          {player.isInjured && (
            <span className="text-[0.45rem] font-bold px-1 py-px rounded leading-none bg-orange-900/40 text-orange-400 border border-orange-700/50 flex items-center gap-px">
              <span className="material-icons leading-none" style={{ fontSize: '7px' }}>healing</span>
              {player.injuryDaysRemaining}d
            </span>
          )}
        </div>
      </div>

      {/* TOT */}
      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: statColor(media, 250) }}>
        {media}
      </span>

      {/* Drag handle */}
      <Icon name="drag_indicator" size="xs" className="text-gray-600 shrink-0" />
    </div>
  )
}

// ─── Bench drop zone ──────────────────────────────────────────────────────────

function BenchDropZone({
  bench,
  players,
  captainId,
  keyPlayerId,
  onPlayerClick,
}: {
  bench: LineupSlot[]
  players: Player[]
  captainId: number
  keyPlayerId?: number
  onPlayerClick?: (playerId: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bench' })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto rounded-xl border transition-colors
        ${isOver ? 'border-gold-500/60 bg-gold-900/10' : 'border-gold-600/20 bg-dark-800/30'}`}
    >
      {bench.length === 0 ? (
        <div className="h-full flex items-center justify-center min-h-[80px]">
          <p className={`text-sm ${isOver ? 'text-gold-500' : 'text-gray-600'}`}>
            {isOver ? 'Soltar para sentar' : 'Sin reservas'}
          </p>
        </div>
      ) : (
        <>
          {bench.map((slot) => {
            const player = players.find((p) => p.id === slot.playerId)
            if (!player) return null
            return (
              <BenchPlayerRow
                key={slot.playerId}
                player={player}
                isCaptain={player.id === captainId}
                isKeyPlayer={player.id === keyPlayerId}
                onPlayerClick={onPlayerClick}
              />
            )
          })}
          {isOver && (
            <div className="py-2 text-center text-gold-500 text-xs">Soltar para sentar</div>
          )}
        </>
      )}
    </div>
  )
}


// ─── Formation pitch with palette-based player states ────────────────────────

type FormationSlotData = ReturnType<typeof getFormationSlots>[number] & {
  x?: number
  y?: number
  left?: number
  top?: number
}

function normalisePercent(value: number) {
  const percent = value <= 1 ? value * 100 : value
  return Math.max(4, Math.min(96, percent))
}

function getSlotCoordinates(slot: FormationSlotData, slotIndex: number, slots: FormationSlotData[]) {
  const rawX = typeof slot.x === 'number' ? slot.x : slot.left
  const rawY = typeof slot.y === 'number' ? slot.y : slot.top

  if (typeof rawX === 'number' && typeof rawY === 'number') {
    return { x: normalisePercent(rawX), y: normalisePercent(rawY) }
  }

  const rowIndexes = slots
    .map((candidate, index) => (candidate.position === slot.position ? index : -1))
    .filter((index) => index >= 0)
  const rowIndex = Math.max(0, rowIndexes.indexOf(slotIndex))
  const rowCount = Math.max(1, rowIndexes.length)

  const yByPosition: Record<Position, number> = {
    GK: 88,
    DF: 70,
    MD: 50,
    FW: 28,
  }

  const x = rowCount === 1 ? 50 : 18 + (rowIndex * 64) / (rowCount - 1)
  return { x, y: yByPosition[slot.position as Position] ?? 50 }
}

function playerCanPlayPosition(player: Player, position: Position) {
  const flexiblePlayer = player as Player & {
    positions?: Position[]
    secondaryPositions?: Position[]
    preferredPositions?: Position[]
  }

  return Boolean(
    player.position === position ||
    flexiblePlayer.positions?.includes(position) ||
    flexiblePlayer.secondaryPositions?.includes(position) ||
    flexiblePlayer.preferredPositions?.includes(position),
  )
}

function FieldPlayerToken({
  player,
  slotIndex,
  slotPosition,
  isCaptain,
  isKeyPlayer,
  onPlayerClick,
  onSlotContextMenu,
}: {
  player: Player
  slotIndex: number
  slotPosition: Position
  isCaptain: boolean
  isKeyPlayer: boolean
  onPlayerClick: (playerId: number) => void
  onSlotContextMenu: (playerId: number, clientX: number, clientY: number) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-player-${player.id}-${slotIndex}`,
    data: { playerId: player.id, isStarter: true, slotIndex },
  })

  const nameStyle = useNameStyle()
  const { media } = getPlayerStatsSummary(player)
  const isOutOfPosition = !playerCanPlayPosition(player, slotPosition)
  const isInjured = Boolean(player.isInjured)

  const stateClass = isOutOfPosition
    ? 'border-red-500/95 bg-red-950/70 ring-2 ring-red-500/80 shadow-xl'
    : isInjured
      ? 'border-yellow-300/95 bg-yellow-950/60 ring-2 ring-yellow-300/80 shadow-xl'
      : 'border-gold-500/70 bg-dark-900/85 ring-1 ring-gold-500/25 shadow-lg'

  const nameClass = isOutOfPosition
    ? 'border-red-400/80 bg-red-700 text-white'
    : isInjured
      ? 'border-yellow-300/80 bg-yellow-500 text-dark-950'
      : 'border-gold-600/45 bg-dark-950/90 text-white'

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`group relative flex flex-col items-center gap-1 select-none transition-all duration-150
        ${isDragging ? 'opacity-0' : 'hover:scale-[1.015] active:scale-[0.985]'}`}
      onClick={(event) => {
        event.stopPropagation()
        onPlayerClick(player.id)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onSlotContextMenu(player.id, event.clientX, event.clientY)
      }}
      {...attributes}
      {...listeners}
    >
      {isOutOfPosition && (
        <div className="absolute -top-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border border-red-300/80 bg-red-600 px-1.5 py-0.5 text-[0.48rem] font-black uppercase tracking-wide text-white shadow-lg">
          <Icon name="warning" size="xs" className="text-white" />
          <span>Fuera pos.</span>
        </div>
      )}

      <div className={`relative h-[4.25rem] w-[4.25rem] rounded-xl border p-1.5 ${stateClass}`}>
        <img
          src={player.spriteUrl}
          alt={playerDisplayName(player, nameStyle)}
          className="h-full w-full rounded-lg object-cover bg-dark-700/60"
          draggable={false}
          onError={(event) => {
            ;(event.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='12' fill='%234b5563'/%3E%3C/svg%3E"
          }}
        />

        <div className="absolute -right-5 -top-1.5 min-w-[1.35rem] rounded-full border border-gold-600/50 bg-gold-600/95 px-1 py-0.5 text-center shadow">
            {media}
        </div>

        {isCaptain && (
          <div className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 shadow">
            <span className="text-[0.55rem] font-black leading-none text-black">C</span>
          </div>
        )}

        {isKeyPlayer && (
          <div className="absolute -left-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 shadow">
            <span className="material-icons select-none leading-none text-white" style={{ fontSize: '10px' }}>star</span>
          </div>
        )}

        {isInjured && (
          <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 rounded-md border border-yellow-300/80 bg-yellow-500 px-1 py-0.5 text-[0.48rem] font-black leading-none text-dark-950 shadow-lg">
            <span className="material-icons leading-none" style={{ fontSize: '9px' }}>healing</span>
            {player.injuryDaysRemaining ?? 0}d
          </div>
        )}
      </div>

      <div className={`max-w-[5.75rem] rounded border px-1.5 py-0.5 text-center text-[0.52rem] font-bold leading-tight shadow ${nameClass}`}>
        <span className="line-clamp-2">{playerDisplayName(player, nameStyle)}</span>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-gold-600/25 bg-dark-950/80 px-1.5 py-0.5">
        <PositionSprite position={player.position} size={50} />
        <span className="text-[0.65rem] font-black text-gold-300">{slotPosition}</span>
      </div>
    </button>
  )
}

function FormationSlot({
  slot,
  slotIndex,
  player,
  captainId,
  keyPlayerId,
  onPlayerClick,
  onSlotContextMenu,
}: {
  slot: FormationSlotData
  slotIndex: number
  player?: Player
  captainId: number
  keyPlayerId?: number
  onPlayerClick: (playerId: number) => void
  onSlotContextMenu: (playerId: number, clientX: number, clientY: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIndex}` })

  return (
    <div
      ref={setNodeRef}
      className="absolute z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
    >
      {player ? (
        <FieldPlayerToken
          player={player}
          slotIndex={slotIndex}
          slotPosition={slot.position as Position}
          isCaptain={player.id === captainId}
          isKeyPlayer={player.id === keyPlayerId}
          onPlayerClick={onPlayerClick}
          onSlotContextMenu={onSlotContextMenu}
        />
      ) : (
        <div
          className={`flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors
            ${isOver ? 'border-gold-400 bg-gold-900/25' : 'border-gold-600/25 bg-dark-900/35'}`}
        >
          <PositionSprite position={slot.position as Position} size={18} />
          <span className="mt-1 text-[0.5rem] font-black text-gold-300">{slot.position}</span>
        </div>
      )}
    </div>
  )
}

function FormationPitchBoard({
  formation,
  slotAssignment,
  players,
  captainId,
  keyPlayerId,
  onSlotContextMenu,
  onPlayerClick,
}: {
  formation: Formation
  slotAssignment: (number | null)[]
  players: Player[]
  captainId: number
  keyPlayerId?: number
  onSlotContextMenu: (playerId: number, clientX: number, clientY: number) => void
  onPlayerClick: (playerId: number) => void
}) {
  const slots = getFormationSlots(formation) as FormationSlotData[]

  return (
    <div className="relative h-full min-h-[31rem] max-w-full aspect-[5/6] rounded-2xl border border-gold-600/35 bg-emerald-950/70 shadow-2xl overflow-hidden">
      <div className="absolute inset-3 rounded-2xl border border-emerald-300/15" />
      <div className="absolute left-3 right-3 top-1/2 h-px bg-emerald-300/15" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/15" />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/20" />
      <div className="absolute left-1/2 top-3 h-11 w-28 -translate-x-1/2 rounded-b-lg border border-t-0 border-emerald-300/15" />
      <div className="absolute bottom-3 left-1/2 h-11 w-28 -translate-x-1/2 rounded-t-lg border border-b-0 border-emerald-300/15" />

      {slots.map((slot, index) => {
        const playerId = slotAssignment[index]
        const player = playerId !== null ? players.find((candidate) => candidate.id === playerId) : undefined
        const { x, y } = getSlotCoordinates(slot, index, slots)

        return (
          <div key={`${slot.position}-${index}`} style={{ left: `${x}%`, top: `${y}%` }} className="absolute">
            <FormationSlot
              slot={slot}
              slotIndex={index}
              player={player}
              captainId={captainId}
              keyPlayerId={keyPlayerId}
              onPlayerClick={onPlayerClick}
              onSlotContextMenu={onSlotContextMenu}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number
  y: number
  playerId: number
}

export default function FormationScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const navigate = useCareerStore((s) => s.navigate)
  const selectPlayer = useCareerStore((s) => s.selectPlayer)
  const applyFormationAction = useCareerStore((s) => s.applyFormation)
  const updateStartersAction = useCareerStore((s) => s.updateStarters)
  const setCaptainAction = useCareerStore((s) => s.setCaptain)
  const setKeyPlayerAction = useCareerStore((s) => s.setKeyPlayer)

  const userTeam = teams.find((t) => t.id === career?.teamId)
  const currentFormation = userTeam?.formation
  const lineup = userTeam?.lineup ?? []

  const [slotAssignment, setSlotAssignment] = useState<(number | null)[]>(() =>
    currentFormation ? initSlots(currentFormation, lineup) : [],
  )
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const starterKey = lineup.filter((s) => s.isStarter).map((s) => `${s.playerId}:${s.assignedPosition}`).join(',')

  useEffect(() => {
    if (currentFormation) setSlotAssignment(initSlots(currentFormation, lineup))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormation?.id, starterKey])

  useEffect(() => {
    if (!contextMenu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextMenu])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const bench = lineup.filter((s) => !s.isStarter)
  const activePlayer = activePlayerId !== null ? players.find((p) => p.id === activePlayerId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActivePlayerId(active.data.current?.playerId ?? null)
    setContextMenu(null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActivePlayerId(null)
    if (!over || !currentFormation) return

    const draggedPlayerId = active.data.current?.playerId as number
    const isFromField = active.data.current?.isStarter as boolean
    const fromSlotIndex = active.data.current?.slotIndex as number | undefined
    const overId = String(over.id)

    if (overId === 'bench') {
      if (isFromField && fromSlotIndex !== undefined) {
        const next = [...slotAssignment]
        next[fromSlotIndex] = null
        setSlotAssignment(next)
        updateStartersAction(next, currentFormation)
      }
      return
    }

    if (overId.startsWith('slot-')) {
      const targetIdx = parseInt(overId.replace('slot-', ''), 10)
      if (isNaN(targetIdx)) return

      const occupant = slotAssignment[targetIdx] ?? null
      const next = [...slotAssignment]

      if (isFromField && fromSlotIndex !== undefined) {
        if (fromSlotIndex === targetIdx) return
        next[fromSlotIndex] = occupant
        next[targetIdx] = draggedPlayerId
      } else {
        next[targetIdx] = draggedPlayerId
      }

      setSlotAssignment(next)
      updateStartersAction(next, currentFormation)
    }
  }

  function handlePlayerClick(playerId: number) {
    selectPlayer(playerId)
    navigate('player_detail')
  }

  function handleSlotContextMenu(playerId: number, clientX: number, clientY: number) {
    const MENU_W = 200
    const MENU_H = 90
    const safeX = clientX + MENU_W > window.innerWidth ? clientX - MENU_W : clientX
    const safeY = clientY + MENU_H > window.innerHeight ? clientY - MENU_H : clientY
    setContextMenu({ x: safeX, y: safeY, playerId })
  }

  if (!career) {
    return (
      <GameLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-400">No hay carrera activa.</p>
        </div>
      </GameLayout>
    )
  }

  const formationDropdownValue = formations.find((f) => f.id === currentFormation?.id)?.id ?? ''
  const startersCount = slotAssignment.filter((id) => id !== null).length
  const isCtxCaptain = contextMenu !== null && contextMenu.playerId === userTeam?.captainId
  const isCtxKeyPlayer = contextMenu !== null && contextMenu.playerId === userTeam?.keyPlayerId

  return (
    <GameLayout>
      <div className="h-full flex overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-hidden p-4 min-h-0">
              <div className="h-full min-h-0">
                <div className="h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_26rem] gap-4 overflow-hidden min-h-0">
                  <div className="panel overflow-hidden min-h-0 flex flex-col">
                    <div className="p-4 flex-1 min-h-0 bg-dark-950/20 overflow-hidden">
                      <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[15.5rem_minmax(0,1fr)] gap-4">
                        <aside className="min-h-0 rounded-xl border border-gold-600/20 bg-dark-900/35 p-3 overflow-y-auto">
                          <div className="flex items-center gap-2 mb-3">
                            <Icon name="dashboard" size="xs" className="text-gold-400" />
                            <p className="text-gold-300 text-[0.65rem] font-bold uppercase tracking-wide">Formación</p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-gray-500 text-[0.625rem] uppercase tracking-wide mb-1.5">Sistema</label>
                              <select
                                value={formationDropdownValue}
                                onChange={(e) => applyFormationAction(parseInt(e.target.value, 10))}
                                className="w-full bg-dark-800/80 border border-gold-600/30 rounded-lg text-sm px-3 py-2 text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                              >
                                {!formationDropdownValue && (
                                  <option value="" disabled>Seleccionar...</option>
                                )}
                                {formations.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name} · {f.DF}-{f.MD}-{f.FW}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="rounded-lg border border-gold-600/20 bg-dark-950/35 px-3 py-2">
                              <p className="text-gray-500 text-[0.625rem] uppercase tracking-wide mb-1">Titulares</p>
                              <div className="flex items-end gap-1.5 tabular-nums">
                                <span
                                  className="text-2xl font-black leading-none"
                                  style={{ color: startersCount === slotAssignment.length ? '#4ade80' : '#f59e0b' }}
                                >
                                  {startersCount}
                                </span>
                                <span className="text-gray-500 text-xs mb-0.5">/ {slotAssignment.length}</span>
                              </div>
                            </div>

                            <div className="rounded-lg border border-gold-600/20 bg-dark-950/35 px-3 py-2">
                              <p className="text-gray-500 text-[0.625rem] uppercase tracking-wide mb-1">Estado</p>
                              <p className="text-sm font-semibold" style={{ color: startersCount === slotAssignment.length ? '#4ade80' : '#f59e0b' }}>
                                {startersCount === slotAssignment.length ? 'Once completo' : `${slotAssignment.length - startersCount} huecos`}
                              </p>
                            </div>
                          </div>
                        </aside>

                        <div className="min-h-0 rounded-xl border border-gold-600/20 bg-dark-950/25 overflow-hidden flex items-center justify-center px-4 py-3">
                          {currentFormation ? (
                            <div className="formation-pitch-palette h-full min-h-0 flex items-center justify-center">
                              <FormationPitchBoard
                                formation={currentFormation}
                                slotAssignment={slotAssignment}
                                players={players}
                                captainId={userTeam?.captainId ?? 0}
                                keyPlayerId={userTeam?.keyPlayerId}
                                onSlotContextMenu={handleSlotContextMenu}
                                onPlayerClick={handlePlayerClick}
                              />
                            </div>
                          ) : (
                            <div className="h-full w-full flex items-center justify-center rounded-xl border border-dashed border-gold-600/25 bg-dark-900/20 text-gray-500 text-sm">
                              Selecciona una formación para empezar
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel overflow-hidden min-h-0 flex flex-col">
                    <div className="panel-header flex items-center justify-between gap-3 border-b border-gold-600/20">
                      <div className="flex items-center gap-2">
                        <Icon name="groups" size="xs" className="text-gold-400" />
                        <span>Reservas</span>
                      </div>
                    </div>
                    <div className="p-3 flex-1 min-h-0">
                      <BenchDropZone
                        bench={bench}
                        players={players}
                        captainId={userTeam?.captainId ?? 0}
                        keyPlayerId={userTeam?.keyPlayerId}
                        onPlayerClick={handlePlayerClick}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
            {activePlayer ? <PlayerOverlayToken player={activePlayer} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
            className="z-50 bg-dark-900/95 border border-gold-600/40 rounded-xl shadow-2xl py-1 min-w-[190px] overflow-hidden"
          >
            <button
              onClick={() => { setCaptainAction(contextMenu.playerId); setContextMenu(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors
                ${isCtxCaptain ? 'text-gold-400 bg-gold-900/10' : 'text-white hover:bg-dark-700/40'}`}
            >
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
                <span className="text-black text-[0.5625rem] font-black leading-none">C</span>
              </div>
              {isCtxCaptain ? 'Capitán (actual)' : 'Hacer capitán'}
            </button>

            <div className="h-px bg-gold-600/20 mx-2" />

            <button
              onClick={() => {
                setKeyPlayerAction(isCtxKeyPlayer ? null : contextMenu.playerId)
                setContextMenu(null)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors
                ${isCtxKeyPlayer ? 'text-gold-500 bg-gold-900/10' : 'text-white hover:bg-dark-700/40'}`}
            >
              <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center shrink-0">
                <span className="material-icons text-white select-none leading-none" style={{ fontSize: '9px' }}>star</span>
              </div>
              {isCtxKeyPlayer ? 'Quitar jugador clave' : 'Hacer jugador clave'}
            </button>
          </div>
        </>
      )}
    </GameLayout>
  )
}
