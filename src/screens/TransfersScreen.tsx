import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TransferPlayerRow from '../components/TransferPlayerRow'
import Icon from '../components/Icon'
import { filterPlayers, calcTransferValue } from '../services/transferService'
import type { Position, Element, Player } from '../types/player'

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GK', 'DF', 'MD', 'FW']
const ELEMENTS: (Element | 'ALL')[] = ['ALL', 'FIRE', 'WOOD', 'WIND', 'MOUNTAIN']

type SortKey = 'name' | 'TOT' | 'valor' | 'equipo'
type SortDir = 'asc' | 'desc'

const SELECT_CLS =
  'bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:border-gray-500 cursor-pointer'

function sortPlayers(players: Player[], key: SortKey, dir: SortDir, teamById: Map<number, { name: string }>): Player[] {
  const sorted = [...players].sort((a, b) => {
    switch (key) {
      case 'TOT': return b.stats.TOT - a.stats.TOT
      case 'valor': return calcTransferValue(b) - calcTransferValue(a)
      case 'equipo': {
        const ta = (a.teamId !== null && a.teamId !== 0) ? (teamById.get(a.teamId)?.name ?? '') : '~Libre'
        const tb = (b.teamId !== null && b.teamId !== 0) ? (teamById.get(b.teamId)?.name ?? '') : '~Libre'
        return ta.localeCompare(tb)
      }
      case 'name': default:
        return a.nameRomaji.localeCompare(b.nameRomaji)
    }
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}

interface SortHeaderProps {
  label: string
  col: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onClick: (col: SortKey) => void
  className?: string
}

function SortHeader({ label, col, currentKey, currentDir, onClick, className = '' }: SortHeaderProps) {
  const active = currentKey === col
  return (
    <th
      className={`py-2 px-3 text-left cursor-pointer select-none hover:text-gray-300 transition-colors ${active ? 'text-white' : 'text-gray-500'} ${className}`}
      onClick={() => onClick(col)}
    >
      <div className="flex items-center gap-0.5">
        <span>{label}</span>
        <span className="material-icons" style={{ fontSize: '14px' }}>
          {active ? (currentDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        </span>
      </div>
    </th>
  )
}

export default function TransfersScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const activeTransferFilter = useCareerStore((s) => s.activeTransferFilter)
  const setTransferFilter = useCareerStore((s) => s.setTransferFilter)
  const selectPlayer = useCareerStore((s) => s.selectPlayer)

  const [sortKey, setSortKey] = useState<SortKey>('TOT')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const teamById = new Map(teams.map((t) => [t.id, t]))

  // Available players: not in user team
  const availablePlayers = players.filter((p) => p.teamId !== career.teamId)
  const filtered = filterPlayers(availablePlayers, activeTransferFilter)
  const sorted = sortPlayers(filtered, sortKey, sortDir, teamById)
  const paginated = sorted.slice(
    activeTransferFilter.page * activeTransferFilter.pageSize,
    (activeTransferFilter.page + 1) * activeTransferFilter.pageSize,
  )
  const totalPages = Math.ceil(filtered.length / activeTransferFilter.pageSize)

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir(col === 'TOT' || col === 'valor' ? 'desc' : 'asc')
    }
    setTransferFilter({ page: 0 })
  }

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Fichajes" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Filters toolbar */}
          <div className="flex-shrink-0 bg-gray-900 border-b border-gray-700 px-4 py-2 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-end">
              {/* Position filter */}
              <div className="flex items-center gap-1">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setTransferFilter({ position: pos, page: 0 })}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      activeTransferFilter.position === pos
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {pos === 'ALL' ? 'Todos' : pos}
                  </button>
                ))}
              </div>

              {/* Element filter */}
              <div className="flex items-center gap-1">
                {ELEMENTS.map((elem) => (
                  <button
                    key={elem}
                    onClick={() => setTransferFilter({ element: elem, page: 0 })}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      activeTransferFilter.element === elem
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {elem === 'ALL' ? 'Elem.' : elem.charAt(0) + elem.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* TOT min */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-xs">TOT ≥</span>
                <input
                  type="number"
                  value={activeTransferFilter.minOverall || ''}
                  onChange={(e) => setTransferFilter({ minOverall: parseInt(e.target.value) || 0, page: 0 })}
                  placeholder="0"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs w-16 focus:outline-none focus:border-gray-500"
                />
              </div>

              {/* Name search */}
              <div className="relative flex-1 min-w-32">
                <Icon name="search" size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={activeTransferFilter.nameSearch}
                  onChange={(e) => setTransferFilter({ nameSearch: e.target.value, page: 0 })}
                  placeholder="Buscar jugador..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-8 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                {activeTransferFilter.nameSearch && (
                  <button onClick={() => setTransferFilter({ nameSearch: '', page: 0 })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <Icon name="close" size="xs" />
                  </button>
                )}
              </div>

              <span className="text-gray-600 text-xs ml-auto shrink-0">{filtered.length} jugadores</span>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 mb-3">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900/80 text-xs border-b border-gray-700">
                    <th className="py-2 px-2 w-12" />
                    <SortHeader label="Jugador" col="name" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} />
                    <SortHeader label="TOT" col="TOT" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-14 text-right" />
                    <SortHeader label="Equipo" col="equipo" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-32" />
                    <SortHeader label="Valor" col="valor" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-20 text-right" />
                    <th className="py-2 px-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((player) => {
                    const isFreeAgent = player.teamId === null || player.teamId === 0
                    const playerTeam = isFreeAgent ? null : teamById.get(player.teamId!)
                    return (
                      <TransferPlayerRow
                        key={player.id}
                        player={player}
                        teamName={playerTeam?.name ?? ''}
                        teamBadgeUrl={playerTeam?.badgeUrl}
                        isFreeAgent={isFreeAgent}
                        onView={() => { selectPlayer(player.id); navigate('player_detail') }}
                      />
                    )
                  })}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500 text-sm">
                        No hay jugadores disponibles con los filtros actuales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setTransferFilter({ page: Math.max(0, activeTransferFilter.page - 1) })}
                  disabled={activeTransferFilter.page === 0}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                  Anterior
                </button>
                <span className="text-gray-400 text-xs tabular-nums">
                  {activeTransferFilter.page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setTransferFilter({ page: Math.min(totalPages - 1, activeTransferFilter.page + 1) })}
                  disabled={activeTransferFilter.page >= totalPages - 1}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
