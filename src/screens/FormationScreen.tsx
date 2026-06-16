import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import FormationPitch from '../components/FormationPitch'
import PositionSprite from '../components/PositionSprite'
import Icon from '../components/Icon'
import { formations, getFormationSlots } from '../data/formations'
import type { Formation, LineupSlot } from '../types/team'
import type { Player, Position, Element } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import { statColor } from '../components/StatBar'

// ─── Element accent colours for bench rows ───────────────────────────────────

const ELEMENT_STRIP: Record<Element | '', string> = {
  FIRE:     '#dc2626',
  WOOD:     '#16a34a',
  WIND:     '#0ea5e9',
  MOUNTAIN: '#d97706',
  '':       '#4b5563',
}

const ELEMENT_SHORT: Record<Element | '', string> = {
  FIRE:     'FUE',
  WOOD:     'BOS',
  WIND:     'VIE',
  MOUNTAIN: 'MNT',
  '':       '',
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
  const { media } = getPlayerStatsSummary(player)
  const stripColor = ELEMENT_STRIP[player.element] ?? ELEMENT_STRIP['']
  return (
    <div className="flex flex-col items-center gap-0.5 select-none drop-shadow-2xl opacity-95">
      <div className="relative">
        <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-400 bg-gray-700 shadow-xl">
          <img
            src={player.spriteUrl}
            alt={player.nameRomaji}
            className="w-full h-full object-cover"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 bg-gray-900/90 rounded-full flex items-center justify-center px-1 shadow border border-gray-700/60">
          <span className="text-[0.5rem] font-black leading-none tabular-nums" style={{ color: statColor(media, 250) }}>
            {media}
          </span>
        </div>
      </div>
      <span
        className="text-white text-[0.5rem] font-semibold rounded px-1 py-0.5 max-w-[72px] text-center leading-tight"
        style={{ backgroundColor: stripColor + 'cc' }}
      >
        {player.nameRomaji}
      </span>
    </div>
  )
}

// ─── Bench player row (draggable) ─────────────────────────────────────────────

function BenchPlayerRow({
  player,
  isCaptain,
  isKeyPlayer,
}: {
  player: Player
  isCaptain: boolean
  isKeyPlayer: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bench-player-${player.id}`,
    data: { playerId: player.id, isStarter: false },
  })

  const { media } = getPlayerStatsSummary(player)
  const stripColor = ELEMENT_STRIP[player.element] ?? ELEMENT_STRIP['']

  return (
    <div
      ref={setNodeRef}
      className={`relative flex items-center gap-2.5 pl-4 pr-3 py-2.5 border-b border-gray-700/30 select-none
        cursor-grab active:cursor-grabbing transition-opacity
        ${isDragging ? 'opacity-0' : 'hover:bg-gray-700/25'}`}
      {...attributes}
      {...listeners}
    >
      {/* Element colour strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
        style={{ backgroundColor: stripColor }}
      />

      {/* Avatar */}
      <div className="relative shrink-0">
        <img
          src={player.spriteUrl}
          alt={player.nameRomaji}
          className="w-8 h-8 rounded-full object-cover bg-gray-700"
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

      {/* Name + position + element */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate leading-tight">{player.nameRomaji}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <PositionSprite position={player.position} size={16} />
          {player.element && (
            <span
              className="text-[0.45rem] font-bold px-1 py-px rounded leading-none"
              style={{
                color: ELEMENT_STRIP[player.element],
                backgroundColor: ELEMENT_STRIP[player.element] + '28',
              }}
            >
              {ELEMENT_SHORT[player.element]}
            </span>
          )}
        </div>
      </div>

      {/* TOT */}
      <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: statColor(media, 250) }}>
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
}: {
  bench: LineupSlot[]
  players: Player[]
  captainId: number
  keyPlayerId?: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bench' })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto rounded-xl border transition-colors
        ${isOver ? 'border-blue-500/60 bg-blue-900/10' : 'border-gray-700/60 bg-gray-800/30'}`}
    >
      {bench.length === 0 ? (
        <div className="h-full flex items-center justify-center min-h-[80px]">
          <p className={`text-sm ${isOver ? 'text-blue-400' : 'text-gray-600'}`}>
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
              />
            )
          })}
          {isOver && (
            <div className="py-2 text-center text-blue-400 text-xs">Soltar para sentar</div>
          )}
        </>
      )}
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
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
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

  useEffect(() => {
    if (currentFormation) setSlotAssignment(initSlots(currentFormation, lineup))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFormation?.id])

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

  function handleSlotContextMenu(playerId: number, clientX: number, clientY: number) {
    const MENU_W = 200
    const MENU_H = 90
    const safeX = clientX + MENU_W > window.innerWidth ? clientX - MENU_W : clientX
    const safeY = clientY + MENU_H > window.innerHeight ? clientY - MENU_H : clientY
    setContextMenu({ x: safeX, y: safeY, playerId })
  }

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const formationDropdownValue = formations.find((f) => f.id === currentFormation?.id)?.id ?? ''
  const startersCount = slotAssignment.filter((id) => id !== null).length
  const isCtxCaptain = contextMenu !== null && contextMenu.playerId === userTeam?.captainId
  const isCtxKeyPlayer = contextMenu !== null && contextMenu.playerId === userTeam?.keyPlayerId

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Formación" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />

        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Control bar */}
            <div className="flex-shrink-0 bg-gray-900 border-b border-gray-700/60 px-4 py-2.5 flex items-center gap-3">
              <span className="text-gray-500 text-xs whitespace-nowrap">Formación</span>
              <select
                value={formationDropdownValue}
                onChange={(e) => applyFormationAction(parseInt(e.target.value, 10))}
                className="bg-gray-800 border border-gray-700 rounded-lg text-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-gray-500 cursor-pointer"
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

              <div className="ml-auto flex items-center gap-1.5 text-xs tabular-nums">
                <span style={{ color: startersCount === slotAssignment.length ? '#4ade80' : '#9ca3af' }}>
                  {startersCount}
                </span>
                <span className="text-gray-600">/ {slotAssignment.length} titulares</span>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
              {/* Left: Field */}
              <div className="flex-[3] flex flex-col min-w-0 overflow-hidden">
                {currentFormation ? (
                  <FormationPitch
                    formation={currentFormation}
                    slotAssignment={slotAssignment}
                    players={players}
                    captainId={userTeam?.captainId ?? 0}
                    keyPlayerId={userTeam?.keyPlayerId}
                    onSlotContextMenu={handleSlotContextMenu}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-700 text-gray-600 text-sm">
                    Selecciona una formación para empezar
                  </div>
                )}
              </div>

              {/* Right: Bench */}
              <div className="flex-[2] flex flex-col min-w-0 overflow-hidden gap-2">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Reservas</span>
                  <span className="text-gray-500 text-[0.625rem] font-semibold bg-gray-800 rounded-full px-1.5 py-0.5">
                    {bench.length}
                  </span>
                  <p className="ml-auto text-gray-600 text-[0.5625rem]">clic derecho para ajustes</p>
                </div>
                <BenchDropZone
                  bench={bench}
                  players={players}
                  captainId={userTeam?.captainId ?? 0}
                  keyPlayerId={userTeam?.keyPlayerId}
                />
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
            className="z-50 bg-gray-900 border border-gray-700/80 rounded-xl shadow-2xl py-1 min-w-[190px] overflow-hidden"
          >
            <button
              onClick={() => { setCaptainAction(contextMenu.playerId); setContextMenu(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors
                ${isCtxCaptain ? 'text-yellow-400 bg-yellow-900/10' : 'text-white hover:bg-gray-800'}`}
            >
              <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
                <span className="text-black text-[0.5625rem] font-black leading-none">C</span>
              </div>
              {isCtxCaptain ? 'Capitán (actual)' : 'Hacer capitán'}
            </button>

            <div className="h-px bg-gray-700/50 mx-2" />

            <button
              onClick={() => {
                setKeyPlayerAction(isCtxKeyPlayer ? null : contextMenu.playerId)
                setContextMenu(null)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors
                ${isCtxKeyPlayer ? 'text-blue-400 bg-blue-900/10' : 'text-white hover:bg-gray-800'}`}
            >
              <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center shrink-0">
                <span className="material-icons text-white select-none leading-none" style={{ fontSize: '9px' }}>star</span>
              </div>
              {isCtxKeyPlayer ? 'Quitar jugador clave' : 'Hacer jugador clave'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
