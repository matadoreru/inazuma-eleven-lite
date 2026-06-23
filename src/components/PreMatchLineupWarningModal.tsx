import type { LineupWarning } from '../services/lineupValidationService'
import { playerDisplayName } from '../types/player'
import Icon from './Icon'
import PositionSprite from './PositionSprite'

interface Props {
  warnings: LineupWarning[]
  missingStarters: number
  starterCount: number
  requiredCount: number
  nameStyle: 'western' | 'japanese'
  onEditLineup: () => void
  onContinue: () => void
  onCancel: () => void
}

function WarningPlayerRow({
  warning, nameStyle, kind,
}: {
  warning: LineupWarning
  nameStyle: 'western' | 'japanese'
  kind: 'injury' | 'position'
}) {
  const { player, assignedPosition } = warning
  const isInjury = kind === 'injury'
  const penaltyPercent = isInjury ? warning.injuryPenaltyPercent : warning.positionPenaltyPercent

  return (
    <div className={`flex items-center gap-4 rounded-xl border p-3 ${
      isInjury ? 'border-red-500/25 bg-red-950/20' : 'border-amber-500/25 bg-amber-950/15'
    }`}>
      <div className={`relative w-16 h-16 rounded-full overflow-hidden bg-dark-700 ring-2 shrink-0 ${
        isInjury ? 'ring-red-500/60' : 'ring-amber-500/60'
      }`}>
        <img src={player.spriteUrl} alt={playerDisplayName(player, nameStyle)} className="w-full h-full object-cover" />
        <span className="absolute inset-0 bg-dark-950/10 flex items-end justify-end p-1">
          <Icon name={isInjury ? 'healing' : 'swap_horiz'} size="sm" className={isInjury ? 'text-red-300' : 'text-amber-300'} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <p className="text-white text-base font-bold truncate flex-1">{playerDisplayName(player, nameStyle)}</p>
          <span className={`rounded-lg border px-2.5 py-1 text-sm font-black tabular-nums ${
            isInjury ? 'border-red-400/60 bg-red-950/60 text-red-200' : 'border-amber-400/60 bg-amber-950/50 text-amber-200'
          }`}>
            −{penaltyPercent}%
          </span>
        </div>
        {isInjury ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-red-300 mt-1.5">
            <Icon name="healing" size="xs" />
            Lesionado · {player.injuryDaysRemaining} día{player.injuryDaysRemaining === 1 ? '' : 's'} restante{player.injuryDaysRemaining === 1 ? '' : 's'}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm text-amber-300 mt-1.5">
            <Icon name="swap_horiz" size="xs" />
            <span className="font-semibold">Fuera de posición</span>
            <span className="flex items-center gap-1 text-gray-400">
              <PositionSprite position={player.position} size={18} /> {player.position}
              <span>→</span>
              <PositionSprite position={assignedPosition} size={18} /> {assignedPosition}
            </span>
          </div>
        )}
        {warning.isInjured && warning.isOutOfPosition && (
          <p className="mt-2 text-xs font-bold text-orange-300">
            Penalización total combinada: −{warning.totalPenaltyPercent}%
          </p>
        )}
      </div>
    </div>
  )
}

export default function PreMatchLineupWarningModal({
  warnings, missingStarters, starterCount, requiredCount, nameStyle, onEditLineup, onContinue, onCancel,
}: Props) {
  const injuredCount = warnings.filter((warning) => warning.isInjured).length
  const outOfPositionCount = warnings.filter((warning) => warning.isOutOfPosition).length
  const injuredWarnings = warnings.filter((warning) => warning.isInjured)
  const outOfPositionWarnings = warnings.filter((warning) => warning.isOutOfPosition)
  const maxPositionPenalty = outOfPositionWarnings.reduce(
    (max, warning) => Math.max(max, warning.positionPenaltyPercent), 0,
  )
  const isIncomplete = missingStarters > 0

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-orange-500/50 bg-dark-900 shadow-2xl shadow-orange-950/50 flex flex-col">
        <div className="p-5 border-b border-orange-500/25 flex items-start gap-4">
          <span className="w-12 h-12 rounded-full bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shrink-0">
            <Icon name="warning" size="md" className="text-orange-400" />
          </span>
          <div>
            <h2 className="text-white text-xl font-black">Problemas en el once titular</h2>
            <p className="text-gray-300 text-sm leading-relaxed mt-1">
              {warnings.length > 0
                ? 'Puedes disputar el partido, pero tu equipo sufrirá una penalización importante de rendimiento.'
                : 'Puedes disputar el partido, pero tu equipo saldrá al campo en desventaja.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {isIncomplete && (
                <span className="rounded-full border border-orange-500/50 bg-orange-950/50 px-3 py-1 text-xs font-bold text-orange-300">
                  Faltan {missingStarters} titular{missingStarters === 1 ? '' : 'es'} · {starterCount}/{requiredCount}
                </span>
              )}
              {injuredCount > 0 && (
                <span className="rounded-full border border-red-500/40 bg-red-950/50 px-3 py-1 text-xs font-bold text-red-300">
                  {injuredCount} lesionado{injuredCount === 1 ? '' : 's'}
                </span>
              )}
              {outOfPositionCount > 0 && (
                <span className="rounded-full border border-amber-500/40 bg-amber-950/40 px-3 py-1 text-xs font-bold text-amber-300">
                  {outOfPositionCount} fuera de posición · hasta −{maxPositionPenalty}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">
          {isIncomplete && (
            <section className="flex items-center gap-4 rounded-xl border border-orange-500/40 bg-orange-950/25 p-4">
              <span className="w-12 h-12 rounded-full bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shrink-0">
                <Icon name="group_remove" size="md" className="text-orange-300" />
              </span>
              <div className="min-w-0">
                <p className="text-white text-base font-bold">
                  Alineación incompleta · {starterCount}/{requiredCount} titulares
                </p>
                <p className="text-sm text-orange-200/90 mt-1">
                  Saldrás al campo con {missingStarters} jugador{missingStarters === 1 ? '' : 'es'} menos.
                  Tu equipo jugará en inferioridad numérica durante todo el partido.
                </p>
              </div>
            </section>
          )}

          {injuredWarnings.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-red-300">
                <Icon name="healing" size="xs" /> Lesionados ({injuredWarnings.length})
              </h3>
              {injuredWarnings.map((warning) => (
                <WarningPlayerRow key={`injury-${warning.player.id}`} warning={warning} nameStyle={nameStyle} kind="injury" />
              ))}
            </section>
          )}

          {outOfPositionWarnings.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-300">
                <Icon name="swap_horiz" size="xs" /> Fuera de posición ({outOfPositionWarnings.length})
              </h3>
              {outOfPositionWarnings.map((warning) => (
                <WarningPlayerRow key={`position-${warning.player.id}`} warning={warning} nameStyle={nameStyle} kind="position" />
              ))}
            </section>
          )}
        </div>

        <div className="p-4 border-t border-gold-600/20 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={onCancel} className="py-3 rounded-xl border border-gray-600/40 bg-dark-800 text-gray-300 font-semibold hover:bg-dark-700 transition-colors">
            Cancelar
          </button>
          <button onClick={onContinue} className="py-3 rounded-xl border border-red-500/40 bg-red-950/50 text-red-300 font-semibold hover:bg-red-900/50 transition-colors">
            Jugar de todas formas
          </button>
          <button onClick={onEditLineup} className="py-3 rounded-xl border border-gold-500/60 bg-gold-600 text-dark-950 font-black hover:bg-gold-500 transition-colors">
            Cambiar alineación
          </button>
        </div>
      </div>
    </div>
  )
}
