import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import Icon from './Icon'
import type { MatchReward } from '../types/reward'
import type { Player } from '../types/player'
import type { EquipmentSlot } from '../types/equipment'
// EquipmentSlot used for player.equipment slot lookup

function StatDelta({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before
  if (delta === 0) return <span className="text-gray-500 text-xs">{label}: {before}</span>
  return (
    <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
      {label}: {before} → {after} ({delta > 0 ? '+' : ''}{delta})
    </span>
  )
}

function EquipmentEquipView({ reward, players, onClose }: { reward: MatchReward; players: Player[]; onClose: () => void }) {
  const equipRewardItem = useCareerStore((s) => s.equipRewardItem)
  const saveReward      = useCareerStore((s) => s.saveRewardToInventory)
  const [selected, setSelected] = useState<number | null>(null)

  const item = reward.equipmentItem!

  function handleEquip() {
    if (selected === null) return
    equipRewardItem(selected, reward)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-700/60 rounded-xl p-3 border border-gold-600/20">
        <p className="text-gold-400 font-bold text-sm">{item.name}</p>
        <p className="text-gray-400 text-xs">{item.slot}</p>
      </div>

      <p className="text-gray-400 text-xs">Selecciona un jugador para equiparlo:</p>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {players.map((p) => {
          const currentItem = p.equipment?.[item.slot as EquipmentSlot] ?? null
          const baseStats = p.stats
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected === p.id ? 'border-gold-500 bg-dark-600/80' : 'border-gray-700 bg-dark-700/40 hover:bg-dark-600/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">{p.name}</p>
                  <p className="text-gray-500 text-xs">{p.position} · Media {Math.round(p.stats.TOT / 7)}</p>
                </div>
                {currentItem && (
                  <span className="text-[10px] text-orange-400 bg-orange-900/30 border border-orange-700/40 rounded px-1.5 py-0.5">
                    {currentItem.name}
                  </span>
                )}
              </div>
              {selected === p.id && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(item.statBonuses ?? {}).map(([stat, boost]) => (
                    <StatDelta
                      key={stat}
                      label={stat}
                      before={baseStats[stat as keyof typeof baseStats] as number}
                      after={(baseStats[stat as keyof typeof baseStats] as number) + (boost ?? 0)}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => { saveReward(reward); onClose() }}
          className="flex-1 py-2.5 bg-dark-700/60 hover:bg-dark-600/60 text-gray-300 text-sm font-semibold rounded-xl border border-gray-700 transition-colors"
        >
          Guardar en inventario
        </button>
        <button
          onClick={handleEquip}
          disabled={selected === null}
          className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-dark-900 text-sm font-bold rounded-xl transition-colors"
        >
          Equipar
        </button>
      </div>
    </div>
  )
}

function TechniqueEquipView({ reward, players, onClose }: { reward: MatchReward; players: Player[]; onClose: () => void }) {
  const teachRewardTechnique = useCareerStore((s) => s.teachRewardTechnique)
  const saveReward           = useCareerStore((s) => s.saveRewardToInventory)
  const [selected, setSelected]         = useState<number | null>(null)
  const [replaceIndex, setReplaceIndex] = useState<number | undefined>(undefined)

  const book = reward.techniqueBook!
  const tech = book.technique

  const selectedPlayer = players.find((p) => p.id === selected)

  function hasFreeSlot(p: Player): boolean {
    const maxSlots = book.isImprovement ? 2 : 3
    const existing = book.isImprovement ? (p.improvementTechniques ?? []) : p.techniques
    return existing.length < maxSlots
  }

  function canTeach(): boolean {
    if (selected === null || !selectedPlayer) return false
    if (hasFreeSlot(selectedPlayer)) return true
    return replaceIndex !== undefined
  }

  function handleTeach() {
    if (!canTeach() || selected === null) return
    teachRewardTechnique(selected, reward, replaceIndex)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-700/60 rounded-xl p-3 border border-gold-600/20">
        <p className="text-gold-400 font-bold text-sm">{tech.name}</p>
        <p className="text-gray-400 text-xs">{tech.type} · {tech.element || 'Sin elemento'} · POT {tech.POT} · PP {tech.PP}</p>
      </div>

      <p className="text-gray-400 text-xs">Selecciona un jugador para enseñarle la técnica:</p>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {players.map((p) => {
          const maxSlots = book.isImprovement ? 2 : 3
          const existingTechs = book.isImprovement ? (p.improvementTechniques ?? []) : p.techniques
          const free = existingTechs.length < maxSlots

          return (
            <div key={p.id}>
              <button
                onClick={() => { setSelected(p.id); setReplaceIndex(undefined) }}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selected === p.id ? 'border-gold-500 bg-dark-600/80' : 'border-gray-700 bg-dark-700/40 hover:bg-dark-600/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{p.name}</p>
                    <p className="text-gray-500 text-xs">{p.position}</p>
                  </div>
                  <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${free ? 'text-green-400 bg-green-900/30 border border-green-700/40' : 'text-orange-400 bg-orange-900/30 border border-orange-700/40'}`}>
                    {existingTechs.length}/{maxSlots}
                  </span>
                </div>
              </button>

              {selected === p.id && !free && (
                <div className="ml-2 mt-1 space-y-1">
                  <p className="text-gray-500 text-xs">Reemplazar:</p>
                  {existingTechs.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setReplaceIndex(i)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                        replaceIndex === i ? 'border-red-500 bg-red-900/30 text-red-300' : 'border-gray-700 bg-dark-700/40 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {t.name} (POT {t.POT}) — se guardará en inventario
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => { saveReward(reward); onClose() }}
          className="flex-1 py-2.5 bg-dark-700/60 hover:bg-dark-600/60 text-gray-300 text-sm font-semibold rounded-xl border border-gray-700 transition-colors"
        >
          Guardar
        </button>
        <button
          onClick={handleTeach}
          disabled={!canTeach()}
          className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-dark-900 text-sm font-bold rounded-xl transition-colors"
        >
          Enseñar
        </button>
      </div>
    </div>
  )
}

export default function RewardEquipModal() {
  const reward     = useCareerStore((s) => s.rewardBeingEquipped)
  const closeEquip = useCareerStore((s) => s.closeRewardEquip)
  const players    = useCareerStore((s) => s.players)
  const career     = useCareerStore((s) => s.career)

  if (!reward || !career) return null

  const squadPlayers = players.filter((p) => p.teamId === career.teamId)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-gold-600/30 rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">
            {reward.type === 'equipment' ? 'Equipamiento recibido' : 'Técnica recibida'}
          </h2>
          <button onClick={closeEquip} className="text-gray-500 hover:text-white">
            <Icon name="close" size="sm" />
          </button>
        </div>

        {reward.type === 'equipment' && (
          <EquipmentEquipView reward={reward} players={squadPlayers} onClose={closeEquip} />
        )}
        {reward.type === 'technique_book' && (
          <TechniqueEquipView reward={reward} players={squadPlayers} onClose={closeEquip} />
        )}
      </div>
    </div>
  )
}
