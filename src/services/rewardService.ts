import type { Match, MatchResult } from '../types/competition'
import type { Team } from '../types/team'
import type { Player, Stats } from '../types/player'
import type { MatchReward, RewardRarity } from '../types/reward'
import type { EquipmentSlot } from '../types/equipment'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------------------------------------------------------------------------
// Core difficulty functions
// ---------------------------------------------------------------------------

export function calcMatchDifficulty(
  rivalReputation: number,
  userReputation: number,
  isCupMatch: boolean,
): number {
  const raw =
    (rivalReputation - userReputation) / 100 + (isCupMatch ? 0.25 : 0)
  return clamp(raw, 0, 1.5)
}

export function difficultyToTier(difficulty: number): 1 | 2 | 3 {
  if (difficulty < 0.5) return 1
  if (difficulty < 1.0) return 2
  return 3
}

export function rewardQualityToRarity(quality: number): RewardRarity {
  if (quality < 0.2) return 'common'
  if (quality < 0.5) return 'uncommon'
  if (quality < 0.85) return 'special'
  if (quality < 1.2) return 'rare'
  return 'legendary'
}

function rarityToEquipmentTier(rarity: RewardRarity): 1 | 2 | 3 {
  if (rarity === 'common' || rarity === 'uncommon') return 1
  if (rarity === 'special') return 2
  return 3
}

export type MatchOutcome = 'win' | 'draw' | 'loss'

export function calcRewardQuality(
  baseDifficulty: number,
  outcome: MatchOutcome,
  goalDiff = 0,
): number {
  const marginImpact = Math.min(Math.max(goalDiff - 1, 0) * 0.15, 0.3)

  if (outcome === 'win') {
    return clamp(baseDifficulty + 0.65 + marginImpact, 0, 1.5)
  }

  if (outcome === 'loss') {
    return clamp(baseDifficulty - 0.85 - marginImpact, 0, 1.5)
  }

  return clamp(baseDifficulty - 0.05, 0, 1.5)
}

function getUserMatchOutcome(
  match: Match,
  userTeamId: number,
  result?: Pick<MatchResult, 'homeGoals' | 'awayGoals'>,
): { outcome: MatchOutcome; goalDiff: number } {
  const homeGoals = result?.homeGoals ?? match.homeGoals
  const awayGoals = result?.awayGoals ?? match.awayGoals
  const userIsHome = match.homeTeamId === userTeamId
  const userGoals = userIsHome ? homeGoals : awayGoals
  const rivalGoals = userIsHome ? awayGoals : homeGoals

  if (userGoals > rivalGoals) {
    return { outcome: 'win', goalDiff: userGoals - rivalGoals }
  }

  if (userGoals < rivalGoals) {
    return { outcome: 'loss', goalDiff: rivalGoals - userGoals }
  }

  return { outcome: 'draw', goalDiff: 0 }
}

// ---------------------------------------------------------------------------
// Individual reward generators
// ---------------------------------------------------------------------------

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['gloves', 'boots', 'pendant', 'bracelet']

const SLOT_PREFIXES: Record<EquipmentSlot, string> = {
  gloves: 'Guantes',
  boots: 'Botas',
  pendant: 'Colgante',
  bracelet: 'Pulsera',
}

const FLAVORS = [
  'de Fuego',
  'de Viento',
  'de Hierro',
  'de Madera',
  'del Trueno',
  'del Sol',
  'de la Luna',
  'del Rayo',
]

const STAT_KEYS: Array<keyof Omit<Stats, 'TOT'>> = [
  'POT',
  'CON',
  'TEC',
  'PRE',
  'FIS',
  'AGI',
  'INT',
]

function generateEquipmentReward(rarity: RewardRarity): MatchReward {
  const slot = pickRandom(EQUIPMENT_SLOTS)
  const flavor = pickRandom(FLAVORS)
  const name = `${SLOT_PREFIXES[slot]} ${flavor}`

  let numStats: number
  let statMin: number
  let statMax: number

  if (rarity === 'common') {
    numStats = randomInt(1, 2)
    statMin = 1
    statMax = 2
  } else if (rarity === 'uncommon') {
    numStats = 2
    statMin = 1
    statMax = 3
  } else if (rarity === 'special') {
    numStats = randomInt(2, 3)
    statMin = 2
    statMax = 4
  } else if (rarity === 'rare') {
    numStats = randomInt(3, 4)
    statMin = 3
    statMax = 6
  } else {
    numStats = 4
    statMin = 5
    statMax = 8
  }

  // Pick unique stats
  const shuffledStats = shuffleArray(STAT_KEYS)
  const chosenStats = shuffledStats.slice(0, numStats)

  const statBonuses: Partial<Stats> = {}
  for (const stat of chosenStats) {
    statBonuses[stat] = randomInt(statMin, statMax)
  }

  return {
    type: 'equipment',
    rarity,
    equipmentItem: {
      id: `equip_gen_${crypto.randomUUID()}`,
      slot,
      name,
      statBonuses,
      tier: rarityToEquipmentTier(rarity),
      rarity,
    },
  }
}

function generateMoneyReward(rarity: RewardRarity): MatchReward {
  let amountK: number
  if (rarity === 'common') {
    amountK = randomInt(5, 15)
  } else if (rarity === 'uncommon') {
    amountK = randomInt(12, 25)
  } else if (rarity === 'special') {
    amountK = randomInt(25, 45)
  } else if (rarity === 'rare') {
    amountK = randomInt(45, 75)
  } else {
    amountK = randomInt(75, 120)
  }
  return {
    type: 'money',
    rarity,
    moneyAmount: amountK * 1000,
  }
}

const TECHNIQUE_TYPES = ['Tiro', 'Regate', 'Bloqueo', 'Parada', 'Mejora'] as const
const ELEMENTS = ['FIRE', 'WOOD', 'WIND', 'MOUNTAIN', ''] as const
const TECH_NAMES = [
  'Tornado',
  'Relámpago',
  'Glaciar',
  'Inferno',
  'Ciclón',
  'Titán',
  'Sombra',
  'Volcán',
  'Tormenta',
  'Fénix',
]

function generateTechniqueBookReward(rarity: RewardRarity): MatchReward {
  let potMin: number
  let potMax: number
  if (rarity === 'common') {
    potMin = 10
    potMax = 28
  } else if (rarity === 'uncommon') {
    potMin = 25
    potMax = 45
  } else if (rarity === 'special') {
    potMin = 45
    potMax = 62
  } else if (rarity === 'rare') {
    potMin = 62
    potMax = 82
  } else {
    potMin = 82
    potMax = 99
  }

  const pot = randomInt(potMin, potMax)
  const type = pickRandom([...TECHNIQUE_TYPES])
  const element = pickRandom([...ELEMENTS])
  const techName = pickRandom(TECH_NAMES)
  const name = `${techName} ${type}`
  const pp = Math.floor(pot * 0.7)
  const id = randomInt(1000, 9999)

  const bookId = `book_gen_${crypto.randomUUID()}`

  return {
    type: 'technique_book',
    rarity,
    techniqueBook: {
      id: bookId,
      technique: {
        id,
        name,
        type,
        element,
        POT: pot,
        PP: pp,
      },
      isImprovement: type === 'Mejora',
    },
  }
}

const POSITION_STATS: Record<Player['position'], Array<keyof Stats>> = {
  GK: ['POT', 'CON'],
  DF: ['PRE', 'FIS'],
  MD: ['TEC', 'INT'],
  FW: ['POT', 'TEC'],
}

function generateStatBoostReward(
  rarity: RewardRarity,
  starters: Player[],
  nameStyle: 'western' | 'japanese' = 'western',
): MatchReward {
  const player = pickRandom(starters)
  const statChoices = POSITION_STATS[player.position]
  const stat = pickRandom(statChoices) as keyof Stats

  let amount: number
  if (rarity === 'common') {
    amount = randomInt(1, 2)
  } else if (rarity === 'uncommon') {
    amount = randomInt(2, 3)
  } else if (rarity === 'special') {
    amount = randomInt(3, 4)
  } else if (rarity === 'rare') {
    amount = randomInt(4, 6)
  } else {
    amount = randomInt(6, 8)
  }

  return {
    type: 'stat_boost',
    rarity,
    statBoost: {
      playerId: player.id,
      playerName: nameStyle === 'japanese' ? player.nameRomaji : player.name,
      stat,
      amount,
    },
  }
}

// ---------------------------------------------------------------------------
// Main reward generation
// ---------------------------------------------------------------------------

export function generateMatchRewards(
  match: Match,
  userTeam: Team,
  rivalTeam: Team,
  starters: Player[],
  rewardChoices: number,
  result?: Pick<MatchResult, 'homeGoals' | 'awayGoals'>,
  nameStyle: 'western' | 'japanese' = 'western',
): MatchReward[] {
  const isCupMatch = match.type === 'cup'
  const baseDifficulty = calcMatchDifficulty(
    rivalTeam.reputation,
    userTeam.reputation,
    isCupMatch,
  )
  const { outcome, goalDiff } = getUserMatchOutcome(match, userTeam.id, result)
  const rewardQuality = calcRewardQuality(baseDifficulty, outcome, goalDiff)
  const rarity = rewardQualityToRarity(rewardQuality)

  // Build candidate pool
  const candidates: MatchReward[] = [
    generateEquipmentReward(rarity),
    generateMoneyReward(rarity),
    generateTechniqueBookReward(rarity),
  ]

  if (starters.length > 0) {
    candidates.push(generateStatBoostReward(rarity, starters, nameStyle))
  }

  // Shuffle and take first rewardChoices items
  const shuffled = shuffleArray(candidates)
  return shuffled.slice(0, rewardChoices)
}
