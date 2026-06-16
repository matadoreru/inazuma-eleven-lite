import type { TechniqueBook } from '../types/inventory'

// Master catalog of all technique books available in the game.
// Books are added to the club inventory via rewards, events, or the future shop.
// Each entry has a unique id, the technique it teaches, and whether it's an improvement technique.
export const techniqueBooksCatalog: TechniqueBook[] = [
  // Example entries (uncomment / expand as books are added to rewards/shop):
  // {
  //   id: 'book_693',
  //   technique: { id: 693, name: 'STRONG PUNCH', type: 'Parada', element: '', POT: 50, PP: 50 },
  //   isImprovement: false,
  // },
]

export function getTechniqueBook(id: string): TechniqueBook | undefined {
  return techniqueBooksCatalog.find((b) => b.id === id)
}
