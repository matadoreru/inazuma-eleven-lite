import type { TechniqueBook } from './inventory'
import type { EquipmentItem } from './equipment'
import type { Stats } from './player'

export type MatchRewardType = 'technique_book' | 'money' | 'stat_boost' | 'equipment'

export interface MatchReward {
  type: MatchRewardType
  techniqueBook?: TechniqueBook
  moneyAmount?: number
  statBoost?: { playerId: number; playerName: string; stat: keyof Stats; amount: number }
  equipmentItem?: EquipmentItem
}
