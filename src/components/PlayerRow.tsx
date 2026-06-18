import type { Player } from '../types/player'
import { getPlayerStatsSummary, playerDisplayName } from '../types/player'
import PositionSprite from './PositionSprite'
import ElementBadge from './ElementBadge'
import { statColor } from './StatBar'
import { getEnergyState } from '../services/energyService'
import { useNameStyle } from '../hooks/useNameStyle'

export type PlayerStatus = 'TIT' | 'SUP' | 'NC'

interface Props {
  player: Player
  status?: PlayerStatus
  isSelected?: boolean
  onClick?: () => void
  actions?: React.ReactNode
}

const STATUS_STYLE: Record<PlayerStatus, string> = {
  TIT: 'bg-blue-600/30 text-blue-300 border border-blue-600/40',
  SUP: 'bg-gray-700 text-gray-400 border border-gray-600',
  NC: 'bg-gray-800 text-gray-600 border border-gray-700',
}

const ENERGY_BAR_COLOR: Record<ReturnType<typeof getEnergyState>, string> = {
  fresh: 'bg-green-500',
  tired: 'bg-amber-400',
  exhausted: 'bg-red-500',
}

export default function PlayerRow({ player, status, isSelected, onClick, actions }: Props) {
  const nameStyle = useNameStyle()
  const { total, media } = getPlayerStatsSummary(player)
  const displayName = playerDisplayName(player, nameStyle)
  const energyState = getEnergyState(player.stamina)
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-700 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${isSelected ? 'bg-blue-900/20' : onClick ? 'hover:bg-gray-700/50' : ''}`}
    >
      <td className="py-1.5 px-3 text-gray-400 text-xs w-10 text-right tabular-nums">
        {player.jerseyNumber > 0 ? `#${player.jerseyNumber}` : '–'}
      </td>
      <td className="py-1.5 px-2 w-14">
        <img
          src={player.spriteUrl}
          alt={displayName}
          className="w-12 h-12 object-contain rounded"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='6' fill='%234b5563'/%3E%3C/svg%3E"
          }}
        />
      </td>
      <td className="py-1.5 px-3">
        <span className="text-white text-sm font-medium block leading-tight">{displayName}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <PositionSprite position={player.position} size={25} />
          <ElementBadge element={player.element} size="sm" />
          {player.isInjured && (
            <span className="text-[0.55rem] font-bold px-1 py-px rounded bg-orange-900/40 text-orange-400 border border-orange-700/50 leading-none">
              LES {player.injuryDaysRemaining}d
            </span>
          )}
        </div>
      </td>
      <td className="py-1.5 px-3 text-right tabular-nums w-16">
        <span className="text-sm font-bold block leading-tight" style={{ color: statColor(media, 250) }}>{media}</span>
        <span className="text-gray-500 text-[0.625rem] block leading-tight">{total}</span>
      </td>
      <td className="py-1.5 px-3 text-right text-gray-300 text-sm tabular-nums w-12">{player.stats.POT}</td>
      <td className="py-1.5 px-3 text-right text-gray-300 text-sm tabular-nums w-12 hidden sm:table-cell">{player.stats.TEC}</td>
      <td className="py-1.5 px-3 text-right text-gray-300 text-sm tabular-nums w-12 hidden sm:table-cell">{player.stats.FIS}</td>
      <td className="py-1.5 px-3 w-20 hidden md:table-cell">
        <div className="flex flex-col items-end gap-0.5">
          <div className="w-14 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${ENERGY_BAR_COLOR[energyState]}`}
              style={{ width: `${player.stamina}%` }}
            />
          </div>
          <span className="text-gray-500 text-[0.6rem] tabular-nums">{player.stamina}%</span>
        </div>
      </td>
      {/* Fixed-width last column: status chip or custom actions */}
      <td className="py-1.5 px-3 w-16 text-center">
        {actions ?? (status && (
          <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[status]}`}>
            {status}
          </span>
        ))}
      </td>
    </tr>
  )
}
