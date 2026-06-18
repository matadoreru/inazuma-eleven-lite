import type { Player } from '../types/player'
import PositionSprite from './PositionSprite'
import ElementBadge from './ElementBadge'
import { statColor } from './StatBar'
import { getPlayerStatsSummary } from '../types/player'
import { calcTransferValue } from '../services/transferService'

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

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
  onView?: () => void
}

export default function TransferPlayerRow({ player, teamName, teamBadgeUrl, isFreeAgent, onView }: Props) {
  const { media } = getPlayerStatsSummary(player)
  const value = calcTransferValue(player)

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-700/40 transition-colors">
      {/* Avatar */}
      <td className="py-1.5 px-2 w-12">
        <img
          src={player.spriteUrl}
          alt={player.nameRomaji}
          className="w-10 h-10 object-contain rounded"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='5' fill='%234b5563'/%3E%3C/svg%3E"
          }}
        />
      </td>

      {/* Nombre + posición */}
      <td className="py-1.5 px-3 min-w-0">
        <span className="text-white text-sm font-medium block leading-tight truncate">
          {player.nameRomaji}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <PositionSprite position={player.position} size={20} />
          {player.positionAlt && (
            <PositionSprite position={player.positionAlt} size={16} className="opacity-60" />
          )}
        </div>
      </td>

      {/* Elemento */}
      <td className="py-1.5 px-2 w-20 text-center">
        <ElementBadge element={player.element} size="sm" />
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
      <td className="py-1.5 px-3 w-32">
        {isFreeAgent ? (
          <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/50">
            Libre
          </span>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            {teamBadgeUrl && (
              <img
                src={teamBadgeUrl}
                alt=""
                className="w-5 h-5 object-contain shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span className="text-gray-400 text-xs truncate">{teamName}</span>
          </div>
        )}
      </td>

      {/* Valor */}
      <td className="py-1.5 px-3 text-right tabular-nums w-20">
        <span className="text-gray-300 text-xs font-medium">{fmt(value)}</span>
      </td>

      {/* Ver ficha */}
      <td className="py-1.5 px-3 w-20 text-center">
        {onView && (
          <button
            onClick={onView}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-700 text-white hover:bg-blue-600 transition-colors font-semibold"
          >
            Ver ficha
          </button>
        )}
      </td>
    </tr>
  )
}
