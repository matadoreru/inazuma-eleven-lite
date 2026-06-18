import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TransferPlayerRow from '../components/TransferPlayerRow'
import Icon from '../components/Icon'
import { filterPlayers, calcTransferValue } from '../services/transferService'
import type { Position, Element, Player } from '../types/player'
import type { IncomingOffer } from '../types/career'
import type { Team } from '../types/team'

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GK', 'DF', 'MD', 'FW']
const ELEMENTS: (Element | 'ALL')[] = ['ALL', 'FIRE', 'WOOD', 'WIND', 'MOUNTAIN']

type SortKey = 'name' | 'TOT' | 'valor' | 'equipo' | 'edad' | 'POT' | 'TEC' | 'FIS' | 'AGI'
type SortDir = 'asc' | 'desc'

const NUMERIC_SORT_KEYS: SortKey[] = ['TOT', 'valor', 'edad', 'POT', 'TEC', 'FIS', 'AGI']

function sortPlayers(players: Player[], key: SortKey, dir: SortDir, teamById: Map<number, { name: string }>): Player[] {
  const sorted = [...players].sort((a, b) => {
    switch (key) {
      case 'TOT': return b.stats.TOT - a.stats.TOT
      case 'POT': return b.stats.POT - a.stats.POT
      case 'TEC': return b.stats.TEC - a.stats.TEC
      case 'FIS': return b.stats.FIS - a.stats.FIS
      case 'AGI': return b.stats.AGI - a.stats.AGI
      case 'edad': return b.age - a.age
      case 'valor': return calcTransferValue(b) - calcTransferValue(a)
      case 'equipo': {
        const ta = (a.teamId !== null && a.teamId !== 0) ? (teamById.get(a.teamId)?.name ?? '') : '~Libre'
        const tb = (b.teamId !== null && b.teamId !== 0) ? (teamById.get(b.teamId)?.name ?? '') : '~Libre'
        return ta.localeCompare(tb)
      }
      case 'name': default:
        return a.name.localeCompare(b.name)
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

function IncomingOfferCard({ offer, players, teams }: { offer: IncomingOffer; players: Player[]; teams: Team[] }) {
  const [counterInput, setCounterInput] = useState('')
  const acceptOffer = useCareerStore(s => s.acceptTransferOffer)
  const rejectOffer = useCareerStore(s => s.rejectTransferOffer)
  const counterOffer = useCareerStore(s => s.counterIncomingOffer)

  const player = players.find(p => p.id === offer.playerId)
  if (!player) return null

  const marketValue = calcTransferValue(player)
  const diff = offer.amount - marketValue
  const diffPct = Math.round((diff / marketValue) * 100)
  const fmt = (n: number) => n >= 1_000_000 ? `€${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `€${(n/1_000).toFixed(0)}K` : `€${n}`

  return (
    <div className="bg-dark-800/80 rounded-xl border border-gold-600/20 p-4 space-y-3">
      <div className="flex items-start gap-3">
        {player.spriteUrl && (
          <img src={player.spriteUrl} alt={player.name} className="w-12 h-12 object-contain rounded" />
        )}
        <div className="flex-1">
          <p className="text-white font-bold">{player.name}</p>
          <p className="text-gray-400 text-xs">{player.position} · {player.age} anos · Media {Math.round(player.stats.TOT / 7)}</p>
          <p className="text-gray-500 text-xs">Interesado: <span className="text-gray-300">{offer.fromTeamName}</span></p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-dark-700/60 rounded p-2">
          <p className="text-gray-500">Valor mercado</p>
          <p className="text-white font-semibold">{fmt(marketValue)}</p>
        </div>
        <div className="bg-dark-700/60 rounded p-2">
          <p className="text-gray-500">Oferta recibida</p>
          <p className="text-white font-semibold">{fmt(offer.amount)}</p>
        </div>
        <div className={`rounded p-2 ${diff >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
          <p className="text-gray-500">Diferencia</p>
          <p className={`font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff >= 0 ? '+' : ''}{diffPct}%
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => acceptOffer(offer.id)}
          className="flex-1 py-2 bg-green-800/60 hover:bg-green-700/60 text-green-300 text-xs font-semibold rounded border border-green-600/40 transition-colors"
        >
          Aceptar
        </button>
        <button
          onClick={() => rejectOffer(offer.id)}
          className="flex-1 py-2 bg-red-900/40 hover:bg-red-800/50 text-red-400 text-xs font-semibold rounded border border-red-700/40 transition-colors"
        >
          Rechazar
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder={`Contraoferta (ej. ${fmt(Math.round(marketValue * 1.1))})`}
          value={counterInput}
          onChange={e => setCounterInput(e.target.value)}
          className="flex-1 bg-dark-700/60 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:border-gold-500 outline-none"
        />
        <button
          onClick={() => {
            const amt = Number(counterInput)
            if (amt > 0 && amt <= 10_000_000) { counterOffer(offer.id, amt); setCounterInput('') }
          }}
          className="px-3 py-1.5 bg-blue-800/60 hover:bg-blue-700/60 text-blue-300 text-xs font-semibold rounded border border-blue-600/40 transition-colors"
        >
          Contraofertar
        </button>
      </div>
    </div>
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
  const [activeTab, setActiveTab] = useState<'market' | 'incoming'>('market')

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900/80">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const incomingOffers = (career.incomingOffers ?? []).filter(o => o.status === 'pending')

  // Available players: not in user team
  const availablePlayers = players.filter((p) => p.teamId !== career.teamId)
  const baseFiltered = filterPlayers(availablePlayers, activeTransferFilter)
  const teamSearchLower = activeTransferFilter.teamSearch.toLowerCase()
  const filtered = teamSearchLower
    ? baseFiltered.filter((p) => {
        const isFree = p.teamId === null || p.teamId === 0
        const name = isFree ? 'libre' : (teamById.get(p.teamId!)?.name ?? '')
        return name.toLowerCase().includes(teamSearchLower)
      })
    : baseFiltered
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
      setSortDir(NUMERIC_SORT_KEYS.includes(col) ? 'desc' : 'asc')
    }
    setTransferFilter({ page: 0 })
  }

  return (
    <GameLayout>
      <div className="h-full flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex-shrink-0 flex border-b border-gray-800 bg-dark-900/80 px-4">
            <button
              onClick={() => setActiveTab('market')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'market' ? 'border-gold-500 text-gold-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Mercado
            </button>
            <button
              onClick={() => setActiveTab('incoming')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'incoming' ? 'border-gold-500 text-gold-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Ofertas recibidas
              {incomingOffers.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {incomingOffers.length}
                </span>
              )}
            </button>
          </div>

          {/* Filters toolbar */}
          {activeTab === 'market' && <div className="flex-shrink-0 bg-dark-900/80 border-b border-gold-600/30 px-4 py-2 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-end">
              {/* Position filter */}
              <div className="flex items-center gap-1">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setTransferFilter({ position: pos, page: 0 })}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      activeTransferFilter.position === pos
                        ? 'bg-gold-600/25 text-gold-300 border border-gold-500/60'
                        : 'bg-dark-700/60 border border-transparent text-gray-400 hover:text-gold-400'
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
                        ? 'bg-gold-600/25 text-gold-300 border border-gold-500/60'
                        : 'bg-dark-800/60 text-gray-400 hover:text-gold-400 border border-transparent'
                    }`}
                  >
                    {elem === 'ALL' ? 'Elem.' : elem.charAt(0) + elem.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Media min */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-xs">Media ≥</span>
                <input
                  type="number"
                  value={activeTransferFilter.minMedia || ''}
                  onChange={(e) => setTransferFilter({ minMedia: parseInt(e.target.value) || 0, page: 0 })}
                  placeholder="0"
                  className="panel rounded-lg px-2 py-1.5 text-white text-xs w-16 focus:outline-none focus:border-gray-500"
                />
              </div>

              {/* Name search */}
              <div className="relative min-w-28">
                <Icon name="search" size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={activeTransferFilter.nameSearch}
                  onChange={(e) => setTransferFilter({ nameSearch: e.target.value, page: 0 })}
                  placeholder="Jugador..."
                  className="w-full panel rounded-lg pl-8 pr-8 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                {activeTransferFilter.nameSearch && (
                  <button onClick={() => setTransferFilter({ nameSearch: '', page: 0 })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <Icon name="close" size="xs" />
                  </button>
                )}
              </div>

              {/* Team search */}
              <div className="relative min-w-28">
                <Icon name="shield" size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={activeTransferFilter.teamSearch}
                  onChange={(e) => setTransferFilter({ teamSearch: e.target.value, page: 0 })}
                  placeholder="Equipo..."
                  className="w-full panel rounded-lg pl-8 pr-8 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                {activeTransferFilter.teamSearch && (
                  <button onClick={() => setTransferFilter({ teamSearch: '', page: 0 })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <Icon name="close" size="xs" />
                  </button>
                )}
              </div>

              <span className="text-gray-600 text-xs ml-auto shrink-0">{filtered.length} jugadores</span>
            </div>
          </div>}

          {/* Market tab: Scrollable table */}
          {activeTab === 'market' && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="panel rounded-xl overflow-hidden mb-3">
              <table className="w-full">
                <thead>
                  <tr className="bg-dark-900/60 text-gold-600/80 text-xs border-b border-gold-600/30">
                    <th className="py-2 px-2 w-14" />
                    <SortHeader label="Jugador" col="name" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} />
                    <th className="py-2 px-2 w-20 text-center text-gray-500">Elem.</th>
                    <SortHeader label="Edad" col="edad" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-center" />
                    <SortHeader label="POT" col="POT" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                    <SortHeader label="TEC" col="TEC" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                    <SortHeader label="FIS" col="FIS" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                    <SortHeader label="AGI" col="AGI" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                    <SortHeader label="Media" col="TOT" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-14 text-right" />
                    <SortHeader label="Equipo" col="equipo" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-32" />
                    <SortHeader label="Valor" col="valor" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-20 text-right" />
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
                      <td colSpan={11} className="py-10 text-center text-gray-500 text-sm">
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
                  className="text-xs px-3 py-1.5 bg-dark-700/80 hover:bg-dark-600/80 disabled:opacity-40 text-white rounded-lg border border-gold-600/20 transition-colors"
                >
                  Anterior
                </button>
                <span className="text-gray-400 text-xs tabular-nums">
                  {activeTransferFilter.page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setTransferFilter({ page: Math.min(totalPages - 1, activeTransferFilter.page + 1) })}
                  disabled={activeTransferFilter.page >= totalPages - 1}
                  className="text-xs px-3 py-1.5 bg-dark-700/80 hover:bg-dark-600/80 disabled:opacity-40 text-white rounded-lg border border-gold-600/20 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
          )}

          {/* Incoming offers tab */}
          {activeTab === 'incoming' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {incomingOffers.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No hay ofertas recibidas pendientes.</p>
              ) : incomingOffers.map((offer) => (
                <IncomingOfferCard key={offer.id} offer={offer} players={players} teams={teams} />
              ))}
            </div>
          )}
        </div>
    </GameLayout>
  )
}
