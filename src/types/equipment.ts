import type { Stats } from './player'

export type EquipmentSlot = 'gloves' | 'boots' | 'pendant' | 'bracelet'

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  gloves: 'Guantes',
  boots: 'Botas',
  pendant: 'Colgante',
  bracelet: 'Pulsera',
}

export const EQUIPMENT_SLOT_ICONS: Record<EquipmentSlot, string> = {
  gloves: 'back_hand',
  boots: 'sprint',
  pendant: 'diamond',
  bracelet: 'watch',
}

export interface EquipmentItem {
  id: string
  slot: EquipmentSlot
  name: string
  statBonuses: Partial<Stats>
  tier: 1 | 2 | 3
}

export const EMPTY_EQUIPMENT: Record<EquipmentSlot, EquipmentItem | null> = {
  gloves: null,
  boots: null,
  pendant: null,
  bracelet: null,
}
