import { describe, it, expect } from 'vitest'
import { getEffectiveStats, equipItem, unequipItem, unequipAllItems } from '../services/equipmentService'
import type { Player } from '../types/player'
import type { EquipmentItem } from '../types/equipment'
import type { ClubInventory } from '../types/inventory'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'Test',
    nameRomaji: 'Test',
    gender: 'Masculino',
    position: 'FW',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 70, CON: 65, TEC: 72, PRE: 60, FIS: 68, AGI: 71, INT: 63, TOT: 469 },
    career: {
      maxLevel: 80, potential: 75, growthRate: 1.0,
      contractStatus: 'contracted', marketValue: 50000, salary: 1000,
      experience: 0, trainingProgress: 0, trainingSessionsThisWeek: 0, positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0,
    isSuspended: false, suspensionMatches: 0,
    age: 22, teamId: 1, jerseyNumber: 1,
    ...overrides,
  }
}

function makeItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item-1',
    slot: 'boots',
    name: 'Botas de Fuego',
    statBonuses: { TEC: 3, AGI: 2 },
    tier: 1,
    ...overrides,
  }
}

const emptyInventory: ClubInventory = { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] }

describe('getEffectiveStats', () => {
  it('returns base stats when player has no equipment field', () => {
    const p = makePlayer()
    expect(getEffectiveStats(p)).toEqual(p.stats)
  })

  it('returns base stats when all slots are null', () => {
    const p = makePlayer({ equipment: { gloves: null, boots: null, pendant: null, bracelet: null } })
    expect(getEffectiveStats(p)).toEqual(p.stats)
  })

  it('adds bonuses from one equipped item', () => {
    const item = makeItem({ statBonuses: { TEC: 3, AGI: 2 } })
    const p = makePlayer({ equipment: { gloves: null, boots: item, pendant: null, bracelet: null } })
    const stats = getEffectiveStats(p)
    expect(stats.TEC).toBe(72 + 3)
    expect(stats.AGI).toBe(71 + 2)
    expect(stats.POT).toBe(70)
  })

  it('accumulates bonuses from multiple slots', () => {
    const boots = makeItem({ id: 'b', slot: 'boots', statBonuses: { TEC: 3 } })
    const gloves = makeItem({ id: 'g', slot: 'gloves', statBonuses: { TEC: 2, POT: 1 } })
    const p = makePlayer({ equipment: { gloves, boots, pendant: null, bracelet: null } })
    const stats = getEffectiveStats(p)
    expect(stats.TEC).toBe(72 + 5)
    expect(stats.POT).toBe(70 + 1)
    expect(stats.CON).toBe(65)
  })
})

describe('equipItem', () => {
  it('moves item from inventory to player slot', () => {
    const item = makeItem()
    const inv = { ...emptyInventory, equipmentItems: [item] }
    const p = makePlayer({ equipment: { gloves: null, boots: null, pendant: null, bracelet: null } })
    const result = equipItem(p, item, inv)
    expect(result.player.equipment?.boots).toEqual(item)
    expect(result.inventory.equipmentItems.find(i => i.id === item.id)).toBeUndefined()
  })

  it('returns displaced item to inventory when slot was occupied', () => {
    const old = makeItem({ id: 'old', statBonuses: { TEC: 1 } })
    const newItem = makeItem({ id: 'new', statBonuses: { TEC: 5 } })
    const inv = { ...emptyInventory, equipmentItems: [newItem] }
    const p = makePlayer({ equipment: { gloves: null, boots: old, pendant: null, bracelet: null } })
    const result = equipItem(p, newItem, inv)
    expect(result.player.equipment?.boots).toEqual(newItem)
    expect(result.inventory.equipmentItems.find(i => i.id === 'old')).toEqual(old)
  })

  it('works when player has no equipment field (initialises it)', () => {
    const item = makeItem()
    const inv = { ...emptyInventory, equipmentItems: [item] }
    const p = makePlayer()
    const result = equipItem(p, item, inv)
    expect(result.player.equipment?.boots).toEqual(item)
  })
})

describe('unequipItem', () => {
  it('moves item from slot to inventory', () => {
    const item = makeItem()
    const p = makePlayer({ equipment: { gloves: null, boots: item, pendant: null, bracelet: null } })
    const result = unequipItem(p, 'boots', emptyInventory)
    expect(result.player.equipment?.boots).toBeNull()
    expect(result.inventory.equipmentItems).toContain(item)
  })

  it('returns unchanged references when slot is empty', () => {
    const p = makePlayer({ equipment: { gloves: null, boots: null, pendant: null, bracelet: null } })
    const result = unequipItem(p, 'boots', emptyInventory)
    expect(result.player).toBe(p)
    expect(result.inventory).toBe(emptyInventory)
  })
})

describe('unequipAllItems', () => {
  it('clears all slots and returns items to inventory', () => {
    const boots = makeItem({ id: 'b', slot: 'boots' })
    const gloves = makeItem({ id: 'g', slot: 'gloves' })
    const p = makePlayer({ equipment: { gloves, boots, pendant: null, bracelet: null } })
    const result = unequipAllItems(p, emptyInventory)
    expect(result.player.equipment?.boots).toBeNull()
    expect(result.player.equipment?.gloves).toBeNull()
    expect(result.inventory.equipmentItems).toHaveLength(2)
  })

  it('returns unchanged references when player has no equipment', () => {
    const p = makePlayer()
    const result = unequipAllItems(p, emptyInventory)
    expect(result.player).toBe(p)
    expect(result.inventory).toBe(emptyInventory)
  })
})
