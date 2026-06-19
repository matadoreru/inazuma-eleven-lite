import { useState, useEffect, useRef } from 'react'
import type { Profile } from '../types/profile'
import {
  listProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  duplicateProfile,
  renameProfile,
  deleteProfile,
  exportProfile,
  validateAndParseImport,
  importProfile,
  restoreBaseProfile,
} from '../services/profileService'
import Icon from '../components/Icon'

function ProfileTag({ tag }: { tag: Profile['tags'][number] }) {
  const colors: Record<string, string> = {
    base: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    custom: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    debug: 'bg-orange-900/40 text-orange-300 border-orange-700/40',
    experimental: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[0.55rem] font-semibold uppercase tracking-wide border ${colors[tag] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {tag}
    </span>
  )
}

function DataSummary({ data }: { data: Profile['data'] }) {
  return (
    <span className="text-gray-500 text-xs">
      {data.players.length} jugadores · {data.teams.length} equipos · {data.leagues.length} ligas
    </span>
  )
}

export default function DevProfilesScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createTags, setCreateTags] = useState<Profile['tags']>(['custom'])
  const [importError, setImportError] = useState<string | null>(null)
  const [importConflictProfile, setImportConflictProfile] = useState<Profile | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    setProfiles(listProfiles())
    setActiveId(getActiveProfile()?.id ?? null)
  }

  useEffect(() => { refresh() }, [])

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 2500)
  }

  function handleActivate(id: string) {
    setActiveProfile(id)
    refresh()
    showFeedback('Perfil activado.')
  }

  function handleDuplicate(id: string) {
    duplicateProfile(id)
    refresh()
    showFeedback('Perfil duplicado.')
  }

  function handleStartRename(profile: Profile) {
    setRenamingId(profile.id)
    setRenameValue(profile.name)
  }

  function handleConfirmRename(id: string) {
    if (renameValue.trim()) {
      renameProfile(id, renameValue.trim())
      refresh()
    }
    setRenamingId(null)
  }

  function handleDeleteConfirmed() {
    if (!confirmDeleteId) return
    deleteProfile(confirmDeleteId)
    setConfirmDeleteId(null)
    refresh()
    showFeedback('Perfil eliminado.')
  }

  function handleCreate() {
    if (!createName.trim()) return
    createProfile(createName.trim(), createDesc.trim(), createTags)
    setCreating(false)
    setCreateName('')
    setCreateDesc('')
    setCreateTags(['custom'])
    refresh()
    showFeedback('Perfil creado.')
  }

  function handleExport(id: string, name: string) {
    const json = exportProfile(id)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_')}.ielite-profile.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const json = ev.target?.result as string
      const result = validateAndParseImport(json)
      if (!result.ok) {
        setImportError(result.error)
        return
      }
      if (result.idConflict) {
        setImportConflictProfile(result.profile)
        return
      }
      importProfile(result.profile)
      refresh()
      showFeedback('Perfil importado.')
    }
    reader.readAsText(file)
  }

  function handleImportOverwrite() {
    if (!importConflictProfile) return
    importProfile(importConflictProfile, true)
    setImportConflictProfile(null)
    refresh()
    showFeedback('Perfil importado (sobreescrito).')
  }

  function handleRestore() {
    restoreBaseProfile()
    refresh()
    showFeedback('Perfil base restaurado.')
  }

  const confirmDeleteProfile = profiles.find((p) => p.id === confirmDeleteId)

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">

      {/* Feedback toast */}
      {feedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
          {feedback}
        </div>
      )}

      {/* Global actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Icon name="add" size="xs" />
          Nuevo perfil
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700/80 hover:bg-dark-600 border border-gray-700 text-gray-300 text-sm font-medium transition-colors"
        >
          <Icon name="upload" size="xs" />
          Importar
        </button>
        <button
          onClick={handleRestore}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700/80 hover:bg-dark-600 border border-gray-700 text-gray-300 text-sm font-medium transition-colors"
        >
          <Icon name="restore" size="xs" />
          Restaurar base
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.ielite-profile.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {/* Import error */}
      {importError && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 flex items-start gap-2">
          <Icon name="error" size="sm" className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm">{importError}</p>
          </div>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-300">
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      {/* Import conflict modal */}
      {importConflictProfile && (
        <div className="bg-dark-800/90 border border-yellow-700/40 rounded-xl p-4 space-y-3">
          <p className="text-yellow-300 text-sm font-medium">
            Ya existe un perfil con el mismo ID: <strong>{importConflictProfile.name}</strong>
          </p>
          <p className="text-gray-400 text-xs">¿Quieres sobreescribirlo?</p>
          <div className="flex gap-2">
            <button
              onClick={handleImportOverwrite}
              className="px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-medium transition-colors"
            >
              Sobreescribir
            </button>
            <button
              onClick={() => setImportConflictProfile(null)}
              className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="bg-dark-800/70 border border-gold-600/20 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-semibold">Nuevo perfil</p>
          <input
            type="text"
            placeholder="Nombre del perfil"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            maxLength={60}
            className="w-full bg-dark-900/60 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            maxLength={120}
            className="w-full bg-dark-900/60 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div>
            <p className="text-gray-400 text-xs mb-2">Tipo</p>
            <div className="flex gap-2 flex-wrap">
              {(['custom', 'debug', 'experimental'] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setCreateTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    createTags.includes(tag)
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-dark-700/60 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!createName.trim()}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-dark-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
            >
              Crear
            </button>
            <button
              onClick={() => { setCreating(false); setCreateName(''); setCreateDesc(''); setCreateTags(['custom']) }}
              className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteId && confirmDeleteProfile && (
        <div className="bg-dark-800/90 border border-red-700/40 rounded-xl p-4 space-y-3">
          <p className="text-red-300 text-sm font-medium">
            ¿Eliminar el perfil <strong>{confirmDeleteProfile.name}</strong>?
          </p>
          <p className="text-gray-400 text-xs">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteConfirmed}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              Eliminar
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Profile list */}
      <div className="space-y-3">
        {profiles.map((profile) => {
          const isActive = profile.id === activeId
          const isRenaming = renamingId === profile.id
          return (
            <div
              key={profile.id}
              className={`rounded-xl border p-4 transition-colors ${
                isActive
                  ? 'border-green-600/50 bg-green-900/10'
                  : 'border-gray-800 bg-dark-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-bold uppercase tracking-wide bg-green-700/30 text-green-400 border border-green-700/40">
                        Activo
                      </span>
                    )}
                    {profile.tags.map((tag) => (
                      <ProfileTag key={tag} tag={tag} />
                    ))}
                  </div>

                  {isRenaming ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename(profile.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        autoFocus
                        maxLength={60}
                        className="flex-1 bg-dark-900/60 border border-blue-500 rounded-lg px-2.5 py-1 text-white text-sm focus:outline-none"
                      />
                      <button
                        onClick={() => handleConfirmRename(profile.id)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="px-2 py-1 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-400 text-sm transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-white font-semibold text-sm truncate">{profile.name}</p>
                  )}

                  {profile.description && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{profile.description}</p>
                  )}
                  <div className="mt-1.5">
                    <DataSummary data={profile.data} />
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mt-3 flex-wrap">
                {!isActive && (
                  <button
                    onClick={() => handleActivate(profile.id)}
                    className="px-2.5 py-1 rounded-lg bg-green-700/30 hover:bg-green-700/50 border border-green-700/40 text-green-400 text-xs font-medium transition-colors"
                  >
                    Activar
                  </button>
                )}
                <button
                  onClick={() => handleDuplicate(profile.id)}
                  className="px-2.5 py-1 rounded-lg bg-dark-700/60 hover:bg-dark-600 border border-gray-700 text-gray-300 text-xs transition-colors"
                >
                  Duplicar
                </button>
                {!profile.isBuiltIn && !isRenaming && (
                  <button
                    onClick={() => handleStartRename(profile)}
                    className="px-2.5 py-1 rounded-lg bg-dark-700/60 hover:bg-dark-600 border border-gray-700 text-gray-300 text-xs transition-colors"
                  >
                    Renombrar
                  </button>
                )}
                <button
                  onClick={() => handleExport(profile.id, profile.name)}
                  className="px-2.5 py-1 rounded-lg bg-dark-700/60 hover:bg-dark-600 border border-gray-700 text-gray-300 text-xs transition-colors"
                >
                  Exportar
                </button>
                {!profile.isBuiltIn && (
                  <button
                    onClick={() => setConfirmDeleteId(profile.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 text-xs transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
