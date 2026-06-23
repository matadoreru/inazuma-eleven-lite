import type { ReactNode } from 'react'
import { useCareerStore } from '../store/careerStore'
import { useNotificationPreferences } from '../hooks/useNotificationPreferences'
import { isDevModeActive } from '../services/profileService'
import Icon from './Icon'
import TeamBadgeImage from './TeamBadgeImage'
import type { Screen } from '../App'
import { formatMoney } from '../utils/formatMoney'

interface NavItem {
  screen: Screen
  label: string
  icon: string
}

const BASE_NAV_ITEMS: NavItem[] = [
  { screen: 'career_home', label: 'Inicio', icon: 'home' },
  { screen: 'club', label: 'Club', icon: 'shield' },
  { screen: 'squad', label: 'Plantilla', icon: 'groups' },
  { screen: 'formation', label: 'Formación', icon: 'dashboard' },
  { screen: 'training', label: 'Entreno', icon: 'fitness_center' },
  { screen: 'calendar', label: 'Calendario', icon: 'calendar_month' },
  { screen: 'standings', label: 'Clasificación', icon: 'leaderboard' },
  { screen: 'transfers', label: 'Fichajes', icon: 'swap_horiz' },
]

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`
}

interface Props {
  children: ReactNode
  /** Override background — 'menu' | 'career' (default: 'career') */
  bg?: 'career' | 'menu'
  /** If true, skip rendering the top info + nav bar (for non-career screens) */
  noNav?: boolean
}

export default function GameLayout({ children, bg = 'career', noNav = false }: Props) {
  const devMode = isDevModeActive()
  const navItems = devMode
    ? [...BASE_NAV_ITEMS, { screen: 'debug' as Screen, label: 'Debug', icon: 'bug_report' }]
    : BASE_NAV_ITEMS

  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const uiPanel = useCareerStore((s) => s.uiPanel)
  const setUIPanel = useCareerStore((s) => s.setUIPanel)
  const { prefs } = useNotificationPreferences()

  const unreadCount = career?.inbox.filter((e) => !e.read && prefs[e.type]).length ?? 0
  const bellActive = uiPanel === 'notifications'
  const gearActive = uiPanel === 'settings'

  const userTeam = career ? teams.find((t) => t.id === career.teamId) : null

  return (
    <div className={`h-full flex flex-col overflow-hidden ${bg === 'menu' ? 'bg-menu' : 'bg-game'}`}>
      {/* ── Overlay to darken background ── */}
      <div className="absolute inset-0 bg-dark-900/60 pointer-events-none" />

      {/* ── Content above overlay ── */}
      <div className="relative flex flex-col h-full overflow-hidden">

        {!noNav && career && (
          <>
            {/* Top info bar */}
            <div className="shrink-0 min-h-[54px] bg-[#0b0b12] border-b-2 border-gold-600/70 px-5 py-2 flex items-center justify-between gap-5 shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
              {/* Left: badge + team name */}
              <div className="flex items-center gap-3 min-w-0">
                {userTeam?.badgeUrl && (
                  <TeamBadgeImage teamName={userTeam.name} badgeUrl={userTeam.badgeUrl} size="overlay" className="shrink-0" />
                )}
                <span className="text-gold-400 font-pixel text-[0.5rem] truncate uppercase tracking-wider">
                  {userTeam?.name ?? ''}
                </span>
              </div>

              {/* Center: season + date */}
              <div className="flex items-center gap-5 text-[0.5rem] font-pixel text-gray-200 uppercase tracking-widest">
                <span>Temp. {career.seasonNumber}</span>
                <span className="text-gold-500">{formatDate(career.season.currentDate)}</span>
              </div>

              {/* Right: budget + actions */}
              <div className="flex items-center gap-3.5">
                <span className="text-gold-400 font-pixel text-[0.5rem] uppercase tracking-wide">
                  {formatMoney(teams.find((t) => t.id === career.teamId)?.budget ?? 0)}
                </span>

                {/* Bell */}
                <button
                  onClick={() => setUIPanel(bellActive ? null : 'notifications')}
                  className={`relative p-2 rounded-md transition-colors border ${
                    bellActive
                      ? 'bg-gold-500/20 border-gold-500 text-gold-400'
                      : 'border-gold-600/30 text-gray-500 hover:border-gold-500 hover:text-gold-400'
                  }`}
                  aria-label="Notificaciones"
                >
                  <Icon name="notifications" size="sm" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[0.4rem] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Gear */}
                <button
                  onClick={() => setUIPanel(gearActive ? null : 'settings')}
                  className={`p-2 rounded-md transition-colors border ${
                    gearActive
                      ? 'bg-gold-500/20 border-gold-500 text-gold-400'
                      : 'border-gold-600/30 text-gray-500 hover:border-gold-500 hover:text-gold-400'
                  }`}
                  aria-label="Ajustes"
                >
                  <Icon name="settings" size="sm" />
                </button>
              </div>
            </div>

            {/* Horizontal nav tabs */}
            <nav className="shrink-0 w-full min-h-[46px] bg-dark-900 border-b border-gold-600/40 flex overflow-x-auto shadow-[0_5px_16px_rgba(0,0,0,0.22)]">
              {navItems.map(({ screen: s, label, icon }) => {
                const isActive = screen === s
                return (
                  <button
                    key={s}
                    onClick={() => navigate(s)}
                    className={`flex-1 min-w-[108px] flex items-center justify-center gap-2 px-3 py-3 text-[0.5rem] font-pixel uppercase tracking-wide transition-colors border-b-2 border-r border-r-gold-600/10 ${
                      isActive
                        ? 'border-gold-400 text-gold-300 bg-gold-500/15'
                        : 'border-b-transparent text-gray-400 hover:text-gold-400 hover:border-b-gold-600/60 hover:bg-dark-800'
                    }`}
                  >
                    <Icon name={icon} size="sm" />
                    {label}
                  </button>
                )
              })}
            </nav>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
