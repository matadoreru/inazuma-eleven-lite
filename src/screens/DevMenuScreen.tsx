import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { disableDevMode } from '../services/profileService'
import GameLayout from '../components/GameLayout'
import Icon from '../components/Icon'
import DevProfilesScreen from './DevProfilesScreen'

type DevTab = 'profiles'

export default function DevMenuScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const [activeTab, setActiveTab] = useState<DevTab>('profiles')

  function handleDisableDev() {
    disableDevMode()
    navigate('main_menu')
  }

  return (
    <GameLayout bg="menu" noNav>
      <div className="h-full flex flex-col">
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

        <div className="flex border-b border-gray-800 shrink-0">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'profiles'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Perfiles
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profiles' && <DevProfilesScreen />}
        </div>
      </div>
    </GameLayout>
  )
}
