import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import Drawer from './Drawer'
import Icon from './Icon'
import { APP_VERSION } from '../utils/version'

const LANGUAGES = [
  { code: 'es', label: 'Español', available: true },
  { code: 'en', label: 'English', available: false },
  { code: 'pt', label: 'Português', available: false },
]

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateStr
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
  const navigate = useCareerStore((s) => s.navigate)
  const saveCareer = useCareerStore((s) => s.saveCareer)
  const exitToMainMenu = useCareerStore((s) => s.exitToMainMenu)

  const [lang, setLang] = useState('es')
  const [saveSlot, setSaveSlot] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)

  const userTeam = career ? teams.find((t) => t.id === career.teamId) : null

  function handleQuickSave() {
    if (!career) return
    setSaving(true)
    saveCareer(saveSlot, `${userTeam?.name ?? 'Carrera'} - Temporada ${career.seasonNumber}`)
    setTimeout(() => {
      setSaving(false)
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
    }, 400)
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
                    ? 'border-blue-500 bg-blue-600/10 text-white'
                    : available
                    ? 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
                    : 'border-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <span className="font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  {!available && (
                    <span className="text-[0.625rem] text-gray-600 uppercase tracking-wide">Próximamente</span>
                  )}
                  {lang === code && <Icon name="check" size="xs" className="text-blue-400" />}
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
              {[0, 1, 2].map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSaveSlot(slot)}
                  className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                    saveSlot === slot
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {slot + 1}
                </button>
              ))}
            </div>
            <button
              onClick={handleQuickSave}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                savedFeedback
                  ? 'bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white'
              }`}
            >
              <Icon name={savedFeedback ? 'check_circle' : 'save'} size="sm" />
              {saving ? 'Guardando...' : savedFeedback ? 'Guardado!' : 'Guardar partida'}
            </button>
            <button
              onClick={() => { setUIPanel(null); navigate('save_load') }}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-400 hover:text-white text-sm transition-colors"
            >
              <Icon name="folder_open" size="xs" />
              Gestionar guardados
            </button>
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
            <div className="bg-gray-800 rounded-xl px-4 py-1 border border-gray-700">
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
          <div className="bg-gray-800 rounded-xl px-4 py-1 border border-gray-700">
            <InfoRow label="Juego" value="Inazuma Eleven Lite" />
            <InfoRow label="Versión" value={APP_VERSION} />
            <InfoRow label="Modo" value="Carrera" />
          </div>
        </section>

      </div>
    </Drawer>
  )
}
