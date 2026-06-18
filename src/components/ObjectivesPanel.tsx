import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { canClaimObjective } from '../services/objectiveService'
import Icon from './Icon'
import type { Objective } from '../types/career'
import { formatMoney } from '../utils/formatMoney'

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
    case 'NORMAL': return 'text-gold-400'
    case 'HARD': return 'text-orange-400'
    case 'VERY_HARD': return 'text-red-400'
    default: return 'text-gray-500'
  }
}

function ObjectiveRow({ obj, onClaim, seasonFinished }: { obj: Objective; onClaim?: () => void; seasonFinished?: boolean }) {
  const progress = Math.min(obj.current / obj.target, 1)
  const isClaimable = canClaimObjective(obj)
  const isClaimed = obj.claimed
  const isFailed = obj.failed

  return (
    <div className={`px-4 py-3 border-b border-gold-600/10 last:border-0 transition-colors ${
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
            {obj.groupType === 'season_end' && !seasonFinished && (
              <span className="text-[10px] bg-blue-900/40 text-blue-400 border border-blue-700/40 rounded px-1.5 py-0.5">
                Se consigue al final de temporada
              </span>
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
              <div className="h-1.5 bg-dark-600/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                      obj.completed ? 'bg-green-500' : 'bg-gold-500'
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
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-dark-700/30 transition-colors"
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

function GroupHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2 mt-4 first:mt-0 px-4">
      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">{label}</h3>
      {sub && <span className="text-gray-600 text-[10px]">{sub}</span>}
    </div>
  )
}

export default function ObjectivesPanel() {
  const [expanded, setExpanded] = useState(true)
  const career = useCareerStore((s) => s.career)
  const claimObjective = useCareerStore((s) => s.claimObjective)

  if (!career) return null

  const objectives = career.objectives
  const seasonFinished = career.season.finished
  const claimable = objectives.filter((o) => o.completed && !o.claimed && !o.failed)
  const active = objectives.filter((o) => !o.completed && !o.failed && !o.claimed)
  const claimed = objectives.filter((o) => o.claimed)
  const failed = objectives.filter((o) => o.failed)

  const total = objectives.length

  // Group active objectives by groupType
  const seasonEndObjs  = active.filter(o => o.groupType === 'season_end' || (!o.groupType && o.category === 'SEASON'))
  const continuousObjs = active.filter(o => o.groupType === 'continuous' || (!o.groupType && o.category === 'GENERAL'))
  const matchObjs      = active.filter(o => o.groupType === 'match' || (!o.groupType && o.category === 'MATCH'))
  const ungroupedObjs  = active.filter(o => !o.groupType && !o.category)

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-700/40 transition-colors border-b border-gold-600/30"
      >
        <div className="flex items-center gap-2">
          <Icon name="flag" size="sm" className="text-gold-400" />
          <span className="text-gold-400 font-pixel text-[0.4rem] uppercase tracking-widest">Objetivos</span>
          {claimable.length > 0 && (
            <span className="bg-green-700/80 text-green-200 text-[0.45rem] font-bold px-1.5 py-0.5 rounded-full border border-green-600/40 leading-none">
              {claimable.length}
            </span>
          )}
          <span className="text-gray-600 text-[0.5rem] ml-1">{total} total</span>
        </div>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-600" />
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-gold-600/15">
          {total === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No hay objetivos</p>
          ) : (
            <>
              <Section title="Para reclamar" icon="redeem" iconClass="text-green-400" count={claimable.length}>
                {claimable.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} onClaim={() => claimObjective(obj.id)} />
                ))}
              </Section>

              {active.length > 0 && (
                <Section title="Activos" icon="pending" iconClass="text-gold-400" count={active.length}>
                  {seasonEndObjs.length > 0 && (
                    <>
                      <GroupHeader label="Fin de temporada" sub="Se evalúan al cerrar la temporada" />
                      {seasonEndObjs.map((obj) => (
                        <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} />
                      ))}
                    </>
                  )}
                  {continuousObjs.length > 0 && (
                    <>
                      <GroupHeader label="Continuos" />
                      {continuousObjs.map((obj) => (
                        <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} />
                      ))}
                    </>
                  )}
                  {matchObjs.length > 0 && (
                    <>
                      <GroupHeader label="De partido" />
                      {matchObjs.map((obj) => (
                        <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} />
                      ))}
                    </>
                  )}
                  {ungroupedObjs.map((obj) => (
                    <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} />
                  ))}
                </Section>
              )}

              <Section title="Completados" icon="check_circle" iconClass="text-gray-500" count={claimed.length}>
                {claimed.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} />
                ))}
              </Section>
              <Section title="Fallidos" icon="cancel" iconClass="text-red-500" count={failed.length}>
                {failed.map((obj) => (
                  <ObjectiveRow key={obj.id} obj={obj} seasonFinished={seasonFinished} />
                ))}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
