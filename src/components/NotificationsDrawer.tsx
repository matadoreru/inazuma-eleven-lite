import { useCareerStore } from '../store/careerStore'
import Drawer from './Drawer'
import Icon from './Icon'
import type { InboxEvent, InboxEventType } from '../types/career'

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
}

function NotificationItem({ event, onRead, onDelete }: {
  event: InboxEvent
  onRead: () => void
  onDelete: () => void
}) {
  return (
    <div className={`px-5 py-3 border-b border-gray-800 transition-colors hover:bg-gray-800/50 ${
      !event.read ? 'bg-blue-950/20' : ''
    }`}>
      <div className="flex items-start gap-3">
        <Icon
          name={typeIcon[event.type]}
          size="sm"
          className={`shrink-0 mt-0.5 ${typeColor[event.type]}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-semibold leading-tight ${event.read ? 'text-gray-300' : 'text-white'}`}>
              {event.title}
            </span>
            {!event.read && (
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
            )}
          </div>
          <p className="text-gray-400 text-xs mt-1 leading-snug">{event.body}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-600 text-xs">{event.date}</span>
            <div className="flex items-center gap-2">
              {!event.read && (
                <button
                  onClick={onRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Marcar leído
                </button>
              )}
              <button
                onClick={onDelete}
                className="text-gray-600 hover:text-red-400 transition-colors"
                aria-label="Eliminar"
              >
                <Icon name="delete" size="xs" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsDrawer() {
  const uiPanel = useCareerStore((s) => s.uiPanel)
  const setUIPanel = useCareerStore((s) => s.setUIPanel)
  const career = useCareerStore((s) => s.career)
  const markInboxRead = useCareerStore((s) => s.markInboxRead)
  const markAllInboxRead = useCareerStore((s) => s.markAllInboxRead)
  const deleteInboxEvent = useCareerStore((s) => s.deleteInboxEvent)
  const deleteAllInboxEvents = useCareerStore((s) => s.deleteAllInboxEvents)

  const inbox = career ? [...career.inbox].reverse() : []
  const unreadCount = inbox.filter((e) => !e.read).length

  return (
    <Drawer
      isOpen={uiPanel === 'notifications'}
      onClose={() => setUIPanel(null)}
      title="Notificaciones"
      subtitle={unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
    >
      {/* Actions bar */}
      {inbox.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-800 shrink-0">
          <button
            onClick={markAllInboxRead}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <Icon name="done_all" size="xs" />
            Marcar todo leído
          </button>
          <button
            onClick={deleteAllInboxEvents}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Icon name="delete_sweep" size="xs" />
            Eliminar todo
          </button>
        </div>
      )}

      {/* Notifications list */}
      {inbox.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <Icon name="notifications_none" size="xl" className="text-gray-700" />
          <p className="text-gray-500 text-sm">No hay notificaciones</p>
        </div>
      ) : (
        <div>
          {inbox.map((event) => (
            <NotificationItem
              key={event.id}
              event={event}
              onRead={() => markInboxRead(event.id)}
              onDelete={() => deleteInboxEvent(event.id)}
            />
          ))}
        </div>
      )}
    </Drawer>
  )
}
