import { useEffect, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import Drawer from './Drawer'
import Icon from './Icon'
import { APP_VERSION } from '../utils/version'
import { MAX_SAVE_SLOTS } from '../types/save'
import type { SaveSlot } from '../types/save'
import { listSaves } from '../services/saveService'
import { formatMoney } from '../utils/formatMoney'

const LANGUAGES = [
  { code: 'es', label: 'Español', available: true },
]

function formatDate(dateStr: string | number): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return String(dateStr)
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-800">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  )
}

export default function SettingsDrawer() {
  const uiPanel = useCareerStore((s) => s.uiPanel)
  const setUIPanel = useCareerStore((s) => s.setUIPanel)
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const saveCareer = useCareerStore((s) => s.saveCareer)
  const exitToMainMenu = useCareerStore((s) => s.exitToMainMenu)

  const [lang, setLang] = useState('es')
  const [saveSlot, setSaveSlot] = useState(0)
  const [saves, setSaves] = useState<SaveSlot[]>(() => listSaves())
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const userTeam = career ? teams.find((t) => t.id === career.teamId) : null
  const selectedSave = saves.find((save) => save.slot === saveSlot) ?? null

  useEffect(() => {
    if (uiPanel === 'settings') setSaves(listSaves())
  }, [uiPanel])

  async function handleQuickSave() {
    if (!career) return
    setSaving(true)
    setSaveError(null)
    setSavedFeedback(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      saveCareer(saveSlot, `${userTeam?.name ?? 'Carrera'} - Temporada ${career.seasonNumber}`)
      setSaves(listSaves())
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
    } catch (error) {
      const isQuotaError = error instanceof DOMException && (
        error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )
      setSaveError(isQuotaError
        ? 'No hay espacio suficiente. Borra una ranura antigua e inténtalo de nuevo.'
        : 'No se pudo guardar la partida. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      isOpen={uiPanel === 'settings'}
      onClose={() => setUIPanel(null)}
      title="Ajustes"
    >
      <div className="px-5 py-4 space-y-6">

        {/* Language */}
        <section>
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Icon name="language" size="xs" />
            Idioma
          </h3>
          <div className="flex flex-col gap-1.5">
            {LANGUAGES.map(({ code, label, available }) => (
              <button
                key={code}
                disabled={!available}
                onClick={() => available && setLang(code)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  lang === code
                    ? 'border-gold-500 bg-gold-500/15 text-gold-200'
                    : available
                    ? 'border-gold-600/20 text-gray-300 hover:border-gold-500/50 hover:text-white'
                    : 'border-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <span className="font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  {!available && (
                    <span className="text-[0.625rem] text-gray-600 uppercase tracking-wide">Próximamente</span>
                  )}
                  {lang === code && <Icon name="check" size="xs" className="text-gold-400" />}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Guardar partida */}
        {career && (
          <section>
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Icon name="save" size="xs" />
              Guardado
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-400 text-sm">Ranura:</span>
              {Array.from({ length: MAX_SAVE_SLOTS }, (_, slot) => slot).map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSaveSlot(slot)}
                  className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                    saveSlot === slot
                      ? 'bg-gold-500 text-dark-900 font-bold'
                      : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                  }`}
                >
                  {slot + 1}
                </button>
              ))}
            </div>

            <div className={`mb-3 rounded-xl border p-3 ${
              selectedSave
                ? 'border-gold-600/40 bg-dark-800'
                : 'border-dashed border-gold-600/30 bg-dark-800'
            }`}>
              {selectedSave ? (
                <div className="flex items-start gap-3">
                  <img
                    src={selectedSave.summary.managerAvatar || '/avatars/avatar-1.svg'}
                    alt={selectedSave.summary.managerName}
                    onError={(event) => { event.currentTarget.src = '/avatars/avatar-1.svg' }}
                    className="w-10 h-10 rounded-full object-cover border border-gold-600/35 bg-dark-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{selectedSave.summary.teamName}</p>
                        <p className="text-gold-400 text-xs truncate">{selectedSave.slotName}</p>
                      </div>
                      <span className="text-[0.625rem] text-gray-400 shrink-0">Ranura {saveSlot + 1}</span>
                    </div>
                    <p className="text-gray-300 text-xs mt-1">
                      {selectedSave.summary.managerName} · Temporada {selectedSave.summary.seasonNumber} · Posición #{selectedSave.summary.leaguePosition}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Fecha de juego: {selectedSave.summary.currentDate} · {formatMoney(selectedSave.summary.budget)}
                    </p>
                    <p className="text-gray-500 text-[0.6875rem] mt-1">
                      Guardado: {formatDate(selectedSave.savedAtUnix)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Icon name="add_circle_outline" size="sm" className="text-gold-500" />
                  <span>Ranura {saveSlot + 1} vacía</span>
                </div>
              )}
            </div>
            <button
              onClick={handleQuickSave}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                savedFeedback
                  ? 'bg-green-700 text-white'
                  : 'bg-gold-600 hover:bg-gold-500 disabled:bg-dark-700 text-dark-900'
              }`}
            >
              <Icon name={savedFeedback ? 'check_circle' : 'save'} size="sm" />
              {saving
                ? 'Guardando...'
                : savedFeedback
                ? 'Guardado!'
                : selectedSave
                ? 'Sobrescribir partida'
                : 'Guardar partida'}
            </button>
            {saveError && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-200">
                <Icon name="error" size="xs" className="mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <button
              onClick={() => exitToMainMenu()}
              className="w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-lg text-red-500 hover:text-red-400 text-sm transition-colors"
            >
              <Icon name="logout" size="xs" />
              Volver al menú principal
            </button>
          </section>
        )}

        {/* Career info */}
        {career && (
          <section>
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Icon name="info" size="xs" />
              Información de la carrera
            </h3>
            <div className="bg-dark-800 rounded-xl px-4 py-1 border border-gold-600/30">
              <InfoRow label="Entrenador" value={career.managerName} />
              <InfoRow label="Equipo" value={userTeam?.name ?? '—'} />
              <InfoRow label="Temporada" value={`${career.seasonNumber}`} />
              <InfoRow label="Fecha en juego" value={career.season.currentDate} />
              <InfoRow label="Último guardado" value={formatDate(career.lastSavedAt)} />
              <InfoRow label="Inicio de carrera" value={formatDate(career.createdAt)} />
            </div>
          </section>
        )}

        {/* App info */}
        <section>
          <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Icon name="sports_soccer" size="xs" />
            Aplicación
          </h3>
          <div className="bg-dark-800 rounded-xl px-4 py-1 border border-gold-600/30">
            <InfoRow label="Juego" value="Inazuma Eleven Lite" />
            <InfoRow label="Versión" value={APP_VERSION} />
          </div>
        </section>

      </div>
    </Drawer>
  )
}
