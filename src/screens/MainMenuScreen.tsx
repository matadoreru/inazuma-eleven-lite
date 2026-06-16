import { useEffect, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { listSaves, deleteSave } from '../services/saveService'
import SaveSlotCard from '../components/SaveSlotCard'
import type { SaveSlot } from '../types/save'
import { MAX_SAVE_SLOTS } from '../types/save'

type View = 'menu' | 'load'

export default function MainMenuScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const loadCareer = useCareerStore((s) => s.loadCareer)
  const [view, setView] = useState<View>('menu')
  const [saves, setSaves] = useState<(SaveSlot | null)[]>([])

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

  function handleDelete(slot: number) {
    deleteSave(slot)
    refreshSaves()
  }

  if (view === 'load') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setView('menu')}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              ← Volver
            </button>
            <h2 className="text-white text-2xl font-bold">Cargar Partida</h2>
          </div>
          <div className="flex flex-col gap-3">
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
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-900 gap-10">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <span className="material-icons text-blue-500" style={{ fontSize: 64 }}>sports_soccer</span>
        </div>
        <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">
          Inazuma Eleven Lite
        </h1>
        <p className="text-gray-400 text-lg">Modo Carrera</p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate('new_career')}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xl transition-colors shadow-lg shadow-blue-900/40"
        >
          Nueva Carrera
        </button>
        <button
          onClick={() => setView('load')}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-bold text-xl transition-colors"
        >
          Cargar Partida
        </button>
      </div>
    </div>
  )
}
