import type { Player } from '../types/player'
import PlayerRow from './PlayerRow'

interface Props {
  player: Player
  teamName: string
  onBuy?: () => void
  onWatchlist?: () => void
  isWatchlisted?: boolean
}

export default function TransferPlayerRow({
  player,
  teamName: _teamName,
  onBuy,
  onWatchlist,
  isWatchlisted = false,
}: Props) {
  const actions = (
    <div className="flex items-center gap-2">
      {onWatchlist && (
        <button
          onClick={onWatchlist}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            isWatchlisted
              ? 'bg-yellow-600 text-yellow-100 hover:bg-yellow-700'
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          {isWatchlisted ? '★ Watching' : '☆ Watch'}
        </button>
      )}
      {onBuy && (
        <button
          onClick={onBuy}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors font-semibold"
        >
          Buy
        </button>
      )}
    </div>
  )

  return <PlayerRow player={player} actions={actions} />
}
