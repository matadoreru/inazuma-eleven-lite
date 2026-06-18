import type { Screen } from '../App'
import Icon from './Icon'

interface Props {
  currentScreen: Screen
  onNavigate: (screen: Screen) => void
}

interface NavItem {
  screen: Screen
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { screen: 'career_home', label: 'Inicio', icon: 'home' },
  { screen: 'club', label: 'Club', icon: 'shield' },
  { screen: 'squad', label: 'Plantilla', icon: 'groups' },
  { screen: 'formation', label: 'Formación', icon: 'dashboard' },
  { screen: 'training', label: 'Entreno', icon: 'fitness_center' },
  { screen: 'calendar', label: 'Calendario', icon: 'calendar_month' },
  { screen: 'standings', label: 'Clasificación', icon: 'leaderboard' },
  { screen: 'transfers', label: 'Fichajes', icon: 'swap_horiz' },
  { screen: 'scout', label: 'Ojeador', icon: 'search' },
]

export default function SideNavigation({ currentScreen, onNavigate }: Props) {
  return (
    <nav className="bg-gray-900 border-r border-gray-700 flex flex-col py-4 gap-0.5 w-36 shrink-0">
      {NAV_ITEMS.map(({ screen, label, icon }) => {
        const isActive = currentScreen === screen
        return (
          <button
            key={screen}
            onClick={() => onNavigate(screen)}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-left rounded-r-lg mr-2
              ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <Icon name={icon} size="sm" />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
