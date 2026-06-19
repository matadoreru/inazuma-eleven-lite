import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import type { Player, Position, Stats } from '../types/player'
import { playerDisplayName } from '../types/player'
import type { WeeklyTrainingSlot, TrainingType } from '../types/training'
import { MAX_TRAINING_SLOTS } from '../types/training'
import { getEnergyState } from '../services/energyService'
import { useNameStyle } from '../hooks/useNameStyle'
import Icon from '../components/Icon'

// ─── Stat info ────────────────────────────────────────────────────────────────

const STAT_INFO: Record<keyof Stats, { label: string; desc: string; roles: string }> = {
  POT: { label: 'Potencia de Tiro', desc: 'Fuerza en el remate y los disparos a puerta.', roles: 'Delanteros, medios ofensivos.' },
  TEC: { label: 'Técnica', desc: 'Control del balón, regate y dominio técnico.', roles: 'Medios creativos, delanteros técnicos.' },
  PRE: { label: 'Precisión', desc: 'Exactitud en pases, centros y entradas defensivas.', roles: 'Todos. Esencial para defensas y mediocampistas.' },
  CON: { label: 'Control Defensivo', desc: 'Capacidad para recuperar balones y cortar jugadas rivales.', roles: 'Defensas, medios defensivos y pivotes.' },
  FIS: { label: 'Físico', desc: 'Resistencia, potencia aérea y fuerza en los duelos.', roles: 'Defensas, delanteros de área, pivotes.' },
  AGI: { label: 'Agilidad', desc: 'Velocidad de reacción, agilidad y movimiento en carrera.', roles: 'Porteros, extremos, regateadores.' },
  INT: { label: 'Inteligencia Táctica', desc: 'Lectura del juego, posicionamiento y toma de decisiones.', roles: 'Porteros, medios organizadores, defensas.' },
  TOT: { label: '', desc: '', roles: '' },
}

const TRAINABLE_STATS: (keyof Stats)[] = ['POT', 'TEC', 'PRE', 'CON', 'FIS', 'AGI', 'INT']
const ALL_POSITIONS: Position[] = ['GK', 'DF', 'MD', 'FW']
const POS_LABEL: Record<Position, string> = { GK: 'PR', DF: 'DF', MD: 'MD', FW: 'DL' }
const POS_FULL: Record<Position, string> = { GK: 'Portero', DF: 'Defensa', MD: 'Centrocampista', FW: 'Delantero' }

const TYPE_LABELS: Record<TrainingType, string> = {
  stat: 'Estadística',
  technique: 'Supertécnica',
  improvement_technique: 'Mejora',
  rest: 'Descanso',
}

const SELECTABLE_TYPES: TrainingType[] = ['stat', 'rest']

const ENERGY_STYLE: Record<ReturnType<typeof getEnergyState>, string> = {
  fresh: 'text-green-400',
  tired: 'text-amber-400',
  exhausted: 'text-red-400',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PlayerFace({ player, size = 'sm' }: { player: Player; size?: 'xs' | 'sm' }) {
  const nameStyle = useNameStyle()
  const px = size === 'xs' ? 'w-8 h-8' : 'w-10 h-10'
  return (
    <div className={`${px} rounded-full overflow-hidden bg-dark-700 shrink-0 ring-1 ring-white/10`}>
      <img
        src={player.spriteUrl}
        alt={playerDisplayName(player, nameStyle)}
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}

function StaminaBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden w-16">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

function SlotCard({ slot, player, onRemove, onChange }: {
  slot: WeeklyTrainingSlot
  player: Player
  onRemove: () => void
  onChange: (updated: WeeklyTrainingSlot) => void
}) {
  const nameStyle = useNameStyle()
  const statInfo = slot.statTarget ? STAT_INFO[slot.statTarget] : null

  function handleTypeChange(type: TrainingType) {
    const updated: WeeklyTrainingSlot = { ...slot, trainingType: type }
    if (type === 'stat') updated.statTarget = slot.statTarget ?? 'POT'
    else delete updated.statTarget
    onChange(updated)
  }

  return (
    <div className="bg-dark-800 border border-gold-600/30 rounded-xl p-3 flex gap-3 items-start">
      <PlayerFace player={player} />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-sm font-semibold truncate">
            {playerDisplayName(player, nameStyle).split(' ')[0]}
          </p>
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-red-400 transition-colors shrink-0 text-lg leading-none"
            title="Quitar del plan"
          >
            ×
          </button>
        </div>

        <select
          value={slot.trainingType}
          onChange={(e) => handleTypeChange(e.target.value as TrainingType)}
          className="w-full bg-dark-700 border border-gold-600/30 rounded px-2 py-1 text-xs text-white"
        >
          {SELECTABLE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        {slot.trainingType === 'stat' && (
          <>
            <select
              value={slot.statTarget ?? 'POT'}
              onChange={(e) => onChange({ ...slot, statTarget: e.target.value as keyof Stats })}
              className="w-full bg-dark-700 border border-gold-600/30 rounded px-2 py-1 text-xs text-white"
            >
              {TRAINABLE_STATS.map((s) => (
                <option key={s} value={s}>{STAT_INFO[s].label} ({s})</option>
              ))}
            </select>
            {statInfo && (
              <div className="bg-dark-900 rounded-lg px-2 py-1.5 border border-gold-600/20">
                <p className="text-gray-300 text-[0.625rem] leading-relaxed">{statInfo.desc}</p>
                <p className="text-gold-500 text-[0.625rem] mt-0.5">{statInfo.roles}</p>
              </div>
            )}
          </>
        )}

        {slot.trainingType === 'rest' && (
          <p className="text-gray-500 text-xs">+30 stamina · +10 moral</p>
        )}
      </div>
    </div>
  )
}

// ─── Position Change Panel ────────────────────────────────────────────────────

function PositionChangePanel({ players, onStart, onCancel }: {
  players: Player[]
  onStart: (playerId: number, target: Position) => 'ok' | 'limit_reached' | 'already_active'
  onCancel: (playerId: number) => void
}) {
  const nameStyle = useNameStyle()
  const [newPlayerId, setNewPlayerId] = useState<number | ''>('')
  const [newTarget, setNewTarget] = useState<Position>('DF')
  const [error, setError] = useState('')

  const activePlans = players.filter((p) => p.career.positionChangePlan && !p.career.positionChangePlan.completed)
  const slotsUsed = activePlans.length
  const canAddNew = slotsUsed < 2
  const availableForChange = players.filter((p) => !p.career.positionChangePlan || p.career.positionChangePlan.completed)
  const selectedPlayer = players.find((p) => p.id === Number(newPlayerId))
  const targetOptions = selectedPlayer ? ALL_POSITIONS.filter((pos) => pos !== selectedPlayer.position) : ALL_POSITIONS

  function handleStart() {
    if (!newPlayerId) return
    const result = onStart(Number(newPlayerId), newTarget)
    if (result === 'limit_reached') {
      setError('Solo se pueden tener 2 cambios de posición activos a la vez.')
    } else {
      setNewPlayerId('')
      setError('')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-500">Cambios activos</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
          slotsUsed >= 2 ? 'border-red-600/40 bg-red-900/30 text-red-400' : 'border-gold-600/20 bg-dark-800 text-gray-400'
        }`}>
          {slotsUsed}/2
        </span>
      </div>

      {/* Active plans */}
      {activePlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-gold-600/20 rounded-xl">
          <Icon name="swap_horiz" size="md" className="text-gray-700 mb-2" />
          <p className="text-gray-600 text-xs">Sin cambios activos</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activePlans.map((player) => {
            const plan = player.career.positionChangePlan!
            const pct = Math.min(100, Math.round((plan.daysCompleted / plan.daysRequired) * 100))
            const remaining = plan.daysRequired - plan.daysCompleted
            return (
              <div key={player.id} className="bg-dark-800 border border-gold-600/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <PlayerFace player={player} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold truncate">
                      {playerDisplayName(player, nameStyle).split(' ')[0]}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {POS_FULL[player.position]} → {POS_FULL[plan.targetPosition]}
                    </p>
                  </div>
                  <button
                    onClick={() => onCancel(player.id)}
                    className="text-gray-600 hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[0.625rem] text-gray-500">
                  <span>{pct}%</span>
                  <span>{remaining} días restantes</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New change form */}
      {canAddNew && (
        <div className="bg-dark-800 border border-gold-600/20 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-500 mb-1">Iniciar nuevo cambio</p>
          <select
            value={newPlayerId}
            onChange={(e) => { setNewPlayerId(e.target.value === '' ? '' : Number(e.target.value)); setNewTarget('DF'); setError('') }}
            className="w-full bg-dark-700 border border-gold-600/30 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="">Seleccionar jugador...</option>
            {availableForChange.map((p) => (
              <option key={p.id} value={p.id}>
                {playerDisplayName(p, nameStyle).split(' ')[0]} ({POS_LABEL[p.position]})
              </option>
            ))}
          </select>
          {newPlayerId !== '' && (
            <select
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value as Position)}
              className="w-full bg-dark-700 border border-gold-600/30 rounded px-2 py-1.5 text-xs text-white"
            >
              {targetOptions.map((pos) => (
                <option key={pos} value={pos}>{POS_FULL[pos]}</option>
              ))}
            </select>
          )}
          {error && <p className="text-red-400 text-[0.625rem]">{error}</p>}
          <button
            onClick={handleStart}
            disabled={!newPlayerId}
            className="w-full py-1.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 text-xs font-bold rounded-lg transition-colors"
          >
            Iniciar cambio de posición
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Player Row (squad list) ──────────────────────────────────────────────────

function PlayerListRow({ player, inPlan, planFull, onAdd }: {
  player: Player
  inPlan: boolean
  planFull: boolean
  onAdd: (player: Player) => void
}) {
  const nameStyle = useNameStyle()
  const disabled = inPlan || planFull || player.isInjured
  const energyState = getEnergyState(player.stamina)
  return (
    <button
      onClick={() => !disabled && onAdd(player)}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left border-b border-gold-600/10 last:border-0
        ${inPlan ? 'bg-gold-600/15' : disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-dark-700/60'}`}
    >
      <PlayerFace player={player} size="xs" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{playerDisplayName(player, nameStyle)}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-gray-500 text-[0.625rem] font-bold">{POS_LABEL[player.position]}</span>
          <StaminaBar value={player.stamina} />
          <span className={`text-[0.625rem] font-semibold tabular-nums ${ENERGY_STYLE[energyState]}`}>
            {player.stamina}%
          </span>
        </div>
      </div>
      {player.isInjured && (
        <span className="text-red-400 text-[0.625rem] font-bold shrink-0">Lesión</span>
      )}
      {inPlan && (
        <Icon name="check_circle" size="xs" className="text-gold-500 shrink-0" />
      )}
      {!inPlan && !player.isInjured && !planFull && (
        <Icon name="add" size="xs" className="text-gray-600 shrink-0" />
      )}
    </button>
  )
}

// ─── Confirm partial plan modal ───────────────────────────────────────────────

function ConfirmPartialModal({ filledSlots, maxSlots, onConfirm, onCancel }: {
  filledSlots: number
  maxSlots: number
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-gold-600/30 rounded-2xl p-6 w-full max-w-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Icon name="warning" size="sm" className="text-amber-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Plan incompleto</p>
            <p className="text-gray-400 text-xs mt-1">
              Solo has asignado <span className="text-amber-300 font-semibold">{filledSlots}/{maxSlots}</span> ranuras.
              Los jugadores sin asignar no recibirán entrenamiento esta semana.
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-dark-700 hover:bg-dark-600 text-gray-300 text-sm font-semibold rounded-xl border border-gold-600/20 transition-colors"
          >
            Volver
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 text-dark-900 text-sm font-bold rounded-xl transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TrainingScreen() {
  const career = useCareerStore((s) => s.career)
  const players = useCareerStore((s) => s.players)
  const setWeeklyTrainingSlot = useCareerStore((s) => s.setWeeklyTrainingSlot)
  const removeWeeklyTrainingSlot = useCareerStore((s) => s.removeWeeklyTrainingSlot)
  const commitWeeklyTraining = useCareerStore((s) => s.commitWeeklyTraining)
  const copyLastTraining = useCareerStore((s) => s.copyLastTraining)
  const startPositionChange = useCareerStore((s) => s.startPositionChange)
  const cancelPositionChange = useCareerStore((s) => s.cancelPositionChange)

  const [activeTab, setActiveTab] = useState<'training' | 'position'>('training')
  const [showConfirm, setShowConfirm] = useState(false)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const squadPlayers = players
    .filter((p) => p.teamId === career.teamId)
    .sort((a, b) => {
      const order: Record<string, number> = { GK: 0, DF: 1, MD: 2, FW: 3 }
      return (order[a.position] ?? 99) - (order[b.position] ?? 99)
    })

  const plan = career.weeklyTrainingPlan
  const slots = plan?.slots ?? []
  const planFull = slots.length >= MAX_TRAINING_SLOTS
  const playerMap = new Map(squadPlayers.map((p) => [p.id, p]))
  const inPlanIds = new Set(slots.map((s) => s.playerId))
  const hasLastTraining = !!career.lastCompletedTrainingSlots?.length

  function handleAddPlayer(player: Player) {
    setWeeklyTrainingSlot({ playerId: player.id, trainingType: 'stat', statTarget: 'POT' })
  }

  function handleConfirmTraining() {
    if (slots.length < MAX_TRAINING_SLOTS) {
      setShowConfirm(true)
    } else {
      commitWeeklyTraining()
    }
  }

  function handleConfirmedCommit() {
    setShowConfirm(false)
    commitWeeklyTraining()
  }

  return (
    <GameLayout>
      <main className="h-full flex overflow-hidden">

        {/* ── Left: Squad list ── */}
        <div className="w-64 shrink-0 bg-dark-900/95 border-r border-gold-600/20 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gold-600/20 shrink-0">
            <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-500">Plantilla</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {squadPlayers.map((player) => (
              <PlayerListRow
                key={player.id}
                player={player}
                inPlan={inPlanIds.has(player.id)}
                planFull={planFull && !inPlanIds.has(player.id)}
                onAdd={handleAddPlayer}
              />
            ))}
            {squadPlayers.length === 0 && (
              <p className="p-4 text-center text-gray-500 text-sm">Sin jugadores en plantilla</p>
            )}
          </div>
        </div>

        {/* ── Right: Tabs ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-dark-900/90">

          {/* Tab bar */}
          <div className="shrink-0 flex border-b border-gold-600/20 bg-dark-900">
            {(['training', 'position'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-5 py-3 text-[0.5rem] font-pixel uppercase tracking-wide transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                    : 'border-transparent text-gray-500 hover:text-gold-400 hover:border-gold-600/50'
                }`}
              >
                <Icon name={tab === 'training' ? 'fitness_center' : 'swap_horiz'} size="xs" />
                {tab === 'training' ? 'Entrenamiento semanal' : 'Cambio de posición'}
                {tab === 'position' && (() => {
                  const active = squadPlayers.filter((p) => p.career.positionChangePlan && !p.career.positionChangePlan.completed).length
                  return active > 0 ? (
                    <span className="ml-1 text-[0.4rem] bg-amber-500/30 text-amber-300 rounded-full px-1.5 py-0.5 font-bold">
                      {active}
                    </span>
                  ) : null
                })()}
              </button>
            ))}
          </div>

          {/* ── TAB: Training ── */}
          {activeTab === 'training' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Header row */}
              <div className="shrink-0 px-5 py-3 border-b border-gold-600/20 flex items-center justify-between gap-3 bg-dark-900/80">
                <div>
                  <h1 className="text-white text-sm font-bold leading-tight">Plan semanal</h1>
                  <p className="text-gray-500 text-xs mt-0.5">Añade jugadores desde la lista para configurar su entrenamiento</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasLastTraining && (
                    <button
                      onClick={copyLastTraining}
                      disabled={planFull}
                      className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 disabled:opacity-40 border border-gold-600/30 text-gold-400 text-xs font-semibold rounded-lg transition-colors"
                      title="Copiar el último entrenamiento completado"
                    >
                      <Icon name="content_copy" size="xs" />
                      Copiar último
                    </button>
                  )}
                  <span className={`text-sm font-bold px-3 py-1 rounded-full border tabular-nums ${
                    planFull
                      ? 'border-gold-500/60 bg-gold-900/20 text-gold-400'
                      : 'border-gold-600/20 bg-dark-800 text-gray-400'
                  }`}>
                    {slots.length}/{MAX_TRAINING_SLOTS}
                  </span>
                </div>
              </div>

              {/* Slot list */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {slots.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-dark-800 border border-gold-600/20 flex items-center justify-center mb-3">
                      <Icon name="fitness_center" size="md" className="text-gray-700" />
                    </div>
                    <p className="text-gray-400 text-sm font-semibold">Plan vacío</p>
                    <p className="text-gray-600 text-xs mt-1">Pulsa el + de un jugador para añadirlo al plan</p>
                  </div>
                ) : (
                  slots.map((slot) => {
                    const player = playerMap.get(slot.playerId)
                    if (!player) return null
                    return (
                      <SlotCard
                        key={slot.playerId}
                        slot={slot}
                        player={player}
                        onRemove={() => removeWeeklyTrainingSlot(slot.playerId)}
                        onChange={(updated) => setWeeklyTrainingSlot(updated)}
                      />
                    )
                  })
                )}
              </div>

              {/* Confirm button */}
              <div className="shrink-0 px-4 py-3 border-t border-gold-600/20 bg-dark-900/80">
                <button
                  onClick={handleConfirmTraining}
                  disabled={slots.length === 0}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    slots.length > 0
                      ? 'bg-gold-600 hover:bg-gold-500 text-dark-900 shadow-lg shadow-amber-900/20'
                      : 'bg-dark-800 text-gray-600 cursor-not-allowed border border-gold-600/20'
                  }`}
                >
                  Confirmar y avanzar 7 días
                </button>
              </div>
            </div>
          )}

          {/* ── TAB: Position changes ── */}
          {activeTab === 'position' && (
            <div className="flex-1 overflow-y-auto">
              <PositionChangePanel
                players={squadPlayers}
                onStart={startPositionChange}
                onCancel={cancelPositionChange}
              />
            </div>
          )}
        </div>
      </main>

      {showConfirm && (
        <ConfirmPartialModal
          filledSlots={slots.length}
          maxSlots={MAX_TRAINING_SLOTS}
          onConfirm={handleConfirmedCommit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </GameLayout>
  )
}
