# Market Value & Sell Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the economy-breaking sell bug, introduce a multi-factor market value formula, add `canonTier` and `seasonStats` to players, and rebuild the sell UI to remove free-form price input.

**Architecture:** `Player` gains two new required fields (`canonTier`, `seasonStats`). `calcTransferValue` becomes a multi-factor multiplicative formula. A new `sanitizeAmount` guard runs at all transaction boundaries. The sell modal in `PlayerDetailScreen` loses its free-form input and gains a one-click quick-sell plus a conditional AI-offer panel. `generateAIOffers` is wired to `commitLiveMatch`. `seasonMatchMinutes` is replaced throughout by `seasonStats.minutesPlayed`.

**Tech Stack:** TypeScript, React, Zustand, Vitest

## Global Constraints

- No free-form price input anywhere in the sell flow
- `sanitizeAmount` must be called before every monetary transaction
- `MAX_TRANSFER_VALUE = 10_000_000` — hard cap on any single transfer
- `canonTier` is `'common' | 'rare' | 'epic' | 'legendary'`
- `seasonStats` resets to zeros at season start
- No emojis in UI copy — use Material Icons (`<span className="material-icons">`)
- Run `npx tsc --noEmit` after every task; it must exit clean

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/player.ts` | Modify | Add `CanonTier`, `PlayerSeasonStats`, update `Player`; remove `seasonMatchMinutes` |
| `src/services/transferService.ts` | Modify | New `calcTransferValue`, add `sanitizeAmount` + `MAX_TRANSFER_VALUE` |
| `src/tests/transferService.test.ts` | Modify | Update fixture; add tests for new formula factors + `sanitizeAmount` |
| `src/store/careerStore.ts` | Modify | Apply `sanitizeAmount`; wire `generateAIOffers`; replace `seasonMatchMinutes` with `seasonStats` |
| `src/services/growthService.ts` | Modify | Replace `seasonMatchMinutes` reads/resets with `seasonStats` |
| `src/screens/PlayerDetailScreen.tsx` | Modify | Remove free-form sell input; add quick-sell + AI-offer panel |
| `src/data/players.ts` | Modify | Add `canonTier` and `seasonStats` initial values to all 1077 entries |
| `src/tests/growthService.test.ts` | Modify | Update fixture + test to use `seasonStats.minutesPlayed` |
| All other test files with Player fixtures | Modify | Add `canonTier: 'common'` and `seasonStats` defaults |

---

## Task 1: Player type — add `canonTier` and `seasonStats`, remove `seasonMatchMinutes`

**Files:**
- Modify: `src/types/player.ts`

**Interfaces:**
- Produces: `CanonTier`, `PlayerSeasonStats`, updated `Player` — consumed by every subsequent task

- [ ] **Step 1: Add `CanonTier` and `PlayerSeasonStats` types, update `Player`**

In `src/types/player.ts`, make these changes:

```ts
// Add before the Player interface:
export type CanonTier = 'common' | 'rare' | 'epic' | 'legendary'

export interface PlayerSeasonStats {
  goals: number
  assists: number
  cleanSheets: number
  matchesPlayed: number
  minutesPlayed: number
}
```

In the `Player` interface, remove `seasonMatchMinutes?: number` and add:

```ts
  canonTier: CanonTier
  seasonStats: PlayerSeasonStats
```

Full updated `Player` interface (relevant portion only — keep everything else unchanged):

```ts
export interface Player {
  id: number
  name: string
  nameRomaji: string
  gender: Gender
  position: Position
  positionAlt: Position | null
  element: Element
  stats: Stats
  career: PlayerCareer
  techniques: Technique[]
  improvementTechniques?: Technique[]
  equipment?: Record<EquipmentSlot, EquipmentItem | null>
  spriteUrl: string
  stamina: number
  morale: number
  isInjured: boolean
  injuryDaysRemaining: number
  isSuspended: boolean
  suspensionMatches: number
  age: number
  teamId: number | null
  jerseyNumber: number
  canonTier: CanonTier
  seasonStats: PlayerSeasonStats
}
```

- [ ] **Step 2: Run tsc — expect errors on all sites that read `seasonMatchMinutes`**

```bash
npx tsc --noEmit 2>&1 | grep -c "seasonMatchMinutes"
```

Expected: a non-zero count of errors. These are fixed in Tasks 3 and 4.

- [ ] **Step 3: Commit type-only change**

```bash
git add src/types/player.ts
git commit -m "feat: add CanonTier and PlayerSeasonStats to Player type"
```

---

## Task 2: `transferService` — new formula + validation (TDD)

**Files:**
- Modify: `src/services/transferService.ts`
- Modify: `src/tests/transferService.test.ts`

**Interfaces:**
- Consumes: `Player` with `canonTier: CanonTier` and `seasonStats: PlayerSeasonStats` (from Task 1)
- Produces:
  - `export const MAX_TRANSFER_VALUE: number`
  - `export function sanitizeAmount(amount: unknown): number | null`
  - `export function calcTransferValue(player: Player, ctx?: { lineupStatus?: 'starter' | 'bench' | 'uncalled'; teamReputation?: number }): number`

- [ ] **Step 1: Add new fields to the `makePlayer` fixture in the test file**

In `src/tests/transferService.test.ts`, add inside `makePlayer` (after `jerseyNumber: 10,`, before `...overrides`):

```ts
  canonTier: 'common' as const,
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
```

- [ ] **Step 2: Write failing tests for `sanitizeAmount` and the new formula factors**

Add to `src/tests/transferService.test.ts` (import `sanitizeAmount` and `MAX_TRANSFER_VALUE` at the top):

```ts
import { filterPlayers, calcTransferValue, buyPlayer, sanitizeAmount, MAX_TRANSFER_VALUE } from '../services/transferService'
```

Add these describe blocks at the end of the file:

```ts
describe('sanitizeAmount', () => {
  it('returns null for NaN', () => {
    expect(sanitizeAmount(NaN)).toBeNull()
  })
  it('returns null for Infinity', () => {
    expect(sanitizeAmount(Infinity)).toBeNull()
  })
  it('returns null for 0', () => {
    expect(sanitizeAmount(0)).toBeNull()
  })
  it('returns null for negative values', () => {
    expect(sanitizeAmount(-500)).toBeNull()
  })
  it('returns null for amounts above MAX_TRANSFER_VALUE', () => {
    expect(sanitizeAmount(MAX_TRANSFER_VALUE + 1)).toBeNull()
  })
  it('returns rounded integer for valid amounts', () => {
    expect(sanitizeAmount(100_000.7)).toBe(100_001)
  })
  it('returns MAX_TRANSFER_VALUE exactly when at the cap', () => {
    expect(sanitizeAmount(MAX_TRANSFER_VALUE)).toBe(MAX_TRANSFER_VALUE)
  })
  it('accepts string numbers', () => {
    expect(sanitizeAmount('50000')).toBe(50_000)
  })
})

describe('calcTransferValue — new factors', () => {
  // Base: TOT=50, age=25, potential=50, common, no performance, healthy
  // base=50000, ageFactor=1.2 (≤26), potentialFactor=1.0, canon=1.0, perf=1.0, injury=1.0
  // Expected: 50000 * 1.2 = 60000
  it('baseline: TOT=50, age=25, potential=50, common', () => {
    const p = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    expect(calcTransferValue(p)).toBe(60_000)
  })

  it('legendary canon multiplies by 2.2', () => {
    const common = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'common' })
    const legendary = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'legendary' })
    expect(calcTransferValue(legendary)).toBe(Math.round(calcTransferValue(common) * 2.2))
  })

  it('epic canon multiplies by 1.6', () => {
    const common = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'common' })
    const epic = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'epic' })
    expect(calcTransferValue(epic)).toBe(Math.round(calcTransferValue(common) * 1.6))
  })

  it('rare canon multiplies by 1.3', () => {
    const common = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'common' })
    const rare = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, canonTier: 'rare' })
    expect(calcTransferValue(rare)).toBe(Math.round(calcTransferValue(common) * 1.3))
  })

  it('injured player is worth 15% less', () => {
    const healthy = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, isInjured: false })
    const injured = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, isInjured: true })
    expect(calcTransferValue(injured)).toBe(Math.round(calcTransferValue(healthy) * 0.85))
  })

  it('10 goals add 10% performance bonus', () => {
    const noGoals = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const scorer = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, seasonStats: { goals: 10, assists: 0, cleanSheets: 0, matchesPlayed: 10, minutesPlayed: 900 } })
    expect(calcTransferValue(scorer)).toBe(Math.round(calcTransferValue(noGoals) * 1.10))
  })

  it('performance bonus is capped at 30%', () => {
    // 100 goals → would be 100% bonus but caps at 30%
    const big = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, seasonStats: { goals: 100, assists: 0, cleanSheets: 0, matchesPlayed: 30, minutesPlayed: 2700 } })
    const cap = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 }, seasonStats: { goals: 30, assists: 0, cleanSheets: 0, matchesPlayed: 30, minutesPlayed: 2700 } })
    expect(calcTransferValue(big)).toBe(calcTransferValue(cap))
  })

  it('starter ctx adds 10% importance bonus', () => {
    const p = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const base = calcTransferValue(p)
    expect(calcTransferValue(p, { lineupStatus: 'starter' })).toBe(Math.round(base * 1.1))
  })

  it('uncalled ctx reduces value by 5%', () => {
    const p = makePlayer({ age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const base = calcTransferValue(p)
    expect(calcTransferValue(p, { lineupStatus: 'uncalled' })).toBe(Math.round(base * 0.95))
  })

  it('never exceeds MAX_TRANSFER_VALUE', () => {
    const p = makePlayer({ age: 18, stats: { ...makePlayer().stats, TOT: 300 }, career: { ...makePlayer().career, potential: 99 }, canonTier: 'legendary', seasonStats: { goals: 100, assists: 100, cleanSheets: 100, matchesPlayed: 40, minutesPlayed: 3600 } })
    expect(calcTransferValue(p)).toBeLessThanOrEqual(MAX_TRANSFER_VALUE)
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/tests/transferService.test.ts 2>&1 | tail -20
```

Expected: failures on `sanitizeAmount` (not exported) and the new `calcTransferValue` tests.

- [ ] **Step 4: Implement `sanitizeAmount`, `MAX_TRANSFER_VALUE`, and new `calcTransferValue` in `transferService.ts`**

Replace the existing `calcTransferValue` function and add `sanitizeAmount` and `MAX_TRANSFER_VALUE` at the top of `src/services/transferService.ts`:

```ts
export const MAX_TRANSFER_VALUE = 10_000_000

export function sanitizeAmount(amount: unknown): number | null {
  const n = Number(amount)
  if (!Number.isFinite(n) || Number.isNaN(n)) return null
  if (n <= 0) return null
  if (n > MAX_TRANSFER_VALUE) return null
  return Math.round(n)
}

export function calcTransferValue(
  player: Player,
  ctx?: { lineupStatus?: 'starter' | 'bench' | 'uncalled'; teamReputation?: number },
): number {
  const ageFactor =
    player.age <= 22 ? 1.4 :
    player.age <= 26 ? 1.2 :
    player.age <= 30 ? 1.0 : 0.7

  const potentialFactor =
    player.career.potential > 80 ? 1.3 :
    player.career.potential > 60 ? 1.1 : 1.0

  const canonFactor =
    player.canonTier === 'legendary' ? 2.2 :
    player.canonTier === 'epic'      ? 1.6 :
    player.canonTier === 'rare'      ? 1.3 : 1.0

  const { goals, assists, cleanSheets } = player.seasonStats
  const rawPerf = goals * 0.01 + assists * 0.005 + cleanSheets * 0.008
  const performanceFactor = 1 + Math.min(rawPerf, 0.30)

  const injuryFactor = player.isInjured ? 0.85 : 1.0

  const importanceFactor =
    ctx?.lineupStatus === 'starter'  ? 1.1 :
    ctx?.lineupStatus === 'uncalled' ? 0.95 : 1.0

  const divisionFactor = ctx?.teamReputation !== undefined
    ? 0.85 + (Math.min(Math.max(ctx.teamReputation, 0), 100) / 100) * 0.30
    : 1.0

  const raw = player.stats.TOT * 1000
    * ageFactor
    * potentialFactor
    * canonFactor
    * performanceFactor
    * injuryFactor
    * importanceFactor
    * divisionFactor

  return Math.min(Math.round(raw), MAX_TRANSFER_VALUE)
}
```

- [ ] **Step 5: Run tests — expect all to pass**

```bash
npx vitest run src/tests/transferService.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Apply `sanitizeAmount` in `buyPlayer` and `sellPlayer` in `transferService.ts`**

In `buyPlayer`, replace the existing guard at the top:

```ts
export function buyPlayer(
  playerId: number,
  teamId: number,
  amount: number,
  career: Career,
  teams: Team[],
  players: Player[],
): { career: Career; teams: Team[]; players: Player[] } {
  const safe = sanitizeAmount(amount)
  const player = players.find((p) => p.id === playerId)
  const buyingTeam = teams.find((t) => t.id === teamId)

  if (safe === null || !player || !buyingTeam) return { career, teams, players }
  if (buyingTeam.budget < safe) return { career, teams, players }

  // ... rest of function uses `safe` instead of `amount`
```

Replace every use of `amount` inside `buyPlayer` with `safe`. Do the same for `sellPlayer` — add `const safe = sanitizeAmount(amount)` and replace `amount` with `safe`.

- [ ] **Step 7: Run tsc and tests**

```bash
npx tsc --noEmit && npx vitest run src/tests/transferService.test.ts 2>&1 | tail -10
```

Expected: tsc clean (there will be other errors from `seasonMatchMinutes` — that's fine at this stage), all transferService tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/services/transferService.ts src/tests/transferService.test.ts
git commit -m "feat: new calcTransferValue formula, sanitizeAmount, MAX_TRANSFER_VALUE"
```

---

## Task 3: Migrate `seasonMatchMinutes` → `seasonStats` (careerStore + growthService)

**Files:**
- Modify: `src/store/careerStore.ts`
- Modify: `src/services/growthService.ts`
- Modify: `src/tests/growthService.test.ts`

**Interfaces:**
- Consumes: `PlayerSeasonStats` from Task 1
- Produces: all reads of `seasonMatchMinutes` replaced; `seasonStats` accumulated per match in `commitMatchResult`; reset in `startNewSeason`

- [ ] **Step 1: Update `growthService.ts` — replace `seasonMatchMinutes` reads**

In `src/services/growthService.ts`, the field is read at lines 43, 91, 95, and reset at line 120.

Replace all four occurrences:

```ts
// line 43 — was: player.seasonMatchMinutes ?? 0
// becomes:
player.seasonStats.minutesPlayed,

// lines 91, 95 — same pattern:
// was: p.seasonMatchMinutes ?? 0
// becomes:
p.seasonStats.minutesPlayed,

// line 120 — was: seasonMatchMinutes: 0
// becomes: reset the whole seasonStats object
seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
```

- [ ] **Step 2: Update `growthService.test.ts` — fixture and test**

In `src/tests/growthService.test.ts`, find the `makePlayer` helper (or inline fixture). Add the two new fields:

```ts
canonTier: 'common' as const,
seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
```

Find the test `'resets seasonMatchMinutes to 0 after applySeasonGrowth'` (line ~176). Update it:

```ts
it('resets seasonStats to zeros after applySeasonGrowth', () => {
  const player = makePlayer({
    seasonStats: { goals: 3, assists: 2, cleanSheets: 1, matchesPlayed: 10, minutesPlayed: 900 },
  })
  const [grown] = applySeasonGrowth([player], {})
  expect(grown.seasonStats).toEqual({
    goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0,
  })
})
```

- [ ] **Step 3: Update `careerStore.ts` — replace all `seasonMatchMinutes` usages**

There are 6 distinct locations. Replace each:

**Location 1 — cup match minutes tracking (lines ~324–331):**
```ts
// Remove the seasonMatchMinutes map entirely; seasonStats is now updated via
// the commitMatchResult helper in Task 3 Step 4
```
Actually keep the minutes update but change it to `seasonStats`:
```ts
updatedPlayers = updatedPlayers.map((p) => ({
  ...p,
  seasonStats: {
    ...p.seasonStats,
    minutesPlayed: p.seasonStats.minutesPlayed + (starterIds.has(p.id) ? 90 : benchIds.has(p.id) ? 45 : 0),
    matchesPlayed: p.seasonStats.matchesPlayed + (starterIds.has(p.id) || benchIds.has(p.id) ? 1 : 0),
  },
}))
```

**Location 2 — league match minutes tracking (lines ~382–387):**
```ts
let updatedPlayers = isUserMatch
  ? players.map((p) => {
      if (!starterIds.has(p.id) && !benchIds.has(p.id)) return p
      return {
        ...p,
        seasonStats: {
          ...p.seasonStats,
          minutesPlayed: p.seasonStats.minutesPlayed + (starterIds.has(p.id) ? 90 : 45),
          matchesPlayed: p.seasonStats.matchesPlayed + 1,
        },
      }
    })
  : players
```

**Location 3 — goal + clean sheet tracking (add after injury processing, ~line 391):**

Add this block after `updatedPlayers = applyMatchInjuries(...)`:

```ts
if (isUserMatch) {
  const isHome = match.homeTeamId === career.teamId
  const goalsConceded = isHome ? result.awayGoals : result.homeGoals
  const isCleanSheet = goalsConceded === 0

  const goalsByPlayer: Record<number, number> = {}
  for (const e of result.events) {
    if (e.type === 'GOAL' && e.teamId === career.teamId && e.playerId != null) {
      goalsByPlayer[e.playerId] = (goalsByPlayer[e.playerId] ?? 0) + 1
    }
  }

  updatedPlayers = updatedPlayers.map((p) => {
    if (!starterIds.has(p.id)) return p
    const goalsDelta = goalsByPlayer[p.id] ?? 0
    const cleanSheetDelta =
      isCleanSheet && (p.position === 'GK' || p.position === 'DF') ? 1 : 0
    return {
      ...p,
      seasonStats: {
        ...p.seasonStats,
        goals: p.seasonStats.goals + goalsDelta,
        cleanSheets: p.seasonStats.cleanSheets + cleanSheetDelta,
      },
    }
  })
}
```

**Location 4 — potential analysis cost (line ~670):**
```ts
// was: seasonMatchMinutes: p.seasonMatchMinutes ?? 0,
seasonMatchMinutes: p.seasonStats.minutesPlayed,
```
Wait — this is passing `seasonMatchMinutes` to a function that still expects that parameter name. Check `potentialService.ts` — its functions take `seasonMatchMinutes: number` as a positional argument. The parameter name is internal; just pass `p.seasonStats.minutesPlayed` as the argument value.

**Location 5 — potential analysis call (line ~1327):**
```ts
// was: player.seasonMatchMinutes ?? 0,
player.seasonStats.minutesPlayed,
```

**Location 6 — `startNewSeason` reset (line ~1613):**
```ts
// was: const resetPlayers = players.map((p) => ({ ...p, seasonMatchMinutes: 0 }))
const resetPlayers = players.map((p) => ({
  ...p,
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
}))
```

**Location 7 — season end growth reset (line ~623):**
```ts
// was: .map((p: Player) => ({ ...p, seasonMatchMinutes: 0 }))
.map((p: Player) => ({
  ...p,
  seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
}))
```

- [ ] **Step 4: Fix PlayerDetailScreen `seasonMatchMinutes` reads (lines 858, 904)**

In `src/screens/PlayerDetailScreen.tsx`, replace both:
```ts
// was: player.seasonMatchMinutes ?? 0
player.seasonStats.minutesPlayed
```

- [ ] **Step 5: Run tsc — expect zero `seasonMatchMinutes` errors**

```bash
npx tsc --noEmit 2>&1 | grep "seasonMatchMinutes"
```

Expected: no output (zero errors about this field).

- [ ] **Step 6: Run growthService tests**

```bash
npx vitest run src/tests/growthService.test.ts 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/store/careerStore.ts src/services/growthService.ts src/tests/growthService.test.ts src/screens/PlayerDetailScreen.tsx
git commit -m "feat: replace seasonMatchMinutes with seasonStats, accumulate goals and clean sheets per match"
```

---

## Task 4: Update remaining test fixtures

**Files:**
- Modify: `src/tests/potentialService.test.ts`
- Modify: `src/tests/formationService.test.ts`
- Modify: `src/tests/trainingService.test.ts`
- Modify: `src/tests/matchSimulator.test.ts`
- Modify: `src/tests/weeklyTrainingService.test.ts`
- Modify: `src/tests/saveService.test.ts`

**Interfaces:**
- Consumes: `CanonTier`, `PlayerSeasonStats` from Task 1

For each file, find every inline player object or `makePlayer` helper and add the two new fields:

```ts
canonTier: 'common' as const,
seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
```

If the file has a `makePlayer` helper, add the fields there (they'll propagate via `...overrides`). If players are defined inline, add the fields to each one.

- [ ] **Step 1: Update `src/tests/potentialService.test.ts`**

Find the player fixture (look for `isInjured: false` as a landmark) and add after `injuryDaysRemaining: 0,`:
```ts
canonTier: 'common' as const,
seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
```

- [ ] **Step 2: Update `src/tests/formationService.test.ts`** — same pattern.

- [ ] **Step 3: Update `src/tests/trainingService.test.ts`** — same pattern.

- [ ] **Step 4: Update `src/tests/matchSimulator.test.ts`** — same pattern.

- [ ] **Step 5: Update `src/tests/weeklyTrainingService.test.ts`** — same pattern.

- [ ] **Step 6: Update `src/tests/saveService.test.ts`** — same pattern.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/tests/
git commit -m "fix: add canonTier and seasonStats to all test Player fixtures"
```

---

## Task 5: Seed data migration — `src/data/players.ts`

**Files:**
- Modify: `src/data/players.ts`

- [ ] **Step 1: Add `seasonStats` and default `canonTier` to all 1077 players**

Since the file has ~41K lines, use a targeted Node script to add the fields rather than editing manually. Create a temporary migration script and delete it after use:

```bash
node -e "
const fs = require('fs');
let src = fs.readFileSync('src/data/players.ts', 'utf8');

// Add seasonStats and canonTier after every jerseyNumber line
src = src.replace(
  /jerseyNumber: (\d+),(\s*\n)/g,
  'jerseyNumber: \$1,\$2    canonTier: \'common\' as const,\$2    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },\$2'
);

fs.writeFileSync('src/data/players.ts', src);
console.log('Done');
"
```

Verify the count matches:
```bash
grep -c "canonTier:" src/data/players.ts
```
Expected: 1077 (one per player).

- [ ] **Step 2: Run tsc to verify the data file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "players.ts" | head -5
```

Expected: no errors from `players.ts`.

- [ ] **Step 3: Assign canon tiers to named IE characters**

After the default migration, patch the known canonical characters. In `src/data/players.ts`, find the following entries by `nameRomaji` and update their `canonTier`:

**Legendary** (main protagonists/central antagonists of the IE saga):
- `"Mamoru Endo"` → `'legendary'`
- `"Shuya Goenji"` → `'legendary'`
- `"Yuto Kido"` → `'legendary'`

**Epic** (Raimon core squad + major story characters):
- `"Heigoro Kabeyama"` → `'epic'`
- `"Ichirota Kazemaru"` → `'epic'`
- `"Ryugo Someoka"` → `'epic'`
- `"Kojiro Genda"` → `'epic'`
- `"Jiro Sakuma"` → `'epic'`
- `"Yuhei Hyodo"` → `'epic'`
- `"Asuka Domon"` → `'epic'`

**Rare** (named support characters with story presence):
- `"Teppei Kurimatsu"` → `'rare'`
- `"Shinichi Handa"` → `'rare'`
- `"Kazuya Ichinose"` → `'rare'`
- `"Densuke Ono"` → `'rare'`
- `"Kenya Narukami"` → `'rare'`

Continue reviewing the full nameRomaji list and assign tiers to any other named story characters you recognize from the IE universe. When in doubt, keep `'common'`.

Use a targeted replace for each, e.g.:
```bash
# Example for Mamoru Endo:
sed -i '/nameRomaji: "Mamoru Endo"/,/canonTier:/ s/canonTier: '"'"'common'"'"'/canonTier: '"'"'legendary'"'"'/' src/data/players.ts
```

Or edit the relevant sections by hand in the file for precision.

- [ ] **Step 4: Verify tsc still compiles clean**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add src/data/players.ts
git commit -m "feat: add canonTier and seasonStats to all seed players"
```

---

## Task 6: Wire `generateAIOffers` in `commitLiveMatch` + apply `sanitizeAmount` in store

**Files:**
- Modify: `src/store/careerStore.ts`

**Interfaces:**
- Consumes: `generateAIOffers` from `transferService.ts`, `addEvent` from `inboxService.ts`, `sanitizeAmount`, `MAX_TRANSFER_VALUE`
- Produces: AI offers appear in inbox after matches; `buyPlayer`/`sellPlayer`/`acceptTransferOffer` validate amounts

`addEvent` signature (from `src/services/inboxService.ts`):
```ts
addEvent(type: InboxEventType, title: string, body: string, career: Career, data?: Record<string, unknown>): Career
```

- [ ] **Step 1: Import `generateAIOffers`, `sanitizeAmount`, `MAX_TRANSFER_VALUE` in the store**

At the top of `src/store/careerStore.ts`, in the existing transfer import:
```ts
import {
  buyPlayer as buyPlayerService,
  sellPlayer as sellPlayerService,
  generateAIOffers,
  sanitizeAmount,
  MAX_TRANSFER_VALUE,
} from '../services/transferService'
```

- [ ] **Step 2: Apply `sanitizeAmount` in `buyPlayer` store action (line ~1099)**

```ts
buyPlayer(playerId, amount) {
  const { career, teams, players } = get()
  if (!career) return
  const safe = sanitizeAmount(amount)
  if (safe === null) return
  const result = buyPlayerService(playerId, career.teamId, safe, career, teams, players)
  set({ career: result.career, teams: result.teams, players: result.players })
},
```

- [ ] **Step 3: Apply `sanitizeAmount` in `sellPlayer` store action (line ~1106)**

```ts
sellPlayer(playerId, toTeamId, amount) {
  const { career, teams, players } = get()
  if (!career) return
  const safe = sanitizeAmount(amount)
  if (safe === null) return
  const result = sellPlayerService(playerId, toTeamId, safe, career, teams, players)
  set({ career: result.career, teams: result.teams, players: result.players })
},
```

- [ ] **Step 4: Apply `sanitizeAmount` in `acceptTransferOffer` (line ~1113)**

```ts
acceptTransferOffer(offerId) {
  const { career } = get()
  if (!career) return

  const offerEvent = career.inbox.find(
    (e) => e.type === 'TRANSFER_OFFER' && e.data?.offerId === offerId,
  )
  if (!offerEvent || !offerEvent.data) return

  const playerId = offerEvent.data.playerId as number
  const toTeamId = offerEvent.data.fromTeamId as number
  const rawAmount = offerEvent.data.amount as number
  const safe = sanitizeAmount(rawAmount)
  if (safe === null) return

  get().sellPlayer(playerId, toTeamId, safe)

  const { career: updatedCareer } = get()
  if (!updatedCareer) return
  set({ career: markRead(offerEvent.id, updatedCareer) })
},
```

- [ ] **Step 5: Wire `generateAIOffers` after `commitLiveMatch` (line ~825)**

In the `commitLiveMatch` action, after the `set({...})` call, add:

```ts
commitLiveMatch() {
  const { career, players, teams, pendingMatch } = get()
  if (!career || !pendingMatch) return

  // ... existing match + rewards logic ...

  set({
    career: committed.career,
    players: committed.players,
    teams: committed.teams,
    lastMatchResult: pendingMatch.result,
    pendingMatch: null,
    pendingRewards: rewards,
  })

  // After committing, maybe generate AI transfer offers
  if (Math.random() < 0.20) {
    const state = get()
    if (!state.career) return
    const offers = generateAIOffers(state.career, state.teams, state.players)
    if (offers.length === 0) return

    let updatedCareer = state.career
    for (const offer of offers) {
      const fmt = (n: number) =>
        n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` :
        n >= 1_000 ? `€${(n / 1_000).toFixed(0)}K` : `€${n}`

      updatedCareer = addEvent(
        'TRANSFER_OFFER',
        `Oferta de ${offer.fromTeamName}`,
        `${offer.fromTeamName} ofrece ${fmt(offer.amount)} por ${offer.playerName}.`,
        updatedCareer,
        {
          offerId: offer.id,
          fromTeamId: offer.fromTeamId,
          fromTeamName: offer.fromTeamName,
          playerId: offer.playerId,
          playerName: offer.playerName,
          amount: offer.amount,
        },
      )
    }
    set({ career: updatedCareer })
  }
},
```

- [ ] **Step 6: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/store/careerStore.ts
git commit -m "feat: wire generateAIOffers after match, apply sanitizeAmount in all store transactions"
```

---

## Task 7: Rebuild sell UI in `PlayerDetailScreen`

**Files:**
- Modify: `src/screens/PlayerDetailScreen.tsx`

**Interfaces:**
- Consumes: `calcTransferValue` (updated signature), `sanitizeAmount`, `acceptTransferOffer`, `rejectTransferOffer`, `sellPlayer` from store

- [ ] **Step 1: Remove free-form sell state and `handleSell`**

Remove:
```ts
const [sellAmount, setSellAmount] = useState('')
```

Remove the entire `handleSell` function:
```ts
function handleSell() {
  const amount = parseInt(sellAmount, 10)
  if (isNaN(amount) || amount <= 0) return
  const targetTeam = teams.find((t) => t.id !== career!.teamId)
  if (!targetTeam) return
  sellPlayer(player!.id, targetTeam.id, amount)
  setShowSellModal(false)
  navigate('squad')
}
```

- [ ] **Step 2: Add `acceptTransferOffer`, `rejectTransferOffer`, and inbox offer lookup**

Add to the store subscriptions at the top of the component (after `sellPlayer`):
```ts
const acceptTransferOffer = useCareerStore((s) => s.acceptTransferOffer)
const rejectTransferOffer = useCareerStore((s) => s.rejectTransferOffer)
```

Add a derived value for the pending offer (after the `player` null-guard):
```ts
const pendingOffer = career.inbox.find(
  (e) => e.type === 'TRANSFER_OFFER' && e.data?.playerId === player?.id,
) ?? null
const offerAmount = pendingOffer ? (pendingOffer.data?.amount as number) : null
const offerTeamName = pendingOffer ? (pendingOffer.data?.fromTeamName as string) : null
const offerOfferId = pendingOffer ? (pendingOffer.data?.offerId as string) : null
```

- [ ] **Step 3: Add `handleQuickSell`, `handleAcceptOffer`, `handleRejectOffer`**

```ts
function handleQuickSell() {
  const targetTeam = teams.find((t) => t.id !== career!.teamId)
  if (!targetTeam) return
  const marketValue = calcTransferValue(player!)
  sellPlayer(player!.id, targetTeam.id, marketValue)
  setShowSellModal(false)
  navigate('squad')
}

function handleAcceptOffer() {
  if (!offerOfferId) return
  acceptTransferOffer(offerOfferId)
  setShowSellModal(false)
  navigate('squad')
}

function handleRejectOffer() {
  if (!offerOfferId) return
  rejectTransferOffer(offerOfferId)
  setShowSellModal(false)
}
```

Add to imports at the top of the file:
```ts
import { calcTransferValue } from '../services/transferService'
```

- [ ] **Step 4: Replace the sell modal JSX**

Remove the old modal (the block starting with `{/* ── Sell modal ── */}`) and replace:

```tsx
{showSellModal && player && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 rounded-xl p-5 w-full max-w-sm border border-gray-700 space-y-4">
      <div>
        <h2 className="text-white text-base font-bold">Vender jugador</h2>
        <p className="text-gray-400 text-xs mt-0.5">{player.nameRomaji}</p>
      </div>

      {/* Market value */}
      <div className="flex items-center justify-between py-2 border-b border-gray-700">
        <span className="text-gray-400 text-xs">Valor de mercado</span>
        <span className="text-white text-sm font-bold tabular-nums">
          {fmt(calcTransferValue(player))}
        </span>
      </div>

      {/* Quick sell */}
      <div className="bg-gray-700/50 rounded-xl p-3 border border-gray-600/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-xs font-semibold">Venta rápida</span>
          <span className="text-white text-sm font-bold tabular-nums">
            {fmt(calcTransferValue(player))}
          </span>
        </div>
        <button
          onClick={handleQuickSell}
          className="w-full flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold text-sm transition-colors"
        >
          <span className="material-icons leading-none" style={{ fontSize: '16px' }}>sell</span>
          Vender ahora
        </button>
      </div>

      {/* AI offer (only if pending) */}
      {pendingOffer && offerAmount !== null && offerTeamName && (
        <div className="bg-yellow-900/20 rounded-xl p-3 border border-yellow-700/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-yellow-300 text-xs font-semibold">{offerTeamName}</span>
            <div className="text-right">
              <span className="text-white text-sm font-bold tabular-nums block">{fmt(offerAmount)}</span>
              {(() => {
                const diff = offerAmount - calcTransferValue(player)
                const pct = Math.round((diff / calcTransferValue(player)) * 100)
                return (
                  <span className={`text-[0.625rem] font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {diff >= 0 ? '+' : ''}{fmt(diff)} ({diff >= 0 ? '+' : ''}{pct}%)
                  </span>
                )
              })()}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptOffer}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-xs transition-colors"
            >
              <span className="material-icons leading-none" style={{ fontSize: '14px' }}>check</span>
              Aceptar
            </button>
            <button
              onClick={handleRejectOffer}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold text-xs transition-colors"
            >
              <span className="material-icons leading-none" style={{ fontSize: '14px' }}>close</span>
              Rechazar
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowSellModal(false)}
        className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-semibold text-sm transition-colors"
      >
        Cancelar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 7: Build**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds (chunk size warning is acceptable).

- [ ] **Step 8: Commit**

```bash
git add src/screens/PlayerDetailScreen.tsx
git commit -m "feat: rebuild sell modal — quick sell at market value, AI offer panel, no free-form input"
```

---

## Self-Review Against Spec

| Spec requirement | Task that covers it |
|---|---|
| Bug: no free-form sell price | Task 7 (modal rebuilt, input removed) |
| Quick sell = market value | Task 7 (`handleQuickSell` uses `calcTransferValue`) |
| AI offers only from system | Task 6 (`generateAIOffers` wired to `commitLiveMatch`) |
| `sanitizeAmount` at all boundaries | Tasks 2 + 6 |
| No NaN/Infinity/negative/huge amounts | Task 2 (`sanitizeAmount`) |
| `MAX_TRANSFER_VALUE` cap | Task 2 |
| Multi-factor formula (age, potential, canon, perf, injury, importance, division) | Task 2 |
| `canonTier` field on Player | Task 1 |
| `seasonStats` field on Player | Task 1 |
| `seasonMatchMinutes` removed | Tasks 1 + 3 |
| Goals + clean sheets accumulated per match | Task 3 |
| `seasonStats` reset at season start | Task 3 |
| Seed data: all players get new fields | Task 5 |
| UI shows market value, offer delta, accept/reject | Task 7 |
| No free-form input anywhere | Tasks 2 (service guards) + 7 (UI) |
