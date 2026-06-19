import { useState, useEffect } from 'react'
import type { League } from '../types/competition'
import type { Team } from '../types/team'
import { getActiveProfile, updateProfileData } from '../services/profileService'

// ─── helpers ────────────────────────────────────────────────────────────────

function defaultLeague(): League {
  return {
    id: `liga-${Date.now()}`,
    name: 'Nueva liga',
    level: 1,
    promotionTo: null,
    relegationTo: null,
    promotionSlots: 0,
    relegationSlots: 0,
    teamsCount: 8,
    rounds: 14,
  }
}

// ─── constants ───────────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full bg-dark-700 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500'
const LABEL_CLS = 'block text-gray-400 text-xs mb-0.5'

// ─── LeagueForm ──────────────────────────────────────────────────────────────

interface LeagueFormProps {
  data: League
  onChange: (updated: League) => void
  onSave: () => void
  onCancel: () => void
}

function LeagueForm({ data, onChange, onSave, onCancel }: LeagueFormProps) {
  return (
    <div className="bg-dark-800 border border-gray-700/50 rounded-lg mx-3 my-2 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">

        {/* Left column */}
        <div className="space-y-2">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Identificación</p>

          <div>
            <label className={LABEL_CLS}>ID</label>
            <input
              type="text"
              value={data.id}
              onChange={e => onChange({ ...data, id: e.target.value })}
              className={INPUT_CLS}
              placeholder="ej: liga-principal"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Nombre</label>
            <input
              type="text"
              value={data.name}
              onChange={e => onChange({ ...data, name: e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Nivel</label>
            <input
              type="number"
              min="1"
              value={data.level}
              onChange={e => onChange({ ...data, level: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Ascenso a (ID liga)</label>
            <input
              type="text"
              value={data.promotionTo ?? ''}
              onChange={e => onChange({ ...data, promotionTo: e.target.value || null })}
              className={INPUT_CLS}
              placeholder="— ninguna —"
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Descenso a (ID liga)</label>
            <input
              type="text"
              value={data.relegationTo ?? ''}
              onChange={e => onChange({ ...data, relegationTo: e.target.value || null })}
              className={INPUT_CLS}
              placeholder="— ninguna —"
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Estructura</p>

          <div>
            <label className={LABEL_CLS}>Plazas de ascenso</label>
            <input
              type="number"
              min="0"
              value={data.promotionSlots}
              onChange={e => onChange({ ...data, promotionSlots: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Plazas de descenso</label>
            <input
              type="number"
              min="0"
              value={data.relegationSlots}
              onChange={e => onChange({ ...data, relegationSlots: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Número de equipos</label>
            <input
              type="number"
              min="2"
              value={data.teamsCount}
              onChange={e => onChange({ ...data, teamsCount: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Jornadas (rounds)</label>
            <input
              type="number"
              min="1"
              value={data.rounds}
              onChange={e => onChange({ ...data, rounds: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

// ─── DevLeaguesScreen ────────────────────────────────────────────────────────

export default function DevLeaguesScreen() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [profileId, setProfileId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<League | null>(null)

  function refresh() {
    const p = getActiveProfile()
    if (!p) return
    setProfileId(p.id)
    setLeagues(p.data.leagues)
    setTeams(p.data.teams)
  }

  useEffect(() => { refresh() }, [])

  function handleSave() {
    if (!formData || !profileId) return
    const oldId = editingId !== 'new' ? editingId : null
    let nextLeagues: League[]
    let nextTeams = teams
    if (editingId === 'new') {
      nextLeagues = [...leagues, formData]
    } else {
      nextLeagues = leagues.map(l => l.id === oldId ? formData : l)
      if (oldId && formData.id !== oldId) {
        nextTeams = teams.map(t => t.leagueId === oldId ? { ...t, leagueId: formData.id } : t)
      }
    }
    updateProfileData(profileId, { leagues: nextLeagues, teams: nextTeams })
    refresh()
    setEditingId(null)
    setFormData(null)
  }

  function handleDelete(id: string) {
    const nextLeagues = leagues.filter(l => l.id !== id)
    const nextTeams = teams.map(t => t.leagueId === id ? { ...t, leagueId: '' } : t)
    updateProfileData(profileId, { leagues: nextLeagues, teams: nextTeams })
    if (editingId === id) { setEditingId(null); setFormData(null) }
    refresh()
  }

  function handleEdit(league: League) {
    if (editingId === league.id) {
      setEditingId(null); setFormData(null)
    } else {
      setEditingId(league.id)
      setFormData(JSON.parse(JSON.stringify(league)))
    }
  }

  function handleNew() {
    setEditingId('new')
    setFormData(defaultLeague())
  }

  function handleCancel() {
    setEditingId(null)
    setFormData(null)
  }

  const filtered = leagues.filter(l =>
    search === '' ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <input
          type="text"
          placeholder="Buscar por nombre o ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-dark-700 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <span className="text-gray-500 text-xs shrink-0">{leagues.length} ligas</span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium shrink-0 transition-colors"
        >
          + Nueva liga
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">

        {/* New league form at top */}
        {editingId === 'new' && formData && (
          <LeagueForm
            data={formData}
            onChange={setFormData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}

        {filtered.length === 0 && (
          <p className="p-6 text-gray-500 text-sm text-center">
            {search ? 'Sin resultados.' : 'No hay ligas en este perfil.'}
          </p>
        )}

        {filtered.map(league => (
          <div key={league.id}>
            {/* League row */}
            <div className="flex items-center px-4 py-2.5 border-b border-gray-800/50 gap-3 hover:bg-dark-800/30">
              <span className="text-blue-400 text-xs font-mono shrink-0">{league.id}</span>
              <span className="text-white text-sm flex-1 min-w-0 truncate">{league.name}</span>
              <span className="text-gray-400 text-xs shrink-0">L{league.level}</span>
              <span className="text-gray-500 text-xs shrink-0">{league.teamsCount} equipos</span>
              <button
                onClick={() => handleEdit(league)}
                className="text-blue-400 hover:text-blue-300 text-xs shrink-0 px-1.5 py-0.5"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(league.id)}
                className="text-red-500 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5"
              >
                ×
              </button>
            </div>

            {/* Inline edit form */}
            {editingId === league.id && formData && (
              <LeagueForm
                data={formData}
                onChange={setFormData}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
