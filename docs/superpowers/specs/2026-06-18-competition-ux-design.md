# Competition UX — Design Spec
**Date:** 2026-06-18  
**Status:** Approved

## Overview

Five improvements to the competition-related UI. Promotion/relegation logic already exists in `promotionService.ts` and is correctly called in `closeSeason()` — no backend changes needed there. All changes are UI and data-plumbing.

---

## A. SideNavigation — Rename "Tabla" to "Clasificación"

**File:** `src/components/SideNavigation.tsx`

Change the label for the `standings` screen from `'Tabla'` to `'Clasificación'`.

---

## B. Calendar — Cup matches + visual distinction

### Problem
`CalendarScreen` passes only `career.season.matches` (league matches) to `CalendarMonth` and the day-detail panel. Cup matches live in `career.cup.rounds[].matches` and are invisible everywhere.

### Solution

**Data plumbing — `CalendarScreen`:**
- Compute `allMatches` by merging league matches and all cup round matches:
  ```ts
  const cupMatches = career.cup?.rounds.flatMap(r => r.matches) ?? []
  const allMatches = [...career.season.matches, ...cupMatches]
  ```
- Pass `allMatches` to both `CalendarMonth` and `DayDetailPanel`.

**Visual distinction — `CalendarMonth`:**
The component already tracks `{ user: boolean; other: boolean }` per date. Extend to:
```ts
{ user: boolean; userCup: boolean; other: boolean }
```
- `user`: user has a **league** match on this date
- `userCup`: user has a **cup** match on this date (check `match.type === 'cup'`)
- Priority order for cell style: selected > userCup > user > today > default

Cup cell style: `bg-yellow-900/60` background + `emoji_events` (trophy) icon instead of `sports_soccer`. Bottom label: `'Copa'` instead of `'Tu partido'`.

If a day has both a league and cup match for the user, cup takes visual priority (rarer, more special).

**Day detail panel:**
- The `matchLabel()` function already returns the cup round name or league name.
- Add a colored badge next to the label: yellow for cup, blue for league.
- Show both matches if the user has both on the same day (league + cup on same day is theoretically possible).

---

## C. Home Menu — Competition label on league matches

**File:** `src/screens/CareerHomeScreen.tsx`  
**Component:** `NextMatchSection`

Currently the "Copa · {round}" badge only renders for `isCupMatch`. Change to always render a competition badge:

- Cup: yellow — `Copa · {match.cupRound}` (existing behavior)
- League: blue — `{leagueName} · J{match.round}`

The league name comes from `leagues.find(l => l.id === match.leagueId)?.name`. Import `leagues` from `../data/leagues`.

The badge sits in the same `absolute -top-2 left-3` position as today.

---

## D. Season-end announcement overlay

### When
`SeasonReviewScreen` is navigated to after `closeSeason()` runs. The `career.lastSeasonReview.userOutcome` field holds `'promoted' | 'relegated' | 'stayed'`, and `career.lastSeasonReview` also tells us if the user was league champion (finalPosition === 1).

### UI
An overlay `div` with `position: fixed, inset: 0, z-50` renders on top of the season review screen for ~3.5 seconds, then fades out revealing the review. Controlled by local state `showReveal` (starts true, set to false after timeout).

Four variants, checked in priority order:

| Priority | Condition | Background | Icon | Text | Duration |
|---|---|---|---|---|---|
| 1 | `finalPosition === 1` | `bg-yellow-900` gradient | `emoji_events` | `¡CAMPEÓN!` + league name | 3.5s |
| 2 | `userOutcome === 'promoted'` | `bg-green-900` gradient | `arrow_upward` | `¡ASCENSO!` + target league name | 3.5s |
| 3 | `userOutcome === 'relegated'` | `bg-red-900` gradient | `arrow_downward` | `DESCENSO` + target league name | 3.5s |
| 4 | `userOutcome === 'stayed'` | `bg-gray-800` gradient | `remove` | `PERMANENCIA` | 2s |

A team can be both champion (#1) AND promoted (e.g. Segunda División winner) — priority 1 takes precedence and shows the champion overlay. The target league name for promotion/relegation comes from `leagues.find(l => l.id === promotionTo/relegationTo)?.name`.

The "stayed" variant still shows briefly so the user knows the season ended cleanly.

### Sound
Use the Web Audio API (`AudioContext`) to synthesize a short tone — no external audio files needed:
- Champion/Promoted: ascending major arpeggio (C4→E4→G4→C5), 0.8s
- Relegated: descending minor phrase (C4→Bb3→Ab3→G3), 0.8s
- Stayed: single neutral tone (E4, 0.4s)

A `playOutcomeSound(outcome)` utility in `src/services/soundService.ts`.

The sound plays once when the overlay mounts (`useEffect` with empty deps).

---

## E. Standings — Multi-competition view

**File:** `src/screens/StandingsScreen.tsx`

### Tab bar
Three tabs rendered at the top, below the TopNavigation:

1. **User's league** (e.g. "Primera División") — default selected
2. **Other league(s)** — one tab per league in `leagues` that is not the user's current league (e.g. "Segunda División"). Data from `career.allLeagueSeasons[leagueId].standings`.
3. **Copa** — shows cup bracket, not standings table

Tab selection via `useState<string>(career.season.leagueId)` for league tabs, or `'cup'` for the cup tab.

### League tab content
Existing standings table, unchanged. For other leagues, read standings from `career.allLeagueSeasons[leagueId]?.standings`. If empty, show "Sin datos disponibles".

Highlight the user's team row in all tabs (they may appear in the other league after promotion/relegation from previous season — but during active season they're only in their current league, so just highlight by `teamId === career.teamId` and show differently if they're not present in that league).

### Copa tab content
Show a read-only bracket of all rounds in `career.cup.rounds[]`. For each round:
- Round name header (e.g. "Octavos de Final")
- List of matches with home/away team names, score if played, "vs" if not yet played
- Highlight matches involving the user's team

No standing rows needed — the cup is knockout format.

If `career.cup` is null (no cup this season), show "Copa no disponible".

---

## Files to create/modify

| File | Change |
|---|---|
| `src/components/SideNavigation.tsx` | Label "Tabla" → "Clasificación" |
| `src/components/CalendarMonth.tsx` | Track cup matches separately, different cell style |
| `src/screens/CalendarScreen.tsx` | Merge cup + league matches before passing to components |
| `src/screens/CareerHomeScreen.tsx` | Always show competition badge on next match |
| `src/screens/SeasonReviewScreen.tsx` | Add reveal overlay + sound trigger |
| `src/screens/StandingsScreen.tsx` | Add tab bar + cup bracket view |
| `src/services/soundService.ts` | New file: `playOutcomeSound()` using Web Audio API |

---

## Out of scope

- No changes to `promotionService.ts`, `seasonService.ts`, or the career store promotion logic.
- No new audio files — Web Audio API synthesis only.
- No changes to the match simulator or any match-related logic.
