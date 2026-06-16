import { useDroppable, useDraggable } from '@dnd-kit/core'
import type { Formation, FormationSlot } from '../types/team'
import type { Player, Position, Element } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import { getFormationSlots } from '../data/formations'
import { statColor } from './StatBar'

// ─── Element label colours ────────────────────────────────────────────────────

const ELEMENT_LABEL_BG: Record<Element | '', string> = {
  FIRE:     'rgba(220, 38, 38, 0.85)',
  WOOD:     'rgba(22, 163, 74, 0.85)',
  WIND:     'rgba(14, 165, 233, 0.85)',
  MOUNTAIN: 'rgba(217, 119, 6, 0.85)',
  '':       'rgba(55, 65, 81, 0.85)',
}

// ─── Position guide style ─────────────────────────────────────────────────────

const POS_GUIDE: Record<Position, { bg: string; border: string; text: string; label: string }> = {
  GK: { bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.38)', text: '#fbbf24', label: 'PR' },
  DF: { bg: 'rgba(59, 130, 246, 0.08)',  border: 'rgba(59, 130, 246, 0.35)',  text: '#60a5fa', label: 'DF' },
  MD: { bg: 'rgba(167, 139, 250, 0.08)', border: 'rgba(167, 139, 250, 0.35)', text: '#a78bfa', label: 'MD' },
  FW: { bg: 'rgba(249, 115, 22, 0.08)',  border: 'rgba(249, 115, 22, 0.38)',  text: '#fb923c', label: 'DL' },
}

interface Props {
  formation: Formation
  slotAssignment: (number | null)[]
  players: Player[]
  captainId: number
  keyPlayerId?: number
  onSlotContextMenu?: (playerId: number, x: number, y: number) => void
}

// ─── Player token (draggable) ─────────────────────────────────────────────────

function PlayerToken({
  player,
  slotIndex,
  isCaptain,
  isKeyPlayer,
  isMismatch,
  onContextMenu,
}: {
  player: Player
  slotIndex: number
  isCaptain: boolean
  isKeyPlayer: boolean
  isMismatch: boolean
  onContextMenu?: (playerId: number, x: number, y: number) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-player-${player.id}`,
    data: { playerId: player.id, isStarter: true, slotIndex },
  })

  const { media } = getPlayerStatsSummary(player)
  const ringColor = isCaptain ? 'ring-yellow-400' : 'ring-white/25'
  const labelBg = ELEMENT_LABEL_BG[player.element] ?? ELEMENT_LABEL_BG['']

  return (
    <div
      ref={setNodeRef}
      className={`relative z-10 flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing select-none transition-opacity
        ${isDragging ? 'opacity-0' : 'opacity-100'}`}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(player.id, e.clientX, e.clientY)
      }}
      {...attributes}
      {...listeners}
    >
      {/* Face circle */}
      <div className="relative">
        <div className={`w-11 h-11 rounded-full overflow-hidden ring-2 shadow-lg bg-gray-700 ${ringColor}`}>
          <img
            src={player.spriteUrl}
            alt={player.nameRomaji}
            className="w-full h-full object-cover"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>

        {/* TOT badge */}
        <div className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 bg-gray-900/90 rounded-full flex items-center justify-center px-1 shadow border border-gray-700/60 z-10">
          <span className="text-[0.5rem] font-black leading-none tabular-nums" style={{ color: statColor(media, 250) }}>
            {media}
          </span>
        </div>

        {/* Captain badge */}
        {isCaptain && (
          <div className="absolute -top-1.5 -left-1.5 w-[1.25rem] h-[1.25rem] bg-yellow-400 rounded-full flex items-center justify-center shadow z-10">
            <span className="text-black text-[0.5625rem] font-black leading-none">C</span>
          </div>
        )}

        {/* Key player badge */}
        {isKeyPlayer && (
          <div className="absolute -bottom-1 -right-1 w-[1.125rem] h-[1.125rem] bg-blue-400 rounded-full flex items-center justify-center shadow z-10">
            <span className="material-icons text-white select-none leading-none" style={{ fontSize: '8px' }}>star</span>
          </div>
        )}

        {/* Mismatch warning */}
        {isMismatch && (
          <div
            className="absolute -bottom-1 -left-1 z-10 cursor-help"
            title="Este jugador no está en su posición natural. Su rendimiento bajará."
          >
            <span className="material-icons text-amber-400 drop-shadow select-none leading-none" style={{ fontSize: '16px' }}>warning</span>
          </div>
        )}
      </div>

      {/* Name label with element colour */}
      <span
        className="text-white text-[0.5625rem] font-semibold leading-tight rounded px-1.5 py-0.5 truncate max-w-[60px] shadow-sm text-center"
        style={{ backgroundColor: labelBg }}
      >
        {player.nameRomaji.split(' ')[0]}
      </span>
    </div>
  )
}

// ─── Field slot (droppable) with always-visible position guide ─────────────────

function FieldSlot({
  slotIndex,
  slot,
  player,
  isCaptain,
  isKeyPlayer,
  onSlotContextMenu,
}: {
  slotIndex: number
  slot: FormationSlot
  player: Player | null
  isCaptain: boolean
  isKeyPlayer: boolean
  onSlotContextMenu?: (playerId: number, x: number, y: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotIndex}`,
    data: { slotIndex, position: slot.position },
  })

  const isMismatch =
    player !== null &&
    player.position !== slot.position &&
    player.positionAlt !== slot.position

  const guide = POS_GUIDE[slot.position]

  return (
    <div
      ref={setNodeRef}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-20 rounded-xl transition-all"
    >
      {/* Position guide box — always visible behind the player token */}
      <div
        className="absolute inset-0 rounded-xl border-2 transition-all pointer-events-none"
        style={{
          backgroundColor: isOver ? 'rgba(59, 130, 246, 0.22)' : guide.bg,
          borderColor:     isOver ? 'rgba(96, 165, 250, 0.65)' : guide.border,
        }}
      >
        {/* Position label — prominent when empty, subtle when occupied */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[0.6875rem] font-black tracking-wider transition-opacity"
          style={{
            color:   isOver ? 'rgba(147, 197, 253, 0.9)' : guide.text,
            opacity: player ? 0.18 : 0.75,
          }}
        >
          {guide.label}
        </span>
      </div>

      {/* Player token sits on top (z-10) */}
      {player && (
        <PlayerToken
          player={player}
          slotIndex={slotIndex}
          isCaptain={isCaptain}
          isKeyPlayer={isKeyPlayer}
          isMismatch={isMismatch}
          onContextMenu={onSlotContextMenu}
        />
      )}
    </div>
  )
}

// ─── Pitch ────────────────────────────────────────────────────────────────────

export default function FormationPitch({ formation, slotAssignment, players, captainId, keyPlayerId, onSlotContextMenu }: Props) {
  const slots = getFormationSlots(formation)
  const playerMap = new Map(players.map((p) => [p.id, p]))

  return (
    <div
      className="relative bg-green-900 rounded-xl overflow-hidden w-full select-none"
      style={{ aspectRatio: '3/4' }}
    >
      {/* Pitch markings */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white/10 rounded-full pointer-events-none" />
      <div className="absolute top-3 left-1/4 right-1/4 h-[14%] border border-white/10 rounded-b pointer-events-none" />
      <div className="absolute bottom-3 left-1/4 right-1/4 h-[14%] border border-white/10 rounded-t pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-green-700/10 via-transparent to-green-950/20 pointer-events-none" />

      {/* Formation name label */}
      <div className="absolute top-2 left-2 z-20 pointer-events-none flex flex-col gap-0.5">
        <span className="text-white/80 text-[0.625rem] font-bold bg-black/40 rounded-md px-2 py-0.5 leading-tight">
          {formation.name}
        </span>
        <span className="text-green-300/50 text-[0.5rem] font-semibold bg-black/25 rounded px-1.5 py-0.5 leading-tight tabular-nums">
          {formation.DF}-{formation.MD}-{formation.FW}
        </span>
      </div>

      {/* Slots */}
      {slots.map((slot, i) => {
        const pid = i < slotAssignment.length ? slotAssignment[i] : null
        const player = pid !== null ? (playerMap.get(pid) ?? null) : null
        return (
          <FieldSlot
            key={i}
            slotIndex={i}
            slot={slot}
            player={player}
            isCaptain={player !== null && player.id === captainId}
            isKeyPlayer={player !== null && player.id === keyPlayerId}
            onSlotContextMenu={onSlotContextMenu}
          />
        )
      })}
    </div>
  )
}
