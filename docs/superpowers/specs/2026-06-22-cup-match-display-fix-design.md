# Cup Match Display Fix — Design Spec
Date: 2026-06-22

## Context

The match simulation engine already handles cup knockout ties correctly:
`simulateCupTiebreak` always produces a winner (extra time → penalties if needed).
`commitMatchResult` stores total goals on the `Match` object and `getMatchWinner`
correctly reads the winner. The cup advancement logic is sound.

The bugs are entirely in the presentation layer: three UI components and one store
string all read `result.homeGoals` / `result.awayGoals` (regular-time only) without
accounting for `result.extraTime` and `result.penalties`.

---

## Files to change

| File | Change |
|------|--------|
| `src/screens/MatchScreen.tsx` | Score header + result label + penalty format |
| `src/screens/LiveMatchScreen.tsx` | Dynamic duration + ET/penalty pauses |
| `src/components/MatchResultCard.tsx` | Border color + penalty score in badge |
| `src/store/careerStore.ts` | Event-log title string in `commitMatchResult` |

---

## Section 1 — MatchScreen.tsx

### Score header
Show **total goals** (regular time + extra time) in the large score display:
```
totalHome = homeGoals + (extraTime?.homeGoals ?? 0)
totalAway = awayGoals + (extraTime?.awayGoals ?? 0)
```

When `penalties` exists, wrap the penalty scores in parentheses adjacent to each
team's total goal count:
```
(4)  1  –  1  (3)
```
Left parenthesis = home team penalties, right = away team penalties.

### VICTORIA / DERROTA / EMPATE label
Resolution hierarchy (stop at first match):
1. `result.penalties` → winner is `penalties.winnerId`
2. `result.extraTime` → compare total goals (reg + ET)
3. Default → compare regular-time goals (league matches, unchanged)

EMPATE is only possible for non-cup matches (league). A cup match will always
resolve to VICTORIA or DERROTA after this hierarchy.

### Round sub-label
When `lastMatch.type === 'cup'`, show `lastMatch.cupRound` (e.g. "Semifinal")
instead of "J0".

### AET badge
If `extraTime` exists (with or without penalties), show a small "A.E.T." badge
below the score, blue-toned, so the user understands the score includes extra time.
The penalty line `(4) pen. (3)` already conveys penalties when present.

---

## Section 2 — LiveMatchScreen.tsx

### Dynamic match duration
Compute `matchEndMinute` from the pre-calculated result:
```
matchEndMinute =
  result.penalties ? 122
  : result.extraTime ? 121
  : 90
```
Replace the hardcoded `MATCH_DURATION = 90` constant with this derived value.

### Extra-time pause (cup matches only)
Add state: `extraTimeDone: boolean` (mirrors existing `halftimeDone`).

Trigger when `currentMinute >= 90 && !extraTimeDone && pendingMatch.isCupMatch && result.extraTime`:
- Pause playback (`setIsPlaying(false)`)
- Set `extraTimeDone = true`
- Open the substitution/phase panel with `reason = 'extra_time'`

The sub panel already supports arbitrary `reason` values; add a new branch for
`'extra_time'` that shows a banner "¡Prórroga!" and a button "Continuar — 1ª parte de prórroga".
No substitutions are offered in this pause (or up to 1 additional sub can be allowed —
keep it simple: no subs in ET for now).

### Penalty-phase pause (optional, cup matches only)
After minute 120, if `result.penalties` exists, pause once with banner "¡Tanda de penaltis!"
and a "Ver penaltis" button. This reveals the `PENALTY_SHOOTOUT` event at minute 121.
Add state `penaltyPhaseDone: boolean` for symmetry.

### "Saltar al final" button
Jump to `matchEndMinute` instead of the hardcoded 90.

### ET_START / ET_END events
Already rendered as phase-separator dividers in the event log (same as `PHASE`).
No additional changes needed.

---

## Section 3 — MatchResultCard.tsx

### Border color
Determine result color using the same hierarchy as MatchScreen (penalties first,
then total goals, then regular-time goals).

### Penalty score in the badge
The existing `penalties` badge currently shows:
```
X – Y
```
Change to include team labels:
```
(4) 1–1 (3)
```
Where the numbers in parentheses are `penalties.homeScore` and `penalties.awayScore`,
flanking the regular-time (or total) goals score.

---

## Section 4 — careerStore.ts — commitMatchResult (cup branch)

The event-log title string currently:
```ts
const matchTitle = `${homeTeamName} ${result.homeGoals} - ${result.awayGoals} ${awayTeamName} (Copa)`
```

New logic:
```
if penalties:   "(4) 1-1 (3)"   → "(homeScore) totalHome - totalAway (awayScore)"
if extraTime:   "2-1 a.e.t."    → total goals + " a.e.t."
else:           "2-1"           → regular-time goals
```

---

## Out of scope
- No changes to simulation logic (`matchSimulator.ts`, `cupService.ts`)
- No changes to cup advancement / winner determination logic
- No substitutions during extra time in the live match (deferred)
