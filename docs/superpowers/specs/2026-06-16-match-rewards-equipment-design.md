# Match Rewards, Equipment & Extended Standings

**Date:** 2026-06-16
**Status:** Approved

## Overview

Two features:

1. **Match Rewards** — after winning a match (league or cup), the player chooses one reward from N options (default 3, configurable at career start). Reward quality scales with match difficulty. Each player can equip 4 items (gloves, boots, pendant, bracelet) that give fixed stat bonuses. Items are generated procedurally — no static catalog needed.

2. **Extended Standings** — `StandingsScreen` gains tabs to browse the user's league, the current cup bracket, and all other leagues being simulated in the career.

---

## 1. Data Types

### 1.1 Equipment

```ts
// src/types/equipment.ts  (new file)

type EquipmentSlot = 'gloves' | 'boots' | 'pendant' | 'bracelet'

interface EquipmentItem {
  id: string                      // uuid generated at creation
  slot: EquipmentSlot
  name: string                    // e.g. "Botas de Fuego", "Guantes de Hierro"
  statBonuses: Partial<Stats>     // e.g. { TEC: 3, AGI: 2 }
  tier: 1 | 2 | 3                 // cosmetic quality indicator
}
```

**Player** (`src/types/player.ts`) gains:
```ts
equipment: Record<EquipmentSlot, EquipmentItem | null>
```
Default: all slots `null`. Existing saves treated as all-null via migration in `saveService`.

### 1.2 Inventory

`ClubInventory` (`src/types/inventory.ts`) gains:
```ts
equipmentItems: EquipmentItem[]   // unassigned items won from matches
```

### 1.3 Match Reward

```ts
// src/types/reward.ts  (new file)

type MatchRewardType = 'technique_book' | 'money' | 'stat_boost' | 'equipment'

interface MatchReward {
  type: MatchRewardType
  techniqueBook?: TechniqueBook
  moneyAmount?: number
  statBoost?: { playerId: number; playerName: string; stat: keyof Stats; amount: number }
  equipmentItem?: EquipmentItem
}
```

### 1.4 Career Settings

`Career` (`src/types/career.ts`) gains:
```ts
rewardChoices: 1 | 2 | 3   // default 3, set at career creation
```

---

## 2. Difficulty Calculation & Reward Generation

### 2.1 Match Difficulty

Computed at the moment of victory:

```
rivalReputation = reputation of the opponent team
userReputation  = reputation of the user's team
isCupMatch      = match.type === 'cup'

raw = (rivalReputation - userReputation) / 100 + (isCupMatch ? 0.25 : 0)
difficulty = clamp(raw, 0.0, 1.5)
```

Tier mapping:
- `0.0–0.49` → tier 1
- `0.5–0.99` → tier 2
- `1.0–1.5`  → tier 3

### 2.2 Equipment Item Generation

Stats per tier (random within range, 1–2 different stats for tier 1, etc.):

| Tier | Nº stats with bonus | Range per stat |
|------|---------------------|----------------|
| 1    | 1–2                 | +1 to +3       |
| 2    | 2–3                 | +2 to +5       |
| 3    | 3–4                 | +3 to +8       |

Stats chosen randomly from the full Stats set (POT, CON, TEC, PRE, FIS, AGI, INT). Slot chosen randomly. Name generated from slot + element flavour (e.g. "Botas de Viento", "Pulsera de Hierro").

### 2.3 Other Reward Types per Tier

| Tier | Money        | Stat boost        | Technique POT range |
|------|--------------|-------------------|---------------------|
| 1    | €5K–€15K     | +1 to +2 pts      | ≤40                 |
| 2    | €15K–€40K    | +2 to +4 pts      | 40–65               |
| 3    | €40K–€100K   | +4 to +7 pts      | ≥65                 |

**Stat boost target:** one random starter from the match; stat chosen by position:
- GK → POT or CON
- DF → PRE or FIS
- MD → TEC or INT
- FW → POT or TEC

**Technique:** generated procedurally with POT in tier range (same approach as existing `techniqueBooks` but generated, not catalog-based). Type and element chosen randomly.

### 2.4 Generating the Options

`generateMatchRewards(match, userTeam, rivalTeam, starters, rewardChoices)` in `src/services/rewardService.ts`:
1. Compute difficulty → tier
2. Generate `rewardChoices` distinct `MatchReward` objects (one per type, shuffled, truncated to `rewardChoices` count). If `rewardChoices < 4`, some types are excluded randomly.
3. Return the array — no side effects, pure function.

---

## 3. UI Flow

### 3.1 Trigger

In `MatchScreen`, after detecting `userGoals > oppGoals`, generate rewards and show the reward modal before the "Continuar" button becomes active.

Rewards are generated once and stored in a `pendingRewards` field in the store (cleared after claiming). This prevents re-generating on re-render.

### 3.2 Reward Modal

Overlay on `MatchScreen`. Shows N cards side by side (or stacked on mobile). Each card:
- Icon (book / coin / lightning / shirt)
- Title (reward type label)
- Detail line (e.g. "+3 TEC, +2 AGI · Botas" or "€25.000" or "+2 POT → Kidou Yuuto")

Player taps a card → modal closes → reward applied → "Continuar" appears.

### 3.3 Applying the Reward

In `careerStore`, action `claimMatchReward(reward: MatchReward)`:
- `technique_book` → add to `career.inventory.techniqueBooks`
- `money` → add to `team.budget`
- `stat_boost` → update `player.stats[stat] += amount`
- `equipment` → add to `career.inventory.equipmentItems`

### 3.4 Equipment in PlayerDetailScreen

New "Equipación" section showing 4 slot cards (gloves, boots, pendant, bracelet). Each slot:
- Shows item name + stat bonuses if equipped, or "Vacío" if empty
- Tap → opens a sub-panel listing compatible items from club inventory
- User can equip (moves item from inventory to player slot), swap (swapped item returns to inventory), or unequip (item returns to inventory)

### 3.5 Effective Stats

New helper `getEffectiveStats(player): Stats` in `src/services/equipmentService.ts`:

```ts
function getEffectiveStats(player: Player): Stats {
  const bonuses = Object.values(player.equipment)
    .filter(Boolean)
    .flatMap(item => Object.entries(item.statBonuses))
  // sum bonuses over base stats
}
```

`buildTeamSnapshot` uses `getEffectiveStats(player)` instead of `player.stats` when computing scores — this is the match simulation integration point.

`getPlayerStatsSummary` (in `player.ts`) stays unchanged — it receives a `Player` and uses `player.stats`. Callers that need to show the user the "real" displayed stats (PlayerDetailScreen, PlayerCard, etc.) should instead call `getEffectiveStats(player)` and compute totals from that. This avoids a circular import between `player.ts` and `equipmentService.ts`.

### 3.6 Equipment on Player Transfer/Release

When a player is sold or released (`sellPlayer`, `removeCallupPlayer` if player leaves), their equipment slots are cleared and all equipped items are returned to `career.inventory.equipmentItems`. This is handled in `transferService` / the store action before removing the player.

---

## 4. New Career Settings

At career creation (`NewCareerScreen`), add a "Recompensas por victoria" selector: 1 / 2 / 3 options. Default 3. Stored in `career.rewardChoices`.

---

## 5. Save Compatibility

`saveService` migration: when loading an old save, default `player.equipment` to `{ gloves: null, boots: null, pendant: null, bracelet: null }` and `career.inventory.equipmentItems` to `[]` and `career.rewardChoices` to `3`.

---

---

## 8. Extended Standings Screen

### 8.1 Overview

`StandingsScreen` currently shows only the user's league table. It will be extended with a tab bar at the top to switch between three views:

- **Mi Liga** — the existing league table (current behaviour, unchanged)
- **Copa** — the current cup bracket / state
- **Otras Ligas** — standings of every external league tracked in `career.allLeagueSeasons`

### 8.2 Tab Bar

Simple horizontal pill tabs at the top of the main content area (not the global nav). Tabs are only shown if the relevant data exists: "Copa" tab is hidden if `career.cup === null`; "Otras Ligas" tab is hidden if `career.allLeagueSeasons` is empty.

### 8.3 Copa Tab

Shows the cup bracket round by round. For each `CupRound`:
- Round name (e.g. "Cuartos de Final") as a section header
- List of matches: `HomeTeam X – Y AwayTeam` (result if played, "vs" if pending)
- The user's team row is highlighted in blue (same style as the league table)
- Current round is expanded by default; past rounds are collapsed (expandable)

If the cup is finished, show the winner prominently at the top ("Campeón: [nombre]").

### 8.4 Otras Ligas Tab

For each external league in `career.allLeagueSeasons`, show:
- League name as a section header (look up from `src/data/leagues.ts` by `leagueId`)
- A compact standings table (same columns as the user's league: #, Equipo, P, V, E, D, GF, GC, DG, Pts)
- If the league is finished, show a "Finalizada" badge next to the header

The leagues are ordered by `level` (lowest level number first, i.e. top divisions first).

### 8.5 No New Data Needed

All data is already in the store: `career.season` (user's league), `career.cup`, `career.allLeagueSeasons`. No new types or services needed — only UI changes in `StandingsScreen.tsx`.

---

## 6. New Files

- `src/types/equipment.ts` — `EquipmentSlot`, `EquipmentItem`
- `src/types/reward.ts` — `MatchRewardType`, `MatchReward`
- `src/services/rewardService.ts` — `generateMatchRewards`, `calcMatchDifficulty`
- `src/services/equipmentService.ts` — `getEffectiveStats`, `equipItem`, `unequipItem`
- `src/components/MatchRewardModal.tsx` — reward choice UI
- `src/components/EquipmentPanel.tsx` — 4-slot equipment UI for PlayerDetailScreen

## 7. Modified Files

- `src/types/player.ts` — add `equipment` field
- `src/types/inventory.ts` — add `equipmentItems` to `ClubInventory`
- `src/types/career.ts` — add `rewardChoices`
- `src/store/careerStore.ts` — add `pendingRewards`, `claimMatchReward`, update `commitLiveMatch`/`simulateMatch` to set pending rewards on win
- `src/services/formationService.ts` — use `getEffectiveStats` in `buildTeamSnapshot`
- `src/screens/PlayerDetailScreen.tsx` — use `getEffectiveStats` for displayed stats (not `getPlayerStatsSummary`)
- `src/screens/MatchScreen.tsx` — show `MatchRewardModal` on win
- `src/screens/PlayerDetailScreen.tsx` — add `EquipmentPanel`
- `src/screens/NewCareerScreen.tsx` — add `rewardChoices` selector
- `src/services/saveService.ts` — migration for old saves
- `src/screens/StandingsScreen.tsx` — add tab bar, Copa view, Otras Ligas view
