import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TransferPlayerRow from '../components/TransferPlayerRow'
import InboxEventCard from '../components/InboxEventCard'

export default function ScoutScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const selectPlayer = useCareerStore((s) => s.selectPlayer)
  const acceptTransferOffer = useCareerStore((s) => s.acceptTransferOffer)
  const rejectTransferOffer = useCareerStore((s) => s.rejectTransferOffer)
  const markInboxRead = useCareerStore((s) => s.markInboxRead)
  const respondToCounterOffer = useCareerStore((s) => s.respondToCounterOffer)
  const cancelNegotiationAction = useCareerStore((s) => s.cancelNegotiation)
  const confirmTransferAction = useCareerStore((s) => s.confirmTransfer)
  const dismissNegotiationAction = useCareerStore((s) => s.dismissNegotiation)

  // Counter-offer inputs keyed by negotiation id
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({})

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

  // Active outgoing negotiations (includes player_accepted = waiting user confirmation)
  const activeNegotiations = career.outgoingNegotiations.filter(
    (n) => n.phase === 'club_pending' || n.phase === 'player_pending' || n.phase === 'player_accepted',
  )

  // Resolved negotiations (failed/cancelled) — shown until dismissed
  const resolvedNegotiations = career.outgoingNegotiations.filter(
    (n) => n.phase === 'failed' || n.phase === 'cancelled',
  )

  // Format amount helper
  function fmtAmt(n: number): string {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
    return `€${n}`
  }

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Explorador" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-4">
          <h1 className="text-white text-2xl font-bold mb-4">Ojeadores</h1>

          {/* Active outgoing negotiations */}
          {(activeNegotiations.length > 0 || resolvedNegotiations.length > 0) && (
            <div className="mb-6">
              <h2 className="text-white text-lg font-semibold mb-3">
                Negociaciones
                {activeNegotiations.length > 0 && ` (${activeNegotiations.length} activas)`}
              </h2>
              <div className="flex flex-col gap-2">

                {/* Active negotiations */}
                {activeNegotiations.map((neg) => {
                  const isPlayerAccepted = neg.phase === 'player_accepted'
                  const isPlayerPending = neg.phase === 'player_pending'
                  const hasCounter = !!neg.counterAmount
                  const borderClass = isPlayerAccepted
                    ? 'border-green-700'
                    : hasCounter
                    ? 'border-yellow-700'
                    : 'border-gray-700'

                  return (
                    <div key={neg.id} className={`bg-gray-800 rounded-xl p-3 border ${borderClass}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{neg.playerName}</p>
                          <p className="text-gray-500 text-xs">{neg.targetClubName}</p>
                          <p className={`text-xs mt-0.5 ${isPlayerAccepted ? 'text-green-400 font-semibold' : 'text-gray-400'}`}>
                            {neg.phase === 'club_pending' && !hasCounter && 'Esperando respuesta del club'}
                            {neg.phase === 'club_pending' && hasCounter && `Contra-oferta del club: ${fmtAmt(neg.counterAmount!)}`}
                            {isPlayerPending && 'El jugador está valorando la oferta'}
                            {isPlayerAccepted && '¡El jugador acepta! Confirma el fichaje'}
                          </p>
                          <p className="text-gray-600 text-[0.625rem]">
                            Oferta: {fmtAmt(neg.currentOffer)}
                            {!isPlayerAccepted && ` · Est. ${neg.resolutionDate}`}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col gap-1 items-end">
                          {/* Player accepted: confirm / cancel */}
                          {isPlayerAccepted && (
                            <>
                              <button
                                onClick={() => confirmTransferAction(neg.id)}
                                className="text-[0.625rem] px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded font-semibold transition-colors"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => cancelNegotiationAction(neg.id)}
                                className="text-[0.625rem] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-semibold transition-colors"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {/* Club counter-offer: accept / counter / reject */}
                          {hasCounter && !isPlayerAccepted && (
                            <>
                              <button
                                onClick={() => respondToCounterOffer(neg.id, 'accept_counter')}
                                className="text-[0.625rem] px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded font-semibold transition-colors"
                              >
                                Aceptar
                              </button>
                              {neg.offerRound < 3 && (
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="number"
                                    value={counterInputs[neg.id] ?? ''}
                                    onChange={(e) => setCounterInputs((prev) => ({ ...prev, [neg.id]: e.target.value }))}
                                    placeholder={String(Math.round(neg.currentOffer * 1.05))}
                                    className="w-20 text-[0.625rem] px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500"
                                  />
                                  <button
                                    onClick={() => {
                                      const raw = parseInt(counterInputs[neg.id] ?? '0')
                                      if (raw > 0) {
                                        respondToCounterOffer(neg.id, 'counter', raw)
                                        setCounterInputs((prev) => ({ ...prev, [neg.id]: '' }))
                                      }
                                    }}
                                    className="text-[0.625rem] px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded font-semibold transition-colors"
                                  >
                                    Contra
                                  </button>
                                </div>
                              )}
                              <button
                                onClick={() => respondToCounterOffer(neg.id, 'reject')}
                                className="text-[0.625rem] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-semibold transition-colors"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {/* Waiting states: only cancel */}
                          {!hasCounter && !isPlayerAccepted && (
                            <button
                              onClick={() => cancelNegotiationAction(neg.id)}
                              className="text-[0.625rem] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-semibold transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Resolved negotiations (failed / cancelled) */}
                {resolvedNegotiations.map((neg) => (
                  <div key={neg.id} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-sm font-semibold truncate">{neg.playerName}</p>
                        <p className="text-gray-600 text-xs">{neg.targetClubName}</p>
                        <p className={`text-xs mt-0.5 ${neg.phase === 'failed' ? 'text-red-400' : 'text-gray-500'}`}>
                          {neg.phase === 'failed' ? 'Negociación fallida' : 'Cancelada'}
                          {' · '}{fmtAmt(neg.currentOffer)}
                        </p>
                      </div>
                      <button
                        onClick={() => dismissNegotiationAction(neg.id)}
                        className="shrink-0 text-[0.625rem] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded font-semibold transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            </div>
          )}

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
                    <tr className="bg-gray-900/80 text-gray-500 text-xs border-b border-gray-700">
                      <th className="py-2 px-2 w-12" />
                      <th className="py-2 px-3 text-left">Jugador</th>
                      <th className="py-2 px-2 w-20 text-center">Elem.</th>
                      <th className="py-2 px-2 w-10 text-center">Edad</th>
                      <th className="py-2 px-2 w-10 text-right">POT</th>
                      <th className="py-2 px-2 w-10 text-right">TEC</th>
                      <th className="py-2 px-2 w-10 text-right">FIS</th>
                      <th className="py-2 px-2 w-10 text-right">AGI</th>
                      <th className="py-2 px-3 text-right w-14">Media</th>
                      <th className="py-2 px-3 text-left w-32">Equipo</th>
                      <th className="py-2 px-3 text-right w-20">Valor</th>
                      <th className="py-2 px-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistPlayers.map((player) => {
                      const isFreeAgentWl = player.teamId === null || player.teamId === 0
                      const playerTeam = isFreeAgentWl ? null : teamById.get(player.teamId!)
                      return (
                        <TransferPlayerRow
                          key={player.id}
                          player={player}
                          teamName={playerTeam?.name ?? ''}
                          teamBadgeUrl={playerTeam?.badgeUrl}
                          isFreeAgent={isFreeAgentWl}
                          onView={() => { selectPlayer(player.id); navigate('player_detail') }}
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
