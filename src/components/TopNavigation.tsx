import { useCareerStore } from '../store/careerStore'
import { useNotificationPreferences } from '../hooks/useNotificationPreferences'
import Icon from './Icon'
import TeamBadgeImage from './TeamBadgeImage'

interface Props {
  title?: string
  badgeUrl?: string
}

export default function TopNavigation({ title, badgeUrl }: Props) {
  const uiPanel = useCareerStore((s) => s.uiPanel)
  const setUIPanel = useCareerStore((s) => s.setUIPanel)
  const career = useCareerStore((s) => s.career)

  const { prefs } = useNotificationPreferences()
  const unreadCount = career?.inbox.filter((e) => !e.read && prefs[e.type]).length ?? 0
  const bellActive = uiPanel === 'notifications'
  const gearActive = uiPanel === 'settings'

  return (
    <header className="bg-dark-900/90 border-b border-gold-600/25 px-4 py-2 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        {badgeUrl && <TeamBadgeImage teamName={title ?? 'Equipo'} badgeUrl={badgeUrl} size="sm" className="shrink-0" />}
        <span className="text-white font-semibold text-sm truncate">{title ?? ''}</span>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setUIPanel(bellActive ? null : 'notifications')}
          className={`relative p-2 rounded-lg transition-colors ${
            bellActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-dark-700/60 hover:text-white'
          }`}
          aria-label="Notificaciones"
        >
          <Icon name="notifications" size="sm" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[0.625rem] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setUIPanel(gearActive ? null : 'settings')}
          className={`p-2 rounded-lg transition-colors ${
            gearActive ? 'bg-dark-700/60 text-white' : 'text-gray-400 hover:bg-dark-700/60 hover:text-white'
          }`}
          aria-label="Ajustes"
        >
          <Icon name="settings" size="sm" />
        </button>
      </div>
    </header>
  )
}
