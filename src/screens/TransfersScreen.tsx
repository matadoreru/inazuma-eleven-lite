import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TransferPlayerRow from '../components/TransferPlayerRow'
import Icon from '../components/Icon'
import ElementBadge from '../components/ElementBadge'
import PositionSprite from '../components/PositionSprite'
import { statColor } from '../components/StatBar'
import { filterPlayers, calcTransferValue, calcFreeAgentRecommendedOffer } from '../services/transferService'
import { formatMoney } from '../utils/formatMoney'
import { getPlayerStatsSummary, playerDisplayName } from '../types/player'
import { useNameStyle } from '../hooks/useNameStyle'
import type { Position, Element, Player } from '../types/player'
import type { IncomingOffer, OutgoingNegotiation } from '../types/career'
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

function TeamDropdown({ marketTeams, value, onChange }: {
  marketTeams: Team[]
  value: string
  onChange: (val: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedTeam = value && value !== 'libre'
    ? marketTeams.find((t) => t.name.toLowerCase() === value)
    : null

  const displayLabel = value === ''
    ? 'Todos'
    : value === 'libre'
    ? 'Libre'
    : (selectedTeam?.name ?? value)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 panel rounded-lg px-2 py-1.5 text-white text-xs min-w-[120px] focus:outline-none"
      >
        {selectedTeam?.badgeUrl ? (
          <img src={selectedTeam.badgeUrl} className="w-4 h-4 object-contain shrink-0" alt="" />
        ) : value === 'libre' ? (
          <Icon name="person_off" size="xs" className="text-green-400" />
        ) : (
          <Icon name="shield" size="xs" className="text-gray-500" />
        )}
        <span className={value === '' ? 'text-gray-500' : 'text-white'}>{displayLabel}</span>
        <Icon name={isOpen ? 'expand_less' : 'expand_more'} size="xs" className="ml-auto text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-dark-800 border border-gold-600/20 rounded-lg shadow-xl min-w-[160px] max-h-52 overflow-y-auto">
            <button
              onClick={() => { onChange(''); setIsOpen(false) }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-700 transition-colors ${value === '' ? 'text-gold-400' : 'text-gray-300'}`}
            >
              <Icon name="public" size="xs" className="text-gray-500" />
              Todos los equipos
            </button>
            <button
              onClick={() => { onChange('libre'); setIsOpen(false) }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-700 transition-colors ${value === 'libre' ? 'text-gold-400' : 'text-green-400'}`}
            >
              <Icon name="person_off" size="xs" className="text-green-400" />
              Libre
            </button>
            <div className="border-t border-gold-600/15 my-1" />
            {marketTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => { onChange(team.name.toLowerCase()); setIsOpen(false) }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-700 transition-colors ${value === team.name.toLowerCase() ? 'text-gold-400' : 'text-gray-300'}`}
              >
                {team.badgeUrl ? (
                  <img src={team.badgeUrl} className="w-4 h-4 object-contain shrink-0" alt="" />
                ) : (
                  <span className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{team.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PlayerDetailPanel({ player, onClose, onOfferSent }: {
  player: Player
  onClose: () => void
  onOfferSent: () => void
}) {
  const nameStyle = useNameStyle()
  const teams = useCareerStore((s) => s.teams)
  const selectPlayer = useCareerStore((s) => s.selectPlayer)
  const navigate = useCareerStore((s) => s.navigate)
  const initiateTransferNegotiation = useCareerStore((s) => s.initiateTransferNegotiation)

  const [offerAmount, setOfferAmount] = useState('')
  const [offerSent, setOfferSent] = useState(false)

  const isFreeAgent = player.teamId === null || player.teamId === 0
  const playerTeam = isFreeAgent ? null : teams.find((t) => t.id === player.teamId)
  const marketValue = calcTransferValue(player)
  const recOffer = isFreeAgent ? calcFreeAgentRecommendedOffer(player) : marketValue
  const { media } = getPlayerStatsSummary(player)
  const displayName = playerDisplayName(player, nameStyle)

  const STATS: (keyof typeof player.stats)[] = ['POT', 'TEC', 'FIS', 'AGI']

  function sendOffer() {
    const amount = Number(offerAmount) || recOffer
    if (amount <= 0) return
    initiateTransferNegotiation(player.id, amount)
    setOfferSent(true)
    onOfferSent()
  }

  function handleViewFull() {
    selectPlayer(player.id)
    navigate('player_detail')
  }

  if (offerSent) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-800/40 border border-green-600/40 flex items-center justify-center">
          <Icon name="check" size="md" className="text-green-400" />
        </div>
        <p className="text-white font-semibold text-sm">¡Oferta enviada!</p>
        <p className="text-gray-500 text-xs">Puedes ver el estado en "Ofertas enviadas"</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gold-600/20 shrink-0">
        <span className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Ficha</span>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
          <Icon name="close" size="xs" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Player header */}
        <div className="p-4 border-b border-gold-600/15">
          <div className="flex items-start gap-3">
            <img
              src={player.spriteUrl}
              alt={displayName}
              className="w-16 h-16 object-contain rounded bg-dark-700/40"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <PositionSprite position={player.position} size={20} />
                {player.positionAlt && (
                  <PositionSprite position={player.positionAlt} size={16} className="opacity-60" />
                )}
                <ElementBadge element={player.element} size="xs" />
              </div>
              <p className="text-gray-500 text-xs mt-1">{player.age} años</p>
              {playerTeam ? (
                <div className="flex items-center gap-1 mt-1">
                  {playerTeam.badgeUrl && (
                    <img src={playerTeam.badgeUrl} className="w-3.5 h-3.5 object-contain" alt="" />
                  )}
                  <span className="text-gray-400 text-xs">{playerTeam.name}</span>
                </div>
              ) : (
                <span className="text-green-400 text-xs font-semibold mt-1 block">Agente libre</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-3 border-b border-gold-600/15">
          <div className="grid grid-cols-5 gap-1.5">
            {STATS.map((stat) => (
              <div key={stat} className="bg-dark-800 rounded p-2 text-center">
                <p className="text-gray-500 text-[9px] uppercase tracking-wide">{stat}</p>
                <p className="font-bold tabular-nums text-sm" style={{ color: statColor(player.stats[stat] as number, 250) }}>
                  {player.stats[stat] as number}
                </p>
              </div>
            ))}
            <div className="bg-dark-700/60 rounded p-2 text-center border border-gold-600/20">
              <p className="text-gray-500 text-[9px] uppercase tracking-wide">Media</p>
              <p className="font-bold tabular-nums text-sm text-gold-400">{media}</p>
            </div>
          </div>
        </div>

        {/* Transfer section */}
        <div className="p-4 space-y-3">
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Valor de mercado</p>
            <p className="text-gold-400 font-bold text-lg tabular-nums">{formatMoney(marketValue)}</p>
            {isFreeAgent && (
              <p className="text-gray-500 text-xs mt-0.5">Oferta rec.: {formatMoney(recOffer)}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-gray-500 text-[10px] uppercase tracking-widest">
              {isFreeAgent ? 'Tu oferta al jugador' : 'Tu oferta al club'}
            </p>
            <input
              type="number"
              placeholder={String(recOffer)}
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              className="w-full bg-dark-700 border border-gold-600/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500 placeholder-gray-600"
            />
            <button
              onClick={sendOffer}
              className="w-full py-2 bg-gold-600 hover:bg-gold-500 text-dark-900 text-sm font-bold rounded-lg transition-colors"
            >
              {isFreeAgent ? 'Fichar' : 'Hacer oferta'}
            </button>
          </div>
        </div>
      </div>

      {/* View full profile */}
      <div className="shrink-0 p-3 border-t border-gold-600/15">
        <button
          onClick={handleViewFull}
          className="w-full py-2 bg-dark-700/60 hover:bg-dark-600/60 text-gray-300 text-xs font-semibold rounded-lg border border-gold-600/15 transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="open_in_new" size="xs" />
          Ver ficha completa
        </button>
      </div>
    </div>
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

  return (
    <div className="bg-dark-800/80 rounded-xl border border-gold-600/20 p-4 space-y-3">
      <div className="flex items-start gap-3">
        {player.spriteUrl && (
          <img src={player.spriteUrl} alt={player.name} className="w-12 h-12 object-contain rounded" />
        )}
        <div className="flex-1">
          <p className="text-white font-bold">{player.name}</p>
          <p className="text-gray-400 text-xs">{player.position} · {player.age} años · Media {Math.round(player.stats.TOT / 7)}</p>
          <p className="text-gray-500 text-xs">Interesado: <span className="text-gray-300">{offer.fromTeamName}</span></p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-dark-700/60 rounded p-2">
          <p className="text-gray-500">Valor mercado</p>
          <p className="text-white font-semibold">{formatMoney(marketValue)}</p>
        </div>
        <div className="bg-dark-700/60 rounded p-2">
          <p className="text-gray-500">Oferta recibida</p>
          <p className="text-white font-semibold">{formatMoney(offer.amount)}</p>
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
          placeholder={`Contraoferta (ej. ${formatMoney(Math.round(marketValue * 1.1))})`}
          value={counterInput}
          onChange={e => setCounterInput(e.target.value)}
          className="flex-1 bg-dark-700/60 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:border-gold-500 outline-none"
        />
        <button
          onClick={() => {
            const amt = Number(counterInput)
            if (amt > 0 && amt <= 10_000_000) { counterOffer(offer.id, amt); setCounterInput('') }
          }}
          className="px-3 py-1.5 bg-dark-700/60 hover:bg-dark-600/60 text-gray-300 text-xs font-semibold rounded border border-gold-600/20 transition-colors"
        >
          Contraofertar
        </button>
      </div>
    </div>
  )
}

function OutgoingNegotiationCard({
  neg,
  counterInput,
  onCounterInputChange,
  onRespondCounter,
  onConfirm,
  onCancel,
  onDismiss,
}: {
  neg: OutgoingNegotiation
  counterInput: string
  onCounterInputChange: (val: string) => void
  onRespondCounter: (action: 'accept_counter' | 'counter' | 'reject', amount?: number) => void
  onConfirm: () => void
  onCancel: () => void
  onDismiss: () => void
}) {
  const isResolved = neg.phase === 'failed' || neg.phase === 'cancelled'
  const isPlayerAccepted = neg.phase === 'player_accepted'
  const isPlayerCounter = neg.phase === 'player_counter'
  const hasCounter = !!neg.counterAmount

  const borderClass = isResolved
    ? 'border-gold-600/20'
    : isPlayerAccepted
    ? 'border-green-600/50'
    : isPlayerCounter || (hasCounter && neg.phase === 'club_pending')
    ? 'border-yellow-600/50'
    : 'border-gold-600/20'

  const statusText = (() => {
    if (neg.phase === 'club_pending' && !hasCounter) return { text: 'Esperando respuesta del club', color: 'text-gray-400' }
    if (neg.phase === 'club_pending' && hasCounter) return { text: `Contraoferta del club: ${formatMoney(neg.counterAmount!)}`, color: 'text-yellow-400' }
    if (neg.phase === 'player_pending') return { text: 'El jugador está valorando la oferta', color: 'text-gray-400' }
    if (isPlayerCounter) return { text: `El jugador pide: ${formatMoney(neg.counterAmount!)}`, color: 'text-yellow-400' }
    if (isPlayerAccepted) return { text: '¡El jugador acepta! Confirma el fichaje', color: 'text-green-400 font-semibold' }
    if (neg.phase === 'failed') return { text: 'Negociación fallida', color: 'text-red-400' }
    if (neg.phase === 'cancelled') return { text: 'Cancelada', color: 'text-gray-500' }
    return { text: '', color: '' }
  })()

  return (
    <div className={`bg-dark-800/80 rounded-xl border p-4 ${borderClass} ${isResolved ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isResolved ? 'text-gray-400' : 'text-white'}`}>{neg.playerName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{neg.targetClubName}</p>
          <p className={`text-xs mt-1 ${statusText.color}`}>{statusText.text}</p>
          {!isResolved && (
            <p className="text-gray-600 text-[0.625rem] mt-0.5">
              Oferta: {formatMoney(neg.currentOffer)}
              {!isPlayerAccepted && ` · Res. ${neg.resolutionDate}`}
            </p>
          )}
          {isResolved && (
            <p className="text-gray-600 text-[0.625rem] mt-0.5">Oferta final: {formatMoney(neg.currentOffer)}</p>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-1.5 items-end">
          {isResolved && (
            <button
              onClick={onDismiss}
              className="text-[0.625rem] px-2 py-1 bg-dark-700/60 hover:bg-dark-600/70 text-gray-400 rounded font-semibold border border-gold-600/15 transition-colors"
            >
              Eliminar
            </button>
          )}

          {isPlayerAccepted && (
            <>
              <button
                onClick={onConfirm}
                className="text-[0.625rem] px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded font-semibold transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={onCancel}
                className="text-[0.625rem] px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded font-semibold transition-colors border border-gold-600/15"
              >
                Cancelar
              </button>
            </>
          )}

          {hasCounter && !isPlayerAccepted && (
            <>
              <button
                onClick={() => onRespondCounter('accept_counter')}
                className="text-[0.625rem] px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded font-semibold transition-colors"
              >
                Aceptar
              </button>
              {neg.offerRound < 3 && (
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    value={counterInput}
                    onChange={(e) => onCounterInputChange(e.target.value)}
                    placeholder={String(Math.round(neg.currentOffer * 1.05))}
                    className="w-20 text-[0.625rem] px-1.5 py-1 bg-dark-700/80 border border-gold-600/30 rounded text-white placeholder-gray-500"
                  />
                  <button
                    onClick={() => {
                      const raw = parseInt(counterInput)
                      if (raw > 0) onRespondCounter('counter', raw)
                    }}
                    className="text-[0.625rem] px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded font-semibold transition-colors"
                  >
                    Contra
                  </button>
                </div>
              )}
              <button
                onClick={() => onRespondCounter('reject')}
                className="text-[0.625rem] px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded font-semibold transition-colors border border-gold-600/15"
              >
                Rechazar
              </button>
            </>
          )}

          {!hasCounter && !isPlayerAccepted && !isResolved && (
            <button
              onClick={onCancel}
              className="text-[0.625rem] px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded font-semibold transition-colors border border-gold-600/15"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TransfersScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const navigate = useCareerStore((s) => s.navigate)
  const activeTransferFilter = useCareerStore((s) => s.activeTransferFilter)
  const setTransferFilter = useCareerStore((s) => s.setTransferFilter)
  const respondToCounterOffer = useCareerStore((s) => s.respondToCounterOffer)
  const cancelNegotiation = useCareerStore((s) => s.cancelNegotiation)
  const confirmTransfer = useCareerStore((s) => s.confirmTransfer)
  const dismissNegotiation = useCareerStore((s) => s.dismissNegotiation)

  const [sortKey, setSortKey] = useState<SortKey>('TOT')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeTab, setActiveTab] = useState<'market' | 'incoming' | 'outgoing'>('market')
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({})
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900/80">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const incomingOffers = (career.incomingOffers ?? []).filter(o => o.status === 'pending')

  const activeNegotiations = career.outgoingNegotiations.filter(
    (n) => n.phase === 'club_pending' || n.phase === 'player_pending' || n.phase === 'player_counter' || n.phase === 'player_accepted',
  )
  const resolvedNegotiations = career.outgoingNegotiations.filter(
    (n) => n.phase === 'failed' || n.phase === 'cancelled',
  )

  const availablePlayers = players.filter((p) => p.teamId !== career.teamId)
  const baseFiltered = filterPlayers(availablePlayers, activeTransferFilter)
  const teamSearchVal = activeTransferFilter.teamSearch.toLowerCase()
  const filtered = teamSearchVal
    ? baseFiltered.filter((p) => {
        const isFree = p.teamId === null || p.teamId === 0
        const name = isFree ? 'libre' : (teamById.get(p.teamId!)?.name?.toLowerCase() ?? '')
        return name === teamSearchVal
      })
    : baseFiltered
  const sorted = sortPlayers(filtered, sortKey, sortDir, teamById)
  const paginated = sorted.slice(
    activeTransferFilter.page * activeTransferFilter.pageSize,
    (activeTransferFilter.page + 1) * activeTransferFilter.pageSize,
  )
  const totalPages = Math.ceil(filtered.length / activeTransferFilter.pageSize)

  const marketTeamIds = new Set(availablePlayers.filter((p) => p.teamId && p.teamId !== 0).map((p) => p.teamId!))
  const marketTeams = teams.filter((t) => marketTeamIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name))

  const selectedPlayer = selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) : null

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
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'outgoing' ? 'border-gold-500 text-gold-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Ofertas enviadas
            {activeNegotiations.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeNegotiations.length}
              </span>
            )}
          </button>
        </div>

        {/* Filters toolbar (market only) */}
        {activeTab === 'market' && (
          <div className="flex-shrink-0 bg-dark-900/80 border-b border-gold-600/30 px-4 py-2 space-y-2">
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

              {/* Team dropdown */}
              <TeamDropdown
                marketTeams={marketTeams}
                value={activeTransferFilter.teamSearch}
                onChange={(val) => setTransferFilter({ teamSearch: val, page: 0 })}
              />

              <span className="text-gray-600 text-xs ml-auto shrink-0">{filtered.length} jugadores</span>
            </div>
          </div>
        )}

        {/* Market tab */}
        {activeTab === 'market' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Player list */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-3 min-w-0">
              <div className="panel rounded-xl overflow-hidden mb-3">
                <table className="w-full">
                  <thead>
                    <tr className="bg-dark-900/60 text-gold-600/80 text-xs border-b border-gold-600/30">
                      <th className="py-2 px-2 w-14" />
                      <SortHeader label="Jugador" col="name" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} />
                      <th className="py-2 px-3 w-28 text-left text-gray-500">Elem.</th>
                      <SortHeader label="Edad" col="edad" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-center" />
                      <SortHeader label="POT" col="POT" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                      <SortHeader label="TEC" col="TEC" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                      <SortHeader label="FIS" col="FIS" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                      <SortHeader label="AGI" col="AGI" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-10 text-right" />
                      <SortHeader label="Media" col="TOT" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-14 text-right" />
                      <SortHeader label="Equipo" col="equipo" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-36" />
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
                          isSelected={player.id === selectedPlayerId}
                          onView={() => setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id)}
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

            {/* Right panel */}
            {selectedPlayer && (
              <div className="w-72 shrink-0 border-l border-gold-600/20 bg-dark-900/60 overflow-hidden flex flex-col">
                <PlayerDetailPanel
                  key={selectedPlayer.id}
                  player={selectedPlayer}
                  onClose={() => setSelectedPlayerId(null)}
                  onOfferSent={() => setTimeout(() => setActiveTab('outgoing'), 1200)}
                />
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

        {/* Outgoing offers tab */}
        {activeTab === 'outgoing' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {activeNegotiations.length === 0 && resolvedNegotiations.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No has enviado ninguna oferta.</p>
            ) : (
              <>
                {activeNegotiations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide px-1">
                      Activas ({activeNegotiations.length})
                    </p>
                    {activeNegotiations.map((neg) => (
                      <OutgoingNegotiationCard
                        key={neg.id}
                        neg={neg}
                        counterInput={counterInputs[neg.id] ?? ''}
                        onCounterInputChange={(val) => setCounterInputs((prev) => ({ ...prev, [neg.id]: val }))}
                        onRespondCounter={(action, amount) => {
                          respondToCounterOffer(neg.id, action, amount)
                          setCounterInputs((prev) => ({ ...prev, [neg.id]: '' }))
                        }}
                        onConfirm={() => confirmTransfer(neg.id)}
                        onCancel={() => cancelNegotiation(neg.id)}
                        onDismiss={() => dismissNegotiation(neg.id)}
                      />
                    ))}
                  </div>
                )}

                {resolvedNegotiations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide px-1">
                      Resueltas ({resolvedNegotiations.length})
                    </p>
                    {resolvedNegotiations.map((neg) => (
                      <OutgoingNegotiationCard
                        key={neg.id}
                        neg={neg}
                        counterInput=""
                        onCounterInputChange={() => {}}
                        onRespondCounter={() => {}}
                        onConfirm={() => {}}
                        onCancel={() => {}}
                        onDismiss={() => dismissNegotiation(neg.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </GameLayout>
  )
}
