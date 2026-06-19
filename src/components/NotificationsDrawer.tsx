import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { useNotificationPreferences, NOTIFICATION_GROUPS } from '../hooks/useNotificationPreferences'
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
  OUTGOING_TRANSFER_CLUB_ACCEPTED: 'done',
  OUTGOING_TRANSFER_CLUB_REJECTED: 'close',
  OUTGOING_TRANSFER_CLUB_COUNTER: 'compare_arrows',
  OUTGOING_TRANSFER_PLAYER_ACCEPTED: 'done',
  OUTGOING_TRANSFER_PLAYER_REJECTED: 'close',
  TRAINING_AVAILABLE: 'fitness_center',
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
  TRAINING_AVAILABLE: 'text-amber-400',
}

function NotificationItem({ event, onRead, onDelete, onNavigate }: {
  event: InboxEvent
  onRead: () => void
  onDelete: () => void
  onNavigate?: () => void
}) {
  const isNavigable = !!event.targetScreen

  function handleClick() {
    onRead()
    if (isNavigable && onNavigate) onNavigate()
  }

  return (
    <div
      className={`px-5 py-3 border-b border-gold-600/15 transition-colors ${
        isNavigable ? 'cursor-pointer hover:bg-dark-700/40' : 'hover:bg-dark-700/30'
      } ${!event.read ? 'bg-blue-950/20' : ''}`}
      onClick={isNavigable ? handleClick : undefined}
    >
      <div className="flex items-start gap-3">
        <Icon name={typeIcon[event.type]} size="sm" className={`shrink-0 mt-0.5 ${typeColor[event.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-semibold leading-tight ${event.read ? 'text-gray-300' : 'text-white'}`}>
              {event.title}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {!event.read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              {isNavigable && <Icon name="chevron_right" size="xs" className="text-gray-500" />}
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-1 leading-snug">{event.body}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-600 text-xs">{event.date}</span>
            <div className="flex items-center gap-2">
              {!event.read && !isNavigable && (
                <button onClick={(e) => { e.stopPropagation(); onRead() }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Marcar leído
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="text-gray-600 hover:text-red-400 transition-colors" aria-label="Eliminar">
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
  const navigate = useCareerStore((s) => s.navigate)

  const { prefs, isGroupEnabled, toggleGroup } = useNotificationPreferences()
  const [showFilter, setShowFilter] = useState(false)

  const allEvents = career ? [...career.inbox].reverse() : []
  const inbox = allEvents.filter((e) => prefs[e.type])
  const unreadCount = inbox.filter((e) => !e.read).length

  const gearButton = (
    <button
      onClick={() => setShowFilter((v) => !v)}
      className={`p-1.5 rounded-lg transition-colors ${showFilter ? 'text-white bg-dark-700/60' : 'text-gray-400 hover:text-white hover:bg-dark-700/60'}`}
      aria-label="Filtrar notificaciones"
    >
      <Icon name="tune" size="sm" />
    </button>
  )

  return (
    <Drawer
      isOpen={uiPanel === 'notifications'}
      onClose={() => { setUIPanel(null); setShowFilter(false) }}
      title="Notificaciones"
      subtitle={unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
      headerActions={gearButton}
    >
      {/* Actions bar */}
      {inbox.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800 shrink-0">
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

      {/* Filter panel */}
      {showFilter && (
        <div className="px-5 py-3 border-b border-gray-800 bg-dark-900/60 shrink-0">
          <p className="text-gray-500 text-[0.625rem] uppercase tracking-widest font-bold mb-2">
            Mostrar notificaciones
          </p>
          <div className="flex flex-col gap-1.5">
            {NOTIFICATION_GROUPS.map((group) => {
              const enabled = isGroupEnabled(group)
              return (
                <label key={group.label} className="flex items-center gap-2.5 cursor-pointer group">
                  <button
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleGroup(group)}
                    className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
                      enabled ? 'bg-gold-600' : 'bg-dark-600/80'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                        enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-xs transition-colors ${enabled ? 'text-gray-300' : 'text-gray-600'}`}>
                    {group.label}
                  </span>
                </label>
              )
            })}
          </div>
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
              onNavigate={event.targetScreen ? () => {
                setUIPanel(null)
                navigate(event.targetScreen as any)
              } : undefined}
            />
          ))}
        </div>
      )}
    </Drawer>
  )
}
