import GameLayout from '../components/GameLayout'
import { useState, useEffect } from 'react'
import { useCareerStore } from '../store/careerStore'
import TeamNameInline from '../components/TeamNameInline'
import { listSaves, deleteSave } from '../services/saveService'
import { formatMoney } from '../utils/formatMoney'
import { MAX_SAVE_SLOTS } from '../types/save'
import type { SaveSlot } from '../types/save'

const fmt = formatMoney

function formatDate(unix: number): string {
  return new Date(unix).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SaveLoadScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const loadCareer = useCareerStore((s) => s.loadCareer)
  const saveCareer = useCareerStore((s) => s.saveCareer)

  const [saves, setSaves] = useState<SaveSlot[]>([])
  const [savingSlot, setSavingSlot] = useState<number | null>(null)
  const [slotName, setSlotName] = useState('')

  const isInGame = career !== null

  useEffect(() => {
    refreshSaves()
  }, [])

  function refreshSaves() {
    setSaves(listSaves())
  }

  function handleLoad(slot: number) {
    loadCareer(slot)
  }

  function handleSave(slot: number) {
    if (!career) return
    const userTeam = teams.find((t) => t.id === career.teamId)
    const name = slotName.trim() || `${userTeam?.name ?? 'Carrera'} — ${career.season.currentDate}`
    saveCareer(slot, name)
    setSavingSlot(null)
    setSlotName('')
    refreshSaves()
  }

  function handleDelete(slot: number) {
    if (!confirm('¿Borrar esta partida guardada?')) return
    deleteSave(slot)
    refreshSaves()
  }

  const savesBySlot = new Map(saves.map((s) => [s.slot, s]))

  const userTeam = career ? teams.find((t) => t.id === career.teamId) : null

  const slots = Array.from({ length: MAX_SAVE_SLOTS }, (_, i) => i)

  const content = (
    <main className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        {!isInGame && (
          <button
            onClick={() => navigate('main_menu')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Volver
          </button>
        )}
        <h1 className="text-white text-2xl font-bold">Guardar / Cargar</h1>
      </div>

      <div className="flex flex-col gap-3 max-w-xl">
        {slots.map((slotIdx) => {
          const save = savesBySlot.get(slotIdx)

          return (
            <div
              key={slotIdx}
              className="bg-dark-800/80 rounded-xl border border-gold-600/15 p-4 border border-gold-600/20"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Slot Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-xs mb-1">
                    Ranura {slotIdx + 1}
                  </p>
                  {save ? (
                    <div>
                      <TeamNameInline
                        teamName={save.summary.teamName}
                        badgeUrl={teams.find((t) => t.name === save.summary.teamName)?.badgeUrl}
                        textClassName="text-white font-semibold"
                      />
                      <p className="text-gray-400 text-xs">
                        Temp. {save.summary.seasonNumber} · Pos. #{save.summary.leaguePosition} ·{' '}
                        {fmt(save.summary.budget)}
                      </p>
                      <p className="text-gray-500 text-xs">{save.summary.currentDate}</p>
                      <p className="text-gray-600 text-xs">{formatDate(save.savedAtUnix)}</p>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm italic">Ranura vacía</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {save && (
                    <button
                      onClick={() => handleLoad(slotIdx)}
                      className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors"
                    >
                      Cargar
                    </button>
                  )}
                  {isInGame && (
                    <button
                      onClick={() => {
                        setSavingSlot(slotIdx)
                        setSlotName('')
                      }}
                      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
                    >
                      Guardar
                    </button>
                  )}
                  {save && (
                    <button
                      onClick={() => handleDelete(slotIdx)}
                      className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>

              {/* Save Name Input */}
              {savingSlot === slotIdx && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={slotName}
                    onChange={(e) => setSlotName(e.target.value)}
                    placeholder="Nombre del guardado (opcional)"
                    className="flex-1 bg-dark-700/80 border border-gold-600/30 rounded-lg px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-gold-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(slotIdx)
                      if (e.key === 'Escape') setSavingSlot(null)
                    }}
                  />
                  <button
                    onClick={() => handleSave(slotIdx)}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setSavingSlot(null)}
                    className="text-xs px-3 py-1.5 bg-dark-700/80 hover:bg-dark-600/80 text-white rounded-lg transition-colors"
                  >
                    X
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )

  if (!isInGame) {
    return (
      <GameLayout noNav>
        {content}
      </GameLayout>
    )
  }

  return (
    <GameLayout>
      {content}
    </GameLayout>
  )
}
