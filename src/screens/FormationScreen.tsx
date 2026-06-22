import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { CollisionDetection, DragStartEvent, DragEndEvent } from '@dnd-kit/core'
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
import { initFormationSlotAssignment } from '../services/formationService'

// ─── Neutral visual labels ───────────────────────────────────────────────────

const ELEMENT_SHORT: Record<string, string> = {
  FIRE: 'FUE',
  WOOD: 'BOS',
  WIND: 'VIE',
  MOUNTAIN: 'MNT',
}

// Mouse/touch drops must follow the pointer, not the centre of the (wide) bench row.
// Keyboard dragging has no pointer coordinates, so it falls back to closestCenter.
const formationCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

// ─── Drag overlay token ───────────────────────────────────────────────────────

function PlayerOverlayToken({ player }: { player: Player }) {
  const nameStyle = useNameStyle()
  const { media } = getPlayerStatsSummary(player)
  return (
    <div className="flex flex-col items-center gap-0.5 select-none drop-shadow-2xl opacity-95">
      <div className="relative">
        <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-gold-400 bg-dark-700/60 shadow-xl">
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
      className={`group relative flex items-center gap-3 pl-4 pr-3 py-3 border-b border-l-2 border-b-gold-600/15 border-l-gold-600/35 select-none
        cursor-grab active:cursor-grabbing transition-colors transition-opacity
        ${isDragging ? 'opacity-30' : 'hover:bg-dark-700/25 hover:border-l-gold-400/70'}`}
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
      <span
        aria-hidden="true"
        className="w-10 h-10 -mr-1 rounded-lg flex items-center justify-center text-gray-500 group-hover:text-gold-300 shrink-0"
      >
        <Icon name="drag_indicator" size="sm" />
      </span>
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
      className={`flex-1 overflow-y-auto rounded-xl border transition-all
        ${isOver ? 'border-gold-400 bg-gold-900/20 ring-4 ring-gold-400/50' : 'border-gold-600/20 bg-dark-800/30'}`}
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
    player.positionAlt === position ||
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

        {isInjured && (
          <div className="absolute top-1 flex items-center gap-0.5 rounded-md border border-yellow-300/80 bg-yellow-500 px-1 py-0.5 text-[0.48rem] font-black leading-none text-dark-950 shadow-lg">
            <span className="material-icons leading-none" style={{ fontSize: '9px' }}>healing</span>
            {player.injuryDaysRemaining ?? 0}dias
          </div>
        )}
      </div>

      <div className="flex items-center top-15 gap-1 rounded-full border border-gold-600/25 bg-dark-950/80 px-1.5 py-0.5">
        <PositionSprite position={player.position} size={20} />
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
  draggedPlayer,
}: {
  slot: FormationSlotData
  slotIndex: number
  player?: Player
  captainId: number
  keyPlayerId?: number
  onPlayerClick: (playerId: number) => void
  onSlotContextMenu: (playerId: number, clientX: number, clientY: number) => void
  draggedPlayer?: Player | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slotIndex}` })
  const isCompatible = draggedPlayer ? playerCanPlayPosition(draggedPlayer, slot.position as Position) : true

  return (
    <div
      ref={setNodeRef}
      className={`absolute z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl transition-all duration-150 ${
        isOver
          ? isCompatible
            ? 'bg-green-400/15 ring-4 ring-green-400/80 scale-110'
            : 'bg-amber-400/15 ring-4 ring-amber-400/80 scale-110'
          : draggedPlayer
            ? 'ring-1 ring-white/10 bg-white/[0.025]'
            : ''
      }`}
    >
      {isOver && (
        <span className={`absolute -top-5 z-30 whitespace-nowrap rounded-full px-2 py-1 text-[0.6rem] font-black uppercase shadow-xl ${
          isCompatible ? 'bg-green-500 text-green-950' : 'bg-amber-400 text-amber-950'
        }`}>
          {player ? 'Intercambiar' : 'Colocar'} · {slot.position}
        </span>
      )}
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
  draggedPlayer,
}: {
  formation: Formation
  slotAssignment: (number | null)[]
  players: Player[]
  captainId: number
  keyPlayerId?: number
  onSlotContextMenu: (playerId: number, clientX: number, clientY: number) => void
  onPlayerClick: (playerId: number) => void
  draggedPlayer?: Player | null
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
              draggedPlayer={draggedPlayer}
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
  const nameStyle = useNameStyle()
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
    currentFormation ? initFormationSlotAssignment(currentFormation, lineup) : [],
  )
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [previousAssignment, setPreviousAssignment] = useState<(number | null)[] | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const starterKey = lineup
    .filter((slot) => slot.isStarter)
    .map((slot) => `${slot.playerId}:${slot.assignedPosition}:${slot.formationSlotIndex ?? ''}`)
    .join(',')

  useEffect(() => {
    if (currentFormation) setSlotAssignment(initFormationSlotAssignment(currentFormation, lineup))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormation?.id, starterKey])

  useEffect(() => {
    if (!contextMenu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextMenu])

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const bench = lineup.filter((s) => !s.isStarter)
  const activePlayer = activePlayerId !== null ? players.find((p) => p.id === activePlayerId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActivePlayerId(active.data.current?.playerId ?? null)
    setContextMenu(null)
  }

  function commitAssignment(next: (number | null)[], message: string) {
    if (!currentFormation) return
    setPreviousAssignment(slotAssignment)
    setSlotAssignment(next)
    updateStartersAction(next, currentFormation)
    setFeedback(message)
  }

  function playerName(playerId: number | null): string {
    const player = playerId !== null ? players.find((candidate) => candidate.id === playerId) : null
    return player ? playerDisplayName(player, nameStyle) : 'Jugador'
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
        commitAssignment(next, `${playerName(draggedPlayerId)} pasa a reservas`)
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

      const targetPosition = getFormationSlots(currentFormation)[targetIdx]?.position
      const draggedPlayer = players.find((player) => player.id === draggedPlayerId)
      const positionWarning = draggedPlayer && targetPosition && !playerCanPlayPosition(draggedPlayer, targetPosition)
        ? ' · fuera de posición'
        : ''
      const message = occupant !== null
        ? `${playerName(draggedPlayerId)} intercambia puesto con ${playerName(occupant)}${positionWarning}`
        : `${playerName(draggedPlayerId)} entra como ${targetPosition}${positionWarning}`
      commitAssignment(next, message)
    }
  }

  function handleDragCancel() {
    setActivePlayerId(null)
  }

  function handleUndo() {
    if (!previousAssignment || !currentFormation) return
    const current = slotAssignment
    setSlotAssignment(previousAssignment)
    updateStartersAction(previousAssignment, currentFormation)
    setPreviousAssignment(current)
    setFeedback('Último cambio deshecho')
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
  const captain = players.find((player) => player.id === userTeam?.captainId)
  const keyPlayer = players.find((player) => player.id === userTeam?.keyPlayerId)

  return (
    <GameLayout>
      <div className="h-full flex overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={formationCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
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
                              <p className="text-gray-500 text-[0.625rem] uppercase tracking-wide mb-1">Capitán</p>
                              {captain ? (
                                <div className="flex items-center gap-2 min-w-0">
                                  <img
                                    src={captain.spriteUrl}
                                    alt={playerDisplayName(captain, nameStyle)}
                                    className="w-9 h-9 rounded-full object-cover bg-dark-700/60 shrink-0"
                                    onError={(e) => {
                                      ;(e.currentTarget as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='36' height='36' rx='18' fill='%234b5563'/%3E%3C/svg%3E"
                                    }}
                                  />
                                  <p className="text-sm font-semibold text-white truncate min-w-0">
                                    {playerDisplayName(captain, nameStyle)}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-white truncate">Sin asignar</p>
                              )}
                            </div>

                            <div className="rounded-lg border border-gold-600/20 bg-dark-950/35 px-3 py-2">
                              <p className="text-gray-500 text-[0.625rem] uppercase tracking-wide mb-1">Jugador clave</p>
                              {keyPlayer ? (
                                <div className="flex items-center gap-2 min-w-0">
                                  <img
                                    src={keyPlayer.spriteUrl}
                                    alt={playerDisplayName(keyPlayer, nameStyle)}
                                    className="w-9 h-9 rounded-full object-cover bg-dark-700/60 shrink-0"
                                    onError={(e) => {
                                      ;(e.currentTarget as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='36' height='36' rx='18' fill='%234b5563'/%3E%3C/svg%3E"
                                    }}
                                  />
                                  <p className="text-sm font-semibold text-white truncate min-w-0">
                                    {playerDisplayName(keyPlayer, nameStyle)}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-white truncate">Sin asignar</p>
                              )}
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
                                draggedPlayer={activePlayer}
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
                      <span className="text-[0.65rem] font-medium normal-case tracking-normal text-gray-500">
                        Arrastra cualquier parte de la fila
                      </span>
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

          {activePlayer && (
            <div className="fixed left-1/2 top-5 z-[90] -translate-x-1/2 rounded-xl border border-gold-400/60 bg-dark-950/95 px-4 py-2.5 shadow-2xl pointer-events-none">
              <p className="text-sm font-bold text-white text-center">
                Arrastra a un puesto para colocar o intercambiar
              </p>
              <p className="text-xs text-gray-400 text-center mt-0.5">También puedes soltarlo en Reservas</p>
            </div>
          )}
        </DndContext>
      </div>

      {feedback && (
        <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 flex items-center gap-3 rounded-xl border-2 border-yellow-400 bg-[#0b0d12] px-4 py-3 shadow-2xl shadow-black/80">
          <Icon name="check_circle" size="sm" className="text-green-400 shrink-0" />
          <span className="text-sm font-semibold text-white">{feedback}</span>
          {previousAssignment && (
            <button onClick={handleUndo} className="ml-2 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-black text-black hover:bg-yellow-300">
              Deshacer
            </button>
          )}
        </div>
      )}

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
