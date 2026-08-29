import type { Player } from '../types/player'
import { playerDisplayName } from '../types/player'
import PositionSprite from './PositionSprite'
import ElementBadge from './ElementBadge'
import { statColor } from './StatBar'
import { getPlayerStatsSummary } from '../types/player'
import { calcTransferValue, calcFreeAgentRecommendedOffer } from '../services/transferService'
import { useNameStyle } from '../hooks/useNameStyle'

import { formatMoney as fmt } from '../utils/formatMoney'

function StatCell({ value }: { value: number }) {
  return (
    <td className="py-1.5 px-2 text-right tabular-nums w-10">
      <span className="text-xs font-semibold" style={{ color: statColor(value, 250) }}>
        {value}
      </span>
    </td>
  )
}

interface Props {
  player: Player
  teamName: string
  teamBadgeUrl?: string
  isFreeAgent: boolean
  isSelected?: boolean
  onView?: () => void
}

export default function TransferPlayerRow({ player, teamName, teamBadgeUrl, isFreeAgent, isSelected, onView }: Props) {
  const nameStyle = useNameStyle()
  const { media } = getPlayerStatsSummary(player)
  const value = calcTransferValue(player)
  const displayName = playerDisplayName(player, nameStyle)
  const recommendedOffer = isFreeAgent ? calcFreeAgentRecommendedOffer(player) : value

  return (
    <tr
      className={`border-b border-gold-600/15 transition-colors cursor-pointer ${
        isSelected ? 'bg-gold-900/20 hover:bg-gold-900/25' : 'hover:bg-dark-700/40'
      }`}
      onClick={onView}
    >
      {/* Avatar */}
      <td className="py-2 px-3 w-20">
        <img
          src={player.spriteUrl}
          alt={displayName}
          className="w-16 h-16 object-contain rounded bg-dark-700"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' rx='5' fill='%234b5563'/%3E%3C/svg%3E"
          }}
        />
      </td>

      {/* Nombre + posición */}
      <td className="py-1.5 px-3">
        <div className="w-28">
          <span className="text-white text-sm font-medium block leading-tight truncate">
            {displayName}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <PositionSprite position={player.position} size={20} />
            {player.positionAlt && (
              <PositionSprite position={player.positionAlt} size={16} className="opacity-60" />
            )}
          </div>
        </div>
      </td>

      {/* Elemento */}
      <td className="py-1.5 px-3 w-32">
        <ElementBadge element={player.element} size="md" />
      </td>

      {/* Edad */}
      <td className="py-1.5 px-2 w-10 text-center tabular-nums">
        <span className="text-gray-400 text-xs">{player.age}</span>
      </td>

      {/* Stats clave con colores */}
      <StatCell value={player.stats.POT} />
      <StatCell value={player.stats.TEC} />
      <StatCell value={player.stats.FIS} />
      <StatCell value={player.stats.AGI} />

      {/* Media */}
      <td className="py-1.5 px-2 text-right tabular-nums w-14">
        <span className="text-sm font-bold" style={{ color: statColor(media, 250) }}>{media}</span>
      </td>

      {/* Equipo */}
      <td className="py-1.5 px-3 w-36">
        {isFreeAgent ? (
          <div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-wide block">Libre</span>
            <span className="text-[10px] text-gray-500">Oferta rec.: {fmt(recommendedOffer)}</span>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1.5 min-w-0">
              {teamBadgeUrl && (
                <img
                  src={teamBadgeUrl}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <span className="text-gray-400 text-xs truncate">{teamName}</span>
            </div>
            <span className="text-[10px] text-gray-500">Oferta rec.: {fmt(recommendedOffer)}</span>
          </div>
        )}
      </td>

      {/* Valor */}
      <td className="py-1.5 px-3 text-right tabular-nums w-20">
        <span className="text-gray-300 text-xs font-medium">{fmt(value)}</span>
      </td>
    </tr>
  )
}
