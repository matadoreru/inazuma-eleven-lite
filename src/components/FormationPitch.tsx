import { useDroppable, useDraggable } from '@dnd-kit/core'
import type { Formation, FormationSlot } from '../types/team'
import type { Player, Position, Element } from '../types/player'
import { getPlayerStatsSummary, playerDisplayName } from '../types/player'
import { getFormationSlots } from '../data/formations'
import { statColor } from './StatBar'
import { useNameStyle } from '../hooks/useNameStyle'

// ─── Element colours ─────────────────────────────────────────────────────────

// Name pill background
const ELEMENT_LABEL_BG: Record<Element | '', string> = {
  FIRE:     'rgba(220, 38, 38, 0.85)',
  WOOD:     'rgba(22, 163, 74, 0.85)',
  WIND:     'rgba(14, 165, 233, 0.85)',
  MOUNTAIN: 'rgba(217, 119, 6, 0.85)',
  '':       'rgba(55, 65, 81, 0.85)',
}

// Guide box fill / border based on player element (or gray when empty)
const ELEMENT_BOX: Record<Element | '', { bg: string; border: string }> = {
  FIRE:     { bg: 'rgba(220, 38, 38, 0.15)',  border: 'rgba(220, 38, 38, 0.65)' },
  WOOD:     { bg: 'rgba(22, 163, 74, 0.15)',  border: 'rgba(22, 163, 74, 0.65)' },
  WIND:     { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.65)' },
  MOUNTAIN: { bg: 'rgba(217, 119, 6, 0.15)',  border: 'rgba(217, 119, 6, 0.65)' },
  '':       { bg: 'rgba(55, 65, 81, 0.25)',   border: 'rgba(75, 85, 99, 0.5)' },
}

// Position label shown BELOW the guide box
const POS_LABEL: Record<Position, { text: string; label: string }> = {
  GK: { text: '#fbbf24', label: 'PR' },
  DF: { text: '#60a5fa', label: 'DF' },
  MD: { text: '#a78bfa', label: 'MD' },
  FW: { text: '#fb923c', label: 'DL' },
}

interface Props {
  formation: Formation
  slotAssignment: (number | null)[]
  players: Player[]
  captainId: number
  keyPlayerId?: number
  onSlotContextMenu?: (playerId: number, x: number, y: number) => void
  onPlayerClick?: (playerId: number) => void
}

// ─── Player token (draggable, fills the guide box) ───────────────────────────

function PlayerToken({
  player,
  slotIndex,
  isCaptain,
  isKeyPlayer,
  isMismatch,
  onContextMenu,
  onClick,
}: {
  player: Player
  slotIndex: number
  isCaptain: boolean
  isKeyPlayer: boolean
  isMismatch: boolean
  onContextMenu?: (playerId: number, x: number, y: number) => void
  onClick?: (playerId: number) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-player-${player.id}`,
    data: { playerId: player.id, isStarter: true, slotIndex },
  })

  const nameStyle = useNameStyle()
  const { media } = getPlayerStatsSummary(player)
  const effectiveMedia = player.isInjured ? Math.round(media * 0.70) : media
  const ringColor = player.isInjured ? 'ring-orange-500/80' : isCaptain ? 'ring-yellow-400' : 'ring-white/25'

  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-opacity
        ${isDragging ? 'opacity-0' : 'opacity-100'}`}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(player.id, e.clientX, e.clientY)
      }}
      onClick={() => onClick?.(player.id)}
      {...attributes}
      {...listeners}
    >
      <div className="relative">
        {/* Face circle */}
        <div className={`w-10 h-10 rounded-full overflow-hidden ring-2 shadow-lg bg-dark-700/60 ${ringColor} ${player.isInjured ? 'opacity-75' : ''}`}>
          <img
            src={player.spriteUrl}
            alt={playerDisplayName(player, nameStyle)}
            className="w-full h-full object-cover"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>

        {/* TOT badge — shows effective rating (penalised when injured) */}
        <div
          className="absolute -top-1.5 -right-1.5 min-w-[1.125rem] h-[1.125rem] rounded-full flex items-center justify-center px-0.5 shadow z-10"
          style={{
            background: player.isInjured ? 'rgba(154,52,18,0.95)' : 'rgba(17,24,39,0.9)',
            borderWidth: 1,
            borderColor: player.isInjured ? 'rgba(249,115,22,0.8)' : 'rgba(75,85,99,0.6)',
          }}
        >
          <span className="text-[0.45rem] font-black leading-none tabular-nums" style={{ color: player.isInjured ? '#fb923c' : statColor(media, 250) }}>
            {effectiveMedia}
          </span>
        </div>

        {/* Captain badge */}
        {isCaptain && (
          <div className="absolute -top-1.5 -left-1.5 w-[1.125rem] h-[1.125rem] bg-yellow-400 rounded-full flex items-center justify-center shadow z-10">
            <span className="text-black text-[0.5rem] font-black leading-none">C</span>
          </div>
        )}

        {/* Key player badge */}
        {isKeyPlayer && (
          <div className="absolute -bottom-1 -right-1 w-[1rem] h-[1rem] bg-blue-400 rounded-full flex items-center justify-center shadow z-10">
            <span className="material-icons text-white select-none leading-none" style={{ fontSize: '7px' }}>star</span>
          </div>
        )}

        {/* Mismatch warning */}
        {isMismatch && (
          <div
            className="absolute -bottom-1 -left-1 z-10 cursor-help"
            title="Este jugador no está en su posición natural. Su rendimiento bajará."
          >
            <span className="material-icons text-amber-400 drop-shadow select-none leading-none" style={{ fontSize: '14px' }}>warning</span>
          </div>
        )}

        {/* Injury indicator */}
        {player.isInjured && (
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 flex items-center gap-px bg-orange-900/90 border border-orange-600/70 rounded-full px-1 py-px shadow"
            title={`Lesionado: ${player.injuryDaysRemaining} días restantes`}
          >
            <span className="material-icons text-orange-400 leading-none select-none" style={{ fontSize: '9px' }}>healing</span>
            <span className="text-orange-300 font-black leading-none" style={{ fontSize: '8px' }}>{player.injuryDaysRemaining}d</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Field slot (droppable) ───────────────────────────────────────────────────

function FieldSlot({
  slotIndex,
  slot,
  player,
  isCaptain,
  isKeyPlayer,
  onSlotContextMenu,
  onPlayerClick,
}: {
  slotIndex: number
  slot: FormationSlot
  player: Player | null
  isCaptain: boolean
  isKeyPlayer: boolean
  onSlotContextMenu?: (playerId: number, x: number, y: number) => void
  onPlayerClick?: (playerId: number) => void
}) {
  const nameStyle = useNameStyle()
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotIndex}`,
    data: { slotIndex, position: slot.position },
  })

  const isMismatch =
    player !== null &&
    player.position !== slot.position &&
    player.positionAlt !== slot.position

  const pos = POS_LABEL[slot.position]
  const elemKey = (player?.element ?? '') as Element | ''
  const elemBox = ELEMENT_BOX[elemKey]
  const labelBg = ELEMENT_LABEL_BG[elemKey]

  return (
    <div
      ref={setNodeRef}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
    >
      {/* Guide box — colored by element when occupied, gray when empty */}
      <div
        className="relative w-16 h-16 rounded-xl border-2 transition-all"
        style={{
          backgroundColor: isOver ? 'rgba(59, 130, 246, 0.22)' : elemBox.bg,
          borderColor:     isOver ? 'rgba(96, 165, 250, 0.65)' : elemBox.border,
        }}
      >
        {player && (
          <PlayerToken
            player={player}
            slotIndex={slotIndex}
            isCaptain={isCaptain}
            isKeyPlayer={isKeyPlayer}
            isMismatch={isMismatch}
            onContextMenu={onSlotContextMenu}
            onClick={onPlayerClick}
          />
        )}
      </div>

      {/* Player name — full name, element-coloured pill */}
      {player ? (
        <span
          className="text-white text-[0.5rem] font-semibold leading-tight rounded px-1 py-px max-w-[80px] text-center shadow-sm"
          style={{ backgroundColor: labelBg }}
        >
          {playerDisplayName(player, nameStyle)}
        </span>
      ) : (
        <span className="h-[14px]" /> /* spacer to keep position label aligned */
      )}

      {/* Position label — always below */}
      <span
        className="text-[0.5rem] font-black tracking-wider leading-none"
        style={{
          color: isOver ? 'rgba(147, 197, 253, 0.9)' : pos.text,
        }}
      >
        {pos.label}
      </span>
    </div>
  )
}

// ─── Pitch ────────────────────────────────────────────────────────────────────

export default function FormationPitch({ formation, slotAssignment, players, captainId, keyPlayerId, onSlotContextMenu, onPlayerClick }: Props) {
  const slots = getFormationSlots(formation)
  const playerMap = new Map(players.map((p) => [p.id, p]))

  return (
    <div
      className="relative rounded-2xl overflow-hidden h-full w-auto max-w-full select-none border border-gold-600/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{ aspectRatio: '3/4' }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(34,197,94,0.2),rgba(20,83,45,0.92)_45%,rgba(6,24,16,0.98)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(251,191,36,0.05),transparent_16%,transparent_84%,rgba(251,191,36,0.04))]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.018)_0px,rgba(255,255,255,0.018)_1px,transparent_1px,transparent_74px)] opacity-60 pointer-events-none" />

      {/* Pitch markings */}
      <div className="absolute inset-[3.5%] rounded-[1.25rem] border border-white/10 pointer-events-none" />
      <div className="absolute inset-x-[3.5%] top-1/2 h-px bg-white/10 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white/10 rounded-full pointer-events-none" />
      <div className="absolute top-[6%] left-[25%] right-[25%] h-[14%] border border-white/10 rounded-b-2xl pointer-events-none" />
      <div className="absolute top-[10.5%] left-[38%] right-[38%] h-[5.5%] border border-white/10 rounded-b-xl pointer-events-none" />
      <div className="absolute bottom-[6%] left-[25%] right-[25%] h-[14%] border border-white/10 rounded-t-2xl pointer-events-none" />
      <div className="absolute bottom-[10.5%] left-[38%] right-[38%] h-[5.5%] border border-white/10 rounded-t-xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/20 pointer-events-none" />

      {/* Formation name label */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-1">
        <span className="text-gold-300 text-[0.625rem] font-bold bg-dark-950/70 border border-gold-600/25 rounded-md px-2 py-1 leading-tight shadow-lg">
          {formation.name}
        </span>
        <span className="text-gray-400 text-[0.5rem] font-semibold bg-dark-950/45 border border-white/5 rounded px-1.5 py-0.5 leading-tight tabular-nums">
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
            onPlayerClick={onPlayerClick}
          />
        )
      })}
    </div>
  )
}
