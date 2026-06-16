import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { canClaimObjective } from '../services/objectiveService'
import Icon from './Icon'
import type { Objective } from '../types/career'

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

function formatRewardLabel(obj: Objective): string {
  const parts: string[] = []
  if (obj.reward.money > 0) parts.push(formatMoney(obj.reward.money))
  if (obj.reward.reputation > 0) parts.push(`+${obj.reward.reputation} rep`)
  return parts.join(' · ')
}

function difficultyLabel(d?: string): string {
  switch (d) {
    case 'EASY': return 'Fácil'
    case 'NORMAL': return 'Normal'
    case 'HARD': return 'Difícil'
    case 'VERY_HARD': return 'Muy difícil'
    default: return ''
  }
}

function difficultyColor(d?: string): string {
  switch (d) {
    case 'EASY': return 'text-green-400'
    case 'NORMAL': return 'text-blue-400'
    case 'HARD': return 'text-orange-400'
    case 'VERY_HARD': return 'text-red-400'
    default: return 'text-gray-500'
  }
}

function ObjectiveRow({ obj, onClaim }: { obj: Objective; onClaim?: () => void }) {
  const progress = Math.min(obj.current / obj.target, 1)
  const isClaimable = canClaimObjective(obj)
  const isClaimed = obj.claimed
  const isFailed = obj.failed

  return (
    <div className={`px-4 py-3 border-b border-gray-800/60 last:border-0 transition-colors ${
      isClaimable ? 'bg-green-950/20' : isFailed ? 'bg-red-950/10' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium leading-tight ${
              isFailed ? 'text-gray-500 line-through' : isClaimed ? 'text-gray-400' : 'text-white'
            }`}>
              {obj.description}
            </span>
            {obj.difficulty && (
              <span className={`text-[0.625rem] font-semibold ${difficultyColor(obj.difficulty)}`}>
                {difficultyLabel(obj.difficulty)}
              </span>
            )}
            {obj.isMandatory && (
              <span className="text-[0.625rem] font-semibold text-red-400 uppercase tracking-wide">Obligatorio</span>
            )}
          </div>

          {/* Progress bar */}
          {!isFailed && !isClaimed && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500 text-xs">{obj.current} / {obj.target}</span>
                {(obj.reward.money > 0 || obj.reward.reputation > 0) && (
                  <span className="text-gray-500 text-xs">{formatRewardLabel(obj)}</span>
                )}
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    obj.completed ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Claimed or failed info */}
          {isClaimed && (
            <p className="text-green-600 text-xs mt-1">Recompensa reclamada · {formatRewardLabel(obj)}</p>
          )}
          {isFailed && (
            <p className="text-red-500 text-xs mt-1">Objetivo fallido</p>
          )}
        </div>

        {/* Claim button */}
        {isClaimable && (
          <button
            onClick={onClaim}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Icon name="redeem" size="xs" />
            Reclamar
          </button>
        )}

        {/* State icon */}
        {isClaimed && (
          <Icon name="check_circle" size="sm" className="text-green-600 shrink-0 mt-0.5" />
        )}
        {isFailed && (
          <Icon name="cancel" size="sm" className="text-red-600 shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  iconClass,
  count,
  children,
}: {
  title: string
  icon: string
  iconClass: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  if (count === 0) return null
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size="xs" className={iconClass} />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</span>
          <span className="text-xs text-gray-600 font-medium">({count})</span>
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} size="xs" className="text-gray-600" />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

export default function ObjectivesPanel() {
  const [expanded, setExpanded] = useState(true)
  const career = useCareerStore((s) => s.career)
  const claimObjective = useCareerStore((s) => s.claimObjective)

  if (!career) return null

  const objectives = career.objectives
  const claimable = objectives.filter((o) => o.completed && !o.claimed && !o.failed)
  const active = objectives.filter((o) => !o.completed && !o.failed && !o.claimed)
  const claimed = objectives.filter((o) => o.claimed)
  const failed = objectives.filter((o) => o.failed)

  const total = objectives.length

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name="flag" size="sm" className="text-yellow-400" />
          <span className="text-white font-semibold text-sm">Objetivos</span>
          {claimable.length > 0 && (
            <span className="bg-green-700 text-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {claimable.length}
            </span>
          )}
          <span className="text-gray-600 text-xs ml-1">{total} total</span>
        </div>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-500" />
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-gray-700/60">
          {total === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No hay objetivos</p>
          ) : (
            <>
              <Section title="Para reclamar" icon="redeem" iconClass="text-green-400" count={claimable.length}>
                {claimable.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} onClaim={() => claimObjective(obj.id)} />
                ))}
              </Section>
              <Section title="Activos" icon="pending" iconClass="text-blue-400" count={active.length}>
                {active.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} />
                ))}
              </Section>
              <Section title="Completados" icon="check_circle" iconClass="text-gray-500" count={claimed.length}>
                {claimed.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} />
                ))}
              </Section>
              <Section title="Fallidos" icon="cancel" iconClass="text-red-500" count={failed.length}>
                {failed.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} />
                ))}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
