import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TransferPlayerRow from '../components/TransferPlayerRow'
import InboxEventCard from '../components/InboxEventCard'
import { calcTransferValue } from '../services/transferService'

export default function ScoutScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const buyPlayer = useCareerStore((s) => s.buyPlayer)
  const acceptTransferOffer = useCareerStore((s) => s.acceptTransferOffer)
  const rejectTransferOffer = useCareerStore((s) => s.rejectTransferOffer)
  const markInboxRead = useCareerStore((s) => s.markInboxRead)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)

  const teamById = new Map(teams.map((t) => [t.id, t]))

  // Watchlist players
  const watchlistPlayers = players.filter(
    (p) => career.watchlist.includes(p.id) && p.teamId !== career.teamId,
  )

  // Incoming transfer offers
  const transferOffers = career.inbox.filter(
    (e) => e.type === 'TRANSFER_OFFER' && e.data?.offerId,
  )

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Explorador" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-4">
          <h1 className="text-white text-2xl font-bold mb-4">Ojeadores</h1>

          {/* Transfer Offers */}
          {transferOffers.length > 0 && (
            <div className="mb-6">
              <h2 className="text-white text-lg font-semibold mb-3">
                Ofertas de Transferencia ({transferOffers.length})
              </h2>
              <div className="flex flex-col gap-3">
                {transferOffers.map((event) => (
                  <div key={event.id} className="bg-gray-800 rounded-xl p-4 border border-yellow-700">
                    <InboxEventCard
                      event={event}
                      onRead={() => markInboxRead(event.id)}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => acceptTransferOffer(event.data!.offerId as string)}
                        className="flex-1 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Aceptar
                      </button>
                      <button
                        onClick={() => rejectTransferOffer(event.data!.offerId as string)}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watchlist */}
          <div>
            <h2 className="text-white text-lg font-semibold mb-3">
              Lista de Seguimiento ({watchlistPlayers.length})
            </h2>

            {watchlistPlayers.length > 0 ? (
              <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="py-2 px-3 text-left w-8">#</th>
                      <th className="py-2 px-3 text-left w-10"></th>
                      <th className="py-2 px-3 text-left">Nombre</th>
                      <th className="py-2 px-3 text-left">Pos</th>
                      <th className="py-2 px-3 text-left">Elem</th>
                      <th className="py-2 px-3 text-left">TOT</th>
                      <th className="py-2 px-3 text-left">PRE</th>
                      <th className="py-2 px-3 text-left">AGI</th>
                      <th className="py-2 px-3 text-left">Valor</th>
                      <th className="py-2 px-3 text-left">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistPlayers.map((player) => {
                      const playerTeam = player.teamId !== null ? teamById.get(player.teamId) : null
                      return (
                        <TransferPlayerRow
                          key={player.id}
                          player={player}
                          teamName={playerTeam?.name ?? 'Sin equipo'}
                          onBuy={() => buyPlayer(player.id, Math.round(calcTransferValue(player) * (career?.difficulty.transferCostMultiplier ?? 1)))}
                          isWatchlisted={true}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
                <p className="text-gray-400 text-sm mb-2">No tienes jugadores en seguimiento</p>
                <p className="text-gray-500 text-xs">
                  Añade jugadores desde el Mercado de Fichajes
                </p>
                <button
                  onClick={() => navigate('transfers')}
                  className="mt-3 text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
                >
                  Ir al Mercado
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
