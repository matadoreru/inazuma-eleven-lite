import { useEffect } from 'react'
import Icon from '../components/Icon'
import { useCareerStore } from '../store/careerStore'
import type { MatchEvent, MatchResult } from '../types/competition'
import type { Player } from '../types/player'
import { playerDisplayName } from '../types/player'
import { useNameStyle } from '../hooks/useNameStyle'
import type { MatchReward, MatchRewardType, RewardRarity } from '../types/reward'
import { REWARD_RARITY_LABELS } from '../types/reward'
import { EQUIPMENT_SLOT_ICONS, EQUIPMENT_SLOT_LABELS } from '../types/equipment'
import TeamNameInline from '../components/TeamNameInline'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

const REWARD_TYPE_LABELS: Record<MatchRewardType, string> = {
  money: 'Dinero',
  stat_boost: 'Mejora',
  technique_book: 'Supertecnica',
  equipment: 'Equipamiento',
}

const TECHNIQUE_TYPE_LABELS = {
  Tiro: 'Tiro', Regate: 'Regate', Bloqueo: 'Defensa', Parada: 'Parada', Mejora: 'Mejora',
} as const

const TECHNIQUE_TYPE_ICONS = {
  Tiro: 'sports_soccer', Regate: 'directions_run', Bloqueo: 'shield', Parada: 'back_hand', Mejora: 'auto_awesome',
} as const

// Rarity visual system
const RARITY_LABEL_COLOR: Record<RewardRarity, string> = {
  common:    'text-gray-400',
  uncommon:  'text-green-400',
  special:   'text-cyan-400',
  rare:      'text-fuchsia-400',
  legendary: 'text-amber-300',
}

const RARITY_BORDER: Record<RewardRarity, string> = {
  common:    'border-gold-600/30/60',
  uncommon:  'border-green-600/50',
  special:   'border-cyan-500/55',
  rare:      'border-fuchsia-500/55',
  legendary: 'border-amber-400/65',
}

const RARITY_BG: Record<RewardRarity, string> = {
  common:    'bg-dark-800/70',
  uncommon:  'bg-green-950/60',
  special:   'bg-cyan-950/55',
  rare:      'bg-fuchsia-950/45',
  legendary: 'bg-amber-950/45',
}

const RARITY_HOVER: Record<RewardRarity, string> = {
  common:    'hover:bg-dark-700/40',
  uncommon:  'hover:bg-green-950',
  special:   'hover:bg-cyan-950',
  rare:      'hover:bg-fuchsia-950',
  legendary: 'hover:bg-amber-950',
}

const RARITY_GLOW: Record<RewardRarity, string> = {
  common:    '',
  uncommon:  '',
  special:   'shadow-md shadow-cyan-500/10',
  rare:      'shadow-md shadow-fuchsia-500/15',
  legendary: 'shadow-lg shadow-amber-400/20',
}

const RARITY_ICON_BG: Record<RewardRarity, string> = {
  common:    'bg-dark-900/70',
  uncommon:  'bg-green-900/40',
  special:   'bg-cyan-900/35',
  rare:      'bg-fuchsia-900/30',
  legendary: 'bg-amber-900/30',
}

const RARITY_ICON_COLOR: Record<RewardRarity, string> = {
  common:    'text-gray-400',
  uncommon:  'text-green-400',
  special:   'text-cyan-400',
  rare:      'text-fuchsia-400',
  legendary: 'text-amber-300',
}

// ─── Stat row ────────────────────────────────────────────────────────────────

function StatRow({
  label, home, away, pct = false, userIsHome,
}: {
  label: string; home: number | string; away: number | string; pct?: boolean; userIsHome: boolean
}) {
  const hNum = typeof home === 'string' ? parseFloat(home) : home
  const aNum = typeof away === 'string' ? parseFloat(away) : away
  const total = hNum + aNum || 1
  const hPct  = Math.round((hNum / total) * 100)
  const aPct  = 100 - hPct
  const homeBar = userIsHome ? 'bg-gold-500' : 'bg-dark-600/80'
  const awayBar = userIsHome ? 'bg-dark-600/80' : 'bg-gold-500'

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white text-xs font-bold tabular-nums w-10 text-left">
          {pct ? `${home}%` : home}
        </span>
        <span className="text-gray-500 text-[0.5rem] font-medium uppercase tracking-wide text-center flex-1">{label}</span>
        <span className="text-white text-xs font-bold tabular-nums w-10 text-right">
          {pct ? `${away}%` : away}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-[2px]">
        <div className={`${homeBar} rounded-l-full`} style={{ width: `${hPct}%` }} />
        <div className={`${awayBar} rounded-r-full`} style={{ width: `${aPct}%` }} />
      </div>
    </div>
  )
}

// ─── Event row ────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<MatchEvent['type'], { icon: string; color: string }> = {
  GOAL:   { icon: 'sports_soccer',   color: 'text-yellow-400' },
  SAVE:   { icon: 'back_hand',       color: 'text-gold-500'   },
  MISS:   { icon: 'close',           color: 'text-gray-600'   },
  YELLOW: { icon: 'square',          color: 'text-yellow-400' },
  RED:    { icon: 'square',          color: 'text-red-500'    },
  INJURY: { icon: 'healing',         color: 'text-orange-400' },
  PHASE:  { icon: 'schedule',        color: 'text-gray-600'   },
}

function EventRow({
  event, homeTeamName, awayTeamName, homeTeamBadgeUrl, awayTeamBadgeUrl,
}: {
  event: MatchEvent
  homeTeamName: string
  awayTeamName: string
  homeTeamBadgeUrl?: string
  awayTeamBadgeUrl?: string
}) {
  const { icon, color } = EVENT_ICON[event.type] ?? { icon: 'fiber_manual_record', color: 'text-gray-600' }

  if (event.type === 'PHASE') {
    return (
      <div className="flex items-center gap-2 my-2">
        <div className="flex-1 h-px bg-gold-600/20" />
        <span className="text-gray-600 text-[0.45rem] font-bold uppercase tracking-widest shrink-0">
          {event.text}
        </span>
        <div className="flex-1 h-px bg-gold-600/20" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gold-600/20/25 last:border-0">
      <span className="text-gray-600 text-[0.5rem] tabular-nums w-5 shrink-0 text-right">{event.minute}'</span>

      {event.playerSpriteUrl ? (
        <div className={`w-5 h-5 rounded-full overflow-hidden bg-dark-700/60 shrink-0 ring-1 ${
          event.type === 'GOAL' ? 'ring-yellow-500/50' :
          event.type === 'RED'  ? 'ring-red-500/50' :
          'ring-gray-600/50'
        }`}>
          <img
            src={event.playerSpriteUrl}
            alt={event.playerName}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      ) : (
        <span className={`material-icons ${color} shrink-0 leading-none`} style={{ fontSize: '12px' }}>{icon}</span>
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-[0.5625rem] leading-tight font-medium truncate ${
          event.type === 'GOAL'   ? 'text-yellow-200' :
          event.type === 'RED'    ? 'text-red-300' :
          event.type === 'YELLOW' ? 'text-yellow-200/80' :
          'text-gray-300'
        }`}>
          {event.text}
        </p>
        <TeamNameInline
          teamName={event.isHome ? homeTeamName : awayTeamName}
          badgeUrl={event.isHome ? homeTeamBadgeUrl : awayTeamBadgeUrl}
          size="xs"
          textClassName="text-gray-600 text-[0.45rem]"
        />
      </div>

      {event.playerSpriteUrl && (
        <span className={`material-icons ${color} shrink-0 leading-none`} style={{ fontSize: '9px' }}>{icon}</span>
      )}
    </div>
  )
}

// ─── Reward card ─────────────────────────────────────────────────────────────

function RewardCard({ reward, onClaim, player }: { reward: MatchReward; onClaim: () => void; player?: Player }) {
  const nameStyle = useNameStyle()
  const border  = RARITY_BORDER[reward.rarity]
  const bg      = RARITY_BG[reward.rarity]
  const hover   = RARITY_HOVER[reward.rarity]
  const glow    = RARITY_GLOW[reward.rarity]
  const iconBg  = RARITY_ICON_BG[reward.rarity]
  const iconCol = RARITY_ICON_COLOR[reward.rarity]
  const lblCol  = RARITY_LABEL_COLOR[reward.rarity]

  const baseClass = `w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${border} ${bg} ${hover} ${glow}`

  if (reward.type === 'money' && reward.moneyAmount) {
    return (
      <button onClick={onClaim} className={baseClass}>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon name="payments" size="sm" className={iconCol} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[0.5625rem] font-bold uppercase tracking-wider ${lblCol}`}>
            {REWARD_RARITY_LABELS[reward.rarity]} · {REWARD_TYPE_LABELS[reward.type]}
          </p>
          <p className="text-white font-black text-xl leading-tight tabular-nums">{fmtMoney(reward.moneyAmount)}</p>
          <p className="text-gray-500 text-[0.5625rem] mt-0.5">Ingreso inmediato al presupuesto del club</p>
        </div>
        <Icon name="chevron_right" size="xs" className="text-gray-600 shrink-0" />
      </button>
    )
  }

  if (reward.type === 'stat_boost' && reward.statBoost) {
    const { playerName, stat, amount } = reward.statBoost
    const displayName = player ? playerDisplayName(player, nameStyle) : playerName
    return (
      <button onClick={onClaim} className={baseClass}>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 overflow-hidden`}>
          {player ? (
            <img
              src={player.spriteUrl}
              alt={displayName}
              className="w-full h-full object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <Icon name="trending_up" size="sm" className={iconCol} />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[0.5625rem] font-bold uppercase tracking-wider ${lblCol}`}>
            {REWARD_RARITY_LABELS[reward.rarity]} · {REWARD_TYPE_LABELS[reward.type]}
          </p>
          <p className="text-white font-semibold text-sm leading-tight truncate">{displayName}</p>
          <p className="text-gray-400 text-xs mt-0.5">{stat} <span className="text-green-400 font-bold">+{amount}</span> · Mejora permanente de estadística</p>
        </div>
        <Icon name="chevron_right" size="xs" className="text-gray-600 shrink-0" />
      </button>
    )
  }

  if (reward.type === 'technique_book' && reward.techniqueBook) {
    const { technique } = reward.techniqueBook
    const typeLabel = TECHNIQUE_TYPE_LABELS[technique.type as keyof typeof TECHNIQUE_TYPE_LABELS] ?? technique.type
    const typeIcon  = TECHNIQUE_TYPE_ICONS[technique.type as keyof typeof TECHNIQUE_TYPE_ICONS] ?? 'star'
    return (
      <button onClick={onClaim} className={baseClass}>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon name={typeIcon} size="sm" className={iconCol} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[0.5625rem] font-bold uppercase tracking-wider ${lblCol}`}>
            {REWARD_RARITY_LABELS[reward.rarity]} · {REWARD_TYPE_LABELS[reward.type]}
          </p>
          <p className="text-white font-bold text-sm leading-tight truncate">{technique.name}</p>
          <p className="text-gray-500 text-[0.5625rem] mt-0.5">{typeLabel} · POT {technique.POT} · PP {technique.PP} · Se añade al inventario del club</p>
        </div>
        <Icon name="chevron_right" size="xs" className="text-gray-600 shrink-0" />
      </button>
    )
  }

  if (reward.type === 'equipment' && reward.equipmentItem) {
    const { name, slot, statBonuses } = reward.equipmentItem
    const slotIcon  = EQUIPMENT_SLOT_ICONS[slot]
    const slotLabel = EQUIPMENT_SLOT_LABELS[slot]
    const bonuses   = Object.entries(statBonuses) as [string, number][]
    return (
      <button onClick={onClaim} className={baseClass}>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon name={slotIcon} size="sm" className={iconCol} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[0.5625rem] font-bold uppercase tracking-wider ${lblCol}`}>
            {REWARD_RARITY_LABELS[reward.rarity]} · {REWARD_TYPE_LABELS[reward.type]}
          </p>
          <p className="text-white font-bold text-sm leading-tight truncate">{name}</p>
          <p className="text-gray-400 text-[0.5625rem] mt-0.5">{slotLabel} · {bonuses.map(([k, v]) => `${k}+${v}`).join(' · ')}</p>
        </div>
        <Icon name="chevron_right" size="xs" className="text-gray-600 shrink-0" />
      </button>
    )
  }

  return null
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const career            = useCareerStore((s) => s.career)
  const teams             = useCareerStore((s) => s.teams)
  const players           = useCareerStore((s) => s.players)
  const navigate          = useCareerStore((s) => s.navigate)
  const lastMatchResult   = useCareerStore((s) => s.lastMatchResult)
  const selectedMatchId   = useCareerStore((s) => s.selectedMatchId)
  const pendingRewards    = useCareerStore((s) => s.pendingRewards)
  const claimReward       = useCareerStore((s) => s.claimReward)

  useEffect(() => {
    if (!lastMatchResult) navigate('career_home')
  }, [lastMatchResult, navigate])

  if (!career || !lastMatchResult) {
    return (
      <div className="h-full flex items-center justify-center bg-game">
        <div className="absolute inset-0 bg-dark-900/60" />
        <p className="relative text-gray-400">Cargando resultado...</p>
      </div>
    )
  }

  const allMatches = [
    ...career.season.matches,
    ...(career.cup?.rounds.flatMap((r) => r.matches) ?? []),
  ]

  const playedMatches = allMatches
    .filter((m) => m.played && (m.homeTeamId === career.teamId || m.awayTeamId === career.teamId))
    .sort((a, b) => b.date.localeCompare(a.date))

  const lastMatch = selectedMatchId
    ? allMatches.find((m) => m.id === selectedMatchId)
    : playedMatches[0]

  const homeTeam = lastMatch ? teams.find((t) => t.id === lastMatch.homeTeamId) : null
  const awayTeam = lastMatch ? teams.find((t) => t.id === lastMatch.awayTeamId) : null
  const homeTeamName = homeTeam?.name ?? 'Local'
  const awayTeamName = awayTeam?.name ?? 'Visitante'

  const { homeGoals, awayGoals } = lastMatchResult
  const isHome    = lastMatch?.homeTeamId === career.teamId
  const userGoals = isHome ? homeGoals : awayGoals
  const oppGoals  = isHome ? awayGoals : homeGoals

  let resultLabel = 'EMPATE'
  let resultColor = 'text-yellow-400'
  let resultBg    = 'bg-yellow-900/20'
  if (userGoals > oppGoals) { resultLabel = 'VICTORIA'; resultColor = 'text-green-400'; resultBg = 'bg-green-900/20' }
  if (userGoals < oppGoals) { resultLabel = 'DERROTA';  resultColor = 'text-red-400';   resultBg = 'bg-red-900/20'  }

  const hasRewards = pendingRewards && pendingRewards.length > 0
  const r = lastMatchResult

  const stats: { label: string; home: number | string; away: number | string; pct?: boolean }[] = [
    { label: 'Posesión',  home: r.homePossession,   away: r.awayPossession,   pct: true },
    { label: 'Disparos',  home: r.homeShots,         away: r.awayShots },
    { label: 'A puerta',  home: r.homeShotsOnTarget, away: r.awayShotsOnTarget },
    { label: 'xG',        home: r.homeXG.toFixed(1), away: r.awayXG.toFixed(1) },
    { label: 'Paradas',   home: r.homeSaves,         away: r.awaySaves },
    { label: 'Córners',   home: r.homeCorners,       away: r.awayCorners },
    { label: 'Faltas',    home: r.homeFouls,         away: r.awayFouls },
    { label: 'Amarillas', home: r.homeYellows,       away: r.awayYellows },
    { label: 'Rojas',     home: r.homeReds,          away: r.awayReds },
  ]

  return (
    <div className="h-full flex flex-col bg-game overflow-hidden">
      <div className="absolute inset-0 bg-dark-900/75 pointer-events-none" />
      <div className="relative flex flex-col h-full overflow-hidden">

      {/* ── HEADER ── */}
      <div className={`shrink-0 border-b border-gold-600/30 px-4 py-3 bg-dark-900/80 ${resultBg}`}>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-right min-w-0">
            <TeamNameInline
              teamName={homeTeamName}
              badgeUrl={homeTeam?.badgeUrl}
              align="right"
              textClassName={`font-bold ${isHome ? 'text-white' : 'text-gray-400'}`}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-white text-3xl font-black tabular-nums">{homeGoals}</span>
            <div className="flex flex-col items-center">
              <span className={`text-[0.5625rem] font-extrabold tracking-widest leading-none mb-0.5 ${resultColor}`}>
                {resultLabel}
              </span>
              <span className="text-gray-600 text-xl leading-none font-light">–</span>
              {lastMatch && (
                <span className="text-gray-600 text-[0.5rem] leading-none mt-0.5 tabular-nums">J{lastMatch.round}</span>
              )}
            </div>
            <span className="text-white text-3xl font-black tabular-nums">{awayGoals}</span>
          </div>

          <div className="flex-1 min-w-0">
            <TeamNameInline
              teamName={awayTeamName}
              badgeUrl={awayTeam?.badgeUrl}
              textClassName={`font-bold ${!isHome ? 'text-white' : 'text-gray-400'}`}
            />
          </div>
        </div>
      </div>

      {/* ── RECOMPENSA ── */}
      <div className="shrink-0 border-b border-gold-600/20/50">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gold-600/20/40">
          <Icon name="redeem" size="xs" className={hasRewards ? 'text-amber-400' : 'text-gray-500'} />
          <h2 className={`text-[0.625rem] font-black uppercase tracking-widest ${hasRewards ? 'text-amber-300' : 'text-gray-500'}`}>
            Recompensa - Elige una recompensa para tu club
          </h2>
        </div>

        {hasRewards ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            {pendingRewards.map((reward, i) => {
              const statBoost    = reward.statBoost
              const rewardPlayer = statBoost ? players.find((p) => p.id === statBoost.playerId) : undefined
              return (
                <RewardCard
                  key={i}
                  reward={reward}
                  player={rewardPlayer}
                  onClaim={() => {
                    claimReward(reward)
                    navigate('career_home')
                  }}
                />
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-gray-600 text-xs">Sin recompensas pendientes</p>
            <button
              onClick={() => navigate('career_home')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors"
            >
              Continuar
            </button>
          </div>
        )}
      </div>

      {/* ── BOTTOM: ESTADÍSTICAS + EVENTOS ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ESTADÍSTICAS */}
        <div className="flex-1 flex flex-col border-r border-gold-600/20 overflow-hidden min-w-0">
          <div className="shrink-0 px-4 py-2 border-b border-gold-600/20/40 flex items-center gap-2">
            <Icon name="bar_chart" size="xs" className="text-gray-500" />
            <h2 className="text-gray-400 text-[0.625rem] font-bold uppercase tracking-widest">Estadísticas</h2>
          </div>

          <div className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-1">
            <div className="flex items-center gap-1 flex-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isHome ? 'bg-gold-500' : 'bg-dark-600/80'}`} />
              <TeamNameInline teamName={homeTeamName} badgeUrl={homeTeam?.badgeUrl} size="xs" textClassName="text-gray-500 text-[0.5rem]" />
            </div>
            <div className="flex items-center gap-1 flex-1 justify-end">
              <TeamNameInline teamName={awayTeamName} badgeUrl={awayTeam?.badgeUrl} size="xs" align="right" textClassName="text-gray-500 text-[0.5rem]" />
              <div className={`w-1.5 h-1.5 rounded-full ${!isHome ? 'bg-gold-500' : 'bg-dark-600/80'}`} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {stats.map(({ label, home, away, pct }) => (
              <StatRow key={label} label={label} home={home} away={away} pct={pct} userIsHome={isHome} />
            ))}
          </div>
        </div>

        {/* EVENTOS */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="shrink-0 px-4 py-2 border-b border-gold-600/20/40 flex items-center gap-2">
            <Icon name="timeline" size="xs" className="text-gray-500" />
            <h2 className="text-gray-400 text-[0.625rem] font-bold uppercase tracking-widest">Eventos</h2>
            <span className="ml-auto text-gray-600 text-[0.5625rem] tabular-nums">
              {lastMatchResult.events.filter((e) => e.type !== 'PHASE').length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {lastMatchResult.events.length === 0 ? (
              <p className="text-gray-600 text-xs text-center mt-8">Sin eventos</p>
            ) : (
              lastMatchResult.events.map((event, i) => (
                <EventRow
                  key={i}
                  event={event}
                  homeTeamName={homeTeamName}
                  awayTeamName={awayTeamName}
                  homeTeamBadgeUrl={homeTeam?.badgeUrl}
                  awayTeamBadgeUrl={awayTeam?.badgeUrl}
                />
              ))
            )}
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
