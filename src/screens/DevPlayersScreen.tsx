import { useState, useEffect } from 'react'
import type { Player, Stats, Technique, Position, Element, Gender, CanonTier } from '../types/player'
import { statTotal } from '../types/player'
import { getActiveProfile, updateProfileData } from '../services/profileService'
import type { Team } from '../types/team'
import PositionSprite from '../components/PositionSprite'
import ElementBadge from '../components/ElementBadge'
import TeamBadgeImage from '../components/TeamBadgeImage'

// ─── helpers ────────────────────────────────────────────────────────────────

function nextId(arr: Player[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map(p => p.id)) + 1
}

function defaultPlayer(): Player {
  return {
    id: 0,
    name: 'Nuevo jugador',
    nameRomaji: 'New Player',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'WIND',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 99,
      potential: 70,
      growthRate: 1,
      contractStatus: 'free',
      marketValue: 100000,
      salary: 5000,
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: null,
      positionChangePlan: null,
    },
    techniques: [],
    improvementTechniques: [],
    spriteUrl: '',
    stamina: 100,
    morale: 80,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 18,
    teamId: null,
    jerseyNumber: 0,
    canonTier: 'common',
    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  }
}

// ─── PlayerForm ──────────────────────────────────────────────────────────────

interface PlayerFormProps {
  data: Player
  teams: Team[]
  onChange: (updated: Player) => void
  onSave: () => void
  onCancel: () => void
}

const INPUT_CLS = 'w-full bg-dark-700 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500'
const LABEL_CLS = 'block text-gray-400 text-xs mb-0.5'

const STAT_KEYS: (keyof Stats)[] = ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT']

function newTech(): Technique {
  return { id: Date.now(), name: '', type: 'Tiro', element: 'FIRE', POT: 50, PP: 5 }
}

function PlayerForm({ data, teams, onChange, onSave, onCancel }: PlayerFormProps) {
  function updateTech(idx: number, field: keyof Technique, value: string | number) {
    const techs = [...(data.techniques ?? [])]
    techs[idx] = { ...techs[idx], [field]: value }
    onChange({ ...data, techniques: techs })
  }

  function addTech() {
    onChange({ ...data, techniques: [...(data.techniques ?? []), newTech()] })
  }

  function removeTech(idx: number) {
    const techs = (data.techniques ?? []).filter((_, i) => i !== idx)
    onChange({ ...data, techniques: techs })
  }

  function updateImproveTech(idx: number, field: keyof Technique, value: string | number) {
    const techs = [...(data.improvementTechniques ?? [])]
    techs[idx] = { ...techs[idx], [field]: value }
    onChange({ ...data, improvementTechniques: techs })
  }

  function addImproveTech() {
    onChange({
      ...data,
      improvementTechniques: [
        ...(data.improvementTechniques ?? []),
        { ...newTech(), type: 'Mejora' },
      ],
    })
  }

  function removeImproveTech(idx: number) {
    const techs = (data.improvementTechniques ?? []).filter((_, i) => i !== idx)
    onChange({ ...data, improvementTechniques: techs })
  }

  const normalTechs = data.techniques ?? []
  const improveTechs = data.improvementTechniques ?? []

  return (
    <div className="bg-dark-800 border border-gray-700/50 rounded-lg mx-3 my-2 p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">

        {/* Left column — Basic info */}
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
            <label className={LABEL_CLS}>Nombre romaji</label>
            <input
              type="text"
              value={data.nameRomaji}
              onChange={e => onChange({ ...data, nameRomaji: e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Edad</label>
            <input
              type="number"
              min="15"
              max="99"
              value={data.age}
              onChange={e => onChange({ ...data, age: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Género</label>
            <select
              value={data.gender}
              onChange={e => onChange({ ...data, gender: e.target.value as Gender })}
              className={INPUT_CLS}
            >
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>Posición</label>
            <select
              value={data.position}
              onChange={e => onChange({ ...data, position: e.target.value as Position })}
              className={INPUT_CLS}
            >
              <option value="GK">GK</option>
              <option value="DF">DF</option>
              <option value="MD">MD</option>
              <option value="FW">FW</option>
            </select>
            <div className="flex items-center gap-2 mt-1">
              <PositionSprite position={data.position} size={24} />
              <span className="text-gray-500 text-xs">{data.position}</span>
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Posición alternativa</label>
            <select
              value={data.positionAlt ?? ''}
              onChange={e => onChange({ ...data, positionAlt: (e.target.value || null) as Position | null })}
              className={INPUT_CLS}
            >
              <option value="">— ninguna</option>
              <option value="GK">GK</option>
              <option value="DF">DF</option>
              <option value="MD">MD</option>
              <option value="FW">FW</option>
            </select>
            {data.positionAlt && (
              <div className="flex items-center gap-2 mt-1">
                <PositionSprite position={data.positionAlt} size={20} className="opacity-70" />
                <span className="text-gray-500 text-xs">{data.positionAlt}</span>
              </div>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>Elemento</label>
            <select
              value={data.element}
              onChange={e => onChange({ ...data, element: e.target.value as Element })}
              className={INPUT_CLS}
            >
              <option value="FIRE">FIRE</option>
              <option value="WOOD">WOOD</option>
              <option value="WIND">WIND</option>
              <option value="MOUNTAIN">MOUNTAIN</option>
            </select>
          </div>

          <div>
            <label className={LABEL_CLS}>Tier</label>
            <div className="flex gap-1 flex-wrap">
              {(['common', 'rare', 'epic', 'legendary'] as const).map(tier => {
                const colors: Record<string, string> = {
                  common: 'bg-gray-600/40 text-gray-200 border-gray-500',
                  rare: 'bg-blue-600/40 text-blue-200 border-blue-500',
                  epic: 'bg-purple-600/40 text-purple-200 border-purple-500',
                  legendary: 'bg-yellow-500/40 text-yellow-200 border-yellow-400',
                }
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => onChange({ ...data, canonTier: tier })}
                    className={`px-2 py-0.5 rounded border text-xs font-semibold transition-opacity ${colors[tier]} ${data.canonTier === tier ? 'opacity-100 ring-1 ring-current' : 'opacity-40'}`}
                  >
                    {tier}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Dorsal</label>
            <input
              type="number"
              min="0"
              max="99"
              value={data.jerseyNumber}
              onChange={e => onChange({ ...data, jerseyNumber: +e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Equipo</label>
            <select
              value={data.teamId ?? ''}
              onChange={e => onChange({ ...data, teamId: e.target.value === '' ? null : +e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">— agente libre —</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {data.teamId != null && (() => {
              const t = teams.find(t => t.id === data.teamId)
              return t ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <TeamBadgeImage teamName={t.name} badgeUrl={t.badgeUrl} size="sm" />
                  <span className="text-gray-400 text-xs">{t.name}</span>
                </div>
              ) : null
            })()}
          </div>

          <div>
            <label className={LABEL_CLS}>Sprite URL</label>
            <input
              type="text"
              value={data.spriteUrl}
              onChange={e => onChange({ ...data, spriteUrl: e.target.value })}
              className={INPUT_CLS}
            />
            {data.spriteUrl && (
              <img
                src={data.spriteUrl}
                alt="preview"
                className="mt-1 w-16 h-16 object-contain rounded bg-dark-700"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        </div>

        {/* Right column — Career + Stats */}
        <div className="space-y-2">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Carrera</p>

          <div>
            <label className={LABEL_CLS}>Nivel máx.</label>
            <input
              type="number"
              min="1"
              max="99"
              value={data.career.maxLevel}
              onChange={e => onChange({ ...data, career: { ...data.career, maxLevel: +e.target.value } })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Potencial</label>
            <input
              type="number"
              min="1"
              max="99"
              value={data.career.potential}
              onChange={e => onChange({ ...data, career: { ...data.career, potential: +e.target.value } })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Valor de mercado</label>
            <input
              type="number"
              min="0"
              value={data.career.marketValue}
              onChange={e => onChange({ ...data, career: { ...data.career, marketValue: +e.target.value } })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Salario</label>
            <input
              type="number"
              min="0"
              value={data.career.salary}
              onChange={e => onChange({ ...data, career: { ...data.career, salary: +e.target.value } })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Estado contrato</label>
            <select
              value={data.career.contractStatus}
              onChange={e => onChange({ ...data, career: { ...data.career, contractStatus: e.target.value as 'free' | 'contracted' } })}
              className={INPUT_CLS}
            >
              <option value="free">Libre</option>
              <option value="contracted">Contratado</option>
            </select>
          </div>

          {/* Stats */}
          <div className="pt-2">
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Estadísticas</p>
            <div className="space-y-1">
              {STAT_KEYS.map(stat => (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-8">{stat}</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={data.stats[stat as keyof Stats]}
                    onChange={e => {
                      const newStats = { ...data.stats, [stat]: +e.target.value }
                      const newTOT = Math.round((newStats.POT + newStats.CON + newStats.TEC + newStats.PRE + newStats.FIS + newStats.AGI + newStats.INT) / 7)
                      onChange({ ...data, stats: { ...newStats, TOT: newTOT } })
                    }}
                    className="w-16 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
                <span className="text-gray-300 text-xs font-semibold w-8">Media</span>
                <span className="text-blue-300 text-sm font-bold">
                  {Math.round((data.stats.POT + data.stats.CON + data.stats.TEC + data.stats.PRE + data.stats.FIS + data.stats.AGI + data.stats.INT) / 7)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Techniques section */}
      <div className="border-t border-gray-800 pt-3 space-y-3">
        {/* Normal techniques */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Técnicas ({normalTechs.length}/3)</p>
            <button
              onClick={addTech}
              disabled={normalTechs.length >= 3}
              className="text-xs px-2 py-0.5 rounded bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Añadir técnica
            </button>
          </div>
          <div className="space-y-2">
            {normalTechs.map((tech, idx) => (
              <div key={tech.id} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={tech.name}
                  onChange={e => updateTech(idx, 'name', e.target.value)}
                  className="flex-1 min-w-0 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <select
                  value={tech.type}
                  onChange={e => updateTech(idx, 'type', e.target.value)}
                  className="bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Tiro">Tiro</option>
                  <option value="Regate">Regate</option>
                  <option value="Bloqueo">Bloqueo</option>
                  <option value="Parada">Parada</option>
                </select>
                <select
                  value={tech.element}
                  onChange={e => updateTech(idx, 'element', e.target.value)}
                  className="bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">— ninguno</option>
                  <option value="FIRE">FIRE</option>
                  <option value="WOOD">WOOD</option>
                  <option value="WIND">WIND</option>
                  <option value="MOUNTAIN">MOUNTAIN</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={tech.POT}
                  onChange={e => updateTech(idx, 'POT', +e.target.value)}
                  className="w-16 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                  placeholder="POT"
                />
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={tech.PP}
                  onChange={e => updateTech(idx, 'PP', +e.target.value)}
                  className="w-12 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                  placeholder="PP"
                />
                <button
                  onClick={() => removeTech(idx)}
                  className="text-red-500 hover:text-red-400 text-sm px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement techniques */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Técnicas de mejora ({improveTechs.length}/2)</p>
            <button
              onClick={addImproveTech}
              disabled={improveTechs.length >= 2}
              className="text-xs px-2 py-0.5 rounded bg-purple-700/30 hover:bg-purple-700/50 text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Añadir técnica de mejora
            </button>
          </div>
          <div className="space-y-2">
            {improveTechs.map((tech, idx) => (
              <div key={tech.id} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={tech.name}
                  onChange={e => updateImproveTech(idx, 'name', e.target.value)}
                  className="flex-1 min-w-0 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-500 text-xs px-2 py-0.5 bg-dark-700 border border-gray-700 rounded">Mejora</span>
                <select
                  value={tech.element}
                  onChange={e => updateImproveTech(idx, 'element', e.target.value)}
                  className="bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">— ninguno</option>
                  <option value="FIRE">FIRE</option>
                  <option value="WOOD">WOOD</option>
                  <option value="WIND">WIND</option>
                  <option value="MOUNTAIN">MOUNTAIN</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={tech.POT}
                  onChange={e => updateImproveTech(idx, 'POT', +e.target.value)}
                  className="w-16 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                  placeholder="POT"
                />
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={tech.PP}
                  onChange={e => updateImproveTech(idx, 'PP', +e.target.value)}
                  className="w-12 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                  placeholder="PP"
                />
                <button
                  onClick={() => removeImproveTech(idx)}
                  className="text-red-500 hover:text-red-400 text-sm px-1"
                >
                  ×
                </button>
              </div>
            ))}
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

// ─── DevPlayersScreen ────────────────────────────────────────────────────────

export default function DevPlayersScreen() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [profileId, setProfileId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [formData, setFormData] = useState<Player | null>(null)

  function refresh() {
    const p = getActiveProfile()
    if (!p) return
    setProfileId(p.id)
    setPlayers(p.data.players)
    setTeams(p.data.teams)
  }

  useEffect(() => { refresh() }, [])

  function handleSave() {
    if (!formData || !profileId) return
    let next: Player[]
    if (editingId === 'new') {
      next = [...players, { ...formData, id: nextId(players) }]
    } else {
      next = players.map(p => p.id === formData.id ? formData : p)
    }
    updateProfileData(profileId, { players: next })
    refresh()
    setEditingId(null)
    setFormData(null)
  }

  function handleDelete(id: number) {
    const next = players.filter(p => p.id !== id)
    updateProfileData(profileId, { players: next })
    if (editingId === id) { setEditingId(null); setFormData(null) }
    refresh()
  }

  function handleDuplicate(player: Player) {
    const copy: Player = {
      ...JSON.parse(JSON.stringify(player)),
      id: nextId(players),
      name: `Copia de ${player.name}`,
    }
    updateProfileData(profileId, { players: [...players, copy] })
    refresh()
  }

  function handleEdit(player: Player) {
    if (editingId === player.id) {
      setEditingId(null); setFormData(null)
    } else {
      setEditingId(player.id)
      setFormData(JSON.parse(JSON.stringify(player)))
    }
  }

  function handleNew() {
    setEditingId('new')
    setFormData(defaultPlayer())
  }

  const filtered = players.filter(p =>
    search === '' ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.nameRomaji.toLowerCase().includes(search.toLowerCase())
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
        <span className="text-gray-500 text-xs shrink-0">{players.length} jugadores</span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium shrink-0 transition-colors"
        >
          + Nuevo jugador
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">

        {/* New player form at top */}
        {editingId === 'new' && formData && (
          <PlayerForm
            data={formData}
            teams={teams}
            onChange={setFormData}
            onSave={handleSave}
            onCancel={() => { setEditingId(null); setFormData(null) }}
          />
        )}

        {filtered.length === 0 && (
          <p className="p-6 text-gray-500 text-sm text-center">
            {search ? 'Sin resultados.' : 'No hay jugadores en este perfil.'}
          </p>
        )}

        {filtered.map(player => (
          <div key={player.id}>
            {/* Player row */}
            <div
              onClick={() => handleEdit(player)}
              className={`flex items-center px-4 py-2.5 border-b border-gray-800/50 gap-3 cursor-pointer transition-colors ${editingId === player.id ? 'bg-dark-800/60' : 'hover:bg-dark-800/30'}`}
            >
              <img
                src={player.spriteUrl}
                alt={player.name}
                className="w-9 h-9 object-contain shrink-0 rounded"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E%3Crect width='36' height='36' rx='4' fill='%234b5563'/%3E%3C/svg%3E" }}
              />
              <span className="text-gray-600 text-xs w-6 shrink-0">#{player.jerseyNumber}</span>
              <span className="text-white text-sm flex-1 min-w-0 truncate">{player.name}</span>
              <span className="text-gray-500 text-xs shrink-0">{player.nameRomaji}</span>
              <PositionSprite position={player.position} size={20} className="shrink-0" />
              <ElementBadge element={player.element} size="xs" />
              <span className="text-blue-300 text-xs font-bold shrink-0 tabular-nums">{player.stats.TOT}</span>
              {(() => {
                const tierColors: Record<string, string> = { common: 'bg-gray-500', rare: 'bg-blue-500', epic: 'bg-purple-500', legendary: 'bg-yellow-400' }
                return <span className={`w-2 h-2 rounded-full shrink-0 ${tierColors[player.canonTier] ?? 'bg-gray-600'}`} title={player.canonTier} />
              })()}
              <button
                onClick={e => { e.stopPropagation(); handleDuplicate(player) }}
                className="text-gray-400 hover:text-white text-xs shrink-0 px-1.5 py-0.5 rounded hover:bg-gray-800"
              >
                Dupl
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(player.id) }}
                className="text-red-500 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5 rounded hover:bg-red-900/20"
              >
                ×
              </button>
            </div>

            {/* Inline edit form */}
            {editingId === player.id && formData && (
              <PlayerForm
                data={formData}
                teams={teams}
                onChange={setFormData}
                onSave={handleSave}
                onCancel={() => { setEditingId(null); setFormData(null) }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
