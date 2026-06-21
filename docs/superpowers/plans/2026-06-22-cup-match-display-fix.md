# Cup Match Display Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all presentation layers so cup matches decided by extra time or penalties show the correct score `(4) 1–1 (3)`, the correct VICTORIA/DERROTA label, an A.E.T. badge, and live extra-time/penalty phase pauses.

**Architecture:** Pure display-layer changes across 4 files. No simulation or cup-advancement logic is touched. `MatchScreen` and `MatchResultCard` gain a winner-determination hierarchy (penalties → total goals → regular-time goals). `LiveMatchScreen` gains a dynamic end minute and two phase-break overlays. `careerStore.commitMatchResult` gets an updated title string.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, Tailwind CSS

## Global Constraints
- Do not touch `matchSimulator.ts`, `cupService.ts`, or any cup-advancement logic
- `MatchResult.homeGoals` / `awayGoals` = regular-time goals only; total = reg + `extraTime.homeGoals` / `awayGoals`
- Penalty display format: `(homeScore) totalHome–totalAway (awayScore)` (parentheses around penalty scores)
- A.E.T. badge appears whenever `extraTime` is present (regardless of whether penalties followed)
- No substitutions offered during ET or penalty-phase pauses in LiveMatchScreen
- All existing tests must continue to pass: `npm test`

---

## File Map

| File | Change |
|------|--------|
| `src/store/careerStore.ts` | Cup match title string in `commitMatchResult` (cup branch, ~line 487) |
| `src/screens/MatchScreen.tsx` | Score header, result label, A.E.T. badge, round sub-label |
| `src/components/MatchResultCard.tsx` | Border color determination, penalty badge format |
| `src/screens/LiveMatchScreen.tsx` | Dynamic end minute, ET phase overlay, penalty phase overlay |

---

### Task 1: Fix cup match title string in careerStore

**Files:**
- Modify: `src/store/careerStore.ts` (~line 487 in `commitMatchResult`, cup branch)

**Context:** In the cup branch of `commitMatchResult`, the event-log title is built from `result.homeGoals` and `result.awayGoals` (regular time only). When the match went to ET or penalties the title shows the draw score rather than the full outcome.

**Interfaces:**
- Produces: `matchTitle` string used in `addEvent(...)` call; format changes based on `result.penalties` / `result.extraTime`

- [ ] **Step 1: Locate the line to change**

Open `src/store/careerStore.ts` and find the cup branch of `commitMatchResult`. Around line 485–488 you will see:
```ts
const homeTeamName = teams.find((t) => t.id === match.homeTeamId)?.name ?? 'Local'
const awayTeamName = teams.find((t) => t.id === match.awayTeamId)?.name ?? 'Visitante'
const matchTitle = `${homeTeamName} ${result.homeGoals} - ${result.awayGoals} ${awayTeamName} (Copa)`
```

- [ ] **Step 2: Replace the three lines with the new implementation**

```ts
const homeTeamName = teams.find((t) => t.id === match.homeTeamId)?.name ?? 'Local'
const awayTeamName = teams.find((t) => t.id === match.awayTeamId)?.name ?? 'Visitante'
const totalHome = result.homeGoals + (result.extraTime?.homeGoals ?? 0)
const totalAway = result.awayGoals + (result.extraTime?.awayGoals ?? 0)
const scoreStr = result.penalties
  ? `(${result.penalties.homeScore}) ${totalHome}-${totalAway} (${result.penalties.awayScore})`
  : result.extraTime
    ? `${totalHome}-${totalAway} a.e.t.`
    : `${totalHome}-${totalAway}`
const matchTitle = `${homeTeamName} ${scoreStr} ${awayTeamName} (Copa)`
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/store/careerStore.ts
git commit -m "fix: cup match event title shows full score (ET + penalties)"
```

---

### Task 2: Fix MatchScreen score header and result label

**Files:**
- Modify: `src/screens/MatchScreen.tsx`

**Context:** Lines 358–412 compute and display the post-match score and label. `homeGoals`/`awayGoals` are destructured from `lastMatchResult` (regular time only). The header needs total goals and `(pen)` parentheses; the label needs to consult `penalties.winnerId` or total goals.

**Interfaces:**
- Consumes: `lastMatchResult` (`MatchResult`) — fields `homeGoals`, `awayGoals`, `extraTime`, `penalties`
- Consumes: `lastMatch` (`Match`) — fields `type`, `cupRound`, `round`, `homeTeamId`
- Consumes: `career.teamId`

- [ ] **Step 1: Replace the score / label computation block**

Find lines 358–367 (from `const { homeGoals, awayGoals } = lastMatchResult` to the last `if (userGoals < oppGoals)` line) and replace with:

```tsx
const { homeGoals, awayGoals, extraTime, penalties } = lastMatchResult
const totalHomeGoals = homeGoals + (extraTime?.homeGoals ?? 0)
const totalAwayGoals = awayGoals + (extraTime?.awayGoals ?? 0)
const isHome = lastMatch?.homeTeamId === career.teamId

let resultLabel = 'EMPATE'
let resultColor = 'text-yellow-400'
let resultBg    = 'bg-yellow-900/20'

if (penalties) {
  const userWon = penalties.winnerId === career.teamId
  resultLabel = userWon ? 'VICTORIA' : 'DERROTA'
  resultColor = userWon ? 'text-green-400' : 'text-red-400'
  resultBg    = userWon ? 'bg-green-900/20' : 'bg-red-900/20'
} else {
  const userGoals = isHome ? totalHomeGoals : totalAwayGoals
  const oppGoals  = isHome ? totalAwayGoals : totalHomeGoals
  if (userGoals > oppGoals) { resultLabel = 'VICTORIA'; resultColor = 'text-green-400'; resultBg = 'bg-green-900/20' }
  if (userGoals < oppGoals) { resultLabel = 'DERROTA';  resultColor = 'text-red-400';   resultBg = 'bg-red-900/20'  }
}
```

- [ ] **Step 2: Replace the header score display block**

Find the `<div className="flex items-center gap-2 shrink-0">` block (lines ~401–413) containing the two goal `<span>` elements and the middle column, and replace it entirely with:

```tsx
<div className="flex items-center gap-2 shrink-0">
  <div className="flex items-center gap-1.5">
    {penalties && (
      <span className="text-gray-400 text-lg font-bold tabular-nums">({penalties.homeScore})</span>
    )}
    <span className="text-white text-3xl font-black tabular-nums">{totalHomeGoals}</span>
  </div>
  <div className="flex flex-col items-center">
    <span className={`text-[0.5625rem] font-extrabold tracking-widest leading-none mb-0.5 ${resultColor}`}>
      {resultLabel}
    </span>
    <span className="text-gray-600 text-xl leading-none font-light">–</span>
    {lastMatch && (
      <span className="text-gray-600 text-[0.5rem] leading-none mt-0.5 tabular-nums">
        {lastMatch.type === 'cup' ? (lastMatch.cupRound ?? `J${lastMatch.round}`) : `J${lastMatch.round}`}
      </span>
    )}
  </div>
  <div className="flex items-center gap-1.5">
    <span className="text-white text-3xl font-black tabular-nums">{totalAwayGoals}</span>
    {penalties && (
      <span className="text-gray-400 text-lg font-bold tabular-nums">({penalties.awayScore})</span>
    )}
  </div>
</div>
```

- [ ] **Step 3: Add A.E.T. badge below the score row**

Immediately after the closing `</div>` of the score row (still inside the header `<div className={...px-4 py-3...}>`), add:

```tsx
{extraTime && (
  <div className="flex justify-center mt-1">
    <span className="text-[0.5rem] font-bold text-blue-400 bg-blue-900/20 border border-blue-700/30 rounded px-2 py-0.5 uppercase tracking-wider">
      A.E.T.
    </span>
  </div>
)}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/MatchScreen.tsx
git commit -m "fix: MatchScreen shows total goals, correct result label, and A.E.T. badge for cup matches"
```

---

### Task 3: Fix MatchResultCard border color and penalty badge

**Files:**
- Modify: `src/components/MatchResultCard.tsx`

**Context:** Lines 28–41 compute `resultColor` / `borderColor` from regular-time goals only. The penalty badge (lines 71–80) shows `X – Y` without the parenthesis format.

**Interfaces:**
- Consumes: `match.result` — fields `homeGoals`, `awayGoals`, `extraTime`, `penalties`
- Consumes: prop `isUserTeam: boolean` — `true` means the user team is HOME

- [ ] **Step 1: Replace the color-determination block**

Find lines 28–41 (from `const { homeGoals, awayGoals, extraTime, penalties } = match.result` to the last `if (userGoals < oppGoals)` statement) and replace with:

```tsx
const { homeGoals, awayGoals, extraTime, penalties } = match.result
const isHome = isUserTeam
const userTeamId = isHome ? match.homeTeamId : match.awayTeamId

let resultColor = 'text-gray-400'
let borderColor = 'border-gold-600/20'

if (penalties) {
  const userWon = penalties.winnerId === userTeamId
  resultColor = userWon ? 'text-green-400' : 'text-red-400'
  borderColor = userWon ? 'border-green-600' : 'border-red-600'
} else {
  const totalHome = homeGoals + (extraTime?.homeGoals ?? 0)
  const totalAway = awayGoals + (extraTime?.awayGoals ?? 0)
  const userGoals = isHome ? totalHome : totalAway
  const oppGoals  = isHome ? totalAway : totalHome
  if (userGoals > oppGoals) { resultColor = 'text-green-400'; borderColor = 'border-green-600' }
  if (userGoals < oppGoals) { resultColor = 'text-red-400';   borderColor = 'border-red-600' }
}
```

- [ ] **Step 2: Update the penalty badge to show `(homeScore) reg–reg (awayScore)`**

Find the `{penalties && (...)}` block (lines ~71–80) and replace with:

```tsx
{penalties && (
  <div className="mt-2 text-center">
    <span className="text-xs font-bold text-orange-400 bg-orange-900/30 border border-orange-700/40 rounded px-2 py-0.5">
      PENALTIS
    </span>
    <p className="text-gray-400 text-xs mt-1">
      ({penalties.homeScore}) {homeGoals}–{awayGoals} ({penalties.awayScore})
    </p>
  </div>
)}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/MatchResultCard.tsx
git commit -m "fix: MatchResultCard border color and penalty badge use total goals / penalties winner"
```

---

### Task 4: Fix LiveMatchScreen — dynamic duration and ET/penalty phase overlays

**Files:**
- Modify: `src/screens/LiveMatchScreen.tsx`

**Context:**
- `const MATCH_DURATION = 90` is hardcoded; cup events at minutes 91–122 are never played
- `isFinished = currentMinute >= MATCH_DURATION` stops the ticker too early
- No pause exists for the transition to extra time or penalties

**Interfaces:**
- Consumes: `pendingMatch.isCupMatch: boolean | undefined`
- Consumes: `result.extraTime: { homeGoals; awayGoals } | undefined`
- Consumes: `result.penalties: { homeScore; awayScore; winnerId } | undefined`

- [ ] **Step 1: Add new state variables after the existing state declarations**

Find the block of `useState` declarations (lines ~253–263) and add three new ones after `matchExclusions`:

```tsx
const [extraTimeDone, setExtraTimeDone]       = useState(false)
const [penaltyPhaseDone, setPenaltyPhaseDone] = useState(false)
const [phaseOverlay, setPhaseOverlay]         = useState<{
  title: string; subtitle: string; buttonText: string
} | null>(null)
```

- [ ] **Step 2: Replace the hardcoded MATCH_DURATION and isFinished with dynamic values**

Remove the line `const MATCH_DURATION = 90` (line 15 at the module top).

After the existing lines:
```tsx
const result   = pendingMatch?.result
const events   = result?.events ?? []
const isFinished = currentMinute >= MATCH_DURATION
```

Replace them with:
```tsx
const result        = pendingMatch?.result
const events        = result?.events ?? []
const isCupMatch    = pendingMatch?.isCupMatch ?? false
const matchEndMinute = isCupMatch && result?.penalties ? 122
  : isCupMatch && result?.extraTime ? 121
  : 90
const isFinished = currentMinute >= matchEndMinute
```

- [ ] **Step 3: Update the tick useEffect to use matchEndMinute**

Find the tick `useEffect` (lines ~273–279):
```tsx
useEffect(() => {
  if (!isPlaying || isFinished) return
  const id = setInterval(() => {
    setCurrentMinute((m) => (m >= MATCH_DURATION ? m : m + 1))
  }, SPEED_INTERVAL[speed])
  return () => clearInterval(id)
}, [isPlaying, speed, isFinished])
```

Replace with:
```tsx
useEffect(() => {
  if (!isPlaying || isFinished) return
  const id = setInterval(() => {
    setCurrentMinute((m) => (m >= matchEndMinute ? m : m + 1))
  }, SPEED_INTERVAL[speed])
  return () => clearInterval(id)
}, [isPlaying, speed, isFinished, matchEndMinute])
```

- [ ] **Step 4: Update the halftime useEffect to use matchEndMinute**

Find the halftime detection `useEffect` (lines ~282–290):
```tsx
useEffect(() => {
  if (currentMinute >= 45 && currentMinute < MATCH_DURATION && !halftimeDone) {
```

Replace `MATCH_DURATION` with `matchEndMinute` and add it to the dependency array:
```tsx
useEffect(() => {
  if (currentMinute >= 45 && currentMinute < matchEndMinute && !halftimeDone) {
    setIsPlaying(false)
    setHalftimeDone(true)
    setSubReason('halftime')
    setInjuredForSub(undefined)
    setSubPanelOpen(true)
  }
}, [currentMinute, halftimeDone, matchEndMinute])
```

- [ ] **Step 5: Add extra-time phase overlay useEffect**

Add a new `useEffect` after the halftime one:

```tsx
useEffect(() => {
  if (!isCupMatch || !result?.extraTime) return
  if (currentMinute >= 90 && !extraTimeDone) {
    setIsPlaying(false)
    setExtraTimeDone(true)
    setPhaseOverlay({
      title: '¡Se va a prórroga!',
      subtitle: 'El partido está empatado. Se jugarán dos tiempos de 15 minutos.',
      buttonText: 'Continuar — Prórroga',
    })
  }
}, [currentMinute, extraTimeDone, isCupMatch, result?.extraTime])
```

- [ ] **Step 6: Add penalty-phase overlay useEffect**

Add another `useEffect` after the ET one:

```tsx
useEffect(() => {
  if (!isCupMatch || !result?.penalties) return
  if (currentMinute >= 120 && !penaltyPhaseDone) {
    setIsPlaying(false)
    setPenaltyPhaseDone(true)
    setPhaseOverlay({
      title: '¡Tanda de penaltis!',
      subtitle: 'El partido sigue empatado. Se decide desde el punto de penalty.',
      buttonText: 'Ver penaltis',
    })
  }
}, [currentMinute, penaltyPhaseDone, isCupMatch, result?.penalties])
```

- [ ] **Step 7: Update handleSkip to clear ET and penalty states**

Find `handleSkip` (lines ~359–364):
```tsx
function handleSkip() {
  setCurrentMinute(MATCH_DURATION)
  setIsPlaying(false)
  setHalftimeDone(true)
  setSubPanelOpen(false)
}
```

Replace with:
```tsx
function handleSkip() {
  setCurrentMinute(matchEndMinute)
  setIsPlaying(false)
  setHalftimeDone(true)
  setExtraTimeDone(true)
  setPenaltyPhaseDone(true)
  setPhaseOverlay(null)
  setSubPanelOpen(false)
}
```

- [ ] **Step 8: Add the phase overlay JSX**

Find the substitution overlay at the bottom of the returned JSX (the `{subPanelOpen && userTeam && (...)}` block). Add a new overlay **above** it (still inside the outermost relative div):

```tsx
{/* Phase-break overlay for ET and penalty transitions in cup matches */}
{phaseOverlay && (
  <div className="fixed inset-0 z-[100] bg-dark-950/95 flex flex-col items-center justify-center gap-6 px-6">
    <span className="material-icons text-yellow-400 leading-none" style={{ fontSize: 64 }}>
      more_time
    </span>
    <h2 className="text-white text-2xl font-black text-center">{phaseOverlay.title}</h2>
    <p className="text-gray-400 text-sm text-center">{phaseOverlay.subtitle}</p>
    <button
      onClick={() => { setPhaseOverlay(null); setIsPlaying(true) }}
      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-base transition-colors"
    >
      <Icon name="play_arrow" size="sm" />
      {phaseOverlay.buttonText}
    </button>
  </div>
)}
```

- [ ] **Step 9: Run tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/screens/LiveMatchScreen.tsx
git commit -m "fix: LiveMatchScreen extends to ET and penalties for cup matches with phase-break overlays"
```

---

## Manual Verification Checklist

After all tasks are committed, play a cup match and verify each scenario:

**Scenario A — Cup match decided in regular time (no draw)**
- [ ] MatchScreen shows regular goals, VICTORIA/DERROTA label, round = cupRound name (e.g. "Previa"), no A.E.T. badge
- [ ] MatchResultCard shows green/red border
- [ ] LiveMatchScreen plays 0–90', then "Ver resultado" button appears

**Scenario B — Cup match goes to extra time (goal in ET)**
- [ ] LiveMatchScreen: pauses at 90' with "¡Se va a prórroga!" overlay → continues to 121'
- [ ] MatchScreen: shows total goals (e.g. 2–1), VICTORIA/DERROTA, A.E.T. badge
- [ ] MatchResultCard: correct border color, PRÓRROGA badge visible

**Scenario C — Cup match goes to penalties**
- [ ] LiveMatchScreen: pauses at 90' (ET overlay) → plays to 120' → pauses (penalty overlay) → shows PENALTY_SHOOTOUT event
- [ ] MatchScreen: shows `(4) 1–1 (3)` with A.E.T. badge, VICTORIA or DERROTA (never EMPATE)
- [ ] MatchResultCard: correct border color, penalty badge shows `(4) 1–1 (3)`
- [ ] Career event log entry shows `"Equipo A (4) 1-1 (3) Equipo B (Copa)"`

**"Saltar al final" in each scenario:**
- [ ] In a no-ET match: jumps to 90'
- [ ] In an ET match: jumps to 121' (all ET events visible)
- [ ] In a penalty match: jumps to 122' (penalty shootout event visible)
