import type { Technique } from './player'
import type { EquipmentItem } from './equipment'

export interface TechniqueBook {
  id: string
  technique: Technique
  isImprovement: boolean
}

export interface ClubInventory {
  techniqueBooks: Record<string, number>        // bookId → quantity
  generatedBooks: Record<string, TechniqueBook> // bookId → full data (for generated books)
  equipmentItems: EquipmentItem[]               // unassigned equipment in club stash
}

export const EMPTY_INVENTORY: ClubInventory = {
  techniqueBooks: {},
  generatedBooks: {},
  equipmentItems: [],
}
