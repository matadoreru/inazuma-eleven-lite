# Competition UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cup match visibility to the calendar, competition badges on the home menu, a season-end announcement overlay with sound, and a multi-tab Standings screen showing all leagues and cup bracket.

**Architecture:** Seven self-contained tasks. Each touches one file (or creates one new file) with clear before/after deltas. No changes to the career store, match simulator, or promotion logic — all existing backend logic is correct.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest (tests), Web Audio API (sound synthesis)

## Global Constraints

- All UI text in Spanish (es)
- No external audio files — sound must use Web Audio API synthesis only
- Follow existing Tailwind class patterns already used in the codebase
- `npm test` must stay green after each task
- `tsc` must stay clean (no new type errors) after each task

---

### Task 1: SideNavigation — rename "Tabla" to "Clasificación"

**Files:**
- Modify: `src/components/SideNavigation.tsx:22`

**Interfaces:**
- Produces: nothing (label change only)

- [ ] **Step 1: Make the change**

In `src/components/SideNavigation.tsx`, change the `standings` nav item label:

```ts
// Before
{ screen: 'standings', label: 'Tabla', icon: 'leaderboard' },

// After
{ screen: 'standings', label: 'Clasificación', icon: 'leaderboard' },
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors, `✓ built in …`

- [ ] **Step 3: Commit**

```bash
git add src/components/SideNavigation.tsx
git commit -m "fix: rename 'Tabla' to 'Clasificación' in side navigation"
```

---

### Task 2: Sound service

**Files:**
- Create: `src/services/soundService.ts`
- Create: `src/tests/soundService.test.ts`

**Interfaces:**
- Produces: `playOutcomeSound(outcome: 'champion' | 'promoted' | 'relegated' | 'stayed'): void`

- [ ] **Step 1: Write the failing test**

Create `src/tests/soundService.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { playOutcomeSound } from '../services/soundService'

describe('playOutcomeSound', () => {
  it('does not throw for any outcome', () => {
    const outcomes = ['champion', 'promoted', 'relegated', 'stayed'] as const
    for (const o of outcomes) {
      expect(() => playOutcomeSound(o)).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- soundService
```
Expected: FAIL — `Cannot find module '../services/soundService'`

- [ ] **Step 3: Implement soundService**

Create `src/services/soundService.ts`:

```ts
export type SoundOutcome = 'champion' | 'promoted' | 'relegated' | 'stayed'

export function playOutcomeSound(outcome: SoundOutcome): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    type Note = { freq: number; dur: number }
    const sequences: Record<SoundOutcome, Note[]> = {
      champion: [
        { freq: 261.63, dur: 0.15 }, // C4
        { freq: 329.63, dur: 0.15 }, // E4
        { freq: 392.00, dur: 0.15 }, // G4
        { freq: 523.25, dur: 0.50 }, // C5
      ],
      promoted: [
        { freq: 261.63, dur: 0.20 }, // C4
        { freq: 329.63, dur: 0.20 }, // E4
        { freq: 392.00, dur: 0.35 }, // G4
      ],
      relegated: [
        { freq: 261.63, dur: 0.20 }, // C4
        { freq: 233.08, dur: 0.20 }, // Bb3
        { freq: 207.65, dur: 0.45 }, // Ab3
      ],
      stayed: [
        { freq: 329.63, dur: 0.35 }, // E4
      ],
    }

    let t = ctx.currentTime + 0.05
    for (const { freq, dur } of sequences[outcome]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t)
      osc.stop(t + dur)
      t += dur
    }
  } catch {
    // AudioContext unavailable (tests, restricted browsers)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- soundService
```
Expected: PASS — 1 test

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/services/soundService.ts src/tests/soundService.test.ts
git commit -m "feat: add sound service with Web Audio API outcome sounds"
```

---

### Task 3: CalendarMonth — cup match visual distinction

**Files:**
- Modify: `src/components/CalendarMonth.tsx`

**Interfaces:**
- Consumes: `Match.type?: 'league' | 'cup'` (already in `src/types/competition.ts`)
- Produces: cup match days render with `bg-yellow-900/60` + trophy icon; league match days unchanged

- [ ] **Step 1: Replace the match index build block**

In `src/components/CalendarMonth.tsx`, replace the `matchByDate` block (lines 44–55) with:

```ts
// Build match index: track user match type and any-match per date
const matchByDate: Record<string, { userLeague: boolean; userCup: boolean; other: boolean }> = {}
for (const m of matches) {
  if (!m.date) continue
  const y = parseInt(m.date.slice(0, 4), 10)
  const mo = parseInt(m.date.slice(5, 7), 10)
  if (y !== year || mo !== month) continue
  const isUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId
  if (!matchByDate[m.date]) matchByDate[m.date] = { userLeague: false, userCup: false, other: false }
  if (isUser) {
    if (m.type === 'cup') matchByDate[m.date].userCup = true
    else matchByDate[m.date].userLeague = true
  } else {
    matchByDate[m.date].other = true
  }
}
```

- [ ] **Step 2: Update cell rendering variables**

Inside the `cells.map()` callback, replace the existing `hasUserMatch` / `hasOtherMatch` derivations and the `bgClass` / `ringClass` block with:

```ts
const hasUserLeagueMatch = info?.userLeague ?? false
const hasUserCupMatch = info?.userCup ?? false
const hasUserMatch = hasUserLeagueMatch || hasUserCupMatch
const hasOtherMatch = info?.other ?? false

// Background priority: selected > cup > league > today > default
let bgClass = 'bg-gray-900/80'
let ringClass = ''
if (isSelected) {
  bgClass = 'bg-blue-600'
} else if (hasUserCupMatch) {
  bgClass = 'bg-yellow-900/60'
} else if (hasUserLeagueMatch) {
  bgClass = 'bg-green-900/80'
} else if (isToday) {
  bgClass = 'bg-amber-900/25'
  ringClass = 'ring-1 ring-inset ring-amber-500/50'
}
```

- [ ] **Step 3: Update the icon and label JSX**

Replace the icon + label JSX block (the `{hasUserMatch && ...}` icon and the `<span>` bottom label) with:

```tsx
{/* Match icon — trophy for cup, ball for league */}
{hasUserCupMatch && (
  <span
    className="material-icons absolute bottom-5 right-2 text-white/20 select-none pointer-events-none"
    style={{ fontSize: 28 }}
  >
    emoji_events
  </span>
)}
{hasUserLeagueMatch && !hasUserCupMatch && (
  <span
    className="material-icons absolute bottom-5 right-2 text-white/20 select-none pointer-events-none"
    style={{ fontSize: 28 }}
  >
    sports_soccer
  </span>
)}

{/* Other-match dot */}
{hasOtherMatch && !hasUserMatch && (
  <div className="absolute bottom-2 right-2">
    <span className="w-1 h-1 rounded-full bg-gray-500/60 block" />
  </div>
)}

{/* Bottom label */}
<span
  className={`absolute bottom-1.5 left-2 text-[0.4rem] font-black uppercase tracking-widest leading-none
    ${hasUserCupMatch
      ? isSelected ? 'text-yellow-300/80' : 'text-yellow-400/70'
      : hasUserLeagueMatch
      ? isSelected ? 'text-green-300/80' : 'text-green-400/70'
      : isSelected ? 'text-blue-200/60' : 'text-gray-700'}`}
>
  {hasUserCupMatch ? 'Copa' : hasUserLeagueMatch ? 'Tu partido' : 'Libre'}
</span>
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20 && npm run build 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/CalendarMonth.tsx
git commit -m "feat: distinguish cup vs league match days in calendar grid"
```

---

### Task 4: CalendarScreen — include cup matches

**Files:**
- Modify: `src/screens/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `career.cup.rounds[].matches` (type `Match[]`, already typed in `src/types/season.ts`)
- Produces: `allMatches` includes both league and cup matches; upcoming strip shows cup badge; day detail panel shows cup badge

- [ ] **Step 1: Build the merged match list**

In `CalendarScreen`, replace the `allMatches` constant (currently `const allMatches = career.season.matches`) with:

```ts
const leagueMatches = career.season.matches
const cupMatches = career.cup?.rounds.flatMap((r) => r.matches) ?? []
const allMatches = [...leagueMatches, ...cupMatches]
```

This goes before the `upcoming` calculation. No other changes needed for the calendar grid or day detail panel — they already receive `allMatches`.

- [ ] **Step 2: Add cup indicator to the upcoming strip**

In the upcoming strip `button`, add a cup label below the date string. The current inner content is:

```tsx
<span className={`text-xs font-black tabular-nums ${isSel ? 'text-blue-300' : 'text-gray-400'}`}>
  {fmtShort(match.date)}
</span>
<div className="flex items-center gap-2">
  ...
</div>
```

Replace with:

```tsx
<div className="flex flex-col items-center gap-0.5">
  <span className={`text-xs font-black tabular-nums ${isSel ? 'text-blue-300' : 'text-gray-400'}`}>
    {fmtShort(match.date)}
  </span>
  {match.type === 'cup' && (
    <span className="text-[0.4rem] font-black uppercase tracking-widest text-yellow-500/80">Copa</span>
  )}
</div>
<div className="flex items-center gap-2">
  <TeamBadge team={teams.find((t) => t.id === career.teamId)} size="md" />
  <span className="text-gray-500 text-[0.5625rem] font-black">VS</span>
  <TeamBadge team={opponent} size="md" />
</div>
```

- [ ] **Step 3: Add competition badge to day detail panel header**

In `DayDetailPanel`, the header currently shows:

```tsx
{userMatch ? (
  <p className="text-blue-400 text-xs mt-0.5 font-medium">
    Jornada {userMatch.round} · {matchLabel(userMatch)}
  </p>
) : (
  <p className="text-gray-600 text-xs mt-0.5">Día libre</p>
)}
```

Replace with:

```tsx
{userMatch ? (
  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
    <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
      ${userMatch.type === 'cup'
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-blue-500/20 text-blue-400'}`}
    >
      {userMatch.type === 'cup' ? 'Copa' : 'Liga'}
    </span>
    <p className="text-gray-400 text-xs font-medium">
      {matchLabel(userMatch)}
      {userMatch.type !== 'cup' && ` · J${userMatch.round}`}
    </p>
  </div>
) : (
  <p className="text-gray-600 text-xs mt-0.5">Día libre</p>
)}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20 && npm run build 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/screens/CalendarScreen.tsx
git commit -m "feat: show cup matches in calendar — merged with league schedule"
```

---

### Task 5: CareerHomeScreen — competition badge on all matches

**Files:**
- Modify: `src/screens/CareerHomeScreen.tsx`

**Interfaces:**
- Consumes: `leagues` from `../data/leagues` (already imported in other screens)
- Produces: league matches display `"{Liga} · J{N}"` badge in blue; cup badge unchanged

- [ ] **Step 1: Import leagues data**

At the top of `src/screens/CareerHomeScreen.tsx`, add:

```ts
import { leagues } from '../data/leagues'
```

- [ ] **Step 2: Replace the conditional badge with an always-visible badge**

In `NextMatchSection`, the current badge block is:

```tsx
{isCupMatch && (
  <div className="absolute -top-2 left-3 z-10">
    <span className="bg-yellow-500 text-black text-[0.6rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
      Copa · {match.cupRound}
    </span>
  </div>
)}
```

Replace with:

```tsx
<div className="absolute -top-2 left-3 z-10">
  {isCupMatch ? (
    <span className="bg-yellow-500 text-black text-[0.6rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
      Copa · {match.cupRound}
    </span>
  ) : (
    <span className="bg-blue-600 text-white text-[0.6rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
      {leagues.find((l) => l.id === match.leagueId)?.name ?? 'Liga'} · J{match.round}
    </span>
  )}
</div>
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20 && npm run build 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/screens/CareerHomeScreen.tsx
git commit -m "feat: show competition badge on all next match cards (league + cup)"
```

---

### Task 6: SeasonReviewScreen — season-end announcement overlay

**Files:**
- Modify: `src/screens/SeasonReviewScreen.tsx`

**Interfaces:**
- Consumes: `playOutcomeSound` from `../services/soundService` (Task 2)
- Consumes: `leagues` from `../data/leagues`
- Consumes: `review.finalPosition`, `review.userOutcome`, `review.leagueId`, `review.leagueName`, `review.seasonNumber` (all already on `SeasonReview`)
- Produces: full-screen animated overlay shown for 3.5s (champion/promoted/relegated) or 2s (stayed), then fades out to reveal the review screen

- [ ] **Step 1: Add imports and local state**

At the top of `SeasonReviewScreen.tsx`, add these imports after the existing ones:

```ts
import { useState, useEffect } from 'react'
import { leagues } from '../data/leagues'
import { playOutcomeSound } from '../services/soundService'
```

Inside `SeasonReviewScreen` (after the early-return guards), add:

```ts
const [showReveal, setShowReveal] = useState(true)
const [fading, setFading] = useState(false)

const isChampion = review.finalPosition === 1
const revealDuration = isChampion || review.userOutcome !== 'stayed' ? 3500 : 2000

useEffect(() => {
  playOutcomeSound(isChampion ? 'champion' : review.userOutcome)
  const fadeTimer = setTimeout(() => setFading(true), revealDuration - 600)
  const hideTimer = setTimeout(() => setShowReveal(false), revealDuration)
  return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Derive overlay configuration**

Add this block directly below the `useEffect`:

```ts
const currentLeague = leagues.find((l) => l.id === review.leagueId)
const promotionTargetName = leagues.find((l) => l.id === currentLeague?.promotionTo)?.name ?? 'División Superior'
const relegationTargetName = leagues.find((l) => l.id === currentLeague?.relegationTo)?.name ?? 'División Inferior'

const overlayConfig = isChampion
  ? { bg: 'from-yellow-950 to-yellow-900', icon: 'emoji_events', iconColor: 'text-yellow-400', title: '¡CAMPEÓN!', sub: review.leagueName, titleColor: 'text-yellow-300' }
  : review.userOutcome === 'promoted'
  ? { bg: 'from-green-950 to-green-900', icon: 'arrow_upward', iconColor: 'text-green-400', title: '¡ASCENSO!', sub: `→ ${promotionTargetName}`, titleColor: 'text-green-300' }
  : review.userOutcome === 'relegated'
  ? { bg: 'from-red-950 to-red-900', icon: 'arrow_downward', iconColor: 'text-red-400', title: 'DESCENSO', sub: `→ ${relegationTargetName}`, titleColor: 'text-red-300' }
  : { bg: 'from-gray-900 to-gray-800', icon: 'remove', iconColor: 'text-gray-400', title: 'PERMANENCIA', sub: review.leagueName, titleColor: 'text-gray-300' }
```

- [ ] **Step 3: Add overlay JSX**

In the component's return, add the overlay as the **first child** inside the outermost `div` (before the header block):

```tsx
{showReveal && (
  <div
    className={`fixed inset-0 z-50 bg-gradient-to-b ${overlayConfig.bg} flex flex-col items-center justify-center gap-6 transition-opacity duration-700`}
    style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'auto' }}
  >
    <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center">
      <span className={`material-icons ${overlayConfig.iconColor}`} style={{ fontSize: 64 }}>
        {overlayConfig.icon}
      </span>
    </div>
    <div className="text-center px-8">
      <p className={`text-5xl font-black tracking-widest ${overlayConfig.titleColor}`}>
        {overlayConfig.title}
      </p>
      <p className="text-gray-300 text-lg mt-2">{overlayConfig.sub}</p>
    </div>
    <p className="text-gray-500 text-sm">Temporada {review.seasonNumber}</p>
  </div>
)}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20 && npm run build 2>&1 | tail -5
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/screens/SeasonReviewScreen.tsx
git commit -m "feat: season-end announcement overlay with sound (champion/ascenso/descenso)"
```

---

### Task 7: StandingsScreen — multi-competition tabs

**Files:**
- Modify: `src/screens/StandingsScreen.tsx`

**Interfaces:**
- Consumes: `career.allLeagueSeasons` (`Record<string, LeagueSeason>`) for other league standings
- Consumes: `career.cup` (`Cup | null`) for bracket view
- Consumes: `leagues` from `../data/leagues` for tab list
- Produces: tab bar switching between each league and cup; league tabs show standings table; cup tab shows round-by-round bracket

- [ ] **Step 1: Add imports and tab state**

Add to the top of `StandingsScreen.tsx`:

```ts
import { useState } from 'react'
import { leagues } from '../data/leagues'
import type { Cup } from '../types/season'
import type { Team } from '../types/team'
```

Inside `StandingsScreen`, after the early guard, add:

```ts
const [activeTab, setActiveTab] = useState<string>(career.season.leagueId)
```

- [ ] **Step 2: Add CupBracket sub-component**

Add this component **before** the `export default function StandingsScreen` line:

```tsx
function CupBracket({ cup, teams, userTeamId }: { cup: Cup | null; teams: Team[]; userTeamId: number }) {
  if (!cup) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">
        Copa no disponible esta temporada
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {cup.rounds.map((round) => (
        <div key={round.name}>
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-700 sticky top-0">
            <span className="material-icons text-yellow-500" style={{ fontSize: 16 }}>emoji_events</span>
            <h3 className="text-gray-300 text-xs font-bold uppercase tracking-wider">{round.name}</h3>
            {round.finished && (
              <span className="text-[0.55rem] font-bold px-1.5 py-px rounded bg-green-900/40 text-green-400 uppercase">Terminada</span>
            )}
          </div>
          <div className="divide-y divide-gray-700/40">
            {round.matches.map((match) => {
              const home = teams.find((t) => t.id === match.homeTeamId)
              const away = teams.find((t) => t.id === match.awayTeamId)
              const isUserHome = match.homeTeamId === userTeamId
              const isUserAway = match.awayTeamId === userTeamId
              const isUser = isUserHome || isUserAway
              return (
                <div
                  key={match.id}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isUser ? 'bg-blue-900/20' : ''}`}
                >
                  <span className={`flex-1 truncate ${isUserHome ? 'text-blue-200 font-semibold' : 'text-white'}`}>
                    {home?.name ?? `Equipo ${match.homeTeamId}`}
                  </span>
                  <div className="shrink-0 min-w-[44px] text-center">
                    {match.played ? (
                      <span className="text-white font-black tabular-nums">{match.homeGoals}–{match.awayGoals}</span>
                    ) : (
                      <span className="text-gray-600 text-xs font-bold">VS</span>
                    )}
                  </div>
                  <span className={`flex-1 truncate text-right ${isUserAway ? 'text-blue-200 font-semibold' : 'text-white'}`}>
                    {away?.name ?? `Equipo ${match.awayTeamId}`}
                  </span>
                </div>
              )
            })}
            {round.matches.length === 0 && (
              <div className="px-4 py-3 text-gray-600 text-xs">Pendiente de sorteo</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Derive active standings**

Inside `StandingsScreen`, replace:

```ts
const sorted = sortStandings(career.season.standings)
```

with:

```ts
const activeStandings = activeTab === career.season.leagueId
  ? career.season.standings
  : career.allLeagueSeasons[activeTab]?.standings ?? []
const sorted = sortStandings(activeStandings)
```

- [ ] **Step 4: Add the tab bar**

In the JSX, replace the `<main className="flex-1 overflow-y-auto p-4">` opening and its `<h1>` with:

```tsx
<main className="flex-1 flex flex-col overflow-hidden">
  {/* Tab bar */}
  <div className="flex border-b border-gray-700 px-2 gap-0 shrink-0 overflow-x-auto bg-gray-900">
    {leagues.map((l) => (
      <button
        key={l.id}
        onClick={() => setActiveTab(l.id)}
        className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
          ${activeTab === l.id
            ? 'text-white border-blue-500'
            : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'}`}
      >
        {l.name}
        {l.id === career.season.leagueId && (
          <span className="ml-1.5 text-[0.5rem] font-black text-blue-400 uppercase tracking-wide">Tu liga</span>
        )}
      </button>
    ))}
    <button
      onClick={() => setActiveTab('cup')}
      className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
        ${activeTab === 'cup'
          ? 'text-white border-yellow-500'
          : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'}`}
    >
      Copa
    </button>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto">
    {activeTab === 'cup' ? (
      <CupBracket cup={career.cup ?? null} teams={teams} userTeamId={career.teamId} />
    ) : (
      <div className="p-4">
        <h1 className="text-white text-xl font-bold mb-4">
          {leagues.find((l) => l.id === activeTab)?.name ?? activeTab} — Temporada {career.season.year}
        </h1>
```

Then close the content section. The existing standings table JSX (`<div className="bg-gray-800 rounded-xl...">`) goes inside, and the closing tags need to be adjusted. The full updated return body:

```tsx
return (
  <div className="h-full flex flex-col">
    <TopNavigation title="Clasificación" />
    <div className="flex flex-1 overflow-hidden">
      <SideNavigation currentScreen={screen} onNavigate={navigate} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-700 px-2 gap-0 shrink-0 overflow-x-auto bg-gray-900">
          {leagues.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveTab(l.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
                ${activeTab === l.id
                  ? 'text-white border-blue-500'
                  : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'}`}
            >
              {l.name}
              {l.id === career.season.leagueId && (
                <span className="ml-1.5 text-[0.5rem] font-black text-blue-400 uppercase tracking-wide">Tu liga</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('cup')}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
              ${activeTab === 'cup'
                ? 'text-white border-yellow-500'
                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'}`}
          >
            Copa
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'cup' ? (
            <CupBracket cup={career.cup ?? null} teams={teams} userTeamId={career.teamId} />
          ) : (
            <div className="p-4">
              <h1 className="text-white text-xl font-bold mb-4">
                {leagues.find((l) => l.id === activeTab)?.name ?? activeTab} — Temporada {career.season.year}
              </h1>

              {activeStandings.length === 0 ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 py-8 text-center text-gray-500 text-sm">
                  Sin datos de clasificación disponibles
                </div>
              ) : (
                <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  {/* Header */}
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

                  {/* Rows */}
                  {sorted.map((row, idx) => {
                    const isUserTeam = row.teamId === career.teamId
                    const team = teams.find((t) => t.id === row.teamId)
                    return (
                      <div
                        key={row.teamId}
                        className={`grid grid-cols-[auto_1fr_repeat(8,auto)] gap-0 px-3 py-2.5 border-t border-gray-700 text-sm items-center
                          ${isUserTeam ? 'bg-blue-900/40 border-l-2 border-l-blue-500' : 'hover:bg-gray-700/50 transition-colors'}`}
                      >
                        <span className={`w-8 text-center font-bold ${isUserTeam ? 'text-blue-300' : 'text-gray-400'}`}>
                          {idx + 1}
                        </span>
                        <div className="px-2 min-w-0">
                          <TeamNameInline
                            teamName={row.teamName}
                            badgeUrl={team?.badgeUrl}
                            textClassName={`${isUserTeam ? 'text-blue-200' : 'text-white'}`}
                          />
                        </div>
                        <span className="w-8 text-center text-gray-300">{row.played}</span>
                        <span className="w-8 text-center text-green-400">{row.won}</span>
                        <span className="w-8 text-center text-yellow-400">{row.drawn}</span>
                        <span className="w-8 text-center text-red-400">{row.lost}</span>
                        <span className="w-10 text-center text-gray-300">{row.goalsFor}</span>
                        <span className="w-10 text-center text-gray-300">{row.goalsAgainst}</span>
                        <span className={`w-10 text-center ${row.goalDiff > 0 ? 'text-green-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                        </span>
                        <span className={`w-10 text-center font-bold text-lg ${isUserTeam ? 'text-blue-300' : 'text-white'}`}>
                          {row.points}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  </div>
)
```

Note: `career.cup` is typed as `Cup | undefined` in some saves and `Cup | null` in others — use `career.cup ?? null` when passing to `CupBracket`.

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -30 && npm run build 2>&1 | tail -5
```
Expected: no type errors, build succeeds

- [ ] **Step 6: Run all tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/screens/StandingsScreen.tsx
git commit -m "feat: standings multi-tab — all leagues + cup bracket"
```

---

## Self-review checklist

**Spec coverage:**
- [x] A. SideNav "Tabla" → "Clasificación" — Task 1
- [x] B. Calendar cup matches + visual distinction — Tasks 3 + 4
- [x] C. Home menu competition badge for league matches — Task 5
- [x] D. Season-end popup with sound — Task 6 (overlay) + Task 2 (sound)
- [x] E. Standings multi-view + cup bracket — Task 7

**Type consistency:**
- `playOutcomeSound(outcome: SoundOutcome)` — defined Task 2, consumed Task 6 ✓
- `CupBracket({ cup: Cup | null, teams: Team[], userTeamId: number })` — defined and consumed in Task 7 ✓
- `matchByDate` shape changed from `{ user, other }` to `{ userLeague, userCup, other }` — all references updated in Task 3 ✓
- `career.cup ?? null` — guards against undefined in Task 7 ✓

**Placeholder scan:** None found.
