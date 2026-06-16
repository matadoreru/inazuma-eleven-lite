# Difficulty System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a difficulty selection step to career creation, with three standard presets (Easy/Normal/Hard) and a Custom mode that exposes all 11 gameplay parameters for manual tuning.

**Architecture:** A `DifficultySettings` interface lives in `src/types/career.ts` alongside its presets and default. Services that contain hardcoded constants receive `DifficultySettings` as an extra parameter; the store reads `career.difficulty` and threads it through. The UI adds a fourth step (index 2) to `NewCareerScreen` before the existing Confirm step.

**Tech Stack:** TypeScript, React, Zustand, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/types/career.ts` | Modify | Add `DifficultySettings`, `DIFFICULTY_PRESETS`, `DEFAULT_DIFFICULTY`; update `Career` |
| `src/services/energyService.ts` | Modify | Accept `settings` in `drainStaminaAfterMatch` |
| `src/services/weeklyTrainingService.ts` | Modify | Accept `settings` in `executeWeeklyPlan` |
| `src/services/trainingService.ts` | Modify | Accept `settings` in `trainPlayer` |
| `src/services/growthService.ts` | Modify | Accept `settings` in `applySeasonGrowth` |
| `src/services/positionChangeService.ts` | Modify | Accept `settings` in `calcPositionChangeDays` + `startOrResetPositionChange` |
| `src/services/potentialService.ts` | Modify | Accept `settings` in `calcAnalysisCost` |
| `src/services/seasonService.ts` | Modify | Thread `settings` from `endSeason` to `applySeasonGrowth` |
| `src/services/careerService.ts` | Modify | Accept `settings` in `createCareer`, apply `budgetMultiplier` |
| `src/services/saveService.ts` | Modify | Inject `DEFAULT_DIFFICULTY` when loading old saves |
| `src/store/careerStore.ts` | Modify | `startNewCareer` + all service call sites + NPC scaling |
| `src/screens/TransfersScreen.tsx` | Modify | Apply `transferCostMultiplier` at buy call site |
| `src/screens/ScoutScreen.tsx` | Modify | Apply `transferCostMultiplier` at buy call site |
| `src/screens/NewCareerScreen.tsx` | Modify | Add Step 2 (difficulty) with presets + custom panel |
| `src/tests/energyService.test.ts` | Create | Tests for `drainStaminaAfterMatch` with settings |
| `src/tests/weeklyTrainingService.test.ts` | Create | Tests for `executeWeeklyPlan` with settings |
| `src/tests/trainingService.test.ts` | Create | Tests for `trainPlayer` with settings |
| `src/tests/positionChangeService.test.ts` | Create | Tests for `calcPositionChangeDays` with settings |
| `src/tests/potentialService.test.ts` | Create | Tests for `calcAnalysisCost` with settings |
| `src/tests/growthService.test.ts` | Modify | Add tests for `applySeasonGrowth` with `seasonGrowthMultiplier` |

---

## Task 1: Add `DifficultySettings` type and update `Career`

**Files:**
- Modify: `src/types/career.ts`

- [ ] **Step 1.1: Add `DifficultySettings` interface and presets to `career.ts`**

In `src/types/career.ts`, insert this block just before the `// ─── Career ──` comment (around line 148):

```typescript
// ─── Difficulty ─────────────────────────────────────────────────────────────

export interface DifficultySettings {
  aiStrengthMultiplier: number         // 0.7–1.3   | scales NPC team strength in user matches
  staminaRecoveryPerDay: number        // 3–15 pts  | stamina recovered per calendar day
  starterStaminaDrain: number          // 15–35 pts | stamina lost per match (starter)
  benchStaminaDrain: number            // 4–15 pts  | stamina lost per match (bench)
  trainingGainMultiplier: number       // 0.5–2.0x  | scales weekly plan + manual training
  seasonGrowthMultiplier: number       // 0.5–2.0x  | scales end-of-season stat growth
  positionChangeDaysMultiplier: number // 0.5–2.0x  | scales position-change duration
  transferCostMultiplier: number       // 0.5–2.0x  | scales buy price paid by user
  budgetMultiplier: number             // 0.5–2.0x  | scales team's starting budget
  scoutCostMultiplier: number          // 0.5–2.0x  | scales potential analysis costs
  rewardChoices: 1 | 2 | 3            // reward options offered after each match
}

export const DIFFICULTY_PRESETS: Record<'easy' | 'normal' | 'hard', DifficultySettings> = {
  easy: {
    aiStrengthMultiplier: 0.85,
    staminaRecoveryPerDay: 10,
    starterStaminaDrain: 20,
    benchStaminaDrain: 6,
    trainingGainMultiplier: 1.4,
    seasonGrowthMultiplier: 1.25,
    positionChangeDaysMultiplier: 0.75,
    transferCostMultiplier: 0.8,
    budgetMultiplier: 1.25,
    scoutCostMultiplier: 0.75,
    rewardChoices: 3,
  },
  normal: {
    aiStrengthMultiplier: 1.0,
    staminaRecoveryPerDay: 7,
    starterStaminaDrain: 25,
    benchStaminaDrain: 8,
    trainingGainMultiplier: 1.0,
    seasonGrowthMultiplier: 1.0,
    positionChangeDaysMultiplier: 1.0,
    transferCostMultiplier: 1.0,
    budgetMultiplier: 1.0,
    scoutCostMultiplier: 1.0,
    rewardChoices: 2,
  },
  hard: {
    aiStrengthMultiplier: 1.2,
    staminaRecoveryPerDay: 5,
    starterStaminaDrain: 30,
    benchStaminaDrain: 10,
    trainingGainMultiplier: 0.75,
    seasonGrowthMultiplier: 0.8,
    positionChangeDaysMultiplier: 1.5,
    transferCostMultiplier: 1.25,
    budgetMultiplier: 0.8,
    scoutCostMultiplier: 1.5,
    rewardChoices: 1,
  },
}

export const DEFAULT_DIFFICULTY: DifficultySettings = DIFFICULTY_PRESETS.normal
```

- [ ] **Step 1.2: Update the `Career` interface**

In `src/types/career.ts`, in the `Career` interface:
- Remove the line: `rewardChoices: 1 | 2 | 3`
- Add the line: `difficulty: DifficultySettings`

The Career interface should now have:
```typescript
export interface Career {
  id: string
  managerName: string
  managerAvatar: string
  teamId: number
  season: Season
  seasonNumber: number
  totalBudgetSpent: number
  totalBudgetEarned: number
  objectives: Objective[]
  inbox: InboxEvent[]
  transferHistory: TransferOffer[]
  watchlist: number[]
  seasonHistory: CareerSeasonStats[]
  playerPotential: Record<number, PotentialAnalysis>
  weeklyTrainingPlan: WeeklyTrainingPlan | null
  inventory: ClubInventory
  allLeagueSeasons: Record<string, LeagueSeason>
  cup: Cup | null
  seasonStatus: SeasonStatus
  lastSeasonReview: SeasonReview | null
  difficulty: DifficultySettings   // ← new
  createdAt: string
  lastSavedAt: string
}
```

- [ ] **Step 1.3: Run TypeScript check to see all call sites that break**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | head -60
```

Expected: TypeScript errors for every place that references `career.rewardChoices` and every service that needs the new `settings` param. This is the full list of things to fix — use it as a checklist.

- [ ] **Step 1.4: Commit types**

```bash
git add src/types/career.ts
git commit -m "feat(types): add DifficultySettings, presets, and wire into Career"
```

---

## Task 2: Update `energyService.ts`

**Files:**
- Create: `src/tests/energyService.test.ts`
- Modify: `src/services/energyService.ts`

- [ ] **Step 2.1: Write failing tests**

Create `src/tests/energyService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { drainStaminaAfterMatch } from '../services/energyService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'

function makePlayer(id: number): Player {
  return {
    id,
    name: `P${id}`,
    nameRomaji: `P${id}`,
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 5,
      potential: 60,
      growthRate: 1.0,
      contractStatus: 'contracted',
      marketValue: 10000,
      salary: 500,
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100,
    morale: 100,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 22,
    teamId: 1,
    jerseyNumber: 1,
  } as Player
}

const normalSettings: DifficultySettings = DEFAULT_DIFFICULTY
const easySettings: DifficultySettings = {
  ...DEFAULT_DIFFICULTY,
  starterStaminaDrain: 20,
  benchStaminaDrain: 6,
}
const hardSettings: DifficultySettings = {
  ...DEFAULT_DIFFICULTY,
  starterStaminaDrain: 30,
  benchStaminaDrain: 10,
}

describe('drainStaminaAfterMatch', () => {
  it('drains starterStaminaDrain from starters (normal)', () => {
    const players = [makePlayer(1)]
    const starters = new Set([1])
    const bench = new Set<number>()
    const result = drainStaminaAfterMatch(players, starters, bench, normalSettings)
    expect(result[0].stamina).toBe(100 - 25)
  })

  it('drains benchStaminaDrain from bench (normal)', () => {
    const players = [makePlayer(1)]
    const starters = new Set<number>()
    const bench = new Set([1])
    const result = drainStaminaAfterMatch(players, starters, bench, normalSettings)
    expect(result[0].stamina).toBe(100 - 8)
  })

  it('uses easy settings (starterStaminaDrain=20)', () => {
    const players = [makePlayer(1)]
    const starters = new Set([1])
    const result = drainStaminaAfterMatch(players, starters, new Set(), easySettings)
    expect(result[0].stamina).toBe(100 - 20)
  })

  it('uses hard settings (starterStaminaDrain=30)', () => {
    const players = [makePlayer(1)]
    const starters = new Set([1])
    const result = drainStaminaAfterMatch(players, starters, new Set(), hardSettings)
    expect(result[0].stamina).toBe(100 - 30)
  })

  it('does not drain players not in starter or bench', () => {
    const players = [makePlayer(1)]
    const result = drainStaminaAfterMatch(players, new Set(), new Set(), normalSettings)
    expect(result[0].stamina).toBe(100)
  })

  it('clamps stamina to 0 (cannot go negative)', () => {
    const p = { ...makePlayer(1), stamina: 5 }
    const result = drainStaminaAfterMatch([p], new Set([1]), new Set(), normalSettings)
    expect(result[0].stamina).toBe(0)
  })
})
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/energyService.test.ts 2>&1 | tail -20
```

Expected: FAIL — `drainStaminaAfterMatch` does not accept a fourth argument yet.

- [ ] **Step 2.3: Update `energyService.ts`**

Replace the `drainStaminaAfterMatch` function:

```typescript
import type { DifficultySettings } from '../types/career'

export function drainStaminaAfterMatch(
  players: Player[],
  starterIds: Set<number>,
  benchIds: Set<number>,
  settings: DifficultySettings,
): Player[] {
  return players.map((p) => {
    if (starterIds.has(p.id)) {
      return { ...p, stamina: Math.max(0, p.stamina - settings.starterStaminaDrain) }
    }
    if (benchIds.has(p.id)) {
      return { ...p, stamina: Math.max(0, p.stamina - settings.benchStaminaDrain) }
    }
    return p
  })
}
```

Also remove the now-unused constants `STARTER_STAMINA_DRAIN` and `BENCH_STAMINA_DRAIN` (or keep them as documentation — your choice, but they're no longer used in the function).

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/energyService.test.ts 2>&1 | tail -10
```

Expected: All 6 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/services/energyService.ts src/tests/energyService.test.ts
git commit -m "feat(energy): drainStaminaAfterMatch reads drain values from DifficultySettings"
```

---

## Task 3: Update `weeklyTrainingService.ts`

**Files:**
- Create: `src/tests/weeklyTrainingService.test.ts`
- Modify: `src/services/weeklyTrainingService.ts`

- [ ] **Step 3.1: Write failing tests**

Create `src/tests/weeklyTrainingService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { executeWeeklyPlan } from '../services/weeklyTrainingService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player, Stats } from '../types/player'
import type { WeeklyTrainingPlan } from '../types/training'
import type { Career } from '../types/career'

function makePlayer(id = 1): Player {
  return {
    id,
    name: 'P',
    nameRomaji: 'P',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 10,
      potential: 80,
      growthRate: 1.0,
      contractStatus: 'contracted',
      marketValue: 10000,
      salary: 500,
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100,
    morale: 100,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 22,
    teamId: 1,
    jerseyNumber: 1,
  } as Player
}

function makeCareer(settings: DifficultySettings = DEFAULT_DIFFICULTY): Career {
  return {
    id: 'c1',
    managerName: 'Test',
    managerAvatar: '',
    teamId: 1,
    season: {} as Career['season'],
    seasonNumber: 1,
    totalBudgetSpent: 0,
    totalBudgetEarned: 0,
    objectives: [],
    inbox: [],
    transferHistory: [],
    watchlist: [],
    seasonHistory: [],
    playerPotential: {},
    weeklyTrainingPlan: null,
    inventory: { equipment: [], techniqueBooks: [] },
    allLeagueSeasons: {},
    cup: null,
    seasonStatus: 'active',
    lastSeasonReview: null,
    difficulty: settings,
    createdAt: '2026-01-01',
    lastSavedAt: '2026-01-01',
  }
}

function makePlan(playerId: number, stat: keyof Stats): WeeklyTrainingPlan {
  return {
    slots: [{ playerId, trainingType: 'stat', statTarget: stat as string }],
    weekStartDate: '2026-01-01',
    executed: false,
  }
}

describe('executeWeeklyPlan stat training gain', () => {
  it('gives base gain of 2 on Normal difficulty', () => {
    const player = makePlayer(1)
    const plan = makePlan(1, 'TEC')
    const career = makeCareer(DEFAULT_DIFFICULTY)
    const { players } = executeWeeklyPlan(plan, [player], career, DEFAULT_DIFFICULTY)
    expect(players[0].stats.TEC).toBe(50 + 2)
  })

  it('gives more stat gain on Easy (1.4x → round(2*1.4)=3)', () => {
    const player = makePlayer(1)
    const plan = makePlan(1, 'TEC')
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 1.4 }
    const career = makeCareer(settings)
    const { players } = executeWeeklyPlan(plan, [player], career, settings)
    expect(players[0].stats.TEC).toBe(50 + 3)
  })

  it('gives less stat gain on Hard (0.75x → max(1, round(2*0.75))=2 → actually 1 since round(1.5)=2)', () => {
    const player = makePlayer(1)
    const plan = makePlan(1, 'TEC')
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 0.5 }
    const career = makeCareer(settings)
    const { players } = executeWeeklyPlan(plan, [player], career, settings)
    // 0.5x: max(1, round(2*0.5)) = max(1, 1) = 1
    expect(players[0].stats.TEC).toBe(50 + 1)
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/weeklyTrainingService.test.ts 2>&1 | tail -15
```

Expected: FAIL — `executeWeeklyPlan` does not accept a fourth argument.

- [ ] **Step 3.3: Update `weeklyTrainingService.ts`**

Add the import at the top:
```typescript
import type { DifficultySettings } from '../types/career'
```

Change `executeWeeklyPlan` signature and the stat gain calculation:
```typescript
export function executeWeeklyPlan(
  plan: WeeklyTrainingPlan,
  players: Player[],
  career: Career,
  settings: DifficultySettings,
): { players: Player[]; career: Career } {
```

In the `'stat'` case, replace the `gain` line:
```typescript
// Before:
const gain = Math.max(1, Math.round(STAT_GAIN_PER_WEEK * affinity))
// After:
const gain = Math.max(1, Math.round(STAT_GAIN_PER_WEEK * settings.trainingGainMultiplier * affinity))
```

- [ ] **Step 3.4: Run tests to confirm they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/weeklyTrainingService.test.ts 2>&1 | tail -10
```

Expected: All tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/services/weeklyTrainingService.ts src/tests/weeklyTrainingService.test.ts
git commit -m "feat(training): weekly stat gain scales with trainingGainMultiplier"
```

---

## Task 4: Update `trainingService.ts`

**Files:**
- Create: `src/tests/trainingService.test.ts`
- Modify: `src/services/trainingService.ts`

- [ ] **Step 4.1: Write failing tests**

Create `src/tests/trainingService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { trainPlayer } from '../services/trainingService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'

function makePlayer(id = 1): Player {
  return {
    id,
    name: 'P',
    nameRomaji: 'P',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 10,
      potential: 80,
      growthRate: 1.0,
      contractStatus: 'contracted',
      marketValue: 10000,
      salary: 500,
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100,
    morale: 100,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 22,
    teamId: 1,
    jerseyNumber: 1,
  } as Player
}

describe('trainPlayer with DifficultySettings', () => {
  it('gives +1 stat on Normal difficulty', () => {
    const players = [makePlayer(1)]
    const result = trainPlayer(1, 'TEC', players, DEFAULT_DIFFICULTY)
    expect(result[0].stats.TEC).toBe(51)
  })

  it('gives +2 stat at 2.0x multiplier', () => {
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 2.0 }
    const result = trainPlayer(1, 'TEC', [makePlayer(1)], settings)
    expect(result[0].stats.TEC).toBe(52)
  })

  it('gives at least +1 stat even at 0.1x multiplier (floor)', () => {
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, trainingGainMultiplier: 0.1 }
    const result = trainPlayer(1, 'TEC', [makePlayer(1)], settings)
    expect(result[0].stats.TEC).toBe(51)
  })

  it('does not train an injured player', () => {
    const p = { ...makePlayer(1), isInjured: true }
    const result = trainPlayer(1, 'TEC', [p], DEFAULT_DIFFICULTY)
    expect(result[0].stats.TEC).toBe(50)
  })
})
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/trainingService.test.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 4.3: Update `trainingService.ts`**

Add import:
```typescript
import type { DifficultySettings } from '../types/career'
```

Change `trainPlayer` signature:
```typescript
export function trainPlayer(
  playerId: number,
  stat: keyof Stats,
  players: Player[],
  settings: DifficultySettings,
): Player[]
```

Inside the function body, replace the stat gain line:
```typescript
// Before:
const newStatValue = Math.min(currentStatValue + 1, cap)
// After:
const gain = Math.max(1, Math.round(settings.trainingGainMultiplier))
const newStatValue = Math.min(currentStatValue + gain, cap)
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/trainingService.test.ts 2>&1 | tail -10
```

Expected: All PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/services/trainingService.ts src/tests/trainingService.test.ts
git commit -m "feat(training): manual training gain scales with trainingGainMultiplier"
```

---

## Task 5: Update `growthService.ts`

**Files:**
- Modify: `src/services/growthService.ts`
- Modify: `src/tests/growthService.test.ts`

- [ ] **Step 5.1: Add failing tests to `src/tests/growthService.test.ts`**

At the end of the existing test file, add:

```typescript
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'

describe('applySeasonGrowth with seasonGrowthMultiplier', () => {
  it('applies 2.0x multiplier resulting in more growth than 1.0x', () => {
    const player = makePlayer({ career: { ...makePlayer().career, growthRate: 2.0 } })
    const easySettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, seasonGrowthMultiplier: 2.0 }
    const normalSettings: DifficultySettings = DEFAULT_DIFFICULTY

    let totalEasy = 0
    let totalNormal = 0
    for (let i = 0; i < 30; i++) {
      const [grownEasy] = applySeasonGrowth([player], undefined, easySettings)
      const [grownNormal] = applySeasonGrowth([player], undefined, normalSettings)
      totalEasy += grownEasy.stats.TEC - player.stats.TEC
      totalNormal += grownNormal.stats.TEC - player.stats.TEC
    }
    expect(totalEasy).toBeGreaterThanOrEqual(totalNormal)
  })

  it('does not mutate original player with any multiplier', () => {
    const player = makePlayer()
    const originalTEC = player.stats.TEC
    const settings: DifficultySettings = { ...DEFAULT_DIFFICULTY, seasonGrowthMultiplier: 2.0 }
    applySeasonGrowth([player], undefined, settings)
    expect(player.stats.TEC).toBe(originalTEC)
  })

  it('defaults to 1.0x when settings not provided (backward compat)', () => {
    const player = makePlayer({ career: { ...makePlayer().career, growthRate: 2.0 } })
    // Should not throw when called without settings
    expect(() => applySeasonGrowth([player])).not.toThrow()
  })
})
```

Also add the import at the top of the test file:
```typescript
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'
```

- [ ] **Step 5.2: Run tests to confirm the new tests fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/growthService.test.ts 2>&1 | tail -15
```

Expected: New tests FAIL, existing tests still PASS.

- [ ] **Step 5.3: Update `growthService.ts`**

Add import:
```typescript
import type { DifficultySettings } from '../types/career'
```

Change `applySeasonGrowth` signature (settings optional for backward compat):
```typescript
export function applySeasonGrowth(
  players: Player[],
  potentials?: Record<number, PotentialAnalysis>,
  settings?: DifficultySettings,
): Player[] {
```

Inside the function, after the line `const boosted = Math.round((delta as number) * matchMultiplier)`, apply the growth multiplier:
```typescript
// Before:
const boosted = Math.round((delta as number) * matchMultiplier)
newStats[key] = Math.min(newStats[key] + boosted, cap)
// After:
const rawBoosted = Math.round((delta as number) * matchMultiplier)
const boosted = Math.round(rawBoosted * (settings?.seasonGrowthMultiplier ?? 1.0))
newStats[key] = Math.min(newStats[key] + boosted, cap)
```

- [ ] **Step 5.4: Run all growth tests**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/growthService.test.ts 2>&1 | tail -10
```

Expected: All tests PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/services/growthService.ts src/tests/growthService.test.ts
git commit -m "feat(growth): applySeasonGrowth scales with seasonGrowthMultiplier"
```

---

## Task 6: Update `positionChangeService.ts`

**Files:**
- Create: `src/tests/positionChangeService.test.ts`
- Modify: `src/services/positionChangeService.ts`

- [ ] **Step 6.1: Write failing tests**

Create `src/tests/positionChangeService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcPositionChangeDays } from '../services/positionChangeService'
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Player } from '../types/player'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: 'P',
    nameRomaji: 'P',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 130, INT: 130, TOT: 50 },
    career: {
      maxLevel: 5,
      potential: 60,
      growthRate: 1.0,
      contractStatus: 'contracted',
      marketValue: 10000,
      salary: 500,
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100,
    morale: 100,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 22,
    teamId: 1,
    jerseyNumber: 1,
    ...overrides,
  } as Player
}

describe('calcPositionChangeDays with DifficultySettings', () => {
  it('returns 0 if current and target position are the same', () => {
    const player = makePlayer({ position: 'MD' })
    expect(calcPositionChangeDays(player, 'MD', DEFAULT_DIFFICULTY)).toBe(0)
  })

  it('at 0.75x (Easy), adjacent change takes fewer days than Normal', () => {
    const player = makePlayer({ position: 'MD' })
    const easySettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, positionChangeDaysMultiplier: 0.75 }
    const normalDays = calcPositionChangeDays(player, 'FW', DEFAULT_DIFFICULTY)
    const easyDays = calcPositionChangeDays(player, 'FW', easySettings)
    expect(easyDays).toBeLessThan(normalDays)
  })

  it('at 1.5x (Hard), adjacent change takes more days than Normal', () => {
    const player = makePlayer({ position: 'MD' })
    const hardSettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, positionChangeDaysMultiplier: 1.5 }
    const normalDays = calcPositionChangeDays(player, 'FW', DEFAULT_DIFFICULTY)
    const hardDays = calcPositionChangeDays(player, 'FW', hardSettings)
    expect(hardDays).toBeGreaterThan(normalDays)
  })

  it('result is always within [14, 84] bounds', () => {
    const player = makePlayer({ position: 'MD' })
    const extremeSettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, positionChangeDaysMultiplier: 0.1 }
    const days = calcPositionChangeDays(player, 'GK', extremeSettings)
    expect(days).toBeGreaterThanOrEqual(14)
    expect(days).toBeLessThanOrEqual(84)
  })
})
```

- [ ] **Step 6.2: Run tests to confirm they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/positionChangeService.test.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 6.3: Update `positionChangeService.ts`**

Add import:
```typescript
import type { DifficultySettings } from '../types/career'
```

Change `calcPositionChangeDays` signature and apply the multiplier before the clamp:
```typescript
export function calcPositionChangeDays(
  player: Player,
  target: Position,
  settings: DifficultySettings,
): number {
  const current = player.position
  if (current === target) return 0

  let base: number
  if (current === 'GK' || target === 'GK') {
    base = 56
  } else if (areAdjacent(current, target)) {
    base = 28
  } else {
    base = 42
  }

  const int = player.stats.INT
  const intModifier = int >= 180 ? 0.7 : int < 120 ? 1.3 : 1.0
  const altModifier = player.positionAlt === target ? 0.5 : 1.0

  const result = Math.round(base * intModifier * altModifier * settings.positionChangeDaysMultiplier)
  return Math.min(84, Math.max(14, result))
}
```

Change `startOrResetPositionChange` to accept and forward settings:
```typescript
export function startOrResetPositionChange(
  player: Player,
  target: Position,
  currentDate: string,
  settings: DifficultySettings,
): Player {
  if (player.position === target || player.positionAlt === target) return player

  const plan: PositionChangePlan = {
    targetPosition: target,
    startDate: currentDate,
    daysRequired: calcPositionChangeDays(player, target, settings),
    daysCompleted: 0,
    completed: false,
  }

  return {
    ...player,
    career: { ...player.career, positionChangePlan: plan },
  }
}
```

- [ ] **Step 6.4: Run tests to confirm they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/positionChangeService.test.ts 2>&1 | tail -10
```

Expected: All PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/services/positionChangeService.ts src/tests/positionChangeService.test.ts
git commit -m "feat(position): position change duration scales with positionChangeDaysMultiplier"
```

---

## Task 7: Update `potentialService.ts`

**Files:**
- Create: `src/tests/potentialService.test.ts`
- Modify: `src/services/potentialService.ts`

- [ ] **Step 7.1: Write failing tests**

Create `src/tests/potentialService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcAnalysisCost } from '../services/potentialService'
import type { DifficultySettings, PotentialAnalysis } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { Team } from '../types/team'
import type { Player } from '../types/player'

function makeTeam(): Team {
  return {
    id: 1, name: 'T', tier: 2, reputation: 60, budget: 500_000,
    leagueId: 'first_division', captainId: 1,
    formation: { id: 1, name: '4-4-2', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 },
    lineup: [], playerIds: [],
    scoutLevel: 1,
    facilitiesLevel: 1,
  }
}

function makePlayer(): Player {
  return {
    id: 1, name: 'P', nameRomaji: 'P', gender: 'Masculino',
    position: 'MD', positionAlt: null, element: 'FIRE',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 50 },
    career: {
      maxLevel: 5, potential: 60, growthRate: 1.0,
      contractStatus: 'contracted', marketValue: 100_000,
      salary: 500, experience: 0, trainingProgress: 0,
      trainingSessionsThisWeek: 0, positionAlt: null,
    },
    techniques: [], spriteUrl: '', stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0,
    isSuspended: false, suspensionMatches: 0,
    age: 22, teamId: 1, jerseyNumber: 1,
  } as Player
}

function makeAnalysis(): PotentialAnalysis {
  return {
    truePotential: 75, growthCurve: 'normal', developmentRisk: 'low',
    trainingAffinity: 1.0, matchAffinity: 1.0,
    uncertainty: 22, rangeMin: 53, rangeMax: 97,
    investmentTotal: 0, analysesCompleted: [], discovered: {},
  }
}

describe('calcAnalysisCost with scoutCostMultiplier', () => {
  it('returns a positive cost on Normal', () => {
    const cost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), DEFAULT_DIFFICULTY)
    expect(cost).toBeGreaterThan(0)
  })

  it('at 0.75x (Easy), cost is less than Normal', () => {
    const easySettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, scoutCostMultiplier: 0.75 }
    const normalCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), DEFAULT_DIFFICULTY)
    const easyCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), easySettings)
    expect(easyCost).toBeLessThan(normalCost)
  })

  it('at 1.5x (Hard), cost is more than Normal', () => {
    const hardSettings: DifficultySettings = { ...DEFAULT_DIFFICULTY, scoutCostMultiplier: 1.5 }
    const normalCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), DEFAULT_DIFFICULTY)
    const hardCost = calcAnalysisCost('basic', makeAnalysis(), makeTeam(), makePlayer(), hardSettings)
    expect(hardCost).toBeGreaterThan(normalCost)
  })
})
```

- [ ] **Step 7.2: Run tests to confirm they fail**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/potentialService.test.ts 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 7.3: Update `potentialService.ts`**

Add import:
```typescript
import type { DifficultySettings } from '../types/career'
```

Change `calcAnalysisCost` signature and apply the multiplier at the end:
```typescript
export function calcAnalysisCost(
  tier: AnalysisTier,
  analysis: PotentialAnalysis,
  team: Team,
  player: Player,
  settings: DifficultySettings,
): number {
  const cfg = TIER_CONFIG[tier]
  const qualityMult = 0.8 + Math.min(1, player.career.marketValue / 500_000) * 0.4
  const discount = facilitiesCostDiscount(team)
  const repeatPenalty = 1 + analysis.analysesCompleted.length * 0.10
  return Math.round(cfg.baseCost * qualityMult * (1 - discount) * repeatPenalty * settings.scoutCostMultiplier)
}
```

- [ ] **Step 7.4: Run tests to confirm they pass**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run src/tests/potentialService.test.ts 2>&1 | tail -10
```

Expected: All PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/services/potentialService.ts src/tests/potentialService.test.ts
git commit -m "feat(potential): analysis cost scales with scoutCostMultiplier"
```

---

## Task 8: Update `seasonService.ts`

**Files:**
- Modify: `src/services/seasonService.ts`

- [ ] **Step 8.1: Update `endSeason` to thread `settings` to `applySeasonGrowth`**

Add import:
```typescript
import type { DifficultySettings } from '../types/career'
```

Change `endSeason` signature (settings optional for backward compat):
```typescript
export function endSeason(
  season: Season,
  teams: Team[],
  players: Player[],
  potentials?: Record<number, PotentialAnalysis>,
  settings?: DifficultySettings,
): { teams: Team[]; players: Player[]; promotions: number[]; relegations: number[] } {
  const grownPlayers = applySeasonGrowth(players, potentials, settings)
  return { teams, players: grownPlayers, promotions: [], relegations: [] }
}
```

- [ ] **Step 8.2: Run the full test suite to make sure nothing broke**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 8.3: Commit**

```bash
git add src/services/seasonService.ts
git commit -m "feat(season): endSeason threads DifficultySettings to applySeasonGrowth"
```

---

## Task 9: Update `careerService.ts`

**Files:**
- Modify: `src/services/careerService.ts`

- [ ] **Step 9.1: Update `createCareer` to accept and apply `settings`**

Add import:
```typescript
import type { DifficultySettings } from '../types/career'
import { DEFAULT_DIFFICULTY } from '../types/career'
```

Change `createCareer` signature:
```typescript
export function createCareer(
  managerName: string,
  teamId: number,
  teams: Team[],
  leagues: League[],
  players: Player[],
  settings: DifficultySettings = DEFAULT_DIFFICULTY,
): { career: Career; teams: Team[]; players: Player[] }
```

Apply `budgetMultiplier` when building the team object. Find where the season is initialized (around the `const season = initSeason(...)` line) and before that, scale the user team's budget:

```typescript
const team = chooseTeam(teamId, teams)
// Apply budget multiplier to the user's team copy
const scaledTeams = teams.map((t) =>
  t.id === teamId
    ? { ...t, budget: Math.round(t.budget * settings.budgetMultiplier) }
    : t,
)
const league = leagues.find((l) => l.id === team.leagueId)
if (!league) throw new Error(`League ${team.leagueId} not found`)
const scaledTeam = scaledTeams.find((t) => t.id === teamId)!

const season = initSeason(teamId, team.leagueId, scaledTeams, leagues, CURRENT_YEAR)
```

Replace usages of `teams` with `scaledTeams` in the rest of `createCareer` where teams are passed to other functions (e.g., `initSeason`, `initLeagueSeason`, `initCup`). The local `team` variable for reading `tier` etc. can stay as is since `scaledTeam` only differs in budget.

In the `career` object literal, replace `rewardChoices: 3` with `difficulty: settings`:

```typescript
let career: Career = {
  id: crypto.randomUUID(),
  managerName,
  managerAvatar: '',
  teamId,
  season,
  seasonNumber: 1,
  totalBudgetSpent: 0,
  totalBudgetEarned: 0,
  objectives,
  inbox: [],
  transferHistory: [],
  watchlist: [],
  seasonHistory: [],
  playerPotential,
  weeklyTrainingPlan: null,
  inventory: { ...EMPTY_INVENTORY },
  allLeagueSeasons,
  cup,
  seasonStatus: 'active',
  lastSeasonReview: null,
  difficulty: settings,       // ← replaces rewardChoices
  createdAt: now,
  lastSavedAt: now,
}
```

Return `scaledTeams` instead of the original teams:
```typescript
return { career, teams: scaledTeams, players: assignedPlayers }
```

- [ ] **Step 9.2: Run the full test suite**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 9.3: Commit**

```bash
git add src/services/careerService.ts
git commit -m "feat(career): createCareer accepts DifficultySettings, applies budgetMultiplier"
```

---

## Task 10: Update `saveService.ts` — migration fallback

**Files:**
- Modify: `src/services/saveService.ts`

- [ ] **Step 10.1: Inject `DEFAULT_DIFFICULTY` for old saves**

Add import:
```typescript
import { DEFAULT_DIFFICULTY } from '../types/career'
```

In the `load` function, after parsing, inject the fallback:
```typescript
export function load(slot: number): SaveData | null {
  const raw = localStorage.getItem(getKey(slot))
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as SaveData
    // Migration: old saves have no difficulty field
    if (!data.career.difficulty) {
      data.career = { ...data.career, difficulty: DEFAULT_DIFFICULTY }
    }
    return data
  } catch {
    return null
  }
}
```

- [ ] **Step 10.2: Run the full test suite**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 10.3: Commit**

```bash
git add src/services/saveService.ts
git commit -m "feat(save): inject DEFAULT_DIFFICULTY when loading pre-difficulty saves"
```

---

## Task 11: Update `careerStore.ts`

**Files:**
- Modify: `src/store/careerStore.ts`

This is the largest task — it wires difficulty through every call site.

- [ ] **Step 11.1: Add `DEFAULT_DIFFICULTY` import**

At the top with other career type imports, add:
```typescript
import { DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'
```

- [ ] **Step 11.2: Add `scaleNpcSnapshot` helper function**

After the existing `buildNpcSnapshot` function (around line 87), add:
```typescript
function scaleNpcSnapshot(snap: TeamSnapshot, multiplier: number): TeamSnapshot {
  return {
    ...snap,
    forwardScore: snap.forwardScore * multiplier,
    midfieldScore: snap.midfieldScore * multiplier,
    defenseScore: snap.defenseScore * multiplier,
    goalkeeperScore: snap.goalkeeperScore * multiplier,
  }
}
```

- [ ] **Step 11.3: Update `startNewCareer` to accept `difficulty`**

Change the type signature in the store interface (around line 460):
```typescript
startNewCareer(managerName: string, teamId: number, managerAvatar?: string, difficulty?: DifficultySettings): void
```

Change the implementation (around line 573):
```typescript
startNewCareer(managerName, teamId, managerAvatar = '/avatars/avatar-1.svg', difficulty = DEFAULT_DIFFICULTY) {
  const playersCopy: Player[] = JSON.parse(JSON.stringify(seedPlayers))
    .map((p: Player) => ({ ...p, seasonMatchMinutes: 0 }))
  const teamsCopy: Team[] = JSON.parse(JSON.stringify(seedTeams))
    .map((t: Team) => ({
      ...t,
      scoutLevel: t.scoutLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
      facilitiesLevel: t.facilitiesLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
    }))
  const leaguesCopy = JSON.parse(JSON.stringify(seedLeagues))

  const { career, teams: newTeams, players: newPlayers } = createCareer(
    managerName, teamId, teamsCopy, leaguesCopy, playersCopy, difficulty,
  )
  career.managerAvatar = managerAvatar

  set({
    career,
    players: newPlayers,
    teams: newTeams,
    screen: 'career_home',
    lastMatchResult: null,
    pendingMatch: null,
    selectedPlayerId: null,
    selectedMatchId: null,
    activeTransferFilter: { ...DEFAULT_TRANSFER_FILTER },
  })
},
```

- [ ] **Step 11.4: Replace all `career.rewardChoices` with `career.difficulty.rewardChoices`**

There are exactly 3 occurrences (lines 691, 750, 1356). Find them and replace:
```typescript
// Before:
generateMatchRewards(match, userTeam, rivalTeam, starters, career.rewardChoices)
// After:
generateMatchRewards(match, userTeam, rivalTeam, starters, career.difficulty.rewardChoices)
```

- [ ] **Step 11.5: Apply `aiStrengthMultiplier` to NPC opponent snapshot in user's matches**

There are three places where user matches are simulated. In each, identify which team is the NPC and scale its snapshot.

**`simulateMatchFast`** (around line 678):
```typescript
const homeTeamData = teams.find((t) => t.id === match.homeTeamId)
const awayTeamData = teams.find((t) => t.id === match.awayTeamId)
if (!homeTeamData || !awayTeamData) return

const aiMult = career.difficulty.aiStrengthMultiplier
const homeIsUser = match.homeTeamId === career.teamId
const rawHome = buildTeamSnapshot(homeTeamData, players)
const rawAway = buildTeamSnapshot(awayTeamData, players)
const homeSnapshot = homeIsUser ? rawHome : scaleNpcSnapshot(rawHome, aiMult)
const awaySnapshot = !homeIsUser ? rawAway : scaleNpcSnapshot(rawAway, aiMult)
const result = simulate(homeSnapshot, awaySnapshot, match)
```

**`startLiveMatch`** (around line 716):
```typescript
const aiMult = career.difficulty.aiStrengthMultiplier
const homeIsUser = match.homeTeamId === career.teamId
const rawHome = buildTeamSnapshot(homeTeamData, players)
const rawAway = buildTeamSnapshot(awayTeamData, players)
const homeSnapshot = homeIsUser ? rawHome : scaleNpcSnapshot(rawHome, aiMult)
const awaySnapshot = !homeIsUser ? rawAway : scaleNpcSnapshot(rawAway, aiMult)
const result = simulate(homeSnapshot, awaySnapshot, match)
set({ pendingMatch: { matchId, result }, selectedMatchId: matchId })
```

**`commitCupMatchFast`** (around line 1343):
```typescript
const aiMult = career.difficulty.aiStrengthMultiplier
const homeIsUser = match.homeTeamId === career.teamId
const rawHome = buildTeamSnapshot(homeTeam, players)
const rawAway = buildTeamSnapshot(awayTeam, players)
const homeSnap = homeIsUser ? rawHome : scaleNpcSnapshot(rawHome, aiMult)
const awaySnap = !homeIsUser ? rawAway : scaleNpcSnapshot(rawAway, aiMult)
const result = simulate(homeSnap, awaySnap, match)
```

- [ ] **Step 11.6: Update `drainStaminaAfterMatch` call sites (2 places)**

At lines 210 and 275, add `career.difficulty` as the fourth argument:
```typescript
// Line 210:
let updatedPlayers = drainStaminaAfterMatch(players, starterIds, benchIds, career.difficulty)
// Line 275:
updatedPlayers = drainStaminaAfterMatch(updatedPlayers, starterIds, benchIds, career.difficulty)
```

- [ ] **Step 11.7: Update `recoverStaminaForDays` call sites (2 places)**

At line 794 (in `advanceDay`) and line 841 (in `advanceToNextMatch`), pass `staminaRecoveryPerDay`:
```typescript
// Line 794:
const recoveredPlayers = recoverStaminaForDays(players, 1, career.difficulty.staminaRecoveryPerDay)
// Line 841:
const recoveredPlayers = recoverStaminaForDays(players, days, career.difficulty.staminaRecoveryPerDay)
```

- [ ] **Step 11.8: Update `trainPlayer` call site (line 861)**

```typescript
trainPlayer(playerId, stat) {
  const { career, players } = get()
  if (!career) return
  const updatedPlayers = trainPlayerService(playerId, stat, players, career.difficulty)
  set({ players: updatedPlayers })
},
```

- [ ] **Step 11.9: Update `executeWeeklyPlan` call site (around line 913)**

```typescript
const { players: updatedPlayers, career: updatedCareer } = executeWeeklyPlan(
  career.weeklyTrainingPlan,
  players,
  career,
  career.difficulty,
)
```

- [ ] **Step 11.10: Update `endSeason` call site (around line 368)**

```typescript
const seasonResult = endSeason(
  finishedSeason,
  updatedTeams,
  updatedPlayers,
  career.playerPotential,
  career.difficulty,
)
```

- [ ] **Step 11.11: Update `startOrResetPositionChange` call site (around line 962)**

```typescript
const updated = startOrResetPositionChange(player, targetPosition, career.season.currentDate, career.difficulty)
```

- [ ] **Step 11.12: Update `calcAnalysisCost` call site (around line 1187)**

```typescript
const cost = calcAnalysisCost(nextTier, existing, userTeam, player, career.difficulty)
```

- [ ] **Step 11.13: Run the full test suite**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run 2>&1 | tail -20
```

Expected: All tests PASS. If any TypeScript errors remain, fix them.

- [ ] **Step 11.14: Commit**

```bash
git add src/store/careerStore.ts
git commit -m "feat(store): wire DifficultySettings through all service call sites"
```

---

## Task 12: Update `TransfersScreen.tsx` and `ScoutScreen.tsx`

**Files:**
- Modify: `src/screens/TransfersScreen.tsx`
- Modify: `src/screens/ScoutScreen.tsx`

- [ ] **Step 12.1: Apply `transferCostMultiplier` in `TransfersScreen.tsx`**

In `TransfersScreen.tsx`, read `career` from the store. The buy call at line ~143 uses `calcTransferValue(player)` directly. Apply the multiplier:

First, find where `career` is read from the store — add it if not already imported:
```typescript
const career = useCareerStore((s) => s.career)
```

Then wrap the buy call:
```typescript
onBuy={() => handleBuy(
  player.id,
  Math.round(calcTransferValue(player) * (career?.difficulty.transferCostMultiplier ?? 1)),
)}
```

- [ ] **Step 12.2: Apply `transferCostMultiplier` in `ScoutScreen.tsx`**

Same pattern. In `ScoutScreen.tsx` at the buy call:
```typescript
const career = useCareerStore((s) => s.career)
// ...
onBuy={() => buyPlayer(
  player.id,
  Math.round(calcTransferValue(player) * (career?.difficulty.transferCostMultiplier ?? 1)),
)}
```

- [ ] **Step 12.3: Run TypeScript check**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: No errors related to these files.

- [ ] **Step 12.4: Commit**

```bash
git add src/screens/TransfersScreen.tsx src/screens/ScoutScreen.tsx
git commit -m "feat(transfers): apply transferCostMultiplier to player buy price"
```

---

## Task 13: Update `NewCareerScreen.tsx` — Add Difficulty Step

**Files:**
- Modify: `src/screens/NewCareerScreen.tsx`

- [ ] **Step 13.1: Update imports, step type, and state**

At the top of `NewCareerScreen.tsx`, add:
```typescript
import { DIFFICULTY_PRESETS, DEFAULT_DIFFICULTY } from '../types/career'
import type { DifficultySettings } from '../types/career'
```

Change the step type and steps array:
```typescript
type Step = 0 | 1 | 2 | 3
const STEPS = ['Entrenador', 'Equipo', 'Dificultad', 'Confirmar']
```

Add difficulty state alongside the existing state declarations:
```typescript
type DifficultyMode = 'easy' | 'normal' | 'hard' | 'custom'
const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>('normal')
const [difficulty, setDifficulty] = useState<DifficultySettings>(DEFAULT_DIFFICULTY)
```

- [ ] **Step 13.2: Update `handleCreate`**

```typescript
function handleCreate() {
  if (!managerName.trim() || selectedTeamId === null) return
  startNewCareer(managerName.trim(), selectedTeamId, managerAvatar, difficulty)
}
```

- [ ] **Step 13.3: Update bottom nav bar logic**

The nav bar currently checks `step < 2` to show "Continuar" vs "Crear Carrera". Change to `step < 3`:
```typescript
{step < 3 ? (
  <button
    onClick={() => {
      if (step === 0 && !managerName.trim()) return
      if (step === 1 && selectedTeamId === null) return
      setStep((s) => (s + 1) as Step)
    }}
    disabled={
      (step === 0 && !managerName.trim()) ||
      (step === 1 && selectedTeamId === null)
    }
    className="ml-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
  >
    Continuar →
  </button>
) : (
  <button
    onClick={handleCreate}
    className="ml-auto px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
  >
    Crear Carrera
  </button>
)}
```

Also update the back button:
```typescript
onClick={() => {
  if (step === 0) navigate('main_menu')
  else setStep((s) => (s - 1) as Step)
}}
```

- [ ] **Step 13.4: Add Step 2 — Difficulty UI**

Insert the following JSX block between the Step 1 and Step 2 blocks (the current Step 2 becomes Step 3):

```tsx
{/* ── STEP 2: Difficulty ── */}
{step === 2 && (
  <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
    <div>
      <h2 className="text-white text-2xl font-bold mb-1">Dificultad</h2>
      <p className="text-gray-400 text-sm">Elige el nivel de desafío de tu carrera.</p>
    </div>

    {/* Preset cards */}
    <div className="grid grid-cols-2 gap-3">
      {/* Fácil */}
      <button
        onClick={() => { setDifficultyMode('easy'); setDifficulty(DIFFICULTY_PRESETS.easy) }}
        className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'easy' ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
      >
        <p className="text-green-400 text-lg font-bold mb-1">🌿 Fácil</p>
        <p className="text-gray-400 text-xs">Más presupuesto, rivales más débiles, entrenamiento y crecimiento acelerados. Ideal para descubrir el juego.</p>
      </button>

      {/* Normal */}
      <button
        onClick={() => { setDifficultyMode('normal'); setDifficulty(DIFFICULTY_PRESETS.normal) }}
        className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'normal' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
      >
        <p className="text-blue-400 text-lg font-bold mb-1">⚽ Normal</p>
        <p className="text-gray-400 text-xs">Valores por defecto. Experiencia equilibrada para la mayoría de jugadores.</p>
      </button>

      {/* Difícil */}
      <button
        onClick={() => { setDifficultyMode('hard'); setDifficulty(DIFFICULTY_PRESETS.hard) }}
        className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'hard' ? 'border-red-500 bg-red-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
      >
        <p className="text-red-400 text-lg font-bold mb-1">🔥 Difícil</p>
        <p className="text-gray-400 text-xs">Rivales más fuertes, stamina limitada, fichajes más caros. Solo para los más exigentes.</p>
      </button>

      {/* Custom */}
      <button
        onClick={() => setDifficultyMode('custom')}
        className={`text-left p-4 rounded-2xl border-2 transition-colors ${difficultyMode === 'custom' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
      >
        <p className="text-purple-400 text-lg font-bold mb-1">⚙️ Custom</p>
        <p className="text-gray-400 text-xs">Configura manualmente cada parámetro a tu gusto.</p>
      </button>
    </div>

    {/* Custom panel */}
    {difficultyMode === 'custom' && (
      <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 flex flex-col gap-5">
        <p className="text-white font-semibold text-sm uppercase tracking-wide">Configuración avanzada</p>

        {/* Partidos */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Partidos</p>
          <div className="flex flex-col gap-3">
            <DiffSlider label="Fuerza rivales" value={difficulty.aiStrengthMultiplier} min={0.7} max={1.3} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, aiStrengthMultiplier: v }))} />
          </div>
        </div>

        {/* Energía */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Energía</p>
          <div className="flex flex-col gap-3">
            <DiffStepper label="Stamina recuperada/día" value={difficulty.staminaRecoveryPerDay} min={3} max={15} onChange={(v) => setDifficulty((d) => ({ ...d, staminaRecoveryPerDay: v }))} />
            <DiffStepper label="Desgaste titular/partido" value={difficulty.starterStaminaDrain} min={15} max={35} onChange={(v) => setDifficulty((d) => ({ ...d, starterStaminaDrain: v }))} />
            <DiffStepper label="Desgaste banquillo/partido" value={difficulty.benchStaminaDrain} min={4} max={15} onChange={(v) => setDifficulty((d) => ({ ...d, benchStaminaDrain: v }))} />
          </div>
        </div>

        {/* Entrenamiento */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Entrenamiento</p>
          <DiffSlider label="Ganancia de entrenamiento" value={difficulty.trainingGainMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, trainingGainMultiplier: v }))} />
        </div>

        {/* Crecimiento */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Crecimiento</p>
          <div className="flex flex-col gap-3">
            <DiffSlider label="Crecimiento temporal" value={difficulty.seasonGrowthMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, seasonGrowthMultiplier: v }))} />
            <DiffSlider label="Velocidad cambio de posición" value={difficulty.positionChangeDaysMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, positionChangeDaysMultiplier: v }))} />
          </div>
        </div>

        {/* Finanzas */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Finanzas</p>
          <div className="flex flex-col gap-3">
            <DiffSlider label="Coste de fichajes" value={difficulty.transferCostMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, transferCostMultiplier: v }))} />
            <DiffSlider label="Presupuesto inicial" value={difficulty.budgetMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, budgetMultiplier: v }))} />
          </div>
        </div>

        {/* Ojeadores */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Ojeadores</p>
          <DiffSlider label="Coste de análisis" value={difficulty.scoutCostMultiplier} min={0.5} max={2.0} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => setDifficulty((d) => ({ ...d, scoutCostMultiplier: v }))} />
        </div>

        {/* Recompensas */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Recompensas por partido</p>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                onClick={() => setDifficulty((d) => ({ ...d, rewardChoices: n }))}
                className={`w-12 h-10 rounded-lg font-bold text-sm transition-colors ${difficulty.rewardChoices === n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 13.5: Add the `DiffSlider` and `DiffStepper` helper components**

Add these small inline components at the top of the file (before `export default function NewCareerScreen()`):

```tsx
function DiffSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-28 accent-purple-500"
      />
      <span className="text-purple-300 text-sm w-12 text-right tabular-nums">{format(value)}</span>
    </div>
  )
}

function DiffStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-300 text-sm flex-1">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold flex items-center justify-center"
      >
        −
      </button>
      <span className="text-purple-300 text-sm w-8 text-center tabular-nums font-medium">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold flex items-center justify-center"
      >
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 13.6: Update Step 3 (Confirm) to show difficulty summary**

In the Confirm step (now `step === 3`), change the `selectedTeam` guard from `step === 2` to `step === 3`, and add a difficulty summary section below the team card:

```tsx
{/* ── STEP 3: Confirm ── */}
{step === 3 && selectedTeam && (
  <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
    {/* ... existing coach + team cards ... */}

    {/* Difficulty summary */}
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Dificultad</p>
      <div className="flex items-center gap-3">
        {difficultyMode === 'easy' && <span className="text-green-400 font-bold text-lg">🌿 Fácil</span>}
        {difficultyMode === 'normal' && <span className="text-blue-400 font-bold text-lg">⚽ Normal</span>}
        {difficultyMode === 'hard' && <span className="text-red-400 font-bold text-lg">🔥 Difícil</span>}
        {difficultyMode === 'custom' && <span className="text-purple-400 font-bold text-lg">⚙️ Custom</span>}
      </div>
      {difficultyMode === 'custom' && (
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          {[
            ['Fuerza rivales', `×${difficulty.aiStrengthMultiplier.toFixed(2)}`],
            ['Stamina/día', `${difficulty.staminaRecoveryPerDay} pts`],
            ['Desgaste titular', `${difficulty.starterStaminaDrain} pts`],
            ['Desgaste banquillo', `${difficulty.benchStaminaDrain} pts`],
            ['Entrenamiento', `×${difficulty.trainingGainMultiplier.toFixed(2)}`],
            ['Crecimiento temporal', `×${difficulty.seasonGrowthMultiplier.toFixed(2)}`],
            ['Cambio posición', `×${difficulty.positionChangeDaysMultiplier.toFixed(2)}`],
            ['Coste fichajes', `×${difficulty.transferCostMultiplier.toFixed(2)}`],
            ['Presupuesto inicial', `×${difficulty.budgetMultiplier.toFixed(2)}`],
            ['Coste ojeadores', `×${difficulty.scoutCostMultiplier.toFixed(2)}`],
            ['Recompensas/partido', `${difficulty.rewardChoices}`],
          ].map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs py-0.5">
              <span className="text-gray-500">{key}</span>
              <span className="text-gray-300 font-medium tabular-nums">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 13.7: Run TypeScript check**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: No errors.

- [ ] **Step 13.8: Run full test suite**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npx vitest run 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 13.9: Commit**

```bash
git add src/screens/NewCareerScreen.tsx
git commit -m "feat(ui): add difficulty selection step to NewCareerScreen with presets and custom mode"
```

---

## Self-Review Checklist

### Spec coverage
- [x] 3 standard modes (Easy, Normal, Hard) — Task 1 (presets) + Task 13 (UI cards)
- [x] Custom mode with all parameters — Task 13 (custom panel)
- [x] `aiStrengthMultiplier` — Task 11 (store, NPC scaling)
- [x] `staminaRecoveryPerDay` / `starterStaminaDrain` / `benchStaminaDrain` — Task 2 (energyService) + Task 11
- [x] `trainingGainMultiplier` (weekly + manual) — Task 3, Task 4
- [x] `seasonGrowthMultiplier` — Task 5 (growthService) + Task 8 (seasonService)
- [x] `positionChangeDaysMultiplier` — Task 6
- [x] `transferCostMultiplier` at buy call site — Task 12
- [x] `budgetMultiplier` applied at career creation — Task 9
- [x] `scoutCostMultiplier` — Task 7
- [x] `rewardChoices` migration from top-level field — Tasks 1, 11
- [x] Save compatibility / migration — Task 10
- [x] Confirm step shows difficulty summary — Task 13
- [x] `DEFAULT_DIFFICULTY` exported for fallback — Task 1

### Type consistency
- `DifficultySettings` defined in Task 1, imported in Tasks 2–9, 11–13 ✓
- `DIFFICULTY_PRESETS` defined in Task 1, used in Task 13 ✓
- `DEFAULT_DIFFICULTY` defined in Task 1, used in Tasks 10, 11, 13 ✓
- `startNewCareer` signature updated in Task 11, called in Task 13 with `difficulty` ✓
- `drainStaminaAfterMatch` updated in Task 2, call sites updated in Task 11 ✓
- `executeWeeklyPlan` updated in Task 3, call site updated in Task 11 ✓
- `trainPlayer` updated in Task 4, call site updated in Task 11 ✓
- `applySeasonGrowth` updated in Task 5, threaded via `endSeason` in Task 8 ✓
- `calcPositionChangeDays` + `startOrResetPositionChange` updated in Task 6, call site updated in Task 11 ✓
- `calcAnalysisCost` updated in Task 7, call site updated in Task 11 ✓
- `createCareer` updated in Task 9, called with `difficulty` in Task 11 ✓
