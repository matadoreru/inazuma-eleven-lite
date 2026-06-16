# Custom Club Creation — Design Spec
**Date:** 2026-06-17  
**Status:** Approved

---

## Overview

Add the option to create a custom club when starting a new career in Inazuma Eleven Lite. The player can choose a name, emblem, initial strength, and starting league. The squad is assembled automatically from the free agent pool.

---

## Flow

The new career wizard expands from 4 steps to 7 steps for the "custom club" path, or stays at 5 steps for the "existing team" path.

```
Step 0  Entrenador        (unchanged)
Step 1  Modo              NEW — choose: existing team or custom club
Step 2a Equipo            (existing path, unchanged)
Step 2b Nombre            NEW — club name input
Step 3b Emblema           NEW — badge picker + custom upload
Step 4b Fuerza + Liga     NEW — strength tier + league selector
Step 5  Dificultad        (unchanged, step index shifts for custom path)
Step 6  Confirmar         (adapted to show custom club data)
```

The `StepperBar` receives a dynamic `steps: string[]` based on the chosen mode. Steps 2b/3b/4b are skipped entirely for the existing team path (the step index jumps from 2a to Dificultad).

---

## Step 1 — Mode Selection

- Two large selectable cards, same visual style as the difficulty preset cards.
- Cards: "Equipo existente" (icon: `sports_soccer`) and "Crear club propio" (icon: `add_circle`).
- Clicking a card selects the mode; the user confirms with "Continuar".
- No default selection — Continuar is disabled until a mode is chosen.

---

## Step 2b — Club Name

Layout: `max-w-lg`, centered, matching Step 0 (Entrenador).

- Text input, `maxLength={25}`, placeholder "Nombre del club..."
- Character counter shown below-right: `{n}/25`, turns red at limit.
- "Continuar" disabled if input is empty or whitespace-only.
- Displayed everywhere the team name appears (Home, calendar, standings, etc.).

**Limit:** 25 characters.

---

## Step 3b — Emblem Picker

Layout: two-column split.

**Left column:** Scrollable grid of preset badges. These are the existing `/public/teams/*.webp|png` images. Each rendered as a clickable square with a highlight border when selected.

**Right column:** Large preview using `TeamBadgeImage size="xl"` showing the selected badge above the club name.

**Bottom:** "Subir imagen propia" button — hidden `<input type="file" accept="image/*">`. On file selection, read via `FileReader.readAsDataURL` and store as a base64 data URL. The upload replaces the preset selection.

**Default:** If the user skips this step without choosing, `badgeUrl` defaults to `/teams/default_team_icon.png` and `badgeIsCustom = false`.

The `TeamBadgeImage` component already handles arbitrary URLs (including base64 data URLs) via its `src` prop — no changes needed to it.

---

## Step 4b — Strength + League

Layout: `max-w-lg`, two stacked sections.

### Strength tier

Four selectable cards in a 2×2 grid:

| Tier | Label | description | tier | reputation |
|------|-------|-------------|------|-----------|
| `weak` | Débil | Jugadores de baja media | 4 | 30 |
| `normal` | Normal | Plantilla equilibrada | 3 | 50 |
| `strong` | Fuerte | Jugadores de alta media | 2 | 65 |
| `very_strong` | Muy fuerte | Los mejores agentes libres | 1 | 80 |

### League selector

Two horizontal cards:
- "Segunda División" — nivel 2 (default)
- "Primera División" — nivel 1

Both selections required to proceed. Default: no selection (Continuar disabled).

---

## Step 6 — Confirm (custom club path)

Same layout as existing confirm screen, with the team section replaced:

- **Manager card** — avatar + name (unchanged)
- **Club card** — badge (large) + club name + league label + strength tier label
- **Squad card** — list of assigned starting players (same row format as current confirm screen: sprite, name, position, stats, media)
- **Difficulty card** — (unchanged)

Buttons: "Atrás" and "Crear Carrera" (green).

---

## Data Model

### New type `CustomClubConfig` — `src/types/team.ts`

```ts
export interface CustomClubConfig {
  name: string
  badgeUrl: string          // preset path or base64 data URL
  badgeIsCustom: boolean
  strengthTier: 'weak' | 'normal' | 'strong' | 'very_strong'
  leagueId: string
}
```

### Runtime `Team` generation

The custom team is built in memory at career creation time. It is never written to `src/data/teams.ts`.

- `id`: `Math.max(...existingTeams.map(t => t.id)) + 1` (avoids collision)
- `name`: from `CustomClubConfig.name`
- `badgeUrl`: from `CustomClubConfig.badgeUrl`
- `tier` / `reputation`: derived from `strengthTier` (see table above)
- `budget`: `300_000` (same as a mid-table team, scaled by difficulty `budgetMultiplier` in `createCareer`)
- `leagueId`: from `CustomClubConfig.leagueId`
- `formation`: first formation with `GK:1, DF:4, MD:4, FW:2` found in `formations.ts` (no hardcoded id)
- `lineup` / `playerIds`: built by `assignSquadFromFreeAgents`
- `captainId`: the player with the highest media in the assigned squad
- `scoutLevel` / `facilitiesLevel`: derived from reputation (same formula as `startNewCareer` already applies)

### `careerStore.startNewCareer` signature extension

```ts
startNewCareer(
  managerName: string,
  teamId: number,
  managerAvatar?: string,
  difficulty?: DifficultySettings,
  customTeam?: { team: Team; squadPlayerIds: number[] }
): void
```

If `customTeam` is provided:
1. Inject `customTeam.team` into `teamsCopy`.
2. Set `teamId` of each player in `squadPlayerIds` to `customTeam.team.id`.
3. Call `createCareer(managerName, customTeam.team.id, ...)` as normal.

No changes to `Career` type, `createCareer` internals, or any in-game screen.

---

## New Service: `src/services/customClubService.ts`

### `buildCustomTeam(config, existingTeams, assignedPlayerIds, lineupSlots): Team`

Assembles the `Team` object from config + generated squad.

### `assignSquadFromFreeAgents(config, players): { playerIds: number[]; lineup: LineupSlot[] }`

```
1. Filter: players with teamId === 0
2. Compute media for each using getPlayerStatsSummary
3. Sort by media ascending
4. Partition by strengthTier:
   - weak:        bottom quartile (lowest 25%)
   - normal:      middle 50% (percentile 25–75)
   - strong:      top 50%, excluding very top
   - very_strong: top quartile (highest 25%)
   If a partition has fewer than 16 players, expand toward adjacent range
5. Select positionally:
   - Target: 1 GK, 4 DF, 4 MD, 2 FW starters (11 total)
   - Subs: up to 5 more, any position
   - Within each position, pick highest-media available
   - If a position slot can't be filled from partition, take nearest available
6. Build LineupSlot[] with isStarter flags
7. Assign jerseys via autoAssignJerseys (existing jerseyService)
```

No player is ever removed from their existing team. Only `teamId === 0` players are touched.

---

## Free Agent Pool Expansion (Prerequisite)

The current `src/data/players.ts` has 17 free agents (TOT media 85–97 — too narrow for meaningful strength tiers).

The reference database at `/home/eru/Documents/Projects/inazuma/inazuma-eleven-universe/content/database/players/players.json` has 1077 players. A migration script (`scripts/import-free-agents.ts`) will:

1. Load `players.json`.
2. Load existing player IDs from `players.ts`.
3. Filter out players already imported (by `id`).
4. Map fields:
   - `name_romaji` → `nameRomaji`
   - `position: 'MF'` → `position: 'MD'`
   - `position_alternative` → `positionAlt`
   - `sprite_url` → `spriteUrl`
   - `supertechniques` → `techniques`
   - `TOT` in stats stays as-is (it's the raw sum; the game uses it as a stored stat alongside the individual stats — `getPlayerStatsSummary` computes media = sum of 6 stats / 7, ignoring `TOT`)
   - Add: `teamId: 0`, `stamina: 100`, `morale: 100`, `isInjured: false`, `injuryDaysRemaining: 0`, `isSuspended: false`, `suspensionMatches: 0`, `jerseyNumber: 0`, `career.contractStatus: 'free'`, `career.experience: 0`, `career.trainingProgress: 0`, `career.trainingSessionsThisWeek: 0`
5. Append to `players.ts`.

The strength tier logic operates on `media = (POT + CON + TEC + PRE + FIS + AGI + INT) / 7`, not the stored `TOT` field.

---

## Files Changed

| File | Change |
|------|--------|
| `src/screens/NewCareerScreen.tsx` | Add steps 1, 2b, 3b, 4b; adapt step numbering and confirm screen |
| `src/store/careerStore.ts` | Extend `startNewCareer` with optional `customTeam` param |
| `src/services/customClubService.ts` | **New** — `buildCustomTeam`, `assignSquadFromFreeAgents` |
| `src/types/team.ts` | Add `CustomClubConfig` interface |
| `src/data/players.ts` | **New free agents** added via import script |
| `scripts/import-free-agents.ts` | **New** — one-shot migration script |

No changes to: `careerService.ts`, `types/career.ts`, `TeamBadgeImage.tsx`, any in-game screen.

---

## Constraints

- Club name: max 25 characters, no empty/whitespace-only.
- Custom badge: base64 stored in save (localStorage). Large images may increase save size — no size limit enforced but `FileReader` reads whatever the user picks.
- The custom team behaves identically to any seed team once the career starts: it participates in the chosen league, appears in standings, calendar, transfers, and club screens without any special-casing.
- Jersey numbers auto-assigned via existing `jerseyService.autoAssignJerseys`.
- Formation default: 4-4-2 (id `103`), already in `formations.ts`.
