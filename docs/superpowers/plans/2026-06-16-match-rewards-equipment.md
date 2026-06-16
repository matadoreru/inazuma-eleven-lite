# Match Rewards, Equipment & Extended Standings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-match reward choice system (technique book, money, stat boost, or equipment), a 4-slot per-player equipment system with stat bonuses, and extend the standings screen with Copa and Otras Ligas tabs.

**Architecture:** Equipment items are generated procedurally by `rewardService` based on match difficulty (rival reputation + cup bonus). Stat bonuses are applied at read-time via `getEffectiveStats()` in `equipmentService`, consumed by `buildTeamSnapshot` and the PlayerDetail UI. Rewards are held in `pendingRewards` store state, shown as a modal on `MatchScreen`, then claimed via a store action.

**Tech Stack:** TypeScript, React, Zustand, Vitest, Tailwind CSS

---

## File Map

**New files:**
- `src/types/equipment.ts` — `EquipmentSlot`, `EquipmentItem`, `EMPTY_EQUIPMENT`
- `src/types/reward.ts` — `MatchRewardType`, `MatchReward`
- `src/services/equipmentService.ts` — `getEffectiveStats`, `equipItem`, `unequipItem`, `unequipAllItems`
- `src/services/rewardService.ts` — `calcMatchDifficulty`, `difficultyToTier`, `generateMatchRewards`
- `src/components/MatchRewardModal.tsx` — overlay shown on MatchScreen after a win
- `src/components/EquipmentPanel.tsx` — 4-slot panel in PlayerDetailScreen
- `src/tests/equipmentService.test.ts`
- `src/tests/rewardService.test.ts`

**Modified files:**
- `src/types/player.ts` — add optional `equipment?` field
- `src/types/inventory.ts` — add `equipmentItems`, `generatedBooks` to `ClubInventory`; update `EMPTY_INVENTORY`
- `src/types/career.ts` — add `rewardChoices: 1 | 2 | 3`
- `src/services/careerService.ts` — accept `rewardChoices` param in `createCareer`
- `src/services/formationService.ts` — use `getEffectiveStats` in `buildTeamSnapshot`
- `src/store/careerStore.ts` — `pendingRewards` state, `claimMatchReward`, `equipItemOnPlayer`, `unequipItemFromPlayer`, update `simulateMatch`/`commitLiveMatch`/`simulateCupMatch`, `startNewCareer`, `loadCareer`, `sellPlayer`
- `src/screens/NewCareerScreen.tsx` — `rewardChoices` selector
- `src/screens/MatchScreen.tsx` — show `MatchRewardModal` on win
- `src/screens/PlayerDetailScreen.tsx` — add `EquipmentPanel`
- `src/screens/StandingsScreen.tsx` — tabs for Copa and Otras Ligas

---

## Task 1: New Types

**Files:**
- Create: `src/types/equipment.ts`
- Create: `src/types/reward.ts`
- Modify: `src/types/player.ts`
- Modify: `src/types/inventory.ts`
- Modify: `src/types/career.ts`

- [ ] **Step 1: Create `src/types/equipment.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/types/reward.ts`**

```ts
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
```

- [ ] **Step 3: Add `equipment?` to `Player` in `src/types/player.ts`**

Add this import at the top:
```ts
import type { EquipmentItem, EquipmentSlot } from './equipment'
```

Add this field inside the `Player` interface (after `improvementTechniques?`):
```ts
equipment?: Record<EquipmentSlot, EquipmentItem | null>
```

- [ ] **Step 4: Update `src/types/inventory.ts`**

Replace the entire file with:
```ts
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
```

- [ ] **Step 5: Add `rewardChoices` to `Career` in `src/types/career.ts`**

Add this field inside the `Career` interface (after `lastSeasonReview`):
```ts
rewardChoices: 1 | 2 | 3
```

- [ ] **Step 6: Run TypeScript to check errors**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors about missing `rewardChoices` and `generatedBooks` in usages — these will be fixed in later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/types/equipment.ts src/types/reward.ts src/types/player.ts src/types/inventory.ts src/types/career.ts
git commit -m "feat: add equipment, reward, and rewardChoices types"
```

---

## Task 2: equipmentService

**Files:**
- Create: `src/services/equipmentService.ts`
- Create: `src/tests/equipmentService.test.ts`

- [ ] **Step 1: Write the failing tests in `src/tests/equipmentService.test.ts`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test -- equipmentService 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../services/equipmentService'`

- [ ] **Step 3: Create `src/services/equipmentService.ts`**

```ts
import type { Player, Stats } from '../types/player'
import type { EquipmentItem, EquipmentSlot } from '../types/equipment'
import type { ClubInventory } from '../types/inventory'

const EMPTY_SLOTS: Record<EquipmentSlot, EquipmentItem | null> = {
  gloves: null,
  boots: null,
  pendant: null,
  bracelet: null,
}

export function getEffectiveStats(player: Player): Stats {
  const base = { ...player.stats }
  if (!player.equipment) return base
  for (const item of Object.values(player.equipment)) {
    if (!item) continue
    for (const [k, bonus] of Object.entries(item.statBonuses) as [keyof Stats, number][]) {
      base[k] = (base[k] ?? 0) + bonus
    }
  }
  return base
}

export function equipItem(
  player: Player,
  item: EquipmentItem,
  inventory: ClubInventory,
): { player: Player; inventory: ClubInventory } {
  const current = player.equipment ?? { ...EMPTY_SLOTS }
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
  const current = player.equipment ?? { ...EMPTY_SLOTS }
  const item = current[slot]
  if (!item) return { player, inventory }
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
    player: { ...player, equipment: { ...EMPTY_SLOTS } },
    inventory: { ...inventory, equipmentItems: [...inventory.equipmentItems, ...items] },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test -- equipmentService 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/equipmentService.ts src/tests/equipmentService.test.ts
git commit -m "feat: add equipmentService with getEffectiveStats, equipItem, unequipItem"
```

---

## Task 3: Use `getEffectiveStats` in `formationService`

**Files:**
- Modify: `src/services/formationService.ts`

- [ ] **Step 1: Add import in `src/services/formationService.ts`**

After the existing imports at the top of `formationService.ts`, add:
```ts
import { getEffectiveStats } from './equipmentService'
```

- [ ] **Step 2: Update `buildTeamSnapshot` to use effective stats**

In `buildTeamSnapshot`, inside the `for (const slot of starters)` loop, replace the line:
```ts
const player = playerMap.get(slot.playerId)
if (!player) continue
const mod = positionModifier(slot.assignedPosition, player.position)
const stamMod = staminaPerformanceMultiplier(player.stamina)
```

with:
```ts
const player = playerMap.get(slot.playerId)
if (!player) continue
const effectivePlayer = { ...player, stats: getEffectiveStats(player) }
const mod = positionModifier(slot.assignedPosition, player.position)
const stamMod = staminaPerformanceMultiplier(player.stamina)
```

Then replace every reference to `player` in the `switch` block with `effectivePlayer`:

```ts
switch (slot.assignedPosition) {
  case 'FW':
    forwardTotal += calcForwardScore(effectivePlayer, mod) * stamMod
    forwardCount++
    break
  case 'MD':
    midfieldTotal += calcMidfieldScore(effectivePlayer, mod) * stamMod
    midfieldCount++
    break
  case 'DF':
    defenseTotal += calcDefenseScore(effectivePlayer, mod) * stamMod
    defenseCount++
    break
  case 'GK':
    goalkeeperTotal += calcGoalkeeperScore(effectivePlayer, mod) * stamMod
    goalkeeperCount++
    break
}
```

- [ ] **Step 3: Run all tests to verify nothing broke**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/formationService.ts
git commit -m "feat: apply equipment stat bonuses in buildTeamSnapshot"
```

---

## Task 4: rewardService

**Files:**
- Create: `src/services/rewardService.ts`
- Create: `src/tests/rewardService.test.ts`

- [ ] **Step 1: Write failing tests in `src/tests/rewardService.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { calcMatchDifficulty, difficultyToTier, generateMatchRewards } from '../services/rewardService'
import type { Match } from '../types/competition'
import type { Team } from '../types/team'
import type { Player } from '../types/player'

function makeTeam(rep: number, id = 1): Team {
  return {
    id, name: `Team${id}`, tier: 1, reputation: rep, budget: 100_000,
    leagueId: 'first_division', captainId: 1,
    formation: { id: 1, name: '4-4-2', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 },
    lineup: [], playerIds: [],
  }
}

function makeMatch(type: 'league' | 'cup' = 'league'): Match {
  return {
    id: 'm1', leagueId: 'first_division', type, round: 1,
    homeTeamId: 1, awayTeamId: 2, date: '2026-01-01',
    played: false, homeGoals: 0, awayGoals: 0, result: null,
  }
}

describe('calcMatchDifficulty', () => {
  it('returns 0 when rival is weaker', () => {
    expect(calcMatchDifficulty(40, 80, false)).toBe(0)
  })
  it('returns 0 when reputation equal, league match', () => {
    expect(calcMatchDifficulty(70, 70, false)).toBe(0)
  })
  it('adds 0.25 bonus for cup matches', () => {
    expect(calcMatchDifficulty(70, 70, true)).toBeCloseTo(0.25)
  })
  it('caps at 1.5', () => {
    expect(calcMatchDifficulty(100, 0, true)).toBe(1.5)
  })
  it('is proportional to reputation gap', () => {
    expect(calcMatchDifficulty(80, 60, false)).toBeCloseTo(0.2)
  })
})

describe('difficultyToTier', () => {
  it('returns 1 for difficulty below 0.5', () => expect(difficultyToTier(0)).toBe(1))
  it('returns 1 for difficulty 0.49', () => expect(difficultyToTier(0.49)).toBe(1))
  it('returns 2 for difficulty 0.5', () => expect(difficultyToTier(0.5)).toBe(2))
  it('returns 2 for difficulty 0.99', () => expect(difficultyToTier(0.99)).toBe(2))
  it('returns 3 for difficulty 1.0', () => expect(difficultyToTier(1.0)).toBe(3))
  it('returns 3 for difficulty 1.5', () => expect(difficultyToTier(1.5)).toBe(3))
})

describe('generateMatchRewards', () => {
  it('returns exactly rewardChoices items', () => {
    const rewards = generateMatchRewards(makeMatch(), makeTeam(70), makeTeam(70, 2), [], 3)
    expect(rewards).toHaveLength(3)
  })

  it('returns 2 items when rewardChoices is 2', () => {
    const rewards = generateMatchRewards(makeMatch(), makeTeam(70), makeTeam(70, 2), [], 2)
    expect(rewards).toHaveLength(2)
  })

  it('returns 1 item when rewardChoices is 1', () => {
    const rewards = generateMatchRewards(makeMatch(), makeTeam(70), makeTeam(70, 2), [], 1)
    expect(rewards).toHaveLength(1)
  })

  it('all rewards have valid type', () => {
    const valid = ['technique_book', 'money', 'stat_boost', 'equipment']
    for (let i = 0; i < 10; i++) {
      const rewards = generateMatchRewards(makeMatch(), makeTeam(70), makeTeam(70, 2), [], 3)
      for (const r of rewards) expect(valid).toContain(r.type)
    }
  })

  it('money reward has positive amount', () => {
    for (let i = 0; i < 20; i++) {
      const rewards = generateMatchRewards(makeMatch(), makeTeam(70), makeTeam(70, 2), [], 3)
      for (const r of rewards) {
        if (r.type === 'money') expect(r.moneyAmount).toBeGreaterThan(0)
      }
    }
  })

  it('equipment reward has valid slot', () => {
    const valid = ['gloves', 'boots', 'pendant', 'bracelet']
    for (let i = 0; i < 20; i++) {
      const rewards = generateMatchRewards(makeMatch(), makeTeam(70), makeTeam(70, 2), [], 3)
      for (const r of rewards) {
        if (r.type === 'equipment') expect(valid).toContain(r.equipmentItem?.slot)
      }
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test -- rewardService 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../services/rewardService'`

- [ ] **Step 3: Create `src/services/rewardService.ts`**

```ts
import type { Match } from '../types/competition'
import type { Team } from '../types/team'
import type { Player, Stats, Technique, Element } from '../types/player'
import type { TechniqueBook } from '../types/inventory'
import type { EquipmentItem, EquipmentSlot } from '../types/equipment'
import type { MatchReward } from '../types/reward'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export type RewardTier = 1 | 2 | 3

export function calcMatchDifficulty(
  rivalReputation: number,
  userReputation: number,
  isCupMatch: boolean,
): number {
  const raw = (rivalReputation - userReputation) / 100 + (isCupMatch ? 0.25 : 0)
  return clamp(raw, 0, 1.5)
}

export function difficultyToTier(difficulty: number): RewardTier {
  if (difficulty >= 1.0) return 3
  if (difficulty >= 0.5) return 2
  return 1
}

// ─── Equipment generation ────────────────────────────────────────────────────

const SLOTS: EquipmentSlot[] = ['gloves', 'boots', 'pendant', 'bracelet']

const SLOT_PREFIXES: Record<EquipmentSlot, string> = {
  gloves: 'Guantes',
  boots: 'Botas',
  pendant: 'Colgante',
  bracelet: 'Pulsera',
}

const FLAVORS = [
  'de Fuego', 'de Viento', 'de Hierro', 'de Madera',
  'del Trueno', 'del Sol', 'de la Luna', 'del Rayo',
] as const

const ALL_STATS: (keyof Stats)[] = ['POT', 'CON', 'TEC', 'PRE', 'FIS', 'AGI', 'INT']

const EQUIP_TIER_CONFIG: Record<RewardTier, { countMin: number; countMax: number; statMin: number; statMax: number }> = {
  1: { countMin: 1, countMax: 2, statMin: 1, statMax: 3 },
  2: { countMin: 2, countMax: 3, statMin: 2, statMax: 5 },
  3: { countMin: 3, countMax: 4, statMin: 3, statMax: 8 },
}

function generateEquipmentReward(tier: RewardTier): MatchReward {
  const slot = pickRandom(SLOTS)
  const cfg = EQUIP_TIER_CONFIG[tier]
  const numStats = randInt(cfg.countMin, cfg.countMax)
  const shuffled = [...ALL_STATS].sort(() => Math.random() - 0.5).slice(0, numStats)
  const statBonuses: Partial<Stats> = {}
  for (const s of shuffled) statBonuses[s] = randInt(cfg.statMin, cfg.statMax)
  const item: EquipmentItem = {
    id: crypto.randomUUID(),
    slot,
    name: `${SLOT_PREFIXES[slot]} ${pickRandom(FLAVORS)}`,
    statBonuses,
    tier,
  }
  return { type: 'equipment', equipmentItem: item }
}

// ─── Money generation ────────────────────────────────────────────────────────

const MONEY_RANGES: Record<RewardTier, [number, number]> = {
  1: [5_000, 15_000],
  2: [15_000, 40_000],
  3: [40_000, 100_000],
}

function generateMoneyReward(tier: RewardTier): MatchReward {
  const [min, max] = MONEY_RANGES[tier]
  const amount = Math.round(randInt(min, max) / 1_000) * 1_000
  return { type: 'money', moneyAmount: amount }
}

// ─── Stat boost generation ───────────────────────────────────────────────────

const STAT_BOOST_RANGES: Record<RewardTier, [number, number]> = {
  1: [1, 2],
  2: [2, 4],
  3: [4, 7],
}

const POSITION_STATS: Record<Player['position'], (keyof Stats)[]> = {
  GK: ['POT', 'CON'],
  DF: ['PRE', 'FIS'],
  MD: ['TEC', 'INT'],
  FW: ['POT', 'TEC'],
}

function generateStatBoostReward(tier: RewardTier, starters: Player[]): MatchReward | null {
  if (starters.length === 0) return null
  const player = pickRandom(starters)
  const stat = pickRandom(POSITION_STATS[player.position] ?? ALL_STATS)
  const [min, max] = STAT_BOOST_RANGES[tier]
  return {
    type: 'stat_boost',
    statBoost: { playerId: player.id, playerName: player.nameRomaji, stat, amount: randInt(min, max) },
  }
}

// ─── Technique book generation ───────────────────────────────────────────────

const TECH_TYPES: Technique['type'][] = ['Tiro', 'Regate', 'Bloqueo', 'Parada', 'Mejora']
const ELEMENTS: (Element | '')[] = ['FIRE', 'WOOD', 'WIND', 'MOUNTAIN', '']
const TECH_NAMES = [
  'Tornado', 'Relámpago', 'Glaciar', 'Inferno', 'Ciclón',
  'Titán', 'Sombra', 'Volcán', 'Tormenta', 'Fénix',
] as const

const TECH_POT_RANGES: Record<RewardTier, [number, number]> = {
  1: [10, 40],
  2: [40, 65],
  3: [65, 95],
}

function generateTechniqueBookReward(tier: RewardTier): MatchReward {
  const [min, max] = TECH_POT_RANGES[tier]
  const pot = randInt(min, max)
  const type = pickRandom(TECH_TYPES)
  const book: TechniqueBook = {
    id: `book_gen_${crypto.randomUUID()}`,
    technique: {
      id: randInt(1000, 9999),
      name: `${pickRandom(TECH_NAMES)} ${type}`,
      type,
      element: pickRandom(ELEMENTS),
      POT: pot,
      PP: Math.floor(pot * 0.7),
    },
    isImprovement: type === 'Mejora',
  }
  return { type: 'technique_book', techniqueBook: book }
}

// ─── Main generator ──────────────────────────────────────────────────────────

export function generateMatchRewards(
  match: Match,
  userTeam: Team,
  rivalTeam: Team,
  starters: Player[],
  rewardChoices: 1 | 2 | 3,
): MatchReward[] {
  const isCupMatch = match.type === 'cup'
  const difficulty = calcMatchDifficulty(rivalTeam.reputation, userTeam.reputation, isCupMatch)
  const tier = difficultyToTier(difficulty)

  const candidates: MatchReward[] = [
    generateEquipmentReward(tier),
    generateMoneyReward(tier),
    generateTechniqueBookReward(tier),
  ]

  const boost = generateStatBoostReward(tier, starters)
  if (boost) candidates.push(boost)

  return candidates.sort(() => Math.random() - 0.5).slice(0, rewardChoices)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test -- rewardService 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/rewardService.ts src/tests/rewardService.test.ts
git commit -m "feat: add rewardService with procedural reward generation"
```

---

## Task 5: Career service + Store wiring

**Files:**
- Modify: `src/services/careerService.ts`
- Modify: `src/store/careerStore.ts`

- [ ] **Step 1: Add `rewardChoices` param to `createCareer` in `src/services/careerService.ts`**

Change the function signature from:
```ts
export function createCareer(
  managerName: string,
  teamId: number,
  teams: Team[],
  leagues: League[],
  players: Player[],
): { career: Career; teams: Team[]; players: Player[] }
```
to:
```ts
export function createCareer(
  managerName: string,
  teamId: number,
  teams: Team[],
  leagues: League[],
  players: Player[],
  rewardChoices: 1 | 2 | 3 = 3,
): { career: Career; teams: Team[]; players: Player[] }
```

Inside `createCareer`, add `rewardChoices` to the career object (after `lastSeasonReview: null`):
```ts
rewardChoices,
```

Also update `EMPTY_INVENTORY` usage — add the missing `generatedBooks: {}` if it was not included in the import already (since we updated `EMPTY_INVENTORY` in Task 1, this should be automatic).

- [ ] **Step 2: Add new imports to `src/store/careerStore.ts`**

Add these imports at the top of `careerStore.ts`:
```ts
import type { MatchReward } from '../types/reward'
import { generateMatchRewards } from '../services/rewardService'
import { equipItem as equipItemService, unequipItem as unequipItemService, unequipAllItems } from '../services/equipmentService'
import type { EquipmentSlot } from '../types/equipment'
```

- [ ] **Step 3: Add new state fields to `CareerState` interface**

In the `CareerState` interface, add (after `pendingMatch`):
```ts
pendingRewards: MatchReward[] | null
```

And add these action signatures (after `sellPlayer`):
```ts
claimMatchReward(reward: MatchReward): void
equipItemOnPlayer(playerId: number, itemId: string): void
unequipItemFromPlayer(playerId: number, slot: EquipmentSlot): void
```

Also update `startNewCareer` signature to accept `rewardChoices`:
```ts
startNewCareer(managerName: string, teamId: number, managerAvatar?: string, rewardChoices?: 1 | 2 | 3): void
```

- [ ] **Step 4: Initialise `pendingRewards: null` in the store's initial state**

In the `create<CareerState>()(...)` call, add `pendingRewards: null` alongside `pendingMatch: null`.

- [ ] **Step 5: Update `simulateMatch` to generate rewards on win**

Replace the entire `simulateMatch` action with:
```ts
simulateMatch(matchId) {
  const { career, players, teams } = get()
  if (!career) return

  const match = career.season.matches.find((m) => m.id === matchId)
  if (!match || match.played) return
  if (match.date > career.season.currentDate) return

  set({ isSimulating: true })

  const homeTeamData = teams.find((t) => t.id === match.homeTeamId)
  const awayTeamData = teams.find((t) => t.id === match.awayTeamId)
  if (!homeTeamData || !awayTeamData) { set({ isSimulating: false }); return }

  const homeSnapshot = buildTeamSnapshot(homeTeamData, players)
  const awaySnapshot = buildTeamSnapshot(awayTeamData, players)
  const result = simulate(homeSnapshot, awaySnapshot, match)

  const committed = commitMatchResult(matchId, result, career, teams, players)

  const isHome = match.homeTeamId === career.teamId
  const userGoals = isHome ? result.homeGoals : result.awayGoals
  const oppGoals = isHome ? result.awayGoals : result.homeGoals
  let pendingRewards: MatchReward[] | null = null
  if (userGoals > oppGoals) {
    const rivalId = isHome ? match.awayTeamId : match.homeTeamId
    const userTeamData = teams.find((t) => t.id === career.teamId)
    const rivalTeamData = teams.find((t) => t.id === rivalId)
    if (userTeamData && rivalTeamData) {
      const starterIds = new Set(userTeamData.lineup.filter((s) => s.isStarter).map((s) => s.playerId))
      const starters = players.filter((p) => starterIds.has(p.id))
      pendingRewards = generateMatchRewards(match, userTeamData, rivalTeamData, starters, career.rewardChoices)
    }
  }

  set({
    career: committed.career,
    players: committed.players,
    teams: committed.teams,
    isSimulating: false,
    lastMatchResult: result,
    selectedMatchId: matchId,
    pendingRewards,
  })
},
```

- [ ] **Step 6: Update `commitLiveMatch` to generate rewards on win**

At the end of `commitLiveMatch`, after `commitMatchResult`, add reward generation. Replace the final `set(...)` call with:
```ts
const match = career.season.matches.find((m) => m.id === pendingMatch.matchId)
  ?? (career.cup?.rounds[career.cup.currentRoundIndex]?.matches.find((m) => m.id === pendingMatch.matchId))
const isHome = match ? match.homeTeamId === career.teamId : false
const userGoals = isHome ? pendingMatch.result.homeGoals : pendingMatch.result.awayGoals
const oppGoals = isHome ? pendingMatch.result.awayGoals : pendingMatch.result.homeGoals
let pendingRewards: MatchReward[] | null = null
if (match && userGoals > oppGoals) {
  const rivalId = isHome ? match.awayTeamId : match.homeTeamId
  const userTeamData = teams.find((t) => t.id === career.teamId)
  const rivalTeamData = teams.find((t) => t.id === rivalId)
  if (userTeamData && rivalTeamData) {
    const starterIds = new Set(userTeamData.lineup.filter((s) => s.isStarter).map((s) => s.playerId))
    const starters = players.filter((p) => starterIds.has(p.id))
    pendingRewards = generateMatchRewards(match, userTeamData, rivalTeamData, starters, career.rewardChoices)
  }
}
set({
  career: committed.career,
  players: committed.players,
  teams: committed.teams,
  lastMatchResult: pendingMatch.result,
  pendingMatch: null,
  pendingRewards,
})
```

Update `simulateCupMatch` — replace its final `set(...)` call with:
```ts
const isHome = match.homeTeamId === career.teamId
const userGoals = isHome ? result.homeGoals : result.awayGoals
const oppGoals = isHome ? result.awayGoals : result.homeGoals
let pendingRewards: MatchReward[] | null = null
if (userGoals > oppGoals) {
  const rivalId = isHome ? match.awayTeamId : match.homeTeamId
  const userTeamData = teams.find((t) => t.id === career.teamId)
  const rivalTeamData = teams.find((t) => t.id === rivalId)
  if (userTeamData && rivalTeamData) {
    const starterIds = new Set(userTeamData.lineup.filter((s) => s.isStarter).map((s) => s.playerId))
    const starters = players.filter((p) => starterIds.has(p.id))
    pendingRewards = generateMatchRewards(match, userTeamData, rivalTeamData, starters, career.rewardChoices)
  }
}
set({
  career: committed.career,
  players: committed.players,
  teams: committed.teams,
  isSimulating: false,
  lastMatchResult: result,
  selectedMatchId: matchId,
  pendingRewards,
})
```

- [ ] **Step 7: Add `claimMatchReward` action**

Add after the `claimObjective` action:
```ts
claimMatchReward(reward) {
  const { career, players, teams } = get()
  if (!career) return

  switch (reward.type) {
    case 'money': {
      const updatedTeams = teams.map((t) =>
        t.id === career.teamId ? { ...t, budget: t.budget + (reward.moneyAmount ?? 0) } : t,
      )
      set({ teams: updatedTeams, pendingRewards: null })
      break
    }
    case 'stat_boost': {
      if (!reward.statBoost) { set({ pendingRewards: null }); break }
      const { playerId, stat, amount } = reward.statBoost
      const updatedPlayers = players.map((p) =>
        p.id === playerId ? { ...p, stats: { ...p.stats, [stat]: p.stats[stat] + amount } } : p,
      )
      set({ players: updatedPlayers, pendingRewards: null })
      break
    }
    case 'equipment': {
      if (!reward.equipmentItem) { set({ pendingRewards: null }); break }
      const updatedCareer = {
        ...career,
        inventory: {
          ...career.inventory,
          equipmentItems: [...career.inventory.equipmentItems, reward.equipmentItem],
        },
      }
      set({ career: updatedCareer, pendingRewards: null })
      break
    }
    case 'technique_book': {
      if (!reward.techniqueBook) { set({ pendingRewards: null }); break }
      const book = reward.techniqueBook
      const updatedCareer = {
        ...career,
        inventory: {
          ...career.inventory,
          techniqueBooks: {
            ...career.inventory.techniqueBooks,
            [book.id]: (career.inventory.techniqueBooks[book.id] ?? 0) + 1,
          },
          generatedBooks: {
            ...career.inventory.generatedBooks,
            [book.id]: book,
          },
        },
      }
      set({ career: updatedCareer, pendingRewards: null })
      break
    }
  }
},
```

- [ ] **Step 8: Add `equipItemOnPlayer` and `unequipItemFromPlayer` actions**

Add after `claimMatchReward`:
```ts
equipItemOnPlayer(playerId, itemId) {
  const { career, players } = get()
  if (!career) return
  const player = players.find((p) => p.id === playerId)
  const item = career.inventory.equipmentItems.find((i) => i.id === itemId)
  if (!player || !item) return
  const { player: updated, inventory } = equipItemService(player, item, career.inventory)
  set({
    players: players.map((p) => (p.id === playerId ? updated : p)),
    career: { ...career, inventory },
  })
},

unequipItemFromPlayer(playerId, slot) {
  const { career, players } = get()
  if (!career) return
  const player = players.find((p) => p.id === playerId)
  if (!player) return
  const { player: updated, inventory } = unequipItemService(player, slot, career.inventory)
  set({
    players: players.map((p) => (p.id === playerId ? updated : p)),
    career: { ...career, inventory },
  })
},
```

- [ ] **Step 9: Update `startNewCareer` to accept and use `rewardChoices`**

Change the implementation signature to:
```ts
startNewCareer(managerName, teamId, managerAvatar = '/avatars/avatar-1.svg', rewardChoices = 3 as 1 | 2 | 3) {
```

After calling `createCareer(...)` and before calling `set(...)`, add:
```ts
career.managerAvatar = managerAvatar
career.rewardChoices = rewardChoices
```

(If TypeScript disallows mutation here, use `const updatedCareer = { ...career, managerAvatar, rewardChoices }` and refer to `updatedCareer` in the `set` call.)

- [ ] **Step 10: Update `loadCareer` to migrate old saves**

In the `set(...)` call inside `loadCareer`, update the `career` mapping:
```ts
career: {
  ...data.career,
  playerPotential: data.career.playerPotential ?? {},
  weeklyTrainingPlan: data.career.weeklyTrainingPlan ?? null,
  inventory: {
    techniqueBooks: data.career.inventory?.techniqueBooks ?? {},
    generatedBooks: data.career.inventory?.generatedBooks ?? {},
    equipmentItems: data.career.inventory?.equipmentItems ?? [],
  },
  allLeagueSeasons: data.career.allLeagueSeasons ?? {},
  cup: data.career.cup ?? null,
  seasonStatus: data.career.seasonStatus ?? 'active',
  lastSeasonReview: data.career.lastSeasonReview ?? null,
  rewardChoices: data.career.rewardChoices ?? 3,
},
```

And add `pendingRewards: null` to the `set(...)` alongside the other null-resets.

- [ ] **Step 11: Update `sellPlayer` to unequip items before sale**

Replace the `sellPlayer` action with:
```ts
sellPlayer(playerId, toTeamId, amount) {
  const { career, teams, players } = get()
  if (!career) return

  const player = players.find((p) => p.id === playerId)
  let updatedCareer = career
  let updatedPlayers = players
  if (player?.equipment) {
    const { player: barePlayer, inventory } = unequipAllItems(player, career.inventory)
    updatedPlayers = players.map((p) => (p.id === playerId ? barePlayer : p))
    updatedCareer = { ...career, inventory }
  }

  const result = sellPlayerService(playerId, toTeamId, amount, updatedCareer, teams, updatedPlayers)
  set({ career: result.career, teams: result.teams, players: result.players })
},
```

- [ ] **Step 12: Update `teachTechnique` to also look up generated books**

Find the `teachTechnique` action in the store. Add a fallback for generated books:
```ts
teachTechnique(playerId, bookId, replaceIndex) {
  const { career, players } = get()
  if (!career) return
  // Check static catalog first, then runtime-generated books
  const book = getTechniqueBook(bookId) ?? career.inventory.generatedBooks?.[bookId]
  if (!book) return
  // ... rest of existing implementation unchanged ...
```

- [ ] **Step 13: Run all tests**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test 2>&1 | tail -30
```

Expected: all tests pass. Fix any TypeScript errors shown.

- [ ] **Step 14: Commit**

```bash
git add src/services/careerService.ts src/store/careerStore.ts
git commit -m "feat: wire reward generation and equipment actions into career store"
```

---

## Task 6: NewCareerScreen — rewardChoices selector

**Files:**
- Modify: `src/screens/NewCareerScreen.tsx`

- [ ] **Step 1: Add state and UI to `NewCareerScreen.tsx`**

Add state after existing state declarations:
```ts
const [rewardChoices, setRewardChoices] = useState<1 | 2 | 3>(3)
```

In the `handleCreate` function, update the call:
```ts
function handleCreate() {
  if (!managerName.trim() || selectedTeamId === null) return
  startNewCareer(managerName.trim(), selectedTeamId, managerAvatar, rewardChoices)
}
```

In Step 0 (Entrenador step), add this block after the manager name input and before the avatar picker (or at the bottom of the step section):
```tsx
{/* Reward choices */}
<div>
  <p className="text-white font-semibold mb-2">Recompensas por victoria</p>
  <p className="text-gray-400 text-xs mb-3">Cuántas opciones de recompensa se muestran al ganar un partido</p>
  <div className="flex gap-2">
    {([1, 2, 3] as const).map((n) => (
      <button
        key={n}
        onClick={() => setRewardChoices(n)}
        className={`flex-1 py-2 rounded-lg font-bold text-sm border transition-colors ${
          rewardChoices === n
            ? 'bg-blue-600 border-blue-500 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
        }`}
      >
        {n} {n === 3 ? '(defecto)' : ''}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Run TypeScript to check no errors**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `NewCareerScreen`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/NewCareerScreen.tsx
git commit -m "feat: add rewardChoices selector to NewCareerScreen"
```

---

## Task 7: MatchRewardModal component

**Files:**
- Create: `src/components/MatchRewardModal.tsx`

- [ ] **Step 1: Create `src/components/MatchRewardModal.tsx`**

```tsx
import type { MatchReward } from '../types/reward'
import { EQUIPMENT_SLOT_LABELS } from '../types/equipment'
import Icon from './Icon'

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

function RewardCard({
  reward,
  onPick,
}: {
  reward: MatchReward
  onPick: () => void
}) {
  let icon = 'star'
  let title = ''
  let detail = ''
  let colorClass = 'border-gray-600'

  if (reward.type === 'money') {
    icon = 'payments'
    title = 'Dinero'
    detail = fmt(reward.moneyAmount ?? 0)
    colorClass = 'border-yellow-600'
  } else if (reward.type === 'stat_boost' && reward.statBoost) {
    icon = 'bolt'
    title = 'Mejora de Stat'
    const { playerName, stat, amount } = reward.statBoost
    detail = `+${amount} ${stat} → ${playerName}`
    colorClass = 'border-blue-600'
  } else if (reward.type === 'technique_book' && reward.techniqueBook) {
    icon = 'menu_book'
    title = 'Técnica'
    const t = reward.techniqueBook.technique
    detail = `${t.name} (POT ${t.POT})`
    colorClass = 'border-purple-600'
  } else if (reward.type === 'equipment' && reward.equipmentItem) {
    icon = 'shield'
    title = EQUIPMENT_SLOT_LABELS[reward.equipmentItem.slot]
    const bonuses = Object.entries(reward.equipmentItem.statBonuses)
      .map(([s, v]) => `+${v} ${s}`)
      .join(', ')
    detail = `${reward.equipmentItem.name} — ${bonuses}`
    colorClass = 'border-green-600'
  }

  return (
    <button
      onClick={onPick}
      className={`flex-1 min-w-0 bg-gray-800 border-2 ${colorClass} rounded-xl p-4 flex flex-col items-center gap-3 text-center hover:bg-gray-700 transition-colors active:scale-95`}
    >
      <Icon name={icon} size="lg" className="text-white" />
      <p className="text-white font-bold text-sm">{title}</p>
      <p className="text-gray-300 text-xs leading-snug">{detail}</p>
    </button>
  )
}

export default function MatchRewardModal({
  rewards,
  onClaim,
}: {
  rewards: MatchReward[]
  onClaim: (reward: MatchReward) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg shadow-2xl p-6">
        <p className="text-white text-xl font-extrabold text-center mb-1">¡Victoria!</p>
        <p className="text-gray-400 text-sm text-center mb-6">Elige tu recompensa</p>
        <div className="flex gap-3">
          {rewards.map((r, i) => (
            <RewardCard key={i} reward={r} onPick={() => onClaim(r)} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript to check no errors**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchRewardModal.tsx
git commit -m "feat: add MatchRewardModal component"
```

---

## Task 8: MatchScreen integration

**Files:**
- Modify: `src/screens/MatchScreen.tsx`

- [ ] **Step 1: Update `src/screens/MatchScreen.tsx`**

Add the new import at the top:
```ts
import MatchRewardModal from '../components/MatchRewardModal'
import type { MatchReward } from '../types/reward'
```

Add `pendingRewards` and `claimMatchReward` to the store selectors (alongside existing ones):
```ts
const pendingRewards = useCareerStore((s) => s.pendingRewards)
const claimMatchReward = useCareerStore((s) => s.claimMatchReward)
```

Determine `isWin` from the already-computed `userGoals`/`oppGoals`:
```ts
const isWin = userGoals > oppGoals
```

Before the final `return`, add this helper handler:
```ts
function handleClaimReward(reward: MatchReward) {
  claimMatchReward(reward)
}
```

At the end of the JSX, just before the closing `</div>` of the entire component, add:
```tsx
{isWin && pendingRewards && pendingRewards.length > 0 && (
  <MatchRewardModal rewards={pendingRewards} onClaim={handleClaimReward} />
)}
```

Also update the "Continuar" button to be disabled while rewards are pending:
```tsx
<button
  onClick={() => navigate('career_home')}
  disabled={!!(isWin && pendingRewards && pendingRewards.length > 0)}
  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors"
>
  Continuar
</button>
```

- [ ] **Step 2: Run TypeScript to check no errors**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/MatchScreen.tsx
git commit -m "feat: show MatchRewardModal after winning a match"
```

---

## Task 9: EquipmentPanel + PlayerDetailScreen

**Files:**
- Create: `src/components/EquipmentPanel.tsx`
- Modify: `src/screens/PlayerDetailScreen.tsx`

- [ ] **Step 1: Create `src/components/EquipmentPanel.tsx`**

```tsx
import { useState } from 'react'
import type { Player } from '../types/player'
import type { EquipmentSlot, EquipmentItem } from '../types/equipment'
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SLOT_ICONS } from '../types/equipment'
import type { ClubInventory } from '../types/inventory'
import Icon from './Icon'

const SLOTS: EquipmentSlot[] = ['gloves', 'boots', 'pendant', 'bracelet']

function statBonusSummary(item: EquipmentItem): string {
  return Object.entries(item.statBonuses)
    .map(([s, v]) => `+${v} ${s}`)
    .join(' · ')
}

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: 'border-gray-500',
  2: 'border-blue-500',
  3: 'border-yellow-500',
}

export default function EquipmentPanel({
  player,
  inventory,
  onEquip,
  onUnequip,
}: {
  player: Player
  inventory: ClubInventory
  onEquip: (itemId: string) => void
  onUnequip: (slot: EquipmentSlot) => void
}) {
  const [activeSlot, setActiveSlot] = useState<EquipmentSlot | null>(null)
  const equipment = player.equipment ?? { gloves: null, boots: null, pendant: null, bracelet: null }

  const slotItems = activeSlot
    ? inventory.equipmentItems.filter((i) => i.slot === activeSlot)
    : []

  function handleEquip(itemId: string) {
    onEquip(itemId)
    setActiveSlot(null)
  }

  function handleUnequip(slot: EquipmentSlot) {
    onUnequip(slot)
    setActiveSlot(null)
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <h3 className="text-white text-sm font-semibold mb-3">Equipación</h3>

      {/* 4 slots */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {SLOTS.map((slot) => {
          const item = equipment[slot]
          const isActive = activeSlot === slot
          return (
            <button
              key={slot}
              onClick={() => setActiveSlot(isActive ? null : slot)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-blue-900/40 border-blue-500'
                  : item
                  ? `bg-gray-700 ${TIER_COLORS[item.tier]} border`
                  : 'bg-gray-700/50 border-gray-600 border-dashed'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon name={EQUIPMENT_SLOT_ICONS[slot]} size="xs" className="text-gray-400 shrink-0" />
                <span className="text-gray-400 text-xs uppercase tracking-wide">{EQUIPMENT_SLOT_LABELS[slot]}</span>
              </div>
              {item ? (
                <>
                  <p className="text-white text-xs font-medium truncate">{item.name}</p>
                  <p className="text-green-400 text-xs mt-0.5">{statBonusSummary(item)}</p>
                </>
              ) : (
                <p className="text-gray-500 text-xs">Vacío</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Sub-panel for slot selection */}
      {activeSlot && (
        <div className="border-t border-gray-700 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs">
              {EQUIPMENT_SLOT_LABELS[activeSlot]} disponibles ({slotItems.length})
            </p>
            {equipment[activeSlot] && (
              <button
                onClick={() => handleUnequip(activeSlot)}
                className="text-red-400 text-xs hover:text-red-300 transition-colors"
              >
                Desequipar
              </button>
            )}
          </div>

          {slotItems.length === 0 ? (
            <p className="text-gray-500 text-xs">No hay ítems disponibles en el inventario</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {slotItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleEquip(item.id)}
                  className="text-left p-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors"
                >
                  <p className="text-white text-xs font-medium">{item.name}</p>
                  <p className="text-green-400 text-xs">{statBonusSummary(item)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `EquipmentPanel` to `PlayerDetailScreen.tsx`**

Add imports at the top (after the existing imports):
```ts
import EquipmentPanel from '../components/EquipmentPanel'
import { getEffectiveStats } from '../services/equipmentService'
```

Add store selectors (after `analyzePlayerPotential`):
```ts
const equipItemOnPlayer = useCareerStore((s) => s.equipItemOnPlayer)
const unequipItemFromPlayer = useCareerStore((s) => s.unequipItemFromPlayer)
```

Inside the IIFE at line ~576, replace:
```ts
const { total, media } = getPlayerStatsSummary(player)
```
with:
```ts
const effectiveStats = getEffectiveStats(player)
const total = statTotal(effectiveStats)
const media = Math.round(total / 7)
```

(`statTotal` is already imported from `../types/player`; remove the `getPlayerStatsSummary` import if it's no longer used elsewhere in this file.)

At line ~726, replace:
```tsx
<StatBar key={stat} label={stat} value={player.stats[stat]} max={250} />
```
with:
```tsx
<StatBar key={stat} label={stat} value={effectiveStats[stat]} max={250} />
```

After the techniques section (around line ~730, after the closing `</div>` of the techniques block), add:
```tsx
{/* Equipment */}
<EquipmentPanel
  player={player}
  inventory={career.inventory}
  onEquip={(itemId) => equipItemOnPlayer(player.id, itemId)}
  onUnequip={(slot) => unequipItemFromPlayer(player.id, slot)}
/>
```

- [ ] **Step 3: Run TypeScript to check no errors**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Run all tests**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/EquipmentPanel.tsx src/screens/PlayerDetailScreen.tsx
git commit -m "feat: add EquipmentPanel to PlayerDetailScreen with equip/unequip"
```

---

## Task 10: Extended StandingsScreen

**Files:**
- Modify: `src/screens/StandingsScreen.tsx`

- [ ] **Step 1: Replace `StandingsScreen.tsx` with the extended version**

```tsx
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import TopNavigation from '../components/TopNavigation'
import SideNavigation from '../components/SideNavigation'
import { sortStandings } from '../services/standingsService'
import { leagues as leaguesCatalog } from '../data/leagues'
import type { StandingRow } from '../types/competition'

type Tab = 'league' | 'cup' | 'other'

function LeagueTable({
  rows,
  userTeamId,
}: {
  rows: StandingRow[]
  userTeamId?: number
}) {
  const sorted = sortStandings(rows)
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className="grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 bg-gray-900 px-3 py-2 text-gray-400 text-xs font-semibold uppercase tracking-wide">
        <span className="w-8 text-center">#</span>
        <span className="px-2">Equipo</span>
        <span className="w-8 text-center">P</span>
        <span className="w-8 text-center">V</span>
        <span className="w-8 text-center">E</span>
        <span className="w-8 text-center">D</span>
        <span className="w-10 text-center">GF</span>
        <span className="w-10 text-center">GC</span>
        <span className="w-10 text-center">DG</span>
        <span className="w-10 text-center font-bold text-white">Pts</span>
      </div>
      {sorted.map((row, idx) => {
        const isUser = row.teamId === userTeamId
        return (
          <div
            key={row.teamId}
            className={`grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 px-3 py-2.5 border-t border-gray-700 text-sm items-center ${
              isUser ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : 'hover:bg-gray-700/50'
            }`}
          >
            <span className={`w-8 text-center font-bold ${isUser ? 'text-blue-300' : 'text-gray-400'}`}>{idx + 1}</span>
            <span className={`px-2 font-medium truncate ${isUser ? 'text-blue-200' : 'text-white'}`}>{row.teamName}</span>
            <span className="w-8 text-center text-gray-300">{row.played}</span>
            <span className="w-8 text-center text-green-400">{row.won}</span>
            <span className="w-8 text-center text-yellow-400">{row.drawn}</span>
            <span className="w-8 text-center text-red-400">{row.lost}</span>
            <span className="w-10 text-center text-gray-300">{row.goalsFor}</span>
            <span className="w-10 text-center text-gray-300">{row.goalsAgainst}</span>
            <span className={`w-10 text-center ${row.goalDiff > 0 ? 'text-green-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
            </span>
            <span className={`w-10 text-center font-bold text-lg ${isUser ? 'text-blue-300' : 'text-white'}`}>{row.points}</span>
          </div>
        )
      })}
      {sorted.length === 0 && (
        <div className="py-8 text-center text-gray-500 text-sm border-t border-gray-700">Sin datos</div>
      )}
    </div>
  )
}

export default function StandingsScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const screen = useCareerStore((s) => s.screen)
  const navigate = useCareerStore((s) => s.navigate)

  const [tab, setTab] = useState<Tab>('league')

  if (!career) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400">No hay carrera activa.</p>
      </div>
    )
  }

  const hasCup = !!career.cup
  const hasOther = Object.keys(career.allLeagueSeasons).length > 0

  const tabs: { id: Tab; label: string }[] = [
    { id: 'league', label: 'Mi Liga' },
    ...(hasCup ? [{ id: 'cup' as Tab, label: 'Copa' }] : []),
    ...(hasOther ? [{ id: 'other' as Tab, label: 'Otras Ligas' }] : []),
  ]

  const otherLeaguesSorted = Object.entries(career.allLeagueSeasons)
    .map(([leagueId, ls]) => ({
      leagueId,
      ls,
      level: leaguesCatalog.find((l) => l.id === leagueId)?.level ?? 99,
      name: leaguesCatalog.find((l) => l.id === leagueId)?.name ?? leagueId,
    }))
    .sort((a, b) => a.level - b.level)

  return (
    <div className="h-full flex flex-col">
      <TopNavigation title="Clasificación" />
      <div className="flex flex-1 overflow-hidden">
        <SideNavigation currentScreen={screen} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto p-4">
          <h1 className="text-white text-2xl font-bold mb-4">Clasificación — Temporada {career.season.year}</h1>

          {/* Tab bar */}
          {tabs.length > 1 && (
            <div className="flex gap-1 mb-4 bg-gray-800 rounded-xl p-1 border border-gray-700">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Mi Liga */}
          {tab === 'league' && (
            <LeagueTable rows={career.season.standings} userTeamId={career.teamId} />
          )}

          {/* Copa */}
          {tab === 'cup' && career.cup && (
            <div className="flex flex-col gap-4">
              {career.cup.winnerId && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 text-center">
                  <p className="text-yellow-400 font-bold">
                    Campeón: {teams.find((t) => t.id === career.cup!.winnerId)?.name ?? '—'}
                  </p>
                </div>
              )}
              {[...career.cup.rounds].reverse().map((round, revIdx) => {
                const roundIdx = career.cup!.rounds.length - 1 - revIdx
                const isCurrent = roundIdx === career.cup!.currentRoundIndex
                return (
                  <div key={round.name} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900">
                      <span className="text-white font-semibold text-sm">{round.name}</span>
                      {round.finished && <span className="text-xs text-gray-500 bg-gray-700 rounded px-2 py-0.5">Finalizada</span>}
                      {isCurrent && !round.finished && <span className="text-xs text-blue-400 bg-blue-900/40 rounded px-2 py-0.5">En curso</span>}
                    </div>
                    <div className="divide-y divide-gray-700">
                      {round.matches
                        .filter((m) => m.homeTeamId !== -1 && m.awayTeamId !== -1)
                        .map((m) => {
                          const home = teams.find((t) => t.id === m.homeTeamId)?.name ?? 'Local'
                          const away = teams.find((t) => t.id === m.awayTeamId)?.name ?? 'Visitante'
                          const isUserMatch = m.homeTeamId === career.teamId || m.awayTeamId === career.teamId
                          return (
                            <div key={m.id} className={`px-4 py-2.5 flex items-center gap-2 text-sm ${isUserMatch ? 'bg-blue-900/20' : ''}`}>
                              <span className={`flex-1 text-right truncate ${isUserMatch ? 'text-blue-200 font-semibold' : 'text-white'}`}>{home}</span>
                              <span className="text-gray-400 text-xs shrink-0">
                                {m.played ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'}
                              </span>
                              <span className={`flex-1 truncate ${isUserMatch ? 'text-blue-200 font-semibold' : 'text-white'}`}>{away}</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Otras Ligas */}
          {tab === 'other' && (
            <div className="flex flex-col gap-6">
              {otherLeaguesSorted.map(({ leagueId, ls, name }) => (
                <div key={leagueId}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-white font-semibold">{name}</h2>
                    {ls.finished && (
                      <span className="text-xs text-gray-400 bg-gray-700 rounded px-2 py-0.5">Finalizada</span>
                    )}
                  </div>
                  <LeagueTable rows={ls.standings} />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript to check no errors**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Run all tests**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/StandingsScreen.tsx
git commit -m "feat: extend StandingsScreen with Copa and Otras Ligas tabs"
```

---

## Self-Review Checklist

After completing all tasks:

- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm test` — all tests pass
- [ ] Start dev server (`npm run dev`) and manually verify:
  - Simulate a match win → reward modal appears with N cards (matching `rewardChoices`)
  - Claim each type of reward (money, stat, equipment, technique book) and verify it's applied
  - Equipment item in inventory → go to PlayerDetailScreen → equip it → stat bar shows bonus
  - Unequip item → returns to club inventory
  - Sell a player who has equipment → items return to club inventory
  - StandingsScreen shows all three tabs (if cup and other leagues exist)
  - New career creation shows the rewardChoices selector
  - Load an old save → no crash (migration defaults applied)
