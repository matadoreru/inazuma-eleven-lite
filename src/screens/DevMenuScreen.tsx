import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { disableDevMode } from '../services/profileService'
import Icon from '../components/Icon'
import DevProfilesScreen from './DevProfilesScreen'

type DevTab = 'profiles' | 'players' | 'teams' | 'leagues'

export default function DevMenuScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<DevTab>('profiles')

  function handleDisableDev() {
    disableDevMode()
    navigate('main_menu')
  }

  return (
    <div className="h-full flex flex-col bg-dark-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <button
            onClick={() => navigate('main_menu')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <Icon name="arrow_back" size="sm" />
            Volver
          </button>
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-orange-600/20 text-orange-400 uppercase tracking-wider">
              DEV
            </span>
            <span className="text-white font-bold text-sm">Menú de Desarrollador</span>
          </div>
          <button
            onClick={handleDisableDev}
            className="text-red-500 hover:text-red-400 text-xs transition-colors"
          >
            Desactivar
          </button>
        </div>

        <div className="flex border-b border-gray-800 shrink-0 overflow-x-auto">
          {(['profiles', 'players', 'teams', 'leagues'] as const).map((tab) => {
            const labels = { profiles: 'Perfiles', players: 'Jugadores', teams: 'Equipos', leagues: 'Ligas' }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  activeTab === tab
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profiles' && <DevProfilesScreen />}
          {activeTab === 'players' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de jugadores</div>}
          {activeTab === 'teams' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de equipos</div>}
          {activeTab === 'leagues' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de ligas</div>}
        </div>
    </div>
  )
}
