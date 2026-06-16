import type { Formation, FormationSlot } from '../types/team'
import type { Position } from '../types/player'

export const formations: Formation[] = [
  {
    id: 1, name: "Muro de Hierro", tacticalType: "BALANCED", GK: 1, DF: 4, MD: 4, FW: 2,
    slots: [
      { position: 'GK', x: 50, y: 87 },
      { position: 'DF', x: 13, y: 70 }, { position: 'DF', x: 37, y: 68 }, { position: 'DF', x: 63, y: 68 }, { position: 'DF', x: 87, y: 70 },
      { position: 'MD', x: 13, y: 50 }, { position: 'MD', x: 37, y: 48 }, { position: 'MD', x: 63, y: 48 }, { position: 'MD', x: 87, y: 50 },
      { position: 'FW', x: 33, y: 22 }, { position: 'FW', x: 67, y: 22 },
    ],
  },
  {
    id: 2, name: "Zona de la Muerte", tacticalType: "OFFENSIVE", GK: 1, DF: 4, MD: 3, FW: 3,
    slots: [
      { position: 'GK', x: 50, y: 87 },
      { position: 'DF', x: 13, y: 70 }, { position: 'DF', x: 37, y: 68 }, { position: 'DF', x: 63, y: 68 }, { position: 'DF', x: 87, y: 70 },
      { position: 'MD', x: 25, y: 50 }, { position: 'MD', x: 50, y: 48 }, { position: 'MD', x: 75, y: 50 },
      { position: 'FW', x: 17, y: 20 }, { position: 'FW', x: 50, y: 18 }, { position: 'FW', x: 83, y: 20 },
    ],
  },
  {
    id: 3, name: "Gran Fortaleza", tacticalType: "DEFENSIVE", GK: 1, DF: 5, MD: 3, FW: 2,
    slots: [
      { position: 'GK', x: 50, y: 87 },
      { position: 'DF', x: 8, y: 72 }, { position: 'DF', x: 27, y: 70 }, { position: 'DF', x: 50, y: 68 }, { position: 'DF', x: 73, y: 70 }, { position: 'DF', x: 92, y: 72 },
      { position: 'MD', x: 25, y: 50 }, { position: 'MD', x: 50, y: 48 }, { position: 'MD', x: 75, y: 50 },
      { position: 'FW', x: 33, y: 22 }, { position: 'FW', x: 67, y: 22 },
    ],
  },
  {
    id: 4, name: "Tifón del Centro", tacticalType: "MIDFIELD_CONTROL", GK: 1, DF: 3, MD: 5, FW: 2,
    slots: [
      { position: 'GK', x: 50, y: 87 },
      { position: 'DF', x: 25, y: 74 }, { position: 'DF', x: 50, y: 72 }, { position: 'DF', x: 75, y: 74 },
      { position: 'MD', x: 10, y: 54 }, { position: 'MD', x: 30, y: 50 }, { position: 'MD', x: 50, y: 48 }, { position: 'MD', x: 70, y: 50 }, { position: 'MD', x: 90, y: 54 },
      { position: 'FW', x: 33, y: 22 }, { position: 'FW', x: 67, y: 22 },
    ],
  },
  {
    id: 5, name: "Presión Absoluta", tacticalType: "HIGH_PRESS", GK: 1, DF: 4, MD: 5, FW: 1,
    slots: [
      { position: 'GK', x: 50, y: 87 },
      { position: 'DF', x: 13, y: 72 }, { position: 'DF', x: 37, y: 70 }, { position: 'DF', x: 63, y: 70 }, { position: 'DF', x: 87, y: 72 },
      { position: 'MD', x: 10, y: 58 }, { position: 'MD', x: 30, y: 50 }, { position: 'MD', x: 50, y: 46 }, { position: 'MD', x: 70, y: 50 }, { position: 'MD', x: 90, y: 58 },
      { position: 'FW', x: 50, y: 18 },
    ],
  },
  {
    id: 6, name: "Relámpago Inverso", tacticalType: "COUNTER_ATTACK", GK: 1, DF: 5, MD: 3, FW: 2,
    slots: [
      { position: 'GK', x: 50, y: 87 },
      { position: 'DF', x: 8, y: 72 }, { position: 'DF', x: 27, y: 70 }, { position: 'DF', x: 50, y: 68 }, { position: 'DF', x: 73, y: 70 }, { position: 'DF', x: 92, y: 72 },
      { position: 'MD', x: 25, y: 52 }, { position: 'MD', x: 50, y: 50 }, { position: 'MD', x: 75, y: 52 },
      { position: 'FW', x: 33, y: 24 }, { position: 'FW', x: 67, y: 24 },
    ],
  },
]

// Returns formation slots (coordinates), computing defaults if not explicitly defined.
// NPC team formations don't carry slots — this generates sensible positions from counts.
export function getFormationSlots(formation: Formation): FormationSlot[] {
  if (formation.slots?.length) return formation.slots

  const countMap: Record<Position, number> = {
    GK: formation.GK,
    DF: formation.DF,
    MD: formation.MD,
    FW: formation.FW,
  }
  const rowY: Record<Position, number> = { GK: 87, DF: 70, MD: 50, FW: 22 }
  const order: Position[] = ['GK', 'DF', 'MD', 'FW']
  const slots: FormationSlot[] = []

  for (const pos of order) {
    const count = countMap[pos]
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 50 : 10 + (80 / (count - 1)) * i
      slots.push({ position: pos, x, y: rowY[pos] })
    }
  }

  return slots
}
