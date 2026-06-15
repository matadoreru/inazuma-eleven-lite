import type { Player, Stats } from '../types/player'
import { statTotal } from '../types/player'
import type { EquipmentItem, EquipmentSlot } from '../types/equipment'
import { EMPTY_EQUIPMENT } from '../types/equipment'
import type { ClubInventory } from '../types/inventory'

export function getEffectiveStats(player: Player): Stats {
  const base = { ...player.stats }
  if (!player.equipment) return base
  for (const item of Object.values(player.equipment)) {
    if (!item) continue
    for (const [k, bonus] of Object.entries(item.statBonuses) as [keyof Stats, number][]) {
      base[k] = (base[k] ?? 0) + bonus
    }
  }
  base.TOT = statTotal(base)
  return base
}

export function equipItem(
  player: Player,
  item: EquipmentItem,
  inventory: ClubInventory,
): { player: Player; inventory: ClubInventory } {
  const current = player.equipment ?? { ...EMPTY_EQUIPMENT }
  const displaced = current[item.slot]
  const updatedInventory: ClubInventory = {
    ...inventory,
    equipmentItems: inventory.equipmentItems
      .filter((i) => i.id !== item.id)
      .concat(displaced ? [displaced] : []),
  }
  return {
    player: { ...player, equipment: { ...current, [item.slot]: item } },
    inventory: updatedInventory,
  }
}

export function unequipItem(
  player: Player,
  slot: EquipmentSlot,
  inventory: ClubInventory,
): { player: Player; inventory: ClubInventory } {
  if (!player.equipment) return { player, inventory }
  const item = player.equipment[slot]
  if (!item) return { player, inventory }
  const current = player.equipment
  return {
    player: { ...player, equipment: { ...current, [slot]: null } },
    inventory: { ...inventory, equipmentItems: [...inventory.equipmentItems, item] },
  }
}

export function unequipAllItems(
  player: Player,
  inventory: ClubInventory,
): { player: Player; inventory: ClubInventory } {
  if (!player.equipment) return { player, inventory }
  const items = Object.values(player.equipment).filter((i): i is EquipmentItem => i !== null)
  if (items.length === 0) return { player, inventory }
  return {
    player: { ...player, equipment: { ...EMPTY_EQUIPMENT } },
    inventory: { ...inventory, equipmentItems: [...inventory.equipmentItems, ...items] },
  }
}
