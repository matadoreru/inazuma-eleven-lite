import type { InboxEvent, InboxEventType } from '../types/career'
import Icon from './Icon'

interface Props {
  event: InboxEvent
  onRead?: () => void
}

const typeIcon: Record<InboxEventType, string> = {
  SEASON_START: 'flag',
  SEASON_END: 'emoji_events',
  MATCH_RESULT: 'sports_soccer',
  OBJECTIVE_COMPLETE: 'check_circle',
  OBJECTIVE_FAILED: 'cancel',
  TRANSFER_OFFER: 'payments',
  TRANSFER_ACCEPTED: 'done_all',
  TRANSFER_REJECTED: 'block',
  PLAYER_INJURED: 'healing',
  PLAYER_RECOVERED: 'mood',
  PLAYER_GROWTH: 'trending_up',
  NEWS: 'article',
  OUTGOING_TRANSFER_CLUB_ACCEPTED: 'done',
  OUTGOING_TRANSFER_CLUB_REJECTED: 'close',
  OUTGOING_TRANSFER_CLUB_COUNTER: 'compare_arrows',
  OUTGOING_TRANSFER_PLAYER_ACCEPTED: 'done',
  OUTGOING_TRANSFER_PLAYER_REJECTED: 'close',
}

const typeColor: Record<InboxEventType, string> = {
  SEASON_START: 'text-blue-400',
  SEASON_END: 'text-yellow-400',
  MATCH_RESULT: 'text-green-400',
  OBJECTIVE_COMPLETE: 'text-green-400',
  OBJECTIVE_FAILED: 'text-red-400',
  TRANSFER_OFFER: 'text-yellow-400',
  TRANSFER_ACCEPTED: 'text-green-400',
  TRANSFER_REJECTED: 'text-red-400',
  PLAYER_INJURED: 'text-orange-400',
  PLAYER_RECOVERED: 'text-green-400',
  PLAYER_GROWTH: 'text-blue-400',
  NEWS: 'text-gray-400',
  OUTGOING_TRANSFER_CLUB_ACCEPTED: 'text-green-400',
  OUTGOING_TRANSFER_CLUB_REJECTED: 'text-red-400',
  OUTGOING_TRANSFER_CLUB_COUNTER: 'text-blue-400',
  OUTGOING_TRANSFER_PLAYER_ACCEPTED: 'text-green-400',
  OUTGOING_TRANSFER_PLAYER_REJECTED: 'text-red-400',
}

export default function InboxEventCard({ event, onRead }: Props) {
  return (
    <div
      className={`bg-dark-800/70 rounded-lg p-3 border transition-colors ${
        event.read ? 'border-gold-600/15 opacity-70' : 'border-gold-500'
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon
          name={typeIcon[event.type]}
          size="sm"
          className={`shrink-0 mt-0.5 ${typeColor[event.type]}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-semibold truncate ${event.read ? 'text-gray-300' : 'text-white'}`}>
              {event.title}
            </span>
            <span className="text-gray-500 text-xs shrink-0">{event.date}</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5 leading-snug line-clamp-2">{event.body}</p>
        </div>
        {!event.read && onRead && (
          <button
            onClick={onRead}
            className="shrink-0 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Leído
          </button>
        )}
      </div>
    </div>
  )
}
