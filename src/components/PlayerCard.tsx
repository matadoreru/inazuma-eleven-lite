import type { Player } from '../types/player'
import { getPlayerStatsSummary, playerDisplayName } from '../types/player'
import PositionSprite from './PositionSprite'
import ElementBadge from './ElementBadge'
import { statColor } from './StatBar'
import { useNameStyle } from '../hooks/useNameStyle'

interface Props {
  player: Player
  onClick?: () => void
}

export default function PlayerCard({ player, onClick }: Props) {
  const nameStyle = useNameStyle()
  const { total, media } = getPlayerStatsSummary(player)
  const displayName = playerDisplayName(player, nameStyle)
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-lg p-2 flex flex-col items-center gap-1 w-24
        ${onClick ? 'cursor-pointer hover:bg-gray-700 active:bg-gray-600 transition-colors' : ''}`}
    >
      <img
        src={player.spriteUrl}
        alt={displayName}
        className="w-12 h-12 object-contain rounded"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='4' fill='%234b5563'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='20'%3E👤%3C/text%3E%3C/svg%3E"
        }}
      />
      <span className="text-white text-xs font-medium text-center leading-tight truncate w-full text-center">
        {displayName}
      </span>
      <PositionSprite position={player.position} size={25} />
      <ElementBadge element={player.element} size="sm" />
      <span className="text-xs font-bold" style={{ color: statColor(media, 250) }}>Media {media}</span>
      <span className="text-gray-500 text-[0.625rem]">Total {total}</span>
    </div>
  )
}
