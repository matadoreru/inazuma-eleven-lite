import GameLayout from '../components/GameLayout'
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import StatBar, { statColor } from '../components/StatBar'
import TechniqueBadge from '../components/TechniqueBadge'
import { formatMoney } from '../utils/formatMoney'
import { formatMoneyInput, parseMoneyInput } from '../utils/moneyInput'
import ElementBadge from '../components/ElementBadge'
import PositionSprite from '../components/PositionSprite'
import Icon from '../components/Icon'
import { MAX_CALLUP } from '../types/team'
import type { Player, Stats } from '../types/player'
import { statTotal, getPlayerStatsSummary, playerDisplayName } from '../types/player'
import { useNameStyle } from '../hooks/useNameStyle'
import type { PotentialAnalysis, AnalysisTier } from '../types/career'
import {
  getNextAnalysisTier,
  calcAnalysisCost,
  previewAnalysisTier,
  getConfidenceLabel,
  getGrowthCurveLabel,
  getDevelopmentRiskLabel,
  getTierConfig,
} from '../services/potentialService'
import type { EquipmentSlot, EquipmentItem } from '../types/equipment'
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SLOT_ICONS, EMPTY_EQUIPMENT } from '../types/equipment'
import { calcTransferValue, getNegotiationFailureFeedback } from '../services/transferService'
import { getNormalTechniques, getImprovementTechniques, MAX_NORMAL_TECHNIQUES, MAX_IMPROVEMENT_TECHNIQUES } from '../services/techniqueService'
import type { TechniqueBook } from '../types/inventory'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = formatMoney

const STAT_KEYS: (keyof Stats)[] = ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT']

// ─── Jersey modal ────────────────────────────────────────────────────────────

function JerseyModal({
  currentNumber,
  playerName,
  players,
  onClose,
  onChange,
  onSwap,
}: {
  currentNumber: number
  playerName: string
  players: { id: number; name: string; nameRomaji: string; jerseyNumber: number }[]
  onClose: () => void
  onChange: (num: number) => 'ok' | 'conflict'
  onSwap: (conflictId: number) => void
}) {
  const nameStyle = useNameStyle()
  const [input, setInput] = useState(currentNumber > 0 ? String(currentNumber) : '')
  const [conflictId, setConflictId] = useState<number | null>(null)
  const conflictPlayer = conflictId !== null ? players.find((p) => p.id === conflictId) : null

  function handleSubmit() {
    const num = parseInt(input, 10)
    if (isNaN(num) || num < 1 || num > 99) return
    const result = onChange(num)
    if (result === 'ok') {
      onClose()
    } else {
      const c = players.find((p) => p.jerseyNumber === num)
      setConflictId(c?.id ?? null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="panel rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 pt-5 pb-4 border-b border-gold-600/20">
          <p className="text-white font-bold text-base">Cambiar dorsal</p>
          <p className="text-gray-400 text-sm mt-0.5">{playerName}</p>
        </div>
        <div className="px-5 py-4">
          {!conflictPlayer ? (
            <>
              <p className="text-gray-500 text-xs mb-3">
                Dorsal actual: <span className="text-white font-semibold">#{currentNumber}</span>
              </p>
              <input
                type="number" min={1} max={99}
                value={input}
                onChange={(e) => { setInput(e.target.value); setConflictId(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Nuevo dorsal (1–99)"
                autoFocus
                className="w-full bg-dark-700/80 border border-gold-600/30 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500 text-sm"
              />
            </>
          ) : (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Icon name="warning" size="sm" className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium">
                  El #{input} ya lo tiene {playerDisplayName(conflictPlayer, nameStyle)}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">Puedes intercambiar los dorsales.</p>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-dark-700/80 hover:bg-dark-600/80 text-white rounded-xl text-sm font-semibold transition-colors">
            Cancelar
          </button>
          {!conflictPlayer ? (
            <button
              onClick={handleSubmit}
              disabled={!input || isNaN(parseInt(input, 10))}
              className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 rounded-xl text-sm font-semibold transition-colors"
            >
              Cambiar
            </button>
          ) : (
            <button
              onClick={() => { onSwap(conflictId!); onClose() }}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Intercambiar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Swap callup modal ───────────────────────────────────────────────────────

function SwapCallupModal({
  playerInName,
  benchPlayers,
  onConfirm,
  onCancel,
}: {
  playerInName: string
  benchPlayers: { id: number; name: string; nameRomaji: string; position: string; stats: Stats }[]
  onConfirm: (outId: number) => void
  onCancel: () => void
}) {
  const nameStyle = useNameStyle()
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="panel rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 pt-5 pb-4 border-b border-gold-600/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="group_remove" size="xs" className="text-amber-400" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Máximo de convocados alcanzado</p>
              <p className="text-gray-400 text-sm mt-1">
                Para convocar a <span className="text-white font-medium">{playerInName}</span>, elige un suplente para desconvocar.
              </p>
            </div>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-700/50">
          {benchPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                selected === p.id ? 'bg-gold-600/15 border-l-2 border-gold-500' : 'hover:bg-dark-700/40 border-l-2 border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-tight">{playerDisplayName(p, nameStyle)}</p>
                <p className="text-gray-500 text-xs">{p.position} · Media {p.stats.TOT} · Total {statTotal(p.stats)}</p>
              </div>
              {selected === p.id && <Icon name="check_circle" size="sm" className="text-gold-500 shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-gold-600/15 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-dark-700/80 hover:bg-dark-600/80 text-white rounded-xl text-sm font-semibold transition-colors">Cancelar</button>
          <button
            onClick={() => selected !== null && onConfirm(selected)}
            disabled={selected === null}
            className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 rounded-xl text-sm font-semibold transition-colors"
          >
            Intercambiar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Potential analysis modal ─────────────────────────────────────────────────

function PotentialModal({
  analysis,
  nextTier,
  cost,
  canAfford,
  playerMinutes,
  team,
  onClose,
  onConfirm,
}: {
  analysis: PotentialAnalysis
  nextTier: AnalysisTier
  cost: number
  canAfford: boolean
  playerMinutes: number
  team: { reputation: number; scoutLevel?: number; facilitiesLevel?: number }
  onClose: () => void
  onConfirm: () => void
}) {
  const cfg = getTierConfig(nextTier)
  const preview = previewAnalysisTier(analysis, nextTier, team as Parameters<typeof previewAnalysisTier>[2], playerMinutes)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="panel rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 pt-5 pb-4 border-b border-gold-600/20">
          <p className="text-white font-bold text-base">{cfg.label}</p>
          <p className="text-gray-400 text-sm mt-0.5">{cfg.description}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Current range */}
          <div>
            <p className="text-gray-500 text-xs mb-2">Rango actual</p>
            <div className="flex items-center gap-3 bg-dark-700/50 rounded-xl px-4 py-3">
              <div className="text-center w-10">
                <p className="text-white text-lg font-bold">{analysis.rangeMin}</p>
                <p className="text-gray-600 text-xs">Mín</p>
              </div>
              <div className="flex-1 h-1.5 bg-dark-600/80 rounded-full relative">
                <div className="absolute inset-y-0 bg-amber-500/60 rounded-full"
                  style={{
                    left: `${((analysis.rangeMin - 1) / 98) * 100}%`,
                    right: `${((99 - analysis.rangeMax) / 98) * 100}%`,
                  }}
                />
              </div>
              <div className="text-center w-10">
                <p className="text-white text-lg font-bold">{analysis.rangeMax}</p>
                <p className="text-gray-600 text-xs">Máx</p>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-1.5 text-center">
              Confianza: {getConfidenceLabel(analysis.uncertainty)}
            </p>
          </div>

          {/* Preview after analysis */}
          <div>
            <p className="text-gray-500 text-xs mb-2">Tras el análisis</p>
            <div className="flex items-center gap-3 bg-gold-900/20 border border-gold-700/30 rounded-xl px-4 py-3">
              <div className="text-center w-10">
                <p className="text-gold-300 text-lg font-bold">{preview.rangeMin}</p>
                <p className="text-gray-600 text-xs">Mín</p>
              </div>
              <div className="flex-1 h-1.5 bg-dark-600/80 rounded-full relative">
                <div className="absolute inset-y-0 bg-gold-500 rounded-full"
                  style={{
                    left: `${((preview.rangeMin - 1) / 98) * 100}%`,
                    right: `${((99 - preview.rangeMax) / 98) * 100}%`,
                  }}
                />
              </div>
              <div className="text-center w-10">
                <p className="text-gold-300 text-lg font-bold">{preview.rangeMax}</p>
                <p className="text-gray-600 text-xs">Máx</p>
              </div>
            </div>
            <p className="text-gold-400 text-xs mt-1.5 text-center">
              Confianza: {getConfidenceLabel(preview.uncertainty)}
            </p>
          </div>

          {/* What gets revealed */}
          {cfg.reveals.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-dark-700/40">
              <Icon name="info" size="xs" className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-gray-300 text-xs">
                Desvela: {cfg.reveals.map((r) => {
                  const labels: Record<string, string> = {
                    growthCurve: 'curva de crecimiento',
                    matchAffinity: 'afinidad con partidos',
                    trainingAffinity: 'afinidad con entrenamiento',
                    developmentRisk: 'riesgo de desarrollo',
                    strengthsFutures: 'fortalezas futuras',
                    recommendation: 'recomendación del scout',
                  }
                  return labels[r] ?? r
                }).join(', ')}
              </p>
            </div>
          )}

          {!canAfford && (
            <p className="text-red-400 text-xs text-center">Presupuesto insuficiente ({fmt(cost)} requerido)</p>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-dark-700/80 hover:bg-dark-600/80 text-white rounded-xl text-sm font-semibold transition-colors">Cancelar</button>
          <button
            onClick={() => { if (canAfford) { onConfirm(); onClose() } }}
            disabled={!canAfford}
            className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 rounded-xl text-sm font-bold transition-colors"
          >
            Invertir {fmt(cost)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Potential section (inside player detail) ────────────────────────────────

function PotentialSection({
  analysis,
  budget,
  playerMinutes,
  team,
  player,
  difficulty,
  onAnalyze,
}: {
  analysis: PotentialAnalysis | null
  budget: number
  playerMinutes: number
  team: { reputation: number; scoutLevel?: number; facilitiesLevel?: number } | undefined
  player: Player
  difficulty: import('../types/career').DifficultySettings
  onAnalyze: () => void
}) {
  if (!analysis || !team) return null

  const nextTier = getNextAnalysisTier(analysis)
  const cost = nextTier ? calcAnalysisCost(nextTier, analysis, team as Parameters<typeof calcAnalysisCost>[2], player, difficulty) : 0
  const confidence = getConfidenceLabel(analysis.uncertainty)
  const { discovered } = analysis

  const confidenceColor =
    confidence === 'Muy alta' ? 'text-green-400' :
    confidence === 'Alta' ? 'text-gold-500' :
    confidence === 'Media' ? 'text-yellow-400' :
    'text-gray-400'

  return (
    <div className="rounded-2xl border border-gold-600/40 bg-[#0b0b12] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gold-600/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="analytics" size="xs" className="text-gold-500" />
          <h2 className="text-white text-sm font-semibold">Potencial</h2>
        </div>
        {analysis.analysesCompleted.length > 0 && (
          <span className="text-gray-600 text-xs">{analysis.analysesCompleted.length}/5 análisis</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Range display */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Potencial estimado</p>
            <div className="flex items-baseline gap-2">
              <span className="text-white text-2xl font-bold tabular-nums">
                {analysis.rangeMin}–{analysis.rangeMax}
              </span>
              {analysis.rangeMax - analysis.rangeMin <= 4 && (
                <span className="text-green-400 text-xs font-semibold">Muy preciso</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs mb-0.5">Confianza</p>
            <p className={`text-sm font-semibold ${confidenceColor}`}>{confidence}</p>
          </div>
        </div>

        {/* Visual range bar */}
        <div className="relative h-2 bg-dark-700/70 rounded-full">
          <div
            className="absolute inset-y-0 bg-amber-500/60 rounded-full"
            style={{
              left: `${((analysis.rangeMin - 1) / 98) * 100}%`,
              right: `${((99 - analysis.rangeMax) / 98) * 100}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-gray-700 text-xs">
          <span>1</span><span>99</span>
        </div>

        {/* Discovered info */}
        {(discovered.growthCurve || discovered.developmentRisk || discovered.trainingAffinity !== undefined || discovered.matchAffinity !== undefined) && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {discovered.growthCurve && (
              <div className="bg-dark-700/40 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs">Curva</p>
                <p className="text-white text-xs font-semibold mt-0.5">{getGrowthCurveLabel(discovered.growthCurve)}</p>
              </div>
            )}
            {discovered.developmentRisk && (
              <div className="bg-dark-700/40 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs">Riesgo</p>
                <p className={`text-xs font-semibold mt-0.5 ${
                  discovered.developmentRisk === 'low' ? 'text-green-400' :
                  discovered.developmentRisk === 'medium' ? 'text-yellow-400' : 'text-red-400'
                }`}>{getDevelopmentRiskLabel(discovered.developmentRisk)}</p>
              </div>
            )}
            {discovered.trainingAffinity !== undefined && (
              <div className="bg-dark-700/40 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs">Afinidad entreno</p>
                <p className={`text-xs font-semibold mt-0.5 ${discovered.trainingAffinity >= 1.2 ? 'text-green-400' : discovered.trainingAffinity <= 0.85 ? 'text-red-400' : 'text-gray-300'}`}>
                  {discovered.trainingAffinity >= 1.2 ? 'Alta' : discovered.trainingAffinity <= 0.85 ? 'Baja' : 'Normal'}
                </p>
              </div>
            )}
            {discovered.matchAffinity !== undefined && (
              <div className="bg-dark-700/40 rounded-lg px-3 py-2">
                <p className="text-gray-500 text-xs">Afinidad partidos</p>
                <p className={`text-xs font-semibold mt-0.5 ${discovered.matchAffinity >= 1.2 ? 'text-green-400' : discovered.matchAffinity <= 0.85 ? 'text-red-400' : 'text-gray-300'}`}>
                  {discovered.matchAffinity >= 1.2 ? 'Alta' : discovered.matchAffinity <= 0.85 ? 'Baja' : 'Normal'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Strengths */}
        {discovered.strengthsFutures && discovered.strengthsFutures.length > 0 && (
          <div>
            <p className="text-gray-500 text-xs mb-1.5">Fortalezas futuras</p>
            <div className="flex flex-wrap gap-1.5">
              {discovered.strengthsFutures.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 bg-gold-900/30 border border-gold-600/40 text-gold-300 rounded-md font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Scout recommendation */}
        {discovered.recommendation && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-dark-700/40 border border-gold-600/20">
            <Icon name="person_pin" size="xs" className="text-gold-500 shrink-0 mt-0.5" />
            <p className="text-gray-300 text-xs leading-relaxed">{discovered.recommendation}</p>
          </div>
        )}

        {/* Minutes observed */}
        {playerMinutes > 0 && (
          <p className="text-gray-600 text-xs">Minutos observados este temporada: {playerMinutes}'</p>
        )}

        {/* Analyze button */}
        {nextTier ? (
          <button
            onClick={onAnalyze}
            disabled={budget < cost}
            className="w-full mt-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="search" size="xs" />
            {getTierConfig(nextTier).label} — {fmt(cost)}
          </button>
        ) : (
          <p className="text-center text-gray-600 text-xs mt-1">Análisis completado.</p>
        )}
      </div>
    </div>
  )
}

// ─── Equipment section ────────────────────────────────────────────────────────

const SLOTS: EquipmentSlot[] = ['gloves', 'boots', 'pendant', 'bracelet']

function EquipmentSection({
  player,
  inventoryItems,
  onEquip,
  onUnequip,
}: {
  player: Player
  inventoryItems: EquipmentItem[]
  onEquip: (itemId: string) => void
  onUnequip: (slot: EquipmentSlot) => void
}) {
  const [openSlot, setOpenSlot] = useState<EquipmentSlot | null>(null)
  const equipped = player.equipment ?? EMPTY_EQUIPMENT

  return (
    <div className="panel rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gold-600/30 bg-dark-800">
        <h2 className="text-white text-base font-bold">Equipamiento</h2>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {SLOTS.map((slot) => {
          const item = equipped[slot]
          const isOpen = openSlot === slot
          const availableItems = inventoryItems.filter((i) => i.slot === slot)
          return (
            <div key={slot}>
              <button
                onClick={() => setOpenSlot(isOpen ? null : slot)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left ${
                  item
                    ? 'border-amber-700/40 bg-amber-900/10 hover:bg-amber-900/20'
                    : 'border-gold-600/25 bg-dark-700 hover:bg-dark-600'
                }`}
              >
                <Icon
                  name={EQUIPMENT_SLOT_ICONS[slot]}
                  size="xs"
                  className={item ? 'text-amber-400' : 'text-gray-600'}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 text-[0.625rem]">{EQUIPMENT_SLOT_LABELS[slot]}</p>
                  {item ? (
                    <>
                      <p className="text-amber-300 text-xs font-semibold leading-tight truncate">{item.name}</p>
                      <p className="text-gray-500 text-[0.625rem]">
                        {(Object.entries(item.statBonuses) as [string, number][]).map(([k, v]) => `${k}+${v}`).join(' ')}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-600 text-xs">Sin equipar</p>
                  )}
                </div>
                {item && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnequip(slot) }}
                    className="shrink-0 p-1 rounded hover:bg-red-900/30 transition-colors"
                  >
                    <Icon name="remove_circle" size="xs" className="text-red-500" />
                  </button>
                )}
              </button>

              {/* Inventory picker for this slot */}
              {isOpen && (
                <div className="mt-1 ml-2 border-l-2 border-gold-600/20 pl-3 flex flex-col gap-1">
                  {availableItems.length === 0 ? (
                    <p className="text-gray-600 text-xs py-1">No hay ítems disponibles en el inventario.</p>
                  ) : (
                    availableItems.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => { onEquip(i.id); setOpenSlot(null) }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-900/20 text-left transition-colors"
                      >
                        <div>
                          <p className="text-amber-200 text-xs font-semibold">{i.name}</p>
                          <p className="text-gray-500 text-[0.625rem]">
                            {(Object.entries(i.statBonuses) as [string, number][]).map(([k, v]) => `${k}+${v}`).join(' ')}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayerStatsOverview({ player, total, media }: { player: Player; total: number; media: number }) {
  return (
    <section className="rounded-2xl border border-gold-600/40 bg-[#0b0b12] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gold-600/30 bg-dark-800">
        <div>
          <h2 className="text-white text-lg font-black">Estadísticas</h2>
          <p className="text-gray-400 text-xs mt-0.5">Rendimiento actual del jugador</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-24 rounded-xl border border-gold-600/30 bg-dark-700 px-4 py-2 text-center">
            <p className="text-gray-400 text-[0.625rem] uppercase tracking-wide">Total</p>
            <p className="text-white text-2xl font-black tabular-nums">{total}</p>
          </div>
          <div className="min-w-24 rounded-xl border border-gold-500/50 bg-[#211b12] px-4 py-2 text-center">
            <p className="text-gold-400 text-[0.625rem] uppercase tracking-wide">Media</p>
            <p className="text-3xl font-black tabular-nums" style={{ color: statColor(media, 250) }}>{media}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
        {STAT_KEYS.map((stat) => (
          <div key={stat} className="rounded-xl border border-gold-600/20 bg-dark-800 p-3">
            <StatBar label={stat} value={player.stats[stat]} max={250} />
          </div>
        ))}
        <div className="rounded-xl border border-gold-600/20 bg-dark-800 p-3 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-white font-black">{player.seasonStats.goals}</p><p className="text-gray-500 text-[0.6rem]">Goles</p></div>
          <div><p className="text-white font-black">{player.seasonStats.assists}</p><p className="text-gray-500 text-[0.6rem]">Asist.</p></div>
          <div><p className="text-white font-black">{player.seasonStats.matchesPlayed}</p><p className="text-gray-500 text-[0.6rem]">Partidos</p></div>
        </div>
      </div>
    </section>
  )
}

function PlayerTechniquesSection({
  player,
  bookCount,
  editable,
  onEdit,
}: {
  player: Player
  bookCount: number
  editable: boolean
  onEdit: (kind: 'normal' | 'improvement', slotIndex: number) => void
}) {
  const normalTechs = getNormalTechniques(player)
  const improveTechs = getImprovementTechniques(player)

  function renderSlots(kind: 'normal' | 'improvement', max: number, techniques: typeof normalTechs) {
    return Array.from({ length: max }, (_, index) => {
      const technique = techniques[index]
      return (
        <div key={index} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
          technique ? 'border-gold-600/25 bg-dark-700' : 'border-dashed border-gold-600/25 bg-[#0d0d15]'
        }`}>
          {technique ? (
            <>
              <TechniqueBadge technique={technique} />
              <div className="flex-1" />
              {editable && (
                <button onClick={() => onEdit(kind, index)} className="p-1.5 rounded-lg text-gray-400 hover:text-gold-400 hover:bg-dark-600" title="Cambiar técnica">
                  <Icon name="swap_horiz" size="xs" />
                </button>
              )}
            </>
          ) : (
            <button onClick={() => editable && onEdit(kind, index)} disabled={!editable} className="w-full flex items-center gap-2 text-gray-500 hover:text-gold-400 disabled:hover:text-gray-500">
              <Icon name="add" size="xs" />
              <span className="text-xs">Ranura vacía</span>
            </button>
          )}
        </div>
      )
    })
  }

  return (
    <section className="rounded-2xl border border-gold-600/40 bg-[#0b0b12] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gold-600/30 bg-dark-800">
        <h2 className="text-white text-base font-bold">Supertécnicas</h2>
        {bookCount > 0 && <span className="text-gold-400 text-xs font-semibold">{bookCount} libro{bookCount === 1 ? '' : 's'}</span>}
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-2">Habilidad ({normalTechs.length}/{MAX_NORMAL_TECHNIQUES})</p>
          <div className="space-y-2">{renderSlots('normal', MAX_NORMAL_TECHNIQUES, normalTechs)}</div>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-2">Pasiva ({improveTechs.length}/{MAX_IMPROVEMENT_TECHNIQUES})</p>
          <div className="space-y-2">{renderSlots('improvement', MAX_IMPROVEMENT_TECHNIQUES, improveTechs)}</div>
        </div>
      </div>
    </section>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PlayerDetailScreen() {
  const nameStyle = useNameStyle()
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const players = useCareerStore((s) => s.players)
  const screen = useCareerStore((s) => s.screen)
  const previousScreen = useCareerStore((s) => s.previousScreen)
  const navigate = useCareerStore((s) => s.navigate)
  const selectedPlayerId = useCareerStore((s) => s.selectedPlayerId)
  const sellPlayer = useCareerStore((s) => s.sellPlayer)
  const acceptTransferOffer = useCareerStore((s) => s.acceptTransferOffer)
  const rejectTransferOffer = useCareerStore((s) => s.rejectTransferOffer)
  const callUpPlayer = useCareerStore((s) => s.callUpPlayer)
  const removeCallupPlayer = useCareerStore((s) => s.removeCallupPlayer)
  const swapCallup = useCareerStore((s) => s.swapCallup)
  const changeJerseyNumber = useCareerStore((s) => s.changeJerseyNumber)
  const swapJerseyNumbers = useCareerStore((s) => s.swapJerseyNumbers)
  const analyzePlayerPotential = useCareerStore((s) => s.analyzePlayerPotential)
  const equipItemAction = useCareerStore((s) => s.equipItem)
  const unequipItemAction = useCareerStore((s) => s.unequipItem)
  const teachTechnique = useCareerStore((s) => s.teachTechnique)
  const initiateTransferNegotiation = useCareerStore((s) => s.initiateTransferNegotiation)
  const respondToCounterOffer = useCareerStore((s) => s.respondToCounterOffer)
  const respondToPlayerCounterOffer = useCareerStore((s) => s.respondToPlayerCounterOffer)
  const cancelNegotiationAction = useCareerStore((s) => s.cancelNegotiation)
  const confirmTransferAction = useCareerStore((s) => s.confirmTransfer)
  const dismissNegotiationAction = useCareerStore((s) => s.dismissNegotiation)

  const [showSellModal, setShowSellModal] = useState(false)
  const [showJerseyModal, setShowJerseyModal] = useState(false)
  const [showSwapCallup, setShowSwapCallup] = useState(false)
  const [showPotentialModal, setShowPotentialModal] = useState(false)
  const [techModal, setTechModal] = useState<{ kind: 'normal' | 'improvement'; slotIndex: number } | null>(null)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerInput, setOfferInput] = useState('')
  const [counterInput, setCounterInput] = useState('')

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-900/80">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const player = players.find((p) => p.id === selectedPlayerId)

  if (!player) {
    return (
      <GameLayout>
        <main className="h-full flex items-center justify-center">
          <p className="text-gray-400">Jugador no encontrado.</p>
        </main>
      </GameLayout>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)
  const isInUserTeam = player.teamId === career.teamId

  // Pending transfer offer for this player
  const pendingOffer = career.inbox.find(
    (e) => e.type === 'TRANSFER_OFFER' && e.data?.playerId === player.id,
  ) ?? null
  const offerAmount = pendingOffer ? (pendingOffer.data?.amount as number) : null
  const offerTeamName = pendingOffer ? (pendingOffer.data?.fromTeamName as string) : null
  const offerOfferId = pendingOffer ? (pendingOffer.data?.offerId as string) : null

  // Callup status
  const starterIds = new Set(userTeam?.lineup.filter((s) => s.isStarter).map((s) => s.playerId) ?? [])
  const benchIds = new Set(userTeam?.lineup.filter((s) => !s.isStarter).map((s) => s.playerId) ?? [])
  const calledUpIds = new Set(userTeam?.lineup.map((s) => s.playerId) ?? [])
  const isStarter = starterIds.has(player.id)
  const isBench = benchIds.has(player.id)
  const isAtLimit = calledUpIds.size >= MAX_CALLUP
  const benchPlayers = players.filter((p) => benchIds.has(p.id))

  // Kept for compatibility with existing analysis data, but no longer shown on this screen.
  const analysis = career.playerPotential?.[player.id] ?? null
  const nextTier = analysis ? getNextAnalysisTier(analysis) : null
  const analysisCost = (analysis && nextTier && userTeam)
    ? calcAnalysisCost(nextTier, analysis, userTeam, player, career.difficulty)
    : 0

  const activeNegotiation = !isInUserTeam
    ? career.outgoingNegotiations.find(
        (n) => n.playerId === player.id && (n.phase === 'club_pending' || n.phase === 'player_pending' || n.phase === 'player_counter' || n.phase === 'player_accepted'),
      ) ?? null
    : null

  const recentNegotiation = !isInUserTeam && !activeNegotiation
    ? (() => {
        const arr = career.outgoingNegotiations.filter(
          (n) => n.playerId === player.id && (n.phase === 'failed' || n.phase === 'cancelled' || n.phase === 'completed'),
        )
        return arr.length > 0 ? arr[arr.length - 1] : null
      })()
    : null

  const marketValueForOffer = Math.round(calcTransferValue(player) * (career.difficulty.transferCostMultiplier ?? 1))

  function handleCallUp() {
    const success = callUpPlayer(player!.id)
    if (!success) setShowSwapCallup(true)
  }

  function handleSwapCallupConfirm(outId: number) {
    swapCallup(outId, player!.id)
    setShowSwapCallup(false)
  }

  function handleQuickSell() {
    const targetTeam = teams.find((t) => t.id !== career!.teamId)
    if (!targetTeam) return
    const quickSellPrice = Math.round(calcTransferValue(player!) * 0.95)
    sellPlayer(player!.id, targetTeam.id, quickSellPrice)
    setShowSellModal(false)
    navigate('squad')
  }

  function handleAcceptOffer() {
    if (!offerOfferId) return
    acceptTransferOffer(offerOfferId)
    setShowSellModal(false)
    navigate('squad')
  }

  function handleRejectOffer() {
    if (!offerOfferId) return
    rejectTransferOffer(offerOfferId)
    setShowSellModal(false)
  }

  const statusLabel = isStarter ? 'TIT' : isBench ? 'SUP' : 'NC'
  const statusFullLabel = isStarter ? 'Titular' : isBench ? 'Suplente' : 'No convocado'
  const statusStyle = isStarter
    ? 'bg-gold-600/30 text-gold-400 border border-gold-600/40'
    : isBench
    ? 'bg-dark-700/60 text-gray-400 border border-gold-600/20'
    : 'bg-dark-800/60 text-gray-600 border border-gold-600/10'

  const { total, media } = getPlayerStatsSummary(player)

  return (
    <GameLayout>
      <main className="h-full flex flex-col overflow-hidden">

          {/* ── Hero strip ── */}
          <div className="shrink-0 flex items-center gap-5 px-5 py-4 border-b border-gold-600/40 bg-[#0a0a10] shadow-[0_8px_25px_rgba(0,0,0,0.35)]">
            <button
              onClick={() => navigate(previousScreen ?? 'squad')}
              className="text-gray-500 hover:text-white transition-colors shrink-0 p-1"
            >
              <Icon name="arrow_back" size="xs" />
            </button>

            {/* Face + position sprite */}
            <div className="relative shrink-0">
              <img
                src={player.spriteUrl}
                alt={playerDisplayName(player, nameStyle)}
                className="w-24 h-24 object-contain rounded-2xl bg-dark-800 border border-gold-600/35 shadow-xl"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' rx='8' fill='%234b5563'/%3E%3C/svg%3E"
                }}
              />
              <div className="absolute -bottom-1 -right-1 bg-dark-900/90 rounded-md p-0.5 border border-gold-600/30">
                <PositionSprite position={player.position} size={28} />
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-white text-2xl font-black leading-tight">{playerDisplayName(player, nameStyle)}</h1>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${statusStyle}`}>{statusFullLabel}</span>
                <ElementBadge element={player.element} size="sm" />
                {player.isInjured && (
                  <span className="bg-red-800 text-red-200 text-[0.625rem] px-1.5 py-0.5 rounded font-semibold shrink-0">Lesionado</span>
                )}
                {player.isSuspended && (
                  <span className="bg-yellow-800 text-yellow-200 text-[0.625rem] px-1.5 py-0.5 rounded font-semibold shrink-0">Sancionado</span>
                )}
              </div>
              <p className="text-gray-400 text-sm truncate mt-1">{nameStyle === 'japanese' ? player.name : player.nameRomaji}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-gray-300 text-sm">Energía <span className="text-amber-400 font-bold">{player.stamina}%</span></span>
                {player.jerseyNumber > 0 && <span className="text-gray-400 text-sm">Dorsal <span className="text-white font-bold">#{player.jerseyNumber}</span></span>}
              </div>
            </div>

            {/* Action buttons */}
            {isInUserTeam && (
              <div className="shrink-0 min-w-44 rounded-xl border border-gold-600/35 bg-dark-800 p-2.5 flex flex-col gap-2">
                <p className="text-gold-400 text-[0.55rem] font-black uppercase tracking-widest px-1">Acciones</p>
                {!isStarter && !isBench && (
                  <button
                    onClick={handleCallUp}
                    disabled={isAtLimit}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-dark-900 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Icon name="person_add" size="xs" />
                    Convocar
                  </button>
                )}
                {isBench && (
                  <button
                    onClick={() => removeCallupPlayer(player.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Icon name="person_remove" size="xs" />
                    Desconvocar
                  </button>
                )}
                <button
                  onClick={() => setShowJerseyModal(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 hover:bg-gold-600/20 text-gold-300 border border-gold-500/50 rounded-lg text-xs font-bold transition-colors"
                >
                  <Icon name="tag" size="xs" />
                  Cambiar dorsal
                </button>
                <button
                  onClick={() => setShowSellModal(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-800 hover:bg-red-700 text-red-100 border border-red-700 rounded-lg text-xs font-bold transition-colors"
                >
                  <Icon name="sell" size="xs" />
                  Vender
                </button>
              </div>
            )}

            {/* Negotiation block for non-owned players */}
            {!isInUserTeam && (
              <div className="shrink-0 flex flex-col gap-1">
                {!activeNegotiation && !recentNegotiation && (
                  <button
                    onClick={() => { setOfferInput(String(marketValueForOffer)); setShowOfferModal(true) }}
                    className="flex items-center gap-1 px-2 py-1 bg-dark-700/60 hover:bg-gold-600/25 text-gold-300 border border-gold-500/60 rounded text-xs font-semibold transition-colors"
                  >
                    <span className="material-icons leading-none" style={{ fontSize: '14px' }}>
                      {(player.teamId === null || player.teamId === 0) ? 'handshake' : 'send'}
                    </span>
                    {(player.teamId === null || player.teamId === 0) ? 'Contactar agente' : 'Contactar club'}
                  </button>
                )}

                {activeNegotiation && activeNegotiation.phase === 'club_pending' && !activeNegotiation.counterAmount && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 text-[0.625rem] leading-tight">Esperando respuesta del club</span>
                    <span className="text-gray-500 text-[0.5rem]">Est. {activeNegotiation.resolutionDate}</span>
                    <button
                      onClick={() => cancelNegotiationAction(activeNegotiation.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded text-xs font-semibold transition-colors border border-gold-600/20"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>cancel</span>
                      Cancelar
                    </button>
                  </div>
                )}

                {activeNegotiation && activeNegotiation.phase === 'club_pending' && activeNegotiation.counterAmount && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-yellow-400 text-[0.625rem] font-semibold">
                      Contra: {fmt(activeNegotiation.counterAmount)}
                    </span>
                    <button
                      onClick={() => respondToCounterOffer(activeNegotiation.id, 'accept_counter')}
                      className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Aceptar
                    </button>
                    {activeNegotiation.offerRound < 3 && (
                      <button
                        onClick={() => { setCounterInput(String(activeNegotiation.currentOffer)); setShowOfferModal(true) }}
                        className="flex items-center gap-1 px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded text-xs font-semibold transition-colors"
                      >
                        Contra-ofrecer
                      </button>
                    )}
                    <button
                      onClick={() => respondToCounterOffer(activeNegotiation.id, 'reject')}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded text-xs font-semibold transition-colors border border-gold-600/20"
                    >
                      Rechazar
                    </button>
                  </div>
                )}

                {activeNegotiation && activeNegotiation.phase === 'player_pending' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gold-500 text-[0.625rem] leading-tight">Jugador valorando oferta</span>
                    <span className="text-gray-500 text-[0.5rem]">Est. {activeNegotiation.resolutionDate}</span>
                    <button
                      onClick={() => cancelNegotiationAction(activeNegotiation.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded text-xs font-semibold transition-colors border border-gold-600/20"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>cancel</span>
                      Cancelar
                    </button>
                  </div>
                )}

                {activeNegotiation && activeNegotiation.phase === 'player_counter' && activeNegotiation.counterAmount !== undefined && (
                  <div className="flex flex-col gap-1">
                    <span className="text-yellow-400 text-[0.625rem] leading-tight font-semibold">Jugador contraoferta</span>
                    <span className="text-yellow-300 text-[0.5rem] font-bold">
                      Pide: {fmt(activeNegotiation.counterAmount)}
                    </span>
                    <button
                      onClick={() => respondToPlayerCounterOffer(activeNegotiation.id, 'accept')}
                      className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>check</span>
                      Aceptar
                    </button>
                    <button
                      onClick={() => respondToPlayerCounterOffer(activeNegotiation.id, 'reject')}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded text-xs font-semibold transition-colors border border-gold-600/20"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>close</span>
                      Rechazar
                    </button>
                  </div>
                )}

                {activeNegotiation && activeNegotiation.phase === 'player_accepted' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-green-400 text-[0.625rem] font-semibold leading-tight">¡El jugador acepta!</span>
                    <button
                      onClick={() => confirmTransferAction(activeNegotiation.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>check_circle</span>
                      Confirmar fichaje
                    </button>
                    <button
                      onClick={() => cancelNegotiationAction(activeNegotiation.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded text-xs font-semibold transition-colors border border-gold-600/20"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>cancel</span>
                      Cancelar fichaje
                    </button>
                  </div>
                )}

                {recentNegotiation && recentNegotiation.phase === 'failed' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-red-400 text-[0.625rem]">{getNegotiationFailureFeedback(recentNegotiation).title}</span>
                    <span className="rounded-lg border border-red-700/35 bg-red-950/30 px-2.5 py-2 text-red-200 text-xs leading-relaxed max-w-[17rem]">{getNegotiationFailureFeedback(recentNegotiation).body}</span>
                    <button
                      onClick={() => { setOfferInput(String(marketValueForOffer)); setShowOfferModal(true) }}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/60 hover:bg-gold-600/25 text-gold-300 border border-gold-500/60 rounded text-xs font-semibold transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {recentNegotiation && recentNegotiation.phase === 'cancelled' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 text-[0.625rem]">Cancelada</span>
                    <button
                      onClick={() => { setOfferInput(String(marketValueForOffer)); setShowOfferModal(true) }}
                      className="flex items-center gap-1 px-2 py-1 bg-dark-700/60 hover:bg-gold-600/25 text-gold-300 border border-gold-500/60 rounded text-xs font-semibold transition-colors"
                    >
                      Nueva oferta
                    </button>
                  </div>
                )}

                {recentNegotiation && recentNegotiation.phase === 'completed' && (
                  <span className="text-green-400 text-[0.625rem] font-semibold">Fichaje completado</span>
                )}
              </div>
            )}
          </div>

          {/* ── Main player information ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#08080d]">
            <PlayerStatsOverview player={player} total={total} media={media} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <PlayerTechniquesSection
                player={player}
                bookCount={Object.values(career.inventory.techniqueBooks).filter((quantity) => quantity > 0).length}
                editable={isInUserTeam}
                onEdit={(kind, slotIndex) => setTechModal({ kind, slotIndex })}
              />
              {isInUserTeam && (
                <EquipmentSection
                  player={player}
                  inventoryItems={career.inventory.equipmentItems}
                  onEquip={(itemId) => equipItemAction(player.id, itemId)}
                  onUnequip={(slot) => unequipItemAction(player.id, slot)}
                />
              )}
            </div>
          </div>

          {/* ── 3-column body ── */}
          <div className="hidden">

            {/* Left: Stats + Season */}
            <div className="w-52 shrink-0 border-r border-gold-600/20 overflow-y-auto p-3 flex flex-col gap-3">
              <div>
                <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-600 mb-2">Estadísticas</p>
                <div className="flex flex-col gap-1.5">
                  {STAT_KEYS.map((stat) => (
                    <StatBar key={stat} label={stat} value={player.stats[stat]} max={250} />
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gold-600/20 grid grid-cols-2 gap-x-2 text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="text-gray-300 font-semibold tabular-nums text-right">{total}</span>
                  <span className="text-gray-500">Media</span>
                  <span className="font-bold tabular-nums text-right" style={{ color: statColor(media, 250) }}>{media}</span>
                </div>
              </div>

              <div>
                <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-600 mb-2">Temporada</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-dark-800/70 rounded-lg px-2 py-1.5 text-center border border-gold-600/15 text-center">
                    <p className="text-white text-base font-black tabular-nums">{player.seasonStats.goals}</p>
                    <p className="text-gray-600 text-[0.5rem]">Goles</p>
                  </div>
                  <div className="bg-dark-800/70 rounded-lg px-2 py-1.5 text-center border border-gold-600/15 text-center">
                    <p className="text-white text-base font-black tabular-nums">{player.seasonStats.assists}</p>
                    <p className="text-gray-600 text-[0.5rem]">Asist.</p>
                  </div>
                  {player.position === 'GK' && (
                    <div className="bg-dark-800/70 rounded-lg px-2 py-1.5 text-center border border-gold-600/15 text-center">
                      <p className="text-white text-base font-black tabular-nums">{player.seasonStats.cleanSheets}</p>
                      <p className="text-gray-600 text-[0.5rem]">P. en cero</p>
                    </div>
                  )}
                  <div className="bg-dark-800/70 rounded-lg px-2 py-1.5 text-center border border-gold-600/15 text-center">
                    <p className="text-white text-base font-black tabular-nums">{player.seasonStats.matchesPlayed}</p>
                    <p className="text-gray-600 text-[0.5rem]">Partidos</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Techniques + Equipment */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-w-0">
              {(() => {
                const normalTechs = getNormalTechniques(player)
                const improveTechs = getImprovementTechniques(player)
                const allBooks = Object.entries(career.inventory.techniqueBooks)
                  .filter(([, qty]) => qty > 0)
                  .map(([bookId]) => career.inventory.generatedBooks[bookId])
                  .filter((b): b is TechniqueBook => b !== undefined)
                const hasAnyBooks = allBooks.length > 0
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-600">Supertécnicas</p>
                      {hasAnyBooks && (
                        <span className="text-[0.5rem] text-gold-500 font-medium">{allBooks.length} libro{allBooks.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    <p className="text-gray-600 text-[0.5rem] mb-1">HABILIDAD ({normalTechs.length}/{MAX_NORMAL_TECHNIQUES})</p>
                    <div className="flex flex-col gap-1 mb-3">
                      {Array.from({ length: MAX_NORMAL_TECHNIQUES }, (_, i) => {
                        const tech = normalTechs[i]
                        return (
                          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${tech ? 'border-gold-600/20 bg-dark-800/60' : 'border-dashed border-gold-600/20 bg-transparent'}`}>
                            {tech ? (
                              <>
                                <TechniqueBadge technique={tech} />
                                <div className="flex-1 min-w-0" />
                                {isInUserTeam && (
                                  <button
                                    onClick={() => setTechModal({ kind: 'normal', slotIndex: i })}
                                    className="text-gray-500 hover:text-gold-500 transition-colors shrink-0"
                                    title="Cambiar técnica"
                                  >
                                    <span className="material-icons leading-none" style={{ fontSize: 13 }}>swap_horiz</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => isInUserTeam && setTechModal({ kind: 'normal', slotIndex: i })}
                                disabled={!isInUserTeam}
                                className="flex items-center gap-2 w-full text-gray-600 hover:text-gray-400 transition-colors disabled:cursor-default"
                              >
                                <span className="material-icons leading-none" style={{ fontSize: 13 }}>add</span>
                                <span className="text-xs">Ranura vacía</span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <p className="text-gray-600 text-[0.5rem] mb-1">PASIVA ({improveTechs.length}/{MAX_IMPROVEMENT_TECHNIQUES})</p>
                    <div className="flex flex-col gap-1">
                      {Array.from({ length: MAX_IMPROVEMENT_TECHNIQUES }, (_, i) => {
                        const tech = improveTechs[i]
                        return (
                          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${tech ? 'border-gold-600/20 bg-dark-800/60' : 'border-dashed border-gold-600/20 bg-transparent'}`}>
                            {tech ? (
                              <>
                                <TechniqueBadge technique={tech} />
                                <div className="flex-1 min-w-0" />
                                {isInUserTeam && (
                                  <button
                                    onClick={() => setTechModal({ kind: 'improvement', slotIndex: i })}
                                    className="text-gray-500 hover:text-gold-500 transition-colors shrink-0"
                                    title="Cambiar técnica"
                                  >
                                    <span className="material-icons leading-none" style={{ fontSize: 13 }}>swap_horiz</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => isInUserTeam && setTechModal({ kind: 'improvement', slotIndex: i })}
                                disabled={!isInUserTeam}
                                className="flex items-center gap-2 w-full text-gray-600 hover:text-gray-400 transition-colors disabled:cursor-default"
                              >
                                <span className="material-icons leading-none" style={{ fontSize: 13 }}>add</span>
                                <span className="text-xs">Ranura vacía</span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {isInUserTeam && (
                <EquipmentSection
                  player={player}
                  inventoryItems={career.inventory.equipmentItems}
                  onEquip={(itemId) => equipItemAction(player.id, itemId)}
                  onUnequip={(slot) => unequipItemAction(player.id, slot)}
                />
              )}
            </div>

            {/* Right: Career info + Potential */}
            <div className="w-56 shrink-0 border-l border-gold-600/20 overflow-y-auto p-3 flex flex-col gap-3">
              <div>
                <p className="text-[0.5rem] font-black uppercase tracking-widest text-gray-600 mb-2">Carrera</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-dark-800/70 rounded-lg px-2 py-1.5">
                    <p className="text-gray-500 text-[0.5625rem]">Potencial base</p>
                    <p className="text-gold-400 font-bold text-sm">{player.career.potential}</p>
                  </div>
                  <div className="bg-dark-800/70 rounded-lg px-2 py-1.5">
                    <p className="text-gray-500 text-[0.5625rem]">Valor</p>
                    <p className="text-green-400 font-bold text-xs truncate">{fmt(player.career.marketValue)}</p>
                  </div>
                </div>
              </div>

              {isInUserTeam && (
                <PotentialSection
                  analysis={analysis}
                  budget={userTeam?.budget ?? 0}
                  playerMinutes={player.seasonStats.minutesPlayed}
                  team={userTeam}
                  player={player}
                  difficulty={career.difficulty}
                  onAnalyze={() => setShowPotentialModal(true)}
                />
              )}
            </div>

          </div>
        </main>

      {/* ── Jersey modal ── */}
      {showJerseyModal && (
        <JerseyModal
          currentNumber={player.jerseyNumber}
          playerName={playerDisplayName(player, nameStyle)}
          players={players.filter((p) => p.teamId === career.teamId)}
          onClose={() => setShowJerseyModal(false)}
          onChange={(num) => changeJerseyNumber(player.id, num)}
          onSwap={(conflictId) => swapJerseyNumbers(player.id, conflictId)}
        />
      )}

      {/* ── Swap callup modal ── */}
      {showSwapCallup && (
        <SwapCallupModal
          playerInName={playerDisplayName(player, nameStyle)}
          benchPlayers={benchPlayers}
          onConfirm={handleSwapCallupConfirm}
          onCancel={() => setShowSwapCallup(false)}
        />
      )}

      {/* ── Potential modal ── */}
      {showPotentialModal && analysis && nextTier && userTeam && (
        <PotentialModal
          analysis={analysis}
          nextTier={nextTier}
          cost={analysisCost}
          canAfford={(userTeam.budget ?? 0) >= analysisCost}
          playerMinutes={player.seasonStats.minutesPlayed}
          team={userTeam}
          onClose={() => setShowPotentialModal(false)}
          onConfirm={() => analyzePlayerPotential(player.id, analysisCost)}
        />
      )}

      {/* ── Offer modal (initiate negotiation / counter-offer) ── */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800/80 rounded-xl border border-gold-600/20 p-5 w-full max-w-sm space-y-4">
            <div>
              <h2 className="text-white text-base font-bold">
                {activeNegotiation?.counterAmount ? 'Contra-oferta' : ((player.teamId === null || player.teamId === 0) ? 'Contactar agente' : 'Enviar oferta al club')}
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">{playerDisplayName(player, nameStyle)}</p>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gold-600/20">
              <span className="text-gray-400 text-xs">Valor de mercado</span>
              <span className="text-white text-sm font-bold tabular-nums">
                {fmt(marketValueForOffer)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-400 text-xs">Tu oferta (¥)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(activeNegotiation?.counterAmount ? counterInput : offerInput)}
                onChange={(e) => activeNegotiation?.counterAmount
                  ? setCounterInput(formatMoneyInput(e.target.value))
                  : setOfferInput(formatMoneyInput(e.target.value))}
                className="w-full bg-dark-700/80 border border-gold-600/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-500"
              />
            </div>

            <button
              onClick={() => {
                const raw = parseMoneyInput(activeNegotiation?.counterAmount ? counterInput : offerInput)
                if (raw <= 0) return
                if (activeNegotiation?.counterAmount) {
                  respondToCounterOffer(activeNegotiation.id, 'counter', raw)
                } else {
                  initiateTransferNegotiation(player.id, raw)
                }
                setShowOfferModal(false)
              }}
              className="w-full py-2 bg-gold-600 hover:bg-gold-500 text-dark-900 rounded-lg font-bold text-sm transition-colors"
            >
              Enviar oferta
            </button>

            <button
              onClick={() => setShowOfferModal(false)}
              className="w-full py-2 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded-lg font-semibold text-sm border border-gold-600/20"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Sell modal ── */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800/80 rounded-xl border border-gold-600/20 p-5 w-full max-w-sm space-y-4">
            <div>
              <h2 className="text-white text-base font-bold">Vender jugador</h2>
              <p className="text-gray-400 text-xs mt-0.5">{playerDisplayName(player, nameStyle)}</p>
            </div>

            {/* Market value */}
            <div className="flex items-center justify-between py-2 border-b border-gold-600/20">
              <span className="text-gray-400 text-xs">Valor de mercado</span>
              <span className="text-white text-sm font-bold tabular-nums">
                {fmt(calcTransferValue(player))}
              </span>
            </div>

            {/* Quick sell */}
            <div className="bg-dark-700/40 rounded-xl p-3 border border-gold-600/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-xs font-semibold">Venta rápida</span>
                <div className="text-right">
                  <span className="text-white text-sm font-bold tabular-nums block">
                    {fmt(Math.round(calcTransferValue(player) * 0.95))}
                  </span>
                  <span className="text-gray-500 text-[0.625rem]">−5% del valor</span>
                </div>
              </div>
              <button
                onClick={handleQuickSell}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                <span className="material-icons leading-none" style={{ fontSize: '16px' }}>sell</span>
                Vender ahora
              </button>
            </div>

            {/* AI offer (only if pending) */}
            {pendingOffer && offerAmount !== null && offerTeamName && (
              <div className="bg-yellow-900/20 rounded-xl p-3 border border-yellow-700/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-yellow-300 text-xs font-semibold">{offerTeamName}</span>
                  <div className="text-right">
                    <span className="text-white text-sm font-bold tabular-nums block">{fmt(offerAmount)}</span>
                    {(() => {
                      const diff = offerAmount - calcTransferValue(player)
                      const pct = Math.round((diff / calcTransferValue(player)) * 100)
                      return (
                        <span className={`text-[0.625rem] font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff >= 0 ? '+' : ''}{fmt(diff)} ({diff >= 0 ? '+' : ''}{pct}%)
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptOffer}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-xs transition-colors"
                  >
                    <span className="material-icons leading-none" style={{ fontSize: '14px' }}>check</span>
                    Aceptar
                  </button>
                  <button
                    onClick={handleRejectOffer}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gold-600/20 hover:bg-gold-600/30 text-gold-300 rounded-lg font-semibold text-xs transition-colors border border-gold-600/30"
                  >
                    <span className="material-icons leading-none" style={{ fontSize: '14px' }}>close</span>
                    Rechazar
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSellModal(false)}
              className="w-full py-2 bg-dark-700/80 hover:bg-dark-600/80 text-gray-300 rounded-lg font-semibold text-sm border border-gold-600/20"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Technique book selection modal ── */}
      {techModal && player && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800/90 rounded-xl w-full max-w-sm border border-gold-600/30">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gold-600/20">
              <div>
                <h2 className="text-white text-sm font-bold">
                  {techModal.kind === 'normal' ? 'Técnica de habilidad' : 'Técnica pasiva'}
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {techModal.kind === 'normal' ? `Ranura ${techModal.slotIndex + 1} / ${MAX_NORMAL_TECHNIQUES}` : `Ranura ${techModal.slotIndex + 1} / ${MAX_IMPROVEMENT_TECHNIQUES}`}
                </p>
              </div>
              <button onClick={() => setTechModal(null)} className="text-gray-500 hover:text-white transition-colors">
                <span className="material-icons leading-none" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto flex flex-col gap-2">
              {(() => {
                const normalTechs = getNormalTechniques(player)
                const improveTechs = getImprovementTechniques(player)
                const knownIds = new Set([...player.techniques, ...(player.improvementTechniques ?? [])].map((t) => t.id))
                const books = Object.entries(career.inventory.techniqueBooks)
                  .filter(([, qty]) => qty > 0)
                  .map(([bookId]) => career.inventory.generatedBooks[bookId])
                  .filter((b): b is TechniqueBook => b !== undefined)
                  .filter((b) => {
                    if (knownIds.has(b.technique.id)) return false
                    const isImprove = b.isImprovement || b.technique.type === 'Mejora'
                    return techModal.kind === 'improvement' ? isImprove : !isImprove
                  })

                if (books.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <span className="material-icons text-gray-700 mb-2" style={{ fontSize: 32 }}>menu_book</span>
                      <p className="text-gray-500 text-sm">Sin libros disponibles</p>
                      <p className="text-gray-600 text-xs mt-1">Consigue libros de técnicas en las recompensas de partido</p>
                    </div>
                  )
                }

                return books.map((book) => {
                  const isReplacing = techModal.kind === 'normal'
                    ? normalTechs[techModal.slotIndex] !== undefined
                    : improveTechs[techModal.slotIndex] !== undefined
                  return (
                    <button
                      key={book.id}
                      onClick={() => {
                        teachTechnique(player.id, book.id, techModal.slotIndex)
                        setTechModal(null)
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gold-600/20 bg-dark-700/30 hover:bg-dark-700/60 transition-colors text-left"
                    >
                      <TechniqueBadge technique={book.technique} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{book.technique.name}</p>
                        <p className="text-gray-500 text-[0.5625rem]">
                          {book.technique.type} · POT {book.technique.POT} · PP {book.technique.PP}
                        </p>
                      </div>
                      <span className="text-gold-500 text-[0.5625rem] font-bold shrink-0">
                        {isReplacing ? 'Reemplazar' : 'Enseñar'}
                      </span>
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}
    </GameLayout>
  )
}
