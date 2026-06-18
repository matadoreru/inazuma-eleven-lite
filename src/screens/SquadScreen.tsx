import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import PlayerRow from '../components/PlayerRow'
import type { PlayerStatus } from '../components/PlayerRow'
import Icon from '../components/Icon'
import { MAX_CALLUP } from '../types/team'
import type { Player, Element } from '../types/player'

type SortKey = 'position' | 'TOT' | 'name'
type SquadFilter = 'all' | 'starters' | 'bench' | 'uncalled'
type PosFilter = 'all' | 'GK' | 'DF' | 'MD' | 'FW'
type ElemFilter = 'all' | Element

const POSITION_ORDER: Record<string, number> = { GK: 0, DF: 1, MD: 2, FW: 3 }

function sortPlayers(players: Player[], key: SortKey): Player[] {
  return [...players].sort((a, b) => {
    if (key === 'position') {
      const posA = POSITION_ORDER[a.position] ?? 99
      const posB = POSITION_ORDER[b.position] ?? 99
      if (posA !== posB) return posA - posB
      return b.stats.TOT - a.stats.TOT
    }
    if (key === 'TOT') return b.stats.TOT - a.stats.TOT
    return a.name.localeCompare(b.name)
  })
}

const SELECT_CLS =
  'panel rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:border-gray-500 cursor-pointer'

function TableHeader() {
  return (
    <thead>
      <tr className="bg-dark-900/60 text-gold-600/80 text-xs border-b border-gold-600/30">
        <th className="py-2 px-3 text-right w-8">#</th>
        <th className="py-2 px-2 w-14" />
        <th className="py-2 px-3 text-left">Jugador</th>
        <th className="py-2 px-3 text-right w-12">TOT</th>
        <th className="py-2 px-3 text-right w-12">POT</th>
        <th className="py-2 px-3 text-right w-12 hidden sm:table-cell">TEC</th>
        <th className="py-2 px-3 text-right w-12 hidden sm:table-cell">FIS</th>
        <th className="py-2 px-3 text-right w-20 hidden md:table-cell">Energía</th>
        <th className="py-2 px-3 w-28" />
      </tr>
    </thead>
  )
}

const posGroups: { key: string; label: string }[] = [
  { key: 'GK', label: 'Porteros' },
  { key: 'DF', label: 'Defensas' },
  { key: 'MD', label: 'Centrocampistas' },
  { key: 'FW', label: 'Delanteros' },
]

export default function SquadScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const selectPlayer = useCareerStore((s) => s.selectPlayer)
  const callUpPlayer = useCareerStore((s) => s.callUpPlayer)
  const removeCallupPlayer = useCareerStore((s) => s.removeCallupPlayer)

  const [sortKey, setSortKey] = useState<SortKey>('position')
  const [squadFilter, setSquadFilter] = useState<SquadFilter>('all')
  const [posFilter, setPosFilter] = useState<PosFilter>('all')
  const [elemFilter, setElemFilter] = useState<ElemFilter>('all')
  const [nameSearch, setNameSearch] = useState('')

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900/80">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)
  const allSquadPlayers = players.filter((p) => p.teamId === career.teamId)

  const starterIds = new Set(
    userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [],
  )
  const benchIds = new Set(
    userTeam?.lineup.filter((s) => !s.isStarter).map((s) => s.playerId) ?? [],
  )
  const calledUpIds = new Set(userTeam?.lineup.map((s) => s.playerId) ?? [])
  const totalCallups = calledUpIds.size

  function getStatus(player: Player): PlayerStatus {
    if (starterIds.has(player.id)) return 'TIT'
    if (benchIds.has(player.id)) return 'SUP'
    return 'NC'
  }

  // Filters
  let filteredPlayers = allSquadPlayers
  if (squadFilter === 'starters') filteredPlayers = filteredPlayers.filter((p) => starterIds.has(p.id))
  else if (squadFilter === 'bench') filteredPlayers = filteredPlayers.filter((p) => benchIds.has(p.id))
  else if (squadFilter === 'uncalled') filteredPlayers = filteredPlayers.filter((p) => !calledUpIds.has(p.id))
  if (posFilter !== 'all') filteredPlayers = filteredPlayers.filter((p) => p.position === posFilter)
  if (elemFilter !== 'all') filteredPlayers = filteredPlayers.filter((p) => p.element === elemFilter)
  if (nameSearch.trim()) {
    const q = nameSearch.trim().toLowerCase()
    filteredPlayers = filteredPlayers.filter((p) => p.name.toLowerCase().includes(q) || p.nameRomaji.toLowerCase().includes(q))
  }

  const squadPlayers = sortPlayers(filteredPlayers, sortKey)

  const uncalledCount = allSquadPlayers.filter((p) => !calledUpIds.has(p.id)).length
  const squadFilterOptions: { key: SquadFilter; label: string }[] = [
    { key: 'all', label: `Todos (${allSquadPlayers.length})` },
    { key: 'starters', label: `Titulares (${starterIds.size})` },
    { key: 'bench', label: `Suplentes (${benchIds.size})` },
    { key: 'uncalled', label: `No conv. (${uncalledCount})` },
  ]

  function handleRowClick(playerId: number) {
    selectPlayer(playerId)
    navigate('player_detail')
  }

  function buildActions(player: Player) {
    const isCalledUp = calledUpIds.has(player.id)
    const isStarter = starterIds.has(player.id)
    if (isStarter) return null
    if (isCalledUp) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); removeCallupPlayer(player.id) }}
          className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-dark-700/60 text-gray-400 border border-gold-600/15 hover:bg-red-900/40 hover:text-red-400 hover:border-red-700/60 transition-colors whitespace-nowrap"
        >
          Desconv.
        </button>
      )
    }
    const disabled = totalCallups >= MAX_CALLUP
    return (
      <button
        onClick={(e) => { e.stopPropagation(); callUpPlayer(player.id) }}
        disabled={disabled}
        className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap
          ${disabled
            ? 'bg-dark-800/60 text-gray-600 border-gold-600/10 cursor-not-allowed'
            : 'bg-blue-900/30 text-gold-400 border-blue-700/50 hover:bg-blue-700/40 hover:text-blue-200'
          }`}
      >
        Convocar
      </button>
    )
  }

  return (
    <GameLayout>
      <div className="h-full flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex-shrink-0 bg-dark-900/80 border-b border-gold-600/30 px-4 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap">
                {squadFilterOptions.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSquadFilter(key)}
                    className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors whitespace-nowrap ${
                      squadFilter === key
                        ? 'bg-gold-600/25 text-gold-300 border border-gold-500/60'
                        : 'bg-dark-700/60 border border-gold-600/20 text-gray-400 hover:text-gold-400 hover:border-gold-500/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                <Icon
                  name="how_to_reg"
                  size="xs"
                  className={totalCallups >= MAX_CALLUP ? 'text-amber-400' : 'text-gray-500'}
                />
                <span className={`text-xs font-semibold tabular-nums ${
                  totalCallups >= MAX_CALLUP ? 'text-amber-400' : 'text-gray-500'
                }`}>
                  {totalCallups} / {MAX_CALLUP}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select value={posFilter} onChange={(e) => setPosFilter(e.target.value as PosFilter)} className={SELECT_CLS}>
                <option value="all">Posición</option>
                <option value="GK">Portero</option>
                <option value="DF">Defensa</option>
                <option value="MD">Centrocampista</option>
                <option value="FW">Delantero</option>
              </select>

              <select value={elemFilter} onChange={(e) => setElemFilter(e.target.value as ElemFilter)} className={SELECT_CLS}>
                <option value="all">Elemento</option>
                <option value="FIRE">Fuego</option>
                <option value="WOOD">Bosque</option>
                <option value="WIND">Aire</option>
                <option value="MOUNTAIN">Tierra</option>
              </select>

              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={SELECT_CLS}>
                <option value="position">Ordenar: Posición</option>
                <option value="TOT">Ordenar: Media</option>
                <option value="name">Ordenar: Nombre</option>
              </select>

              <div className="relative flex-1 min-w-32">
                <Icon name="search" size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="Buscar jugador..."
                  className="w-full panel rounded-lg pl-8 pr-8 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                {nameSearch && (
                  <button onClick={() => setNameSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <Icon name="close" size="xs" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-y-auto p-3">
            {squadPlayers.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-12">No hay jugadores con esos filtros</p>
            ) : sortKey === 'position' ? (
              posGroups.map(({ key, label }) => {
                const group = squadPlayers.filter((p) => p.position === key)
                if (group.length === 0) return null
                return (
                  <div key={key} className="mb-3">
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{label}</span>
                      <span className="text-gray-700 text-xs">({group.length})</span>
                    </div>
                    <div className="panel rounded-xl overflow-hidden">
                      <table className="w-full">
                        <TableHeader />
                        <tbody>
                          {group.map((player) => (
                            <PlayerRow
                              key={player.id}
                              player={player}
                              onClick={() => handleRowClick(player.id)}
                              actions={buildActions(player)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="panel rounded-xl overflow-hidden">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    {squadPlayers.map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        onClick={() => handleRowClick(player.id)}
                        actions={buildActions(player)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
    </GameLayout>
  )
}
