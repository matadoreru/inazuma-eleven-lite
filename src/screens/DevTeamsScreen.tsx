import { useState, useEffect } from 'react'
import type { Team } from '../types/team'
import type { League } from '../types/competition'
import { formations as seedFormations } from '../data/formations'
import { getActiveProfile, updateProfileData } from '../services/profileService'
import { formatMoney } from '../utils/formatMoney'

// ─── helpers ────────────────────────────────────────────────────────────────

function nextId(arr: Team[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map(t => t.id)) + 1
}

function defaultTeam(leagueList: League[]): Team {
  return {
    id: 0,
    name: 'Nuevo equipo',
    tier: 3,
    reputation: 50,
    budget: 500000,
    leagueId: leagueList[0]?.id ?? '',
    captainId: 0,
    keyPlayerId: undefined,
    badgeUrl: undefined,
    formation: seedFormations[0],
    lineup: [],
    playerIds: [],
    scoutLevel: 2,
    facilitiesLevel: 2,
  }
}

// ─── constants ───────────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full bg-dark-700 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500'
const LABEL_CLS = 'block text-gray-400 text-xs mb-0.5'

// ─── TeamForm ────────────────────────────────────────────────────────────────

interface TeamFormProps {
  data: Team
  leagues: League[]
  onChange: (updated: Team) => void
  onSave: () => void
  onCancel: () => void
}

function TeamForm({ data, leagues, onChange, onSave, onCancel }: TeamFormProps) {
  return (
    <div className="bg-dark-800 border border-gray-700/50 rounded-lg mx-3 my-2 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">

        {/* Left column */}
        <div className="space-y-2">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Información básica</p>

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
            <label className={LABEL_CLS}>Liga</label>
            <select
              value={data.leagueId}
              onChange={e => onChange({ ...data, leagueId: e.target.value })}
              className={INPUT_CLS}
            >
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name} (L{l.level})</option>
              ))}
              {leagues.length === 0 && (
                <option value="">— sin ligas —</option>
              )}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>Tier</label>
            <input
              type="number"
              min="1"
              max="10"
              value={data.tier}
              onChange={e => onChange({ ...data, tier: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Reputación</label>
            <input
              type="number"
              min="1"
              max="100"
              value={data.reputation}
              onChange={e => onChange({ ...data, reputation: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Recursos</p>

          <div>
            <label className={LABEL_CLS}>Presupuesto</label>
            <input
              type="number"
              min="0"
              value={data.budget}
              onChange={e => onChange({ ...data, budget: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Nivel de ojeadores</label>
            <input
              type="number"
              min="1"
              max="5"
              value={data.scoutLevel ?? 2}
              onChange={e => onChange({ ...data, scoutLevel: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Nivel de instalaciones</label>
            <input
              type="number"
              min="1"
              max="5"
              value={data.facilitiesLevel ?? 2}
              onChange={e => onChange({ ...data, facilitiesLevel: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Badge URL</label>
            <input
              type="text"
              value={data.badgeUrl ?? ''}
              onChange={e => onChange({ ...data, badgeUrl: e.target.value || undefined })}
              className={INPUT_CLS}
              placeholder="https://..."
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

// ─── DevTeamsScreen ──────────────────────────────────────────────────────────

export default function DevTeamsScreen() {
  const [teams, setTeams] = useState<Team[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [profileId, setProfileId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [formData, setFormData] = useState<Team | null>(null)

  function refresh() {
    const p = getActiveProfile()
    if (!p) return
    setProfileId(p.id)
    setTeams(p.data.teams)
    setLeagues(p.data.leagues)
  }

  useEffect(() => { refresh() }, [])

  function handleSave() {
    if (!formData || !profileId) return
    let next: Team[]
    if (editingId === 'new') {
      next = [...teams, { ...formData, id: nextId(teams) }]
    } else {
      next = teams.map(t => t.id === formData.id ? formData : t)
    }
    updateProfileData(profileId, { teams: next })
    refresh()
    setEditingId(null)
    setFormData(null)
  }

  function handleDelete(id: number) {
    const next = teams.filter(t => t.id !== id)
    updateProfileData(profileId, { teams: next })
    if (editingId === id) { setEditingId(null); setFormData(null) }
    refresh()
  }

  function handleDuplicate(team: Team) {
    const copy: Team = {
      ...JSON.parse(JSON.stringify(team)),
      id: nextId(teams),
      name: `Copia de ${team.name}`,
    }
    updateProfileData(profileId, { teams: [...teams, copy] })
    refresh()
  }

  function handleEdit(team: Team) {
    if (editingId === team.id) {
      setEditingId(null); setFormData(null)
    } else {
      setEditingId(team.id)
      setFormData(JSON.parse(JSON.stringify(team)))
    }
  }

  function handleNew() {
    setEditingId('new')
    setFormData(defaultTeam(leagues))
  }

  function handleCancel() {
    setEditingId(null)
    setFormData(null)
  }

  const filtered = teams.filter(t =>
    search === '' ||
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-dark-700 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <span className="text-gray-500 text-xs shrink-0">{teams.length} equipos</span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium shrink-0 transition-colors"
        >
          + Nuevo equipo
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">

        {/* New team form at top */}
        {editingId === 'new' && formData && (
          <TeamForm
            data={formData}
            leagues={leagues}
            onChange={setFormData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}

        {filtered.length === 0 && (
          <p className="p-6 text-gray-500 text-sm text-center">
            {search ? 'Sin resultados.' : 'No hay equipos en este perfil.'}
          </p>
        )}

        {filtered.map(team => (
          <div key={team.id}>
            {/* Team row */}
            <div className="flex items-center px-4 py-2.5 border-b border-gray-800/50 gap-3 hover:bg-dark-800/30">
              <span className="text-gray-500 text-xs shrink-0">#{team.id}</span>
              <span className="text-white text-sm flex-1 min-w-0 truncate">{team.name}</span>
              <span className="text-gray-400 text-xs shrink-0">T{team.tier}</span>
              <span className="text-gray-400 text-xs shrink-0">Rep {team.reputation}</span>
              <span className="text-gray-500 text-xs shrink-0">{formatMoney(team.budget)}</span>
              <button
                onClick={() => handleEdit(team)}
                className="text-blue-400 hover:text-blue-300 text-xs shrink-0 px-1.5 py-0.5"
              >
                Editar
              </button>
              <button
                onClick={() => handleDuplicate(team)}
                className="text-gray-400 hover:text-white text-xs shrink-0 px-1.5 py-0.5"
              >
                Dupl
              </button>
              <button
                onClick={() => handleDelete(team.id)}
                className="text-red-500 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5"
              >
                ×
              </button>
            </div>

            {/* Inline edit form */}
            {editingId === team.id && formData && (
              <TeamForm
                data={formData}
                leagues={leagues}
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
