import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { teams } from '../data/teams'
import { players } from '../data/players'
import StepperBar from '../components/StepperBar'
import AvatarPicker from '../components/AvatarPicker'
import TeamSelectCard from '../components/TeamSelectCard'
import TeamBadgeImage from '../components/TeamBadgeImage'
import PositionSprite from '../components/PositionSprite'
import ElementBadge from '../components/ElementBadge'
import type { Team } from '../types/team'
import type { Stats } from '../types/player'
import { getPlayerStatsSummary } from '../types/player'
import { statColor } from '../components/StatBar'
import { DIFFICULTY_PRESETS, DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'

const STAT_KEYS: (keyof Stats)[] = ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT']

type Step = 0 | 1 | 2 | 3
type DifficultyMode = 'easy' | 'normal' | 'hard' | 'custom'

const STEPS = ['Entrenador', 'Equipo', 'Dificultad', 'Confirmar']

const LEAGUE_LABELS: Record<string, string> = {
  first_division: 'Primera División',
  second_division: 'Segunda División',
}

function DiffSlider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-28 accent-purple-500"
      />
      <span className="text-purple-300 text-sm w-12 text-right tabular-nums">{format(value)}</span>
    </div>
  )
}

function DiffStepper({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold flex items-center justify-center"
      >−</button>
      <span className="text-purple-300 text-sm w-8 text-center tabular-nums font-medium">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold flex items-center justify-center"
      >+</button>
    </div>
  )
}

export default function NewCareerScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const startNewCareer = useCareerStore((s) => s.startNewCareer)

  const [step, setStep] = useState<Step>(0)
  const [managerName, setManagerName] = useState('')
  const [managerAvatar, setManagerAvatar] = useState('/avatars/avatar-1.svg')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>('normal')
  const [difficulty, setDifficulty] = useState<DifficultySettings>(DEFAULT_DIFFICULTY)

  const selectedTeam: Team | undefined = teams.find((t) => t.id === selectedTeamId)
  const squadPlayers = selectedTeam
    ? players.filter((p) => selectedTeam.playerIds.includes(p.id))
    : []
  const starters = squadPlayers.filter((p) => {
    const slot = selectedTeam?.lineup.find((l) => l.playerId === p.id)
    return slot?.isStarter
  })

  function handleCreate() {
    if (!managerName.trim() || selectedTeamId === null) return
    startNewCareer(managerName.trim(), selectedTeamId, managerAvatar, difficulty)
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <StepperBar steps={STEPS} current={step} />

      <div className="flex-1 overflow-y-auto">
        {/* ── STEP 0: Coach ── */}
        {step === 0 && (
          <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold mb-1">Crear Entrenador</h2>
              <p className="text-gray-400 text-sm">¿Cómo se llama tu entrenador?</p>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Nombre del Entrenador
              </label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Tu nombre..."
                maxLength={30}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-lg"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-3">
                Avatar del Entrenador
              </label>
              <AvatarPicker value={managerAvatar} onChange={setManagerAvatar} />
            </div>
          </div>
        )}

        {/* ── STEP 1: Team ── */}
        {step === 1 && (
          <div className="flex h-full">
            <div className="w-80 flex-shrink-0 border-r border-gray-800 overflow-y-auto px-4 py-6 flex flex-col gap-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Selecciona tu Equipo
              </p>
              {teams.map((team) => (
                <TeamSelectCard
                  key={team.id}
                  team={team}
                  isSelected={selectedTeamId === team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {selectedTeam ? (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-5">
                    <TeamBadgeImage teamName={selectedTeam.name} badgeUrl={selectedTeam.badgeUrl} size="lg" />
                    <div>
                      <h2 className="text-white text-2xl font-bold">{selectedTeam.name}</h2>
                      <p className="text-gray-400">{LEAGUE_LABELS[selectedTeam.leagueId]}</p>
                      <p className="text-gray-500 text-sm">Tier {selectedTeam.tier} · Reputación {selectedTeam.reputation}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">
                      Plantilla titular ({starters.length} jugadores)
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {starters.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                          <img
                            src={p.spriteUrl}
                            alt={p.name}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            className="w-16 h-16 object-contain rounded flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                              <PositionSprite position={p.position} size={25} />
                              <ElementBadge element={p.element} size="xs" />
                            </div>
                            <div className="flex items-end gap-3">
                              {STAT_KEYS.map((stat) => (
                                <div key={stat} className="flex flex-col items-center">
                                  <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">{stat}</span>
                                  <span className="text-gray-300 text-xs font-medium">{p.stats[stat]}</span>
                                </div>
                              ))}
                              <div className="ml-auto flex flex-col items-center">
                                <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">Media</span>
                                <span className="text-sm font-bold" style={{ color: statColor(getPlayerStatsSummary(p).media, 250) }}>{getPlayerStatsSummary(p).media}</span>
                                <span className="text-gray-500 text-[0.5625rem] tabular-nums">{getPlayerStatsSummary(p).total}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  <p>← Selecciona un equipo</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Difficulty ── */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold mb-1">Dificultad</h2>
              <p className="text-gray-400 text-sm">Elige el nivel de desafío de tu carrera.</p>
            </div>

            {/* Preset cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setDifficultyMode('easy'); setDifficulty(DIFFICULTY_PRESETS.easy) }}
                className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'easy' ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
              >
                <p className="text-green-400 text-lg font-bold mb-1">Fácil</p>
                <p className="text-gray-400 text-xs">Más presupuesto, rivales más débiles, entrenamiento y crecimiento acelerados.</p>
              </button>

              <button
                onClick={() => { setDifficultyMode('normal'); setDifficulty(DIFFICULTY_PRESETS.normal) }}
                className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'normal' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
              >
                <p className="text-blue-400 text-lg font-bold mb-1">Normal</p>
                <p className="text-gray-400 text-xs">Valores por defecto. Experiencia equilibrada para la mayoría de jugadores.</p>
              </button>

              <button
                onClick={() => { setDifficultyMode('hard'); setDifficulty(DIFFICULTY_PRESETS.hard) }}
                className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'hard' ? 'border-red-500 bg-red-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
              >
                <p className="text-red-400 text-lg font-bold mb-1">Difícil</p>
                <p className="text-gray-400 text-xs">Rivales más fuertes, stamina limitada, fichajes más caros. Solo para los más exigentes.</p>
              </button>

              <button
                onClick={() => setDifficultyMode('custom')}
                className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'custom' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
              >
                <p className="text-purple-400 text-lg font-bold mb-1">Custom</p>
                <p className="text-gray-400 text-xs">Configura manualmente cada parámetro a tu gusto.</p>
              </button>
            </div>

            {/* Custom panel */}
            {difficultyMode === 'custom' && (
              <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 flex flex-col gap-5">
                <p className="text-white font-semibold text-sm uppercase tracking-wide">Configuración avanzada</p>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Partidos</p>
                  <DiffSlider label="Fuerza rivales" value={difficulty.aiStrengthMultiplier} min={0.7} max={1.3} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, aiStrengthMultiplier: v }))} />
                </div>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Energía</p>
                  <div className="flex flex-col gap-3">
                    <DiffStepper label="Stamina recuperada/día" value={difficulty.staminaRecoveryPerDay} min={3} max={15} onChange={(v) => setDifficulty((d) => ({ ...d, staminaRecoveryPerDay: v }))} />
                    <DiffStepper label="Desgaste titular/partido" value={difficulty.starterStaminaDrain} min={15} max={35} onChange={(v) => setDifficulty((d) => ({ ...d, starterStaminaDrain: v }))} />
                    <DiffStepper label="Desgaste banquillo/partido" value={difficulty.benchStaminaDrain} min={4} max={15} onChange={(v) => setDifficulty((d) => ({ ...d, benchStaminaDrain: v }))} />
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Entrenamiento</p>
                  <DiffSlider label="Ganancia de entrenamiento" value={difficulty.trainingGainMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, trainingGainMultiplier: v }))} />
                </div>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Crecimiento</p>
                  <div className="flex flex-col gap-3">
                    <DiffSlider label="Crecimiento temporal" value={difficulty.seasonGrowthMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, seasonGrowthMultiplier: v }))} />
                    <DiffSlider label="Velocidad cambio de posición" value={difficulty.positionChangeDaysMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, positionChangeDaysMultiplier: v }))} />
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Finanzas</p>
                  <div className="flex flex-col gap-3">
                    <DiffSlider label="Coste de fichajes" value={difficulty.transferCostMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, transferCostMultiplier: v }))} />
                    <DiffSlider label="Presupuesto inicial" value={difficulty.budgetMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, budgetMultiplier: v }))} />
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Ojeadores</p>
                  <DiffSlider label="Coste de análisis" value={difficulty.scoutCostMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, scoutCostMultiplier: v }))} />
                </div>

                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Recompensas por partido</p>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setDifficulty((d) => ({ ...d, rewardChoices: n }))}
                        className={`w-12 h-10 rounded-lg font-bold text-sm transition-colors ${difficulty.rewardChoices === n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && selectedTeam && (
          <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold mb-1">Confirmar Carrera</h2>
              <p className="text-gray-400 text-sm">Revisa los datos antes de comenzar.</p>
            </div>

            <div className="bg-gray-800 rounded-2xl p-5 flex items-center gap-4 border border-gray-700">
              <img
                src={managerAvatar}
                alt="Entrenador"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
                className="w-16 h-16 rounded-full object-cover bg-gray-700 flex-shrink-0"
              />
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Entrenador</p>
                <p className="text-white text-xl font-bold">{managerName}</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <TeamBadgeImage teamName={selectedTeam.name} badgeUrl={selectedTeam.badgeUrl} size="lg" />
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Equipo</p>
                  <p className="text-white text-xl font-bold">{selectedTeam.name}</p>
                  <p className="text-gray-400 text-sm">{LEAGUE_LABELS[selectedTeam.leagueId]}</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Titular ({starters.length} jugadores)
              </p>
              <div className="flex flex-col gap-1.5">
                {starters.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-gray-700/50 rounded-lg px-3 py-2">
                    <img
                      src={p.spriteUrl}
                      alt={p.name}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      className="w-16 h-16 object-contain rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                        <PositionSprite position={p.position} size={25} />
                        <ElementBadge element={p.element} size="xs" />
                      </div>
                      <div className="flex items-end gap-3">
                        {STAT_KEYS.map((stat) => (
                          <div key={stat} className="flex flex-col items-center">
                            <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">{stat}</span>
                            <span className="text-gray-300 text-xs font-medium">{p.stats[stat]}</span>
                          </div>
                        ))}
                        <div className="ml-auto flex flex-col items-center">
                          <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">Media</span>
                          <span className="text-sm font-bold" style={{ color: statColor(getPlayerStatsSummary(p).media, 250) }}>{getPlayerStatsSummary(p).media}</span>
                          <span className="text-gray-500 text-[0.5625rem] tabular-nums">{getPlayerStatsSummary(p).total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Difficulty summary */}
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Dificultad</p>
              <div className="flex items-center gap-3">
                {difficultyMode === 'easy' && <span className="text-green-400 font-bold text-lg">Fácil</span>}
                {difficultyMode === 'normal' && <span className="text-blue-400 font-bold text-lg">Normal</span>}
                {difficultyMode === 'hard' && <span className="text-red-400 font-bold text-lg">Difícil</span>}
                {difficultyMode === 'custom' && <span className="text-purple-400 font-bold text-lg">Custom</span>}
              </div>
              {difficultyMode === 'custom' && (
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                  {[
                    ['Fuerza rivales', `×${difficulty.aiStrengthMultiplier.toFixed(2)}`],
                    ['Stamina/día', `${difficulty.staminaRecoveryPerDay} pts`],
                    ['Desgaste titular', `${difficulty.starterStaminaDrain} pts`],
                    ['Desgaste banquillo', `${difficulty.benchStaminaDrain} pts`],
                    ['Entrenamiento', `×${difficulty.trainingGainMultiplier.toFixed(2)}`],
                    ['Crecimiento temporal', `×${difficulty.seasonGrowthMultiplier.toFixed(2)}`],
                    ['Cambio posición', `×${difficulty.positionChangeDaysMultiplier.toFixed(2)}`],
                    ['Coste fichajes', `×${difficulty.transferCostMultiplier.toFixed(2)}`],
                    ['Presupuesto inicial', `×${difficulty.budgetMultiplier.toFixed(2)}`],
                    ['Coste ojeadores', `×${difficulty.scoutCostMultiplier.toFixed(2)}`],
                    ['Recompensas/partido', `${difficulty.rewardChoices}`],
                  ].map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-500">{key}</span>
                      <span className="text-gray-300 font-medium tabular-nums">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav bar ── */}
      <div className="flex-shrink-0 border-t border-gray-800 px-6 py-4 flex gap-3 bg-gray-900">
        <button
          onClick={() => {
            if (step === 0) navigate('main_menu')
            else setStep((s) => (s - 1) as Step)
          }}
          className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
        >
          ← Atrás
        </button>
        {step < 3 ? (
          <button
            onClick={() => {
              if (step === 0 && !managerName.trim()) return
              if (step === 1 && selectedTeamId === null) return
              setStep((s) => (s + 1) as Step)
            }}
            disabled={
              (step === 0 && !managerName.trim()) ||
              (step === 1 && selectedTeamId === null)
            }
            className="ml-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
          >
            Continuar →
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="ml-auto px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
          >
            Crear Carrera
          </button>
        )}
      </div>
    </div>
  )
}
