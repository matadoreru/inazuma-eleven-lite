import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import TeamNameInline from '../components/TeamNameInline'
import type { Player, Position, Stats } from '../types/player'
import type { WeeklyTrainingSlot, TrainingType } from '../types/training'
import { MAX_TRAINING_SLOTS } from '../types/training'
import { getEnergyState } from '../services/energyService'

// ─── Stat info ────────────────────────────────────────────────────────────────

const STAT_INFO: Record<keyof Stats, { label: string; desc: string; roles: string }> = {
  POT: {
    label: 'Potencia de Tiro',
    desc: 'Fuerza en el remate y los disparos a puerta.',
    roles: 'Delanteros, medios ofensivos.',
  },
  TEC: {
    label: 'Técnica',
    desc: 'Control del balón, regate y dominio técnico.',
    roles: 'Medios creativos, delanteros técnicos.',
  },
  PRE: {
    label: 'Precisión',
    desc: 'Exactitud en pases, centros y entradas defensivas.',
    roles: 'Todos. Esencial para defensas y mediocampistas.',
  },
  CON: {
    label: 'Control Defensivo',
    desc: 'Capacidad para recuperar balones y cortar jugadas rivales.',
    roles: 'Defensas, medios defensivos y pivotes.',
  },
  FIS: {
    label: 'Físico',
    desc: 'Resistencia, potencia aérea y fuerza en los duelos.',
    roles: 'Defensas, delanteros de área, pivotes.',
  },
  AGI: {
    label: 'Agilidad',
    desc: 'Velocidad de reacción, agilidad y movimiento en carrera.',
    roles: 'Porteros, extremos, regateadores.',
  },
  INT: {
    label: 'Inteligencia Táctica',
    desc: 'Lectura del juego, posicionamiento y toma de decisiones.',
    roles: 'Porteros, medios organizadores, defensas.',
  },
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

const ENERGY_LABEL: Record<ReturnType<typeof getEnergyState>, string> = {
  fresh: 'En forma',
  tired: 'Cansado',
  exhausted: 'Agotado',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PlayerFace({ player, size = 'sm' }: { player: Player; size?: 'xs' | 'sm' }) {
  const px = size === 'xs' ? 'w-8 h-8' : 'w-10 h-10'
  return (
    <div className={`${px} rounded-full overflow-hidden bg-gray-700 shrink-0 ring-1 ring-white/10`}>
      <img
        src={player.spriteUrl}
        alt={player.nameRomaji}
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}

function StaminaBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="h-1 bg-gray-600 rounded-full overflow-hidden w-16">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ─── Slot Card ────────────────────────────────────────────────────────────────

function SlotCard({
  slot,
  player,
  onRemove,
  onChange,
}: {
  slot: WeeklyTrainingSlot
  player: Player
  onRemove: () => void
  onChange: (updated: WeeklyTrainingSlot) => void
}) {
  const statInfo = slot.statTarget ? STAT_INFO[slot.statTarget] : null

  function handleTypeChange(type: TrainingType) {
    const updated: WeeklyTrainingSlot = { ...slot, trainingType: type }
    if (type === 'stat') {
      updated.statTarget = slot.statTarget ?? 'POT'
    } else {
      delete updated.statTarget
    }
    onChange(updated)
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex gap-3 items-start">
      <PlayerFace player={player} />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-sm font-semibold truncate">
            {player.nameRomaji.split(' ')[0]}
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
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
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
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
            >
              {TRAINABLE_STATS.map((s) => (
                <option key={s} value={s}>{STAT_INFO[s].label} ({s})</option>
              ))}
            </select>
            {statInfo && (
              <div className="bg-gray-900/60 rounded-lg px-2 py-1.5 border border-gray-700/50">
                <p className="text-gray-300 text-[0.625rem] leading-relaxed">{statInfo.desc}</p>
                <p className="text-blue-400 text-[0.625rem] mt-0.5">{statInfo.roles}</p>
              </div>
            )}
          </>
        )}

        {slot.trainingType === 'rest' && (
          <p className="text-gray-500 text-xs">+{30} stamina · +{10} moral</p>
        )}
      </div>
    </div>
  )
}

// ─── Position Change Management ───────────────────────────────────────────────

function PositionChangePanel({
  players,
  onStart,
  onCancel,
  currentDate,
}: {
  players: Player[]
  onStart: (playerId: number, target: Position) => 'ok' | 'limit_reached' | 'already_active'
  onCancel: (playerId: number) => void
  currentDate: string
}) {
  const [newPlayerId, setNewPlayerId] = useState<number | ''>('')
  const [newTarget, setNewTarget] = useState<Position>('DF')
  const [error, setError] = useState('')

  const activePlans = players.filter(
    (p) => p.career.positionChangePlan && !p.career.positionChangePlan.completed,
  )
  const slotsUsed = activePlans.length
  const canAddNew = slotsUsed < 2

  const availableForChange = players.filter(
    (p) => !p.career.positionChangePlan || p.career.positionChangePlan.completed,
  )

  const selectedPlayer = players.find((p) => p.id === Number(newPlayerId))
  const targetOptions = selectedPlayer
    ? ALL_POSITIONS.filter((pos) => pos !== selectedPlayer.position)
    : ALL_POSITIONS

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
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          Cambio de posición
        </h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          slotsUsed >= 2 ? 'bg-red-900/40 text-red-400' : 'bg-gray-700 text-gray-400'
        }`}>
          {slotsUsed}/2
        </span>
      </div>

      {/* Active plans */}
      {activePlans.length === 0 ? (
        <div className="text-gray-600 text-xs text-center py-3 border border-dashed border-gray-700 rounded-xl">
          Sin cambios activos
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {activePlans.map((player) => {
            const plan = player.career.positionChangePlan!
            const pct = Math.min(100, Math.round((plan.daysCompleted / plan.daysRequired) * 100))
            const remaining = plan.daysRequired - plan.daysCompleted
            return (
              <div key={player.id} className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <PlayerFace player={player} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold truncate">
                      {player.nameRomaji.split(' ')[0]}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {POS_FULL[player.position]} → {POS_FULL[plan.targetPosition]}
                    </p>
                  </div>
                  <button
                    onClick={() => onCancel(player.id)}
                    className="text-gray-500 hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
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
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-gray-500 text-xs font-medium">Iniciar nuevo cambio</p>
          <select
            value={newPlayerId}
            onChange={(e) => {
              setNewPlayerId(e.target.value === '' ? '' : Number(e.target.value))
              setNewTarget('DF')
              setError('')
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="">Seleccionar jugador...</option>
            {availableForChange.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameRomaji.split(' ')[0]} ({POS_LABEL[p.position]})
              </option>
            ))}
          </select>
          {newPlayerId !== '' && (
            <select
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value as Position)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white"
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
            className="w-full py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Iniciar cambio de posición
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Player Row (squad list) ──────────────────────────────────────────────────

function PlayerListRow({
  player,
  inPlan,
  planFull,
  onAdd,
}: {
  player: Player
  inPlan: boolean
  planFull: boolean
  onAdd: (player: Player) => void
}) {
  const disabled = inPlan || planFull || player.isInjured
  const energyState = getEnergyState(player.stamina)
  return (
    <button
      onClick={() => !disabled && onAdd(player)}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left
        ${inPlan ? 'bg-blue-900/30 border border-blue-700/40' : disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-700/60'}`}
    >
      <PlayerFace player={player} size="xs" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{player.nameRomaji}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-gray-500 text-[0.625rem]">{POS_LABEL[player.position]}</span>
          <StaminaBar value={player.stamina} />
          <span className={`text-[0.625rem] font-medium ${ENERGY_STYLE[energyState]}`}>
            {player.stamina}%
          </span>
        </div>
      </div>
      {player.isInjured && (
        <span className="text-red-400 text-[0.625rem] font-bold shrink-0">Lesionado</span>
      )}
      {inPlan && (
        <span className="text-blue-400 text-[0.625rem] font-bold shrink-0">En plan</span>
      )}
      {!inPlan && !player.isInjured && !planFull && (
        <span className="material-icons text-gray-500" style={{ fontSize: 16 }}>add</span>
      )}
    </button>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TrainingScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)
  const setWeeklyTrainingSlot = useCareerStore((s) => s.setWeeklyTrainingSlot)
  const removeWeeklyTrainingSlot = useCareerStore((s) => s.removeWeeklyTrainingSlot)
  const commitWeeklyTraining = useCareerStore((s) => s.commitWeeklyTraining)
  const startPositionChange = useCareerStore((s) => s.startPositionChange)
  const cancelPositionChange = useCareerStore((s) => s.cancelPositionChange)

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
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

  function handleAddPlayer(player: Player) {
    const slot: WeeklyTrainingSlot = {
      playerId: player.id,
      trainingType: 'stat',
      statTarget: 'POT',
    }
    setWeeklyTrainingSlot(slot)
  }

  const teamName = teams.find((t) => t.id === career.teamId)?.name ?? ''
  const userTeam = teams.find((t) => t.id === career.teamId)

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Entrenamiento" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto flex flex-col gap-6 lg:flex-row lg:items-start">

            {/* ── Left column: Plan + Player list ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-white text-xl font-bold">Entrenamiento semanal</h1>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-500 text-xs">
                    <span>{career.season.currentDate} ·</span>
                    <TeamNameInline teamName={teamName} badgeUrl={userTeam?.badgeUrl} size="xs" textClassName="text-gray-500 text-xs" />
                  </div>
                </div>
                <span className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
                  {slots.length}/{MAX_TRAINING_SLOTS} slots
                </span>
              </div>

              {/* Plan slots */}
              <div>
                <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Plan semanal
                </h2>
                {slots.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center text-gray-600 text-sm">
                    Selecciona jugadores de la lista para añadirlos al plan
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {slots.map((slot) => {
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
                    })}
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <button
                onClick={commitWeeklyTraining}
                disabled={slots.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all
                  ${slots.length > 0
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'}`}
              >
                Confirmar y avanzar 7 días
              </button>

              {/* Player list */}
              <div>
                <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Plantilla
                </h2>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden divide-y divide-gray-700/30">
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
                    <p className="p-4 text-center text-gray-500 text-sm">No hay jugadores en la plantilla</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column: Position changes ── */}
            <div className="lg:w-72 shrink-0">
              <PositionChangePanel
                players={squadPlayers}
                onStart={startPositionChange}
                onCancel={cancelPositionChange}
                currentDate={career.season.currentDate}
              />
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
