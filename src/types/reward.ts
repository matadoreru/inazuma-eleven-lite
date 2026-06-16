import type { TechniqueBook } from './inventory'
import type { EquipmentItem } from './equipment'
import type { Stats } from './player'

export type MatchRewardType = 'technique_book' | 'money' | 'stat_boost' | 'equipment'
export type RewardRarity = 'common' | 'uncommon' | 'special' | 'rare' | 'legendary'

export const REWARD_RARITY_LABELS: Record<RewardRarity, string> = {
  common: 'Comun',
  uncommon: 'Poco comun',
  special: 'Especial',
  rare: 'Raro',
  legendary: 'Legendario',
}

export interface MatchReward {
  type: MatchRewardType
  rarity: RewardRarity
  techniqueBook?: TechniqueBook
  moneyAmount?: number
  statBoost?: { playerId: number; playerName: string; stat: keyof Stats; amount: number }
  equipmentItem?: EquipmentItem
}
