import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TransferPlayerRow from '../components/TransferPlayerRow'
import { filterPlayers, calcTransferValue } from '../services/transferService'
import type { Position, Element } from '../types/player'

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GK', 'DF', 'MD', 'FW']
const ELEMENTS: (Element | 'ALL')[] = ['ALL', 'FIRE', 'WOOD', 'WIND', 'MOUNTAIN']

export default function TransfersScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const activeTransferFilter = useCareerStore((s) => s.activeTransferFilter)
  const setTransferFilter = useCareerStore((s) => s.setTransferFilter)
  const buyPlayer = useCareerStore((s) => s.buyPlayer)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)

  // Available players: not in user team, not already in user's watchlist disqualifies nothing
  const availablePlayers = players.filter((p) => p.teamId !== career.teamId)
  const filtered = filterPlayers(availablePlayers, activeTransferFilter)
  const paginated = filtered.slice(
    activeTransferFilter.page * activeTransferFilter.pageSize,
    (activeTransferFilter.page + 1) * activeTransferFilter.pageSize,
  )
  const totalPages = Math.ceil(filtered.length / activeTransferFilter.pageSize)

  function handleBuy(playerId: number, marketValue: number) {
    buyPlayer(playerId, marketValue)
  }

  const teamById = new Map(teams.map((t) => [t.id, t]))

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Fichajes" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-4">
          <h1 className="text-white text-2xl font-bold mb-4">Mercado de Fichajes</h1>

          {/* Filters */}
          <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 mb-4 flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-gray-400 text-xs mb-1">Posición</p>
              <div className="flex gap-1">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setTransferFilter({ position: pos, page: 0 })}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      activeTransferFilter.position === pos
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-gray-400 text-xs mb-1">Elemento</p>
              <div className="flex gap-1">
                {ELEMENTS.map((elem) => (
                  <button
                    key={elem}
                    onClick={() => setTransferFilter({ element: elem, page: 0 })}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      activeTransferFilter.element === elem
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {elem === 'ALL' ? 'Todos' : elem}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-gray-400 text-xs mb-1">Nombre</p>
              <input
                type="text"
                value={activeTransferFilter.nameSearch}
                onChange={(e) => setTransferFilter({ nameSearch: e.target.value, page: 0 })}
                placeholder="Buscar..."
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 w-32"
              />
            </div>

            <div>
              <p className="text-gray-400 text-xs mb-1">TOT mínimo</p>
              <input
                type="number"
                value={activeTransferFilter.minOverall}
                onChange={(e) => setTransferFilter({ minOverall: parseInt(e.target.value) || 0, page: 0 })}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-xs w-20 focus:outline-none focus:border-blue-500"
              />
            </div>

            <p className="text-gray-500 text-xs ml-auto">
              {filtered.length} jugadores
            </p>
          </div>

          {/* Player Table */}
          <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 mb-4">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                  <th className="py-2 px-3 text-left w-8">#</th>
                  <th className="py-2 px-3 text-left w-14"></th>
                  <th className="py-2 px-3 text-left">Jugador</th>
                  <th className="py-2 px-3 text-left">TOT</th>
                  <th className="py-2 px-3 text-left">PRE</th>
                  <th className="py-2 px-3 text-left">AGI</th>
                  <th className="py-2 px-3 text-left">Valor</th>
                  <th className="py-2 px-3 text-left">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((player) => {
                  const playerTeam = player.teamId !== null ? teamById.get(player.teamId) : null
                  return (
                    <TransferPlayerRow
                      key={player.id}
                      player={player}
                      teamName={playerTeam?.name ?? 'Sin equipo'}
                      onBuy={() => handleBuy(player.id, Math.round(calcTransferValue(player) * (career?.difficulty.transferCostMultiplier ?? 1)))}
                    />
                  )
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500 text-sm">
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
              <span className="text-gray-400 text-xs">
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
        </main>
      </div>
    </div>
  )
}
