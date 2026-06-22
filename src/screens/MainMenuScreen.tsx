import { useEffect, useRef, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { listSaves, deleteSave } from '../services/saveService'
import SaveSlotCard from '../components/SaveSlotCard'
import GameLayout from '../components/GameLayout'
import type { SaveSlot } from '../types/save'
import { MAX_SAVE_SLOTS } from '../types/save'
import { APP_VERSION } from '../utils/version'
import { isDevModeActive, enableDevMode, init as initProfiles } from '../services/profileService'

type View = 'menu' | 'load'

interface MenuItem {
  label: string
  sublabel: string
  icon: string
  onClick: () => void
}

export default function MainMenuScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const loadCareer = useCareerStore((s) => s.loadCareer)
  const [view, setView] = useState<View>('menu')
  const [saves, setSaves] = useState<(SaveSlot | null)[]>([])
  const [devMode, setDevMode] = useState(() => isDevModeActive())
  const [tapCount, setTapCount] = useState(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    initProfiles()
  }, [])

  function refreshSaves() {
    const filled = listSaves()
    const slots: (SaveSlot | null)[] = Array.from({ length: MAX_SAVE_SLOTS }, (_, i) =>
      filled.find((s) => s.slot === i) ?? null
    )
    setSaves(slots)
  }

  useEffect(() => {
    if (view === 'load') refreshSaves()
  }, [view])

  function handleVersionTap() {
    const next = tapCount + 1
    setTapCount(next)
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => setTapCount(0), 3000)
    if (next >= 5) {
      enableDevMode()
      setDevMode(true)
      setTapCount(0)
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    }
  }

  function handleDelete(slot: number) {
    deleteSave(slot)
    refreshSaves()
  }

  const menuItems: MenuItem[] = [
    {
      label: 'NUEVA CARRERA',
      sublabel: 'Inicia una nueva carrera de manager.',
      icon: 'sports_soccer',
      onClick: () => navigate('new_career'),
    },
    {
      label: 'CARGAR PARTIDA',
      sublabel: 'Carga una carrera guardada.',
      icon: 'save',
      onClick: () => setView('load'),
    },
  ]

  if (view === 'load') {
    return (
      <GameLayout bg="menu" noNav>
        <div className="h-full flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-lg">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setView('menu')}
                className="flex items-center gap-2 text-gold-400 hover:text-gold-300 text-xs font-pixel uppercase tracking-wide transition-colors border border-gold-600/40 hover:border-gold-500 rounded px-3 py-2"
              >
                ← Volver
              </button>
              <h2 className="text-gold-400 font-pixel text-[0.55rem] uppercase tracking-widest">
                Cargar Partida
              </h2>
            </div>
            <div className="panel p-4 flex flex-col gap-3">
              {saves.map((slot, i) => (
                <SaveSlotCard
                  key={i}
                  slot={slot}
                  slotNumber={i}
                  onLoad={() => loadCareer(i)}
                  onDelete={slot ? () => handleDelete(i) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </GameLayout>
    )
  }

  return (
    <GameLayout bg="menu" noNav>
      <div className="relative h-full flex items-center justify-center px-8 gap-10">

        {/* Left: Logo + title */}
        <div className="panel w-[21rem] min-h-[21rem] rounded-[2.5rem] px-8 py-10 flex flex-col items-center justify-center gap-6 shrink-0 bg-dark-900/75">
          <div className="flex items-center justify-center w-24 h-24 rounded-full overflow-hidden bg-dark-800/80 border-2 border-gold-500 shadow-lg shadow-gold-900/30">
            <img src="/icon-menu.png" alt="Inazuma Eleven" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="text-center">
            <h1 className="font-pixel text-gold-400 text-[0.9rem] uppercase tracking-widest leading-loose">
              Inazuma Eleven
            </h1>
            <p className="font-pixel text-gold-600 text-[0.58rem] uppercase tracking-widest mt-1.5">
              ✦ Modo Carrera ✦
            </p>
          </div>
        </div>

        {/* Right: Menu panel */}
        <div className="w-[21rem]">
          <div className="panel min-h-[21rem] rounded-[2.5rem] p-4 flex flex-col gap-4 justify-center">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-4 px-4 py-4 text-left transition-colors border border-gold-600/20 rounded-[1.75rem] group hover:bg-dark-700/50 min-h-[7rem]"
              >
                <div className="w-8 h-8 rounded flex items-center justify-center border shrink-0 border-gold-600/40 bg-dark-700/60 text-gray-400 group-hover:text-gold-400 group-hover:border-gold-500/60">
                  <span className="material-icons" style={{ fontSize: 18 }}>{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-pixel text-[0.52rem] uppercase tracking-wide text-gray-300 group-hover:text-gold-300 leading-relaxed">
                    {item.label}
                  </p>
                  <p className="text-gray-500 text-[0.7rem] mt-1 leading-relaxed">{item.sublabel}</p>
                </div>
                <span className="material-icons text-sm shrink-0 text-gray-600 group-hover:text-gold-600">chevron_right</span>
              </button>
            ))}
            {devMode && (
              <button
                onClick={() => navigate('dev_menu')}
                className="mt-2 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-orange-600/30 text-orange-400 hover:bg-orange-900/20 text-sm font-medium transition-colors"
              >
                <span className="material-icons text-base">developer_mode</span>
                Menú Dev
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Version bottom-right */}
      <button
        onClick={handleVersionTap}
        className="absolute bottom-3 right-4 font-pixel text-gray-400 text-[0.7rem] select-none cursor-default focus:outline-none"
      >
        {devMode && (
          <span className="mr-1.5 px-1.5 py-0.5 rounded text-[0.7rem] font-bold bg-orange-600/20 text-orange-400 uppercase tracking-wider">
            DEV
          </span>
        )}
        {APP_VERSION}
      </button>
    </GameLayout>
  )
}
