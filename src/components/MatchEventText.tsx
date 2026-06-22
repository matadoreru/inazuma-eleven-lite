import type { MatchEvent } from '../types/competition'
import type { Technique } from '../types/player'
import { supertechniques } from '../data/supertechniques'

const TECHNIQUE_TYPE_BY_NAME = new Map(
  Object.values(supertechniques).map((technique) => [technique.name, technique.type]),
)

const TECHNIQUE_COLORS: Record<Technique['type'], string> = {
  Parada: 'border-yellow-400/70 bg-yellow-900/55 text-yellow-200',
  Bloqueo: 'border-green-400/70 bg-green-900/55 text-green-200',
  Regate: 'border-blue-400/70 bg-blue-900/55 text-blue-200',
  Tiro: 'border-rose-400/70 bg-rose-950/60 text-rose-200',
  Mejora: 'border-purple-400/70 bg-purple-950/60 text-purple-200',
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function MatchEventText({ event }: { event: MatchEvent }) {
  const storedTechniques = event.techniques ?? []
  const storedTypeByName = new Map(storedTechniques.map((technique) => [technique.name, technique.type]))
  const techniqueNames = [...new Set([
    ...storedTechniques.map((technique) => technique.name),
    ...(event.techniqueNames?.length ? event.techniqueNames : [event.techniqueName])
      .filter((name): name is string => Boolean(name)),
  ])].sort((a, b) => b.length - a.length)

  if (techniqueNames.length === 0) return <>{event.text}</>

  const techniqueSet = new Set(techniqueNames)
  const parts = event.text.split(new RegExp(`(${techniqueNames.map(escapeRegExp).join('|')})`, 'g'))

  return <>{parts.map((part, index) => techniqueSet.has(part) ? (
    <span
      key={`${part}-${index}`}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 mx-1 text-[0.875em] leading-tight font-black align-baseline ${
        TECHNIQUE_COLORS[storedTypeByName.get(part) ?? TECHNIQUE_TYPE_BY_NAME.get(part) ?? 'Mejora']
      }`}
    >
      {part}
    </span>
  ) : part)}</>
}
