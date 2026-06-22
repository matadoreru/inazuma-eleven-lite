import type { Player, Stats, Technique, TechniqueStatBoosts } from '../types/player'
import type { ClubInventory } from '../types/inventory'
import type { TechniqueBook } from '../types/inventory'

export const MAX_NORMAL_TECHNIQUES = 3
export const MAX_IMPROVEMENT_TECHNIQUES = 2

const ACTION_STATS: Record<Technique['type'], [keyof TechniqueStatBoosts, keyof TechniqueStatBoosts]> = {
  Tiro: ['POT', 'TEC'],
  Regate: ['CON', 'AGI'],
  Bloqueo: ['PRE', 'FIS'],
  Parada: ['PRE', 'AGI'],
  Mejora: ['INT', 'TEC'],
}

/** Default used to migrate old saves and to create generated techniques. */
export function buildTechniqueStatBoosts(type: Technique['type'], power: number): TechniqueStatBoosts {
  if (power <= 0) return {}
  const [primary, secondary] = ACTION_STATS[type]
  const primaryBoost = Math.max(1, Math.min(15, Math.round(power / 8)))
  return { [primary]: primaryBoost, [secondary]: Math.max(1, Math.round(primaryBoost / 2)) }
}

export function getTechniqueStatBoosts(technique: Technique): TechniqueStatBoosts {
  return technique.statBoosts ?? buildTechniqueStatBoosts(technique.type, technique.POT)
}

export function applyTechniqueStatBoosts(stats: Stats, boosts: TechniqueStatBoosts): Stats {
  const next = { ...stats }
  for (const key of Object.keys(boosts) as Array<keyof TechniqueStatBoosts>) {
    next[key] = Math.min(120, next[key] + (boosts[key] ?? 0))
  }
  next.TOT = Math.round((next.POT + next.CON + next.TEC + next.PRE + next.FIS + next.AGI + next.INT) / 7)
  return next
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getNormalTechniques(player: Player): Technique[] {
  return player.techniques.filter((t) => t.type !== 'Mejora')
}

export function getImprovementTechniques(player: Player): Technique[] {
  return [
    ...player.techniques.filter((t) => t.type === 'Mejora'),
    ...(player.improvementTechniques ?? []),
  ]
}

export function hasSpaceForNormal(player: Player): boolean {
  return getNormalTechniques(player).length < MAX_NORMAL_TECHNIQUES
}

export function hasSpaceForImprovement(player: Player): boolean {
  return getImprovementTechniques(player).length < MAX_IMPROVEMENT_TECHNIQUES
}

export function hasBookInInventory(bookId: string, inventory: ClubInventory): boolean {
  return (inventory.techniqueBooks[bookId] ?? 0) > 0
}

export function alreadyKnows(player: Player, techniqueId: number): boolean {
  const all = [...player.techniques, ...(player.improvementTechniques ?? [])]
  return all.some((t) => t.id === techniqueId)
}

// ─── Learning checks ─────────────────────────────────────────────────────────

export type LearnResult =
  | 'ok'
  | 'no_book'
  | 'already_known'
  | 'no_space'  // slot full, must replace

export function canLearn(
  player: Player,
  book: TechniqueBook,
  inventory: ClubInventory,
): LearnResult {
  if (!hasBookInInventory(book.id, inventory)) return 'no_book'
  if (alreadyKnows(player, book.technique.id)) return 'already_known'
  const isImprovement = book.isImprovement || book.technique.type === 'Mejora'
  if (isImprovement && !hasSpaceForImprovement(player)) return 'no_space'
  if (!isImprovement && !hasSpaceForNormal(player)) return 'no_space'
  return 'ok'
}

// ─── Teaching ────────────────────────────────────────────────────────────────

// Teaches a technique, consuming one book from inventory.
// If replaceIndex is provided, replaces that slot instead of appending.
// replaceIndex refers to the index within the normal or improvement array (depending on type).
export function learnTechnique(
  player: Player,
  book: TechniqueBook,
  inventory: ClubInventory,
  replaceIndex?: number,
): { player: Player; inventory: ClubInventory } {
  const newTechnique = book.technique
  const isImprovement = book.isImprovement || newTechnique.type === 'Mejora'

  // Deduct book
  const newBooks = { ...inventory.techniqueBooks }
  const qty = newBooks[book.id] ?? 0
  if (qty <= 1) {
    delete newBooks[book.id]
  } else {
    newBooks[book.id] = qty - 1
  }
  const newInventory: ClubInventory = { ...inventory, techniqueBooks: newBooks }

  let newPlayer: Player

  if (!isImprovement) {
    const existing = getNormalTechniques(player)
    let updated: Technique[]
    if (replaceIndex !== undefined && replaceIndex < existing.length) {
      updated = existing.map((t, i) => (i === replaceIndex ? newTechnique : t))
    } else {
      updated = [...existing, newTechnique].slice(0, MAX_NORMAL_TECHNIQUES)
    }
    // Keep improvement techniques (type === 'Mejora') separate
    const improvements = player.techniques.filter((t) => t.type === 'Mejora')
    newPlayer = {
      ...player,
      techniques: [...updated, ...improvements],
    }
  } else {
    const existing = getImprovementTechniques(player)
    let updated: Technique[]
    if (replaceIndex !== undefined && replaceIndex < existing.length) {
      updated = existing.map((t, i) => (i === replaceIndex ? newTechnique : t))
    } else {
      updated = [...existing, newTechnique].slice(0, MAX_IMPROVEMENT_TECHNIQUES)
    }
    // Keep normal techniques unchanged
    const normals = player.techniques.filter((t) => t.type !== 'Mejora')
    newPlayer = {
      ...player,
      techniques: [...normals, ...updated],
      improvementTechniques: [],  // migrated into techniques
    }
  }

  return { player: newPlayer, inventory: newInventory }
}
