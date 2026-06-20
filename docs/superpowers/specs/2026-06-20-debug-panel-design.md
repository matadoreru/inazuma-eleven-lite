# Debug Panel — Design Spec
**Date:** 2026-06-20

## Context

The game already has a developer mode flag (`isDevModeActive()` / `DEV_MODE_KEY` in `profileService.ts`). Dev mode unlocks the `DevMenuScreen` (data editor — players, teams, leagues, profiles) from the main menu. During a career session, dev mode currently shows three small cheat buttons inside the Settings drawer.

This spec replaces those drawer buttons with a dedicated **Debug Panel screen**, accessible via a new nav tab that is only visible when dev mode is active.

---

## Goal

A full-screen debug panel reachable from the in-game nav bar during an active career. It groups cheat/debug actions into sections, provides instant feedback, and covers the operations most needed during development and QA.

---

## Architecture

### New screen: `DevDebugScreen`

`src/screens/DevDebugScreen.tsx`

A scrollable screen wrapped in `GameLayout`. No routing or URL changes — it uses the existing `navigate()` store action and the store's `screen` discriminated union.

All mutations happen synchronously via `useCareerStore.getState()` + `useCareerStore.setState()` (same pattern as the current cheat buttons in SettingsDrawer).

### Changes to existing files

| File | Change |
|---|---|
| `src/components/GameLayout.tsx` | Conditionally append a "Debug" tab to `NAV_ITEMS` when `isDevModeActive()` |
| `src/App.tsx` | Add `'debug'` to the `Screen` union; import and render `DevDebugScreen` |
| `src/components/SettingsDrawer.tsx` | Remove the existing 3-button cheat section (replaced by this screen) |

---

## Screen Layout

Header (identical style to other screens — dark top bar):
```
🐛 Panel de Debug    [chip: "Modo desarrollador activo"]
```

Below the header, a scrollable list of **sections**. Each section has:
- A coloured label row (section title + icon)
- A grid of compact action buttons (2 columns)

Feedback: a floating toast chip (`✓ [acción]`) that auto-dismisses after 1.5 s, positioned at the bottom of the screen above the nav. No confirmation modals.

---

## Sections & Actions

### 1. Economía
Modifies `team.budget` for the user's team.

| Button | Delta |
|---|---|
| +100.000€ | +100 000 |
| +500.000€ | +500 000 |
| −100.000€ | −100 000 (floor 0) |
| −500.000€ | −500 000 (floor 0) |

### 2. Club
Modifies `team.reputation` for the user's team (clamped 0–100).

| Button | Delta |
|---|---|
| +5 Reputación | +5 |
| +10 Reputación | +10 |
| −10 Reputación | −10 |

### 3. Plantilla
Operates on `players` array (only players in the user's team, i.e. `player.teamId === career.teamId`).

| Button | Effect |
|---|---|
| Energía completa | Set `player.career.stamina` to max (100) for all user players |
| Curar lesiones | Set `player.career.injuryCountdown` to 0 for all user players |
| +10 stats plantilla | Add +10 to each of the 7 base stats (POT, CON, TEC, PRE, FIS, AGI, INT), cap each at 99, recompute `TOT = Math.round(sum / 7)` |

### 4. Inventario
Adds a preset equipment item to `career.inventory.equipmentItems`.

| Button | Effect |
|---|---|
| Añadir objeto legendario | Push a `EquipmentItem` with slot `boots`, tier 3, rarity `legendary`, fixed stat bonuses (+5 POT/CON/TEC/PRE) and a unique id (`dev_item_${Date.now()}`) |

### 5. Liga
Changes `team.leagueId` and `team.tier` immediately. Since season scheduling is done at `startNewSeason()`, the change takes effect in the next season. A warning label explains this.

| Button | Effect |
|---|---|
| Ascender liga | Find `league.promotionTo` for the user's current league → set `team.leagueId = promotionTo`, `team.tier = tier - 1`; disabled if already top tier or no promotionTo |
| Descender liga | Find `league.relegationTo` for the user's current league → set `team.leagueId = relegationTo`, `team.tier = tier + 1`; disabled if already bottom tier or no relegationTo |

---

## Error / Edge Cases

- **No active career:** screen shows an empty state ("No hay carrera activa"). In practice the tab is only visible in-game so this is defensive only.
- **Budget floor:** budget never goes below 0.
- **Reputation clamp:** reputation clamped to [0, 100].
- **Stat cap:** each stat capped at 99 before computing TOT.
- **Liga buttons disabled:** if the current league has no `promotionTo` / `relegationTo` configured, the corresponding button is visually disabled.

---

## Cleanup

The three existing cheat buttons in `SettingsDrawer.tsx` (`cheatAddMoney`, `cheatAddReputation`, `cheatAddItem` + the `devMode` state + `CHEAT_ITEM` constant) are removed. The imports of `isDevModeActive` and `EquipmentItem` added in the previous session are also removed if no longer needed.

---

## Files Summary

```
new       src/screens/DevDebugScreen.tsx
modified  src/components/GameLayout.tsx    (conditional Debug tab)
modified  src/App.tsx                      (Screen union + render)
modified  src/components/SettingsDrawer.tsx (remove cheat section)
```

No new services, no new store actions, no new types required.
