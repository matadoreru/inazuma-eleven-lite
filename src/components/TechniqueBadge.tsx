import type { Technique } from '../types/player'
import Icon from './Icon'
import { getTechniqueStatBoosts } from '../services/techniqueService'

interface Props {
  technique: Technique
}

const typeIcon: Record<Technique['type'], string> = {
  Tiro: 'sports_soccer',
  Regate: 'directions_run',
  Bloqueo: 'shield',
  Parada: 'back_hand',
  Mejora: 'auto_awesome',
}

const typeColor: Record<Technique['type'], string> = {
  Tiro: 'text-orange-400',
  Regate: 'text-blue-400',
  Bloqueo: 'text-stone-400',
  Parada: 'text-green-400',
  Mejora: 'text-purple-400',
}

export default function TechniqueBadge({ technique }: Props) {
  const effects = Object.entries(getTechniqueStatBoosts(technique))
    .map(([stat, amount]) => `${stat} +${amount}`)
    .join(' · ')
  return (
    <div className="inline-flex items-center gap-1.5 bg-dark-700/60 rounded px-2 py-1 text-sm" title={effects}>
      <Icon name={typeIcon[technique.type]} size="xs" className={typeColor[technique.type]} />
      <span className="text-white font-medium truncate max-w-[120px]">{technique.name}</span>
      <span className="text-yellow-400 font-bold text-xs ml-1">POT {technique.POT}</span>
      {effects && <span className="text-emerald-400 text-[0.625rem]">{effects}</span>}
    </div>
  )
}
