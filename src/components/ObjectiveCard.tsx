import type { Objective, ObjectiveCategory, ObjectiveDifficulty } from '../types/career'
import StatBar from './StatBar'
import Icon from './Icon'

interface Props {
  objective: Objective
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

const categoryLabel: Record<ObjectiveCategory, string> = {
  MATCH: 'Partido',
  SEASON: 'Temporada',
  GENERAL: 'General',
}

const difficultyLabel: Record<ObjectiveDifficulty, string> = {
  EASY: 'Fácil',
  NORMAL: 'Normal',
  HARD: 'Difícil',
  VERY_HARD: 'Muy difícil',
}

const difficultyColor: Record<ObjectiveDifficulty, string> = {
  EASY: 'text-green-400',
  NORMAL: 'text-blue-400',
  HARD: 'text-orange-400',
  VERY_HARD: 'text-red-400',
}

export default function ObjectiveCard({ objective }: Props) {
  const category = objective.category ?? 'SEASON'
  const difficulty = objective.difficulty ?? 'NORMAL'

  let statusIcon = 'radio_button_unchecked'
  let statusClass = objective.isMandatory ? 'text-yellow-400' : 'text-blue-400'
  let statusLabel = objective.isMandatory ? 'Obligatorio' : 'Bonus'

  if (objective.claimed) {
    statusIcon = 'done_all'
    statusClass = 'text-gray-500'
    statusLabel = 'Reclamado'
  } else if (objective.completed) {
    statusIcon = 'check_circle'
    statusClass = 'text-green-400'
    statusLabel = 'Completado'
  } else if (objective.failed) {
    statusIcon = 'cancel'
    statusClass = 'text-red-400'
    statusLabel = 'Fallido'
  }

  const rewardParts: string[] = []
  if (objective.reward.money > 0) rewardParts.push(formatMoney(objective.reward.money))
  if (objective.reward.reputation > 0) rewardParts.push(`+${objective.reward.reputation} rep`)

  return (
    <div className={`bg-dark-800/70 rounded-lg p-3 border ${
      objective.claimed ? 'border-gold-600/15 opacity-60' :
      objective.completed ? 'border-green-700' :
      objective.failed ? 'border-red-800' : 'border-gold-600/20'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium leading-snug">{objective.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-xs">{categoryLabel[category]}</span>
            <span className="text-gray-700 text-xs">·</span>
            <span className={`text-xs font-medium ${difficultyColor[difficulty]}`}>
              {difficultyLabel[difficulty]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Icon name={statusIcon} size="sm" className={statusClass} />
          <span className={`text-xs font-bold ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>
      <StatBar
        label="Prog"
        value={objective.current}
        max={objective.target}
        color={
          objective.claimed ? 'bg-dark-500/80' :
          objective.completed ? 'bg-green-500' :
          objective.failed ? 'bg-red-500' : 'bg-blue-500'
        }
      />
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {objective.current} / {objective.target}
        </span>
        {rewardParts.length > 0 && (
          <div className="flex items-center gap-1 text-yellow-400 font-semibold">
            <Icon name="payments" size="xs" />
            {rewardParts.join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
