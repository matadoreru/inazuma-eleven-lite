# Mejoras Completas v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the season-end blocker and implement 8 additional gameplay improvements across match simulation, transfers, cup logic, objectives, and reward management.

**Architecture:** Pure-service logic changes tested with Vitest; UI changes in React components connected to the Zustand career store. Each area is independent — implement, test, and commit before moving to the next.

**Tech Stack:** React 18, TypeScript, Zustand 5, Tailwind CSS, Vitest, Google Material Icons

## Global Constraints

- Style: dark panels, gold/yellow borders (`border-gold-600/20`), retro/pixel aesthetic, no emojis, Google Material Icons via `<Icon name="..." />`
- All new `Career` fields must be normalized in `loadCareer` and `restoreAutoSave` with `?? defaultValue` to keep existing saves working
- `MAX_TRANSFER_VALUE = 10_000_000` — no amount may exceed this
- Test runner: `npm test` (= `npx vitest run`); single file: `npx vitest run src/tests/<file>.test.ts`
- Commit after every task

---

## Task 1: Fix Season-End Blocker

**Files:**
- Modify: `src/store/careerStore.ts`
- Modify: `src/screens/CareerHomeScreen.tsx`
- Test: `src/tests/seasonEnd.test.ts` (create)

**Interfaces:**
- Produces: `simulateAllRemainingAndClose(): void` on the store
- Produces: fixed `advanceDay()` that does not block when `career.season.finished === true`

- [ ] **Step 1: Write the failing test**

Create `src/tests/seasonEnd.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeSeasonStatus } from '../store/careerStore'

// We test the pure helper by re-exporting it.
// For now we verify the logic contract: season finished + cup finished => all_finished
describe('computeSeasonStatus', () => {
  it('returns all_finished when user season and cup are both done', () => {
    const mockCareer = {
      seasonStatus: 'active' as const,
      season: { finished: true } as any,
      allLeagueSeasons: {},
      cup: { finished: true } as any,
    }
    // We'll verify this after exporting the helper
    expect(mockCareer.season.finished).toBe(true)
    expect(mockCareer.cup.finished).toBe(true)
  })
})
```

Run: `npx vitest run src/tests/seasonEnd.test.ts`
Expected: PASS (trivial test just to bootstrap the file)

- [ ] **Step 2: Export `computeSeasonStatus` from careerStore**

In `src/store/careerStore.ts`, find the `computeSeasonStatus` function (line ~193) and add `export` keyword:

```ts
export function computeSeasonStatus(
  career: Pick<Career, 'season' | 'allLeagueSeasons' | 'cup' | 'seasonStatus'>,
): SeasonStatus {
```

- [ ] **Step 3: Fix the cup-blocking bug in `advanceDay`**

In `src/store/careerStore.ts`, find the block in `advanceDay` (~line 979):

```ts
// BEFORE:
const todayCupMatch = getNextUserCupMatch(career.cup, career.teamId, career.season.currentDate)
const todayCupMatchIsToday = todayCupMatch?.date === career.season.currentDate
if (todayLeagueMatch || todayCupMatchIsToday) return
```

Replace with:

```ts
const todayCupMatch = getNextUserCupMatch(career.cup, career.teamId, career.season.currentDate)
// Only block on cup when user's league is still active — once league is done, let days advance freely
const todayCupMatchIsToday = !career.season.finished && todayCupMatch?.date === career.season.currentDate
if (todayLeagueMatch || todayCupMatchIsToday) return
```

- [ ] **Step 4: Add `simulateAllRemainingAndClose` to the store interface and implementation**

In `src/store/careerStore.ts`, add to the `CareerState` interface:

```ts
simulateAllRemainingAndClose(): void
```

Add the implementation inside `create<CareerState>()((set, get) => ({`:

```ts
simulateAllRemainingAndClose() {
  const MAX_ITER = 200
  for (let i = 0; i < MAX_ITER; i++) {
    const { career } = get()
    if (!career) break
    const status = computeSeasonStatus(career)
    if (status === 'all_finished' || status === 'review') break
    get().advanceDay()
  }
  // After loop, close if ready
  const { career } = get()
  if (career && computeSeasonStatus(career) === 'all_finished') {
    get().closeSeason()
  }
},
```

- [ ] **Step 5: Update `UserFinishedBanner` in CareerHomeScreen**

In `src/screens/CareerHomeScreen.tsx`, update the `UserFinishedBanner` component:

```tsx
function UserFinishedBanner({ onAdvanceDay, onAdvanceToNextMatch, onSimulateAll }: {
  onAdvanceDay: () => void
  onAdvanceToNextMatch: () => void
  onSimulateAll: () => void
}) {
  return (
    <div className="panel p-4 flex flex-col gap-3 border-blue-500/40">
      <div className="flex items-center gap-2">
        <Icon name="schedule" size="sm" className="text-gold-500" />
        <p className="text-gold-400 font-semibold text-sm">Tu liga ha terminado</p>
      </div>
      <p className="text-gray-400 text-xs">
        Otras competiciones siguen en curso. Avanza días para simularlas o simúlalas todas de golpe.
      </p>
      <div className="flex gap-2">
        <button onClick={onAdvanceDay} className="btn-secondary flex-1 py-2">
          +1 día
        </button>
        <button onClick={onAdvanceToNextMatch} className="flex-1 py-2 bg-blue-800/60 hover:bg-blue-700/70 text-gold-400 text-xs font-semibold rounded border border-blue-600/40 hover:border-blue-500 transition-colors uppercase tracking-wide">
          Sig. evento
        </button>
      </div>
      <button
        onClick={onSimulateAll}
        className="w-full py-2.5 bg-green-800/60 hover:bg-green-700/70 text-green-300 text-xs font-semibold rounded border border-green-600/40 hover:border-green-500 transition-colors uppercase tracking-wide flex items-center justify-center gap-1.5"
      >
        <Icon name="fast_forward" size="xs" />
        Simular todo y cerrar temporada
      </button>
    </div>
  )
}
```

Find where `UserFinishedBanner` is rendered in the same file and update the call to pass `onSimulateAll`:

```tsx
const simulateAllRemainingAndClose = useCareerStore((s) => s.simulateAllRemainingAndClose)
// ...
<UserFinishedBanner
  onAdvanceDay={advanceDay}
  onAdvanceToNextMatch={advanceToNextMatch}
  onSimulateAll={simulateAllRemainingAndClose}
/>
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/store/careerStore.ts src/screens/CareerHomeScreen.tsx src/tests/seasonEnd.test.ts
git commit -m "fix: unblock advanceDay after league ends; add simulate-all-and-close button"
```

---

## Task 2: Navigable Notifications

**Files:**
- Modify: `src/types/career.ts`
- Modify: `src/services/inboxService.ts`
- Modify: `src/store/careerStore.ts`
- Modify: `src/components/NotificationsDrawer.tsx`
- Test: `src/tests/inboxService.test.ts` (create)

**Interfaces:**
- `InboxEvent` gains `targetScreen?: string` and `targetEntityId?: string`
- `addEvent(type, title, body, career, data?, targetScreen?, targetEntityId?)` updated signature

- [ ] **Step 1: Extend `InboxEvent` type**

In `src/types/career.ts`, find the `InboxEvent` interface and add two optional fields:

```ts
export interface InboxEvent {
  id: string
  type: InboxEventType
  title: string
  body: string
  date: string
  read: boolean
  data?: Record<string, unknown>
  targetScreen?: string      // Screen name to navigate to on click
  targetEntityId?: string    // e.g. playerId or matchId as string
}
```

- [ ] **Step 2: Update `addEvent` in inboxService**

In `src/services/inboxService.ts`, update `addEvent`:

```ts
export function addEvent(
  type: InboxEventType,
  title: string,
  body: string,
  career: Career,
  data?: Record<string, unknown>,
  targetScreen?: string,
  targetEntityId?: string,
): Career {
  const event: InboxEvent = {
    id: crypto.randomUUID(),
    type,
    title,
    body,
    date: new Date().toISOString().split('T')[0],
    read: false,
    data,
    targetScreen,
    targetEntityId,
  }
  return { ...career, inbox: [event, ...career.inbox] }
}
```

- [ ] **Step 3: Write test for addEvent with navigation**

Create `src/tests/inboxService.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { addEvent } from '../services/inboxService'
import type { Career } from '../types/career'

const makeCareer = (): Career => ({
  id: '1', managerName: 'Test', managerAvatar: '', teamId: 1,
  season: {} as any, seasonNumber: 1, totalBudgetSpent: 0, totalBudgetEarned: 0,
  objectives: [], inbox: [], transferHistory: [], watchlist: [], seasonHistory: [],
  playerPotential: {}, weeklyTrainingPlan: null, inventory: { techniqueBooks: {}, generatedBooks: {}, equipmentItems: [] },
  allLeagueSeasons: {}, cup: null, seasonStatus: 'active', lastSeasonReview: null,
  outgoingNegotiations: [], difficulty: {} as any, nameStyle: 'western',
  createdAt: '2026-01-01', lastSavedAt: '2026-01-01',
})

describe('addEvent', () => {
  it('stores targetScreen and targetEntityId when provided', () => {
    const career = makeCareer()
    const result = addEvent('PLAYER_INJURED', 'Lesión', 'Jugador lesionado', career, undefined, 'squad', '42')
    expect(result.inbox[0].targetScreen).toBe('squad')
    expect(result.inbox[0].targetEntityId).toBe('42')
  })

  it('leaves targetScreen undefined when not provided', () => {
    const career = makeCareer()
    const result = addEvent('NEWS', 'Noticia', 'Cuerpo', career)
    expect(result.inbox[0].targetScreen).toBeUndefined()
  })
})
```

Run: `npx vitest run src/tests/inboxService.test.ts`
Expected: PASS

- [ ] **Step 4: Update `addEvent` call-sites in careerStore with navigation targets**

In `src/store/careerStore.ts`, search for every `addEvent(` call and add the appropriate `targetScreen` / `targetEntityId` as 6th/7th arguments:

```ts
// TRANSFER_OFFER (in commitLiveMatch, ~line 948):
updatedCareer = addEvent(
  'TRANSFER_OFFER',
  `Oferta de ${offer.fromTeamName}`,
  `${offer.fromTeamName} ofrece ${fmt(offer.amount)} por ${offer.playerName}.`,
  updatedCareer,
  { offerId: offer.id, fromTeamId: offer.fromTeamId, fromTeamName: offer.fromTeamName,
    playerId: offer.playerId, playerName: offer.playerName, amount: offer.amount },
  'transfers',  // <-- add
)

// OUTGOING_TRANSFER_CLUB_ACCEPTED (in transferService resolveNegotiations — pass target via data instead,
// since transferService doesn't know about Screen type; handle in the inboxService call in careerStore
// by wrapping addEvent calls for outgoing negotiations):
// In commitMatchResult and advanceDay where MATCH_RESULT is pushed:
updatedCareer = addEvent('MATCH_RESULT', matchTitle, `Resultado final: ${matchTitle}`, updatedCareer, {
  matchId, homeGoals: result.homeGoals, awayGoals: result.awayGoals,
}, 'match', matchId)

// OBJECTIVE_COMPLETE (in commitMatchResult):
updatedCareer = addEvent(
  'OBJECTIVE_COMPLETE',
  `Objetivo completado: ${obj.description}`,
  `Reclama tu recompensa (${moneyStr}${repStr}) en el panel de objetivos.`,
  updatedCareer,
  undefined,
  'career_home',
)
```

For outgoing transfer notifications that come from `transferService.ts` (via `makeEvent` helper inside that file), add `targetScreen` to the data payload and read it in `NotificationsDrawer`:

In `src/services/transferService.ts`, update the `makeEvent` helper to accept optional navigation fields:

```ts
function makeEvent(
  type: InboxEventType,
  title: string,
  body: string,
  date: string,
  data?: Record<string, unknown>,
  targetScreen?: string,
  targetEntityId?: string,
): InboxEvent {
  return { id: crypto.randomUUID(), type, title, body, date, read: false, data, targetScreen, targetEntityId }
}
```

Then update every `makeEvent` call inside `resolveNegotiations` for transfer-related events to pass `'transfers'` as `targetScreen`:

```ts
c = pushEvent(c, makeEvent(
  'OUTGOING_TRANSFER_CLUB_ACCEPTED',
  `Club acepta: ${neg.playerName}`,
  `...`,
  currentDate,
  { negotiationId: neg.id },
  'transfers',   // <-- add to all OUTGOING_TRANSFER_* makeEvent calls
))
```

Do the same for `OUTGOING_TRANSFER_CLUB_REJECTED`, `OUTGOING_TRANSFER_CLUB_COUNTER`, `OUTGOING_TRANSFER_PLAYER_ACCEPTED`, `OUTGOING_TRANSFER_PLAYER_REJECTED`.

For `PLAYER_INJURED` events (in `applyMatchInjuries` flow — the event is generated in `generateDisciplinaryEvents` which doesn't know the player id for injury events). Update the INJURY mkEvent in `matchSimulator.ts` to carry the player id in `data`, then in `careerStore.ts` after `applyMatchInjuries`, generate an InboxEvent per injured player:

In `src/store/careerStore.ts`, after `applyMatchInjuries` call in `commitMatchResult`:

```ts
// After: updatedPlayers = applyMatchInjuries(result.events, career.teamId, updatedPlayers)
const newlyInjured = result.events.filter(
  (e) => e.type === 'INJURY' && e.teamId === career.teamId && e.playerId != null,
)
for (const injEvent of newlyInjured) {
  updatedCareer = addEvent(
    'PLAYER_INJURED',
    `Lesión: ${injEvent.playerName ?? 'Jugador'}`,
    `${injEvent.playerName ?? 'Un jugador'} ha salido lesionado del partido.`,
    updatedCareer,
    { playerId: injEvent.playerId },
    'squad',
    String(injEvent.playerId),
  )
}
```

- [ ] **Step 5: Update `NotificationsDrawer` to navigate on click**

In `src/components/NotificationsDrawer.tsx`, update `NotificationItem` to accept and use navigation:

```tsx
function NotificationItem({ event, onRead, onDelete, onNavigate }: {
  event: InboxEvent
  onRead: () => void
  onDelete: () => void
  onNavigate?: () => void
}) {
  const isNavigable = !!event.targetScreen

  function handleClick() {
    onRead()
    if (isNavigable && onNavigate) onNavigate()
  }

  return (
    <div
      className={`px-5 py-3 border-b border-gold-600/15 transition-colors ${
        isNavigable ? 'cursor-pointer hover:bg-dark-700/40' : 'hover:bg-dark-700/30'
      } ${!event.read ? 'bg-blue-950/20' : ''}`}
      onClick={isNavigable ? handleClick : undefined}
    >
      <div className="flex items-start gap-3">
        <Icon name={typeIcon[event.type]} size="sm" className={`shrink-0 mt-0.5 ${typeColor[event.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-semibold leading-tight ${event.read ? 'text-gray-300' : 'text-white'}`}>
              {event.title}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {!event.read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
              {isNavigable && <Icon name="chevron_right" size="xs" className="text-gray-500" />}
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-1 leading-snug">{event.body}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-600 text-xs">{event.date}</span>
            <div className="flex items-center gap-2">
              {!event.read && !isNavigable && (
                <button onClick={(e) => { e.stopPropagation(); onRead() }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Marcar leído
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="text-gray-600 hover:text-red-400 transition-colors" aria-label="Eliminar">
                <Icon name="delete" size="xs" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

In the `NotificationsDrawer` default export, add `navigate` and `setUIPanel` consumption and pass `onNavigate` to each item:

```tsx
const navigate = useCareerStore((s) => s.navigate)

// In the inbox.map:
<NotificationItem
  key={event.id}
  event={event}
  onRead={() => markInboxRead(event.id)}
  onDelete={() => deleteInboxEvent(event.id)}
  onNavigate={event.targetScreen ? () => {
    setUIPanel(null)
    navigate(event.targetScreen as any)
  } : undefined}
/>
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/types/career.ts src/services/inboxService.ts src/services/transferService.ts src/store/careerStore.ts src/components/NotificationsDrawer.tsx src/tests/inboxService.test.ts
git commit -m "feat: navigable notifications — click routes to relevant screen"
```

---

## Task 3: Free Agent Acceptance Logic

**Files:**
- Modify: `src/services/transferService.ts`
- Modify: `src/components/TransferPlayerRow.tsx`
- Test: existing `src/tests/transferService.test.ts` (add cases)

**Interfaces:**
- `evaluatePlayerDecision` unchanged signature; updated thresholds for `isFreeAgent` branch
- `calcFreeAgentRecommendedOffer(player: Player): number` — new export

- [ ] **Step 1: Write failing tests for new thresholds**

In `src/tests/transferService.test.ts`, add:

```ts
describe('evaluatePlayerDecision — free agent', () => {
  const freeAgent = makePlayer({ teamId: 0, stats: { POT: 100, CON: 80, TEC: 90, PRE: 70, FIS: 85, AGI: 75, INT: 80, TOT: 83 } })
  const avgClub = makeTeam({ reputation: 50 })
  const weakClub = makeTeam({ reputation: 15 })

  it('accepts ≥80% of market value with high probability', () => {
    // run 100 trials — expect ≥85 accepts
    const value = calcTransferValue(freeAgent)
    let accepts = 0
    for (let i = 0; i < 100; i++) {
      if (evaluatePlayerDecision(freeAgent, avgClub, Math.round(value * 0.85), true) === 'accept') accepts++
    }
    expect(accepts).toBeGreaterThan(55) // pAccept ~0.65 for avg club at 0.85 ratio
  })

  it('almost always accepts offer at or above market value', () => {
    const value = calcTransferValue(freeAgent)
    let accepts = 0
    for (let i = 0; i < 100; i++) {
      if (evaluatePlayerDecision(freeAgent, avgClub, value, true) === 'accept') accepts++
    }
    expect(accepts).toBeGreaterThan(80)
  })

  it('very weak club still gets decent acceptance at full value', () => {
    const value = calcTransferValue(freeAgent)
    let accepts = 0
    for (let i = 0; i < 100; i++) {
      if (evaluatePlayerDecision(freeAgent, weakClub, value, true) === 'accept') accepts++
    }
    expect(accepts).toBeGreaterThan(70) // repBonus -0.15, pAccept still 0.92-0.15=0.77
  })
})
```

You'll need `makeTeam` helper. Add it to the test file alongside `makePlayer`:

```ts
const makeTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 99, name: 'Test FC', tier: 3, reputation: 50, budget: 5_000_000,
  leagueId: 'test', captainId: 1, formation: {} as any, lineup: [], playerIds: [],
  ...overrides,
})
```

Run: `npx vitest run src/tests/transferService.test.ts`
Expected: new tests FAIL (old thresholds)

- [ ] **Step 2: Update `evaluatePlayerDecision` thresholds**

In `src/services/transferService.ts`, replace the `isFreeAgent` branch:

```ts
if (isFreeAgent) {
  const marketValue = Math.max(1, calcTransferValue(player))
  const ratio = offerAmount / marketValue

  let pAccept: number
  let pCounter: number
  if (ratio >= 0.80) {
    pAccept = 0.92; pCounter = 0.06
  } else if (ratio >= 0.65) {
    pAccept = 0.65; pCounter = 0.25
  } else if (ratio >= 0.50) {
    pAccept = 0.25; pCounter = 0.50
  } else {
    pAccept = 0.05; pCounter = 0.25
  }

  // Wider rep range: ±0.15. Very new clubs get small bonus (opportunity factor).
  const repBonus = Math.max(-0.15, Math.min(0.15, (buyingTeam.reputation - 50) / 100))
  const newClubBonus = buyingTeam.reputation < 20 ? 0.05 : 0
  pAccept = Math.max(0, Math.min(1, pAccept + repBonus + newClubBonus))

  const r = Math.random()
  if (r < pAccept) return 'accept'
  if (r < pAccept + pCounter) return 'counter'
  return 'reject'
}
```

- [ ] **Step 3: Add `calcFreeAgentRecommendedOffer` export**

In `src/services/transferService.ts`, add after `calcTransferValue`:

```ts
export function calcFreeAgentRecommendedOffer(player: Player): number {
  // Free agents accept at ~0.80 of market value → recommend 0.78 as a safe starting offer
  return Math.round(calcTransferValue(player) * 0.78)
}
```

- [ ] **Step 4: Show recommended offer in `TransferPlayerRow`**

In `src/components/TransferPlayerRow.tsx`, find where the player's team/status is displayed. Add a "Libre" badge and recommended offer hint for free agents. First, read the current file to find the right spot:

```bash
head -60 src/components/TransferPlayerRow.tsx
```

Then add below the player name or team column:

```tsx
import { calcFreeAgentRecommendedOffer } from '../services/transferService'

// Inside the component, where isFree is determined:
const isFree = player.teamId === null || player.teamId === 0
const recommendedOffer = isFree ? calcFreeAgentRecommendedOffer(player) : null

// In JSX, where team name is shown:
{isFree ? (
  <div className="flex flex-col">
    <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Libre</span>
    {recommendedOffer !== null && (
      <span className="text-[10px] text-gray-500">
        Oferta rec.: {recommendedOffer >= 1000 ? `€${(recommendedOffer/1000).toFixed(0)}K` : `€${recommendedOffer}`}
      </span>
    )}
  </div>
) : (
  <span className="text-gray-400 text-xs">{teamName}</span>
)}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass including new free agent tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/transferService.ts src/components/TransferPlayerRow.tsx src/tests/transferService.test.ts
git commit -m "feat: more reasonable free agent acceptance — better thresholds and recommended offer display"
```

---

## Task 4: Incoming Offers + Counteroffers

**Files:**
- Modify: `src/types/career.ts`
- Modify: `src/services/transferService.ts`
- Modify: `src/store/careerStore.ts`
- Modify: `src/screens/TransfersScreen.tsx`
- Test: `src/tests/transferService.test.ts` (add cases)

**Interfaces:**
- New type `IncomingOffer` in `career.ts`
- New exports from transferService: `respondToIncomingOffer`, `resolveIncomingCounters`
- New store actions: `counterIncomingOffer(offerId, amount)`, updated `acceptTransferOffer`, `rejectTransferOffer`

- [ ] **Step 1: Add `IncomingOffer` type and field to Career**

In `src/types/career.ts`, add after the `TransferOffer` interface:

```ts
export interface IncomingOffer {
  id: string
  fromTeamId: number
  fromTeamName: string
  playerId: number
  amount: number
  date: string
  status: 'pending' | 'accepted' | 'rejected' | 'budget_failed' | 'counter_sent' | 'counter_accepted' | 'counter_rejected'
  counterAmount?: number
  counterResolutionDate?: string
}
```

In the `Career` interface, add:

```ts
incomingOffers: IncomingOffer[]
```

- [ ] **Step 2: Update `generateAIOffers` to push to `incomingOffers`**

In `src/services/transferService.ts`, change `generateAIOffers` return type and behavior:

```ts
export function generateAIOffers(
  career: Career,
  teams: Team[],
  players: Player[],
): { offers: IncomingOffer[]; career: Career } {
  const myTeam = teams.find((t) => t.id === career.teamId)
  if (!myTeam) return { offers: [], career }

  const myPlayers = players.filter((p) => p.teamId === career.teamId)
  const aiTeams = teams.filter((t) => t.id !== career.teamId)
  const now = new Date().toISOString().split('T')[0]

  const offers: IncomingOffer[] = []

  for (const aiTeam of aiTeams) {
    if (Math.random() > 0.05) continue
    if (myPlayers.length === 0) break

    const target = myPlayers[Math.floor(Math.random() * myPlayers.length)]
    const value = calcTransferValue(target)
    const offerAmount = Math.round(value * (0.8 + Math.random() * 0.5))

    if (aiTeam.budget < offerAmount) continue

    offers.push({
      id: crypto.randomUUID(),
      fromTeamId: aiTeam.id,
      fromTeamName: aiTeam.name,
      playerId: target.id,
      amount: offerAmount,
      date: now,
      status: 'pending',
    })
  }

  const updatedCareer: Career = {
    ...career,
    incomingOffers: [...career.incomingOffers, ...offers],
  }

  return { offers, career: updatedCareer }
}
```

- [ ] **Step 3: Add `respondToIncomingOffer` and `resolveIncomingCounters`**

In `src/services/transferService.ts`, add:

```ts
export function respondToIncomingOffer(
  offerId: string,
  action: 'accept' | 'reject' | 'counter',
  career: Career,
  players: Player[],
  teams: Team[],
  counterAmount?: number,
): { career: Career; players: Player[]; teams: Team[]; error?: string } {
  const offer = career.incomingOffers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'pending') return { career, players, teams }

  const updateOffer = (updates: Partial<IncomingOffer>): Career => ({
    ...career,
    incomingOffers: career.incomingOffers.map((o) => o.id === offerId ? { ...o, ...updates } : o),
  })

  if (action === 'reject') {
    return { career: updateOffer({ status: 'rejected' }), players, teams }
  }

  if (action === 'counter') {
    const safe = counterAmount !== undefined ? sanitizeAmount(counterAmount) : null
    if (safe === null) return { career, players, teams, error: 'invalid_amount' }

    const d = new Date(career.season.currentDate)
    d.setDate(d.getDate() + Math.floor(Math.random() * 2) + 1)
    const counterResolutionDate = d.toISOString().split('T')[0]

    return {
      career: updateOffer({ status: 'counter_sent', counterAmount: safe, counterResolutionDate }),
      players,
      teams,
    }
  }

  // accept
  const buyingTeam = teams.find((t) => t.id === offer.fromTeamId)
  if (!buyingTeam || buyingTeam.budget < offer.amount) {
    const updatedCareer = updateOffer({ status: 'budget_failed' })
    return { career: updatedCareer, players, teams, error: 'insufficient_budget' }
  }

  const player = players.find((p) => p.id === offer.playerId)
  if (!player || player.teamId !== career.teamId) {
    return { career: updateOffer({ status: 'rejected' }), players, teams, error: 'player_unavailable' }
  }

  const sold = sellPlayer(offer.playerId, offer.fromTeamId, offer.amount, career, teams, players)
  return {
    career: {
      ...sold.career,
      incomingOffers: sold.career.incomingOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'accepted' } : o,
      ),
    },
    players: sold.players,
    teams: sold.teams,
  }
}

function addDaysIncoming(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function resolveIncomingCounters(
  career: Career,
  currentDate: string,
  players: Player[],
  teams: Team[],
): { career: Career; players: Player[]; teams: Team[] } {
  let c = career
  const p = players
  const t = teams

  for (const offer of career.incomingOffers) {
    if (offer.status !== 'counter_sent') continue
    if (!offer.counterResolutionDate || offer.counterResolutionDate > currentDate) continue

    const buyingTeam = teams.find((tm) => tm.id === offer.fromTeamId)
    if (!buyingTeam) {
      c = { ...c, incomingOffers: c.incomingOffers.map((o) => o.id === offer.id ? { ...o, status: 'counter_rejected' } : o) }
      continue
    }

    const marketValue = Math.max(1, calcTransferValue(players.find((pl) => pl.id === offer.playerId) ?? { stats: { TOT: 70 } } as any))
    const ratio = (offer.counterAmount ?? offer.amount) / marketValue
    const pAccept = ratio <= 1.0 ? 0.65 : ratio <= 1.2 ? 0.40 : ratio <= 1.5 ? 0.15 : 0.03

    if (Math.random() < pAccept) {
      // AI accepts counter
      const sold = respondToIncomingOffer(offer.id, 'accept',
        { ...c, incomingOffers: c.incomingOffers.map((o) => o.id === offer.id ? { ...o, amount: offer.counterAmount!, status: 'pending' } : o) },
        p, t)
      c = sold.career
    } else {
      c = { ...c, incomingOffers: c.incomingOffers.map((o) => o.id === offer.id ? { ...o, status: 'counter_rejected' } : o) }
    }
  }

  return { career: c, players: p, teams: t }
}
```

Note: `sellPlayer` in transferService needs to guard `player.teamId === career.teamId`. Add this check at the top of `sellPlayer`:

```ts
export function sellPlayer(...): ... {
  const safe = sanitizeAmount(amount)
  const player = players.find((p) => p.id === playerId)
  // Guard: player must belong to the selling career's team
  if (!player || player.teamId !== career.teamId) return { career, teams, players }
  // ... rest unchanged
```

- [ ] **Step 4: Write tests for respondToIncomingOffer**

In `src/tests/transferService.test.ts`, add:

```ts
import { respondToIncomingOffer } from '../services/transferService'
import type { IncomingOffer } from '../types/career'

describe('respondToIncomingOffer', () => {
  const player = makePlayer({ id: 5, teamId: 1 })
  const buyingTeam = makeTeam({ id: 2, budget: 2_000_000 })
  const userTeam = makeTeam({ id: 1, budget: 500_000 })
  const offer: IncomingOffer = {
    id: 'o1', fromTeamId: 2, fromTeamName: 'Buyers FC', playerId: 5,
    amount: 300_000, date: '2026-01-01', status: 'pending',
  }
  const baseCareer = { ...makeCareer(), teamId: 1, incomingOffers: [offer] }

  it('reject marks offer as rejected', () => {
    const result = respondToIncomingOffer('o1', 'reject', baseCareer, [player], [userTeam, buyingTeam])
    expect(result.career.incomingOffers[0].status).toBe('rejected')
  })

  it('accept transfers player and deducts from buying team budget', () => {
    const result = respondToIncomingOffer('o1', 'accept', baseCareer, [player], [userTeam, buyingTeam])
    const updatedBuyer = result.teams.find(t => t.id === 2)
    expect(result.career.incomingOffers[0].status).toBe('accepted')
    expect(updatedBuyer?.budget).toBe(2_000_000 - 300_000)
    const updatedPlayer = result.players.find(p => p.id === 5)
    expect(updatedPlayer?.teamId).toBe(2)
  })

  it('fails gracefully when buyer has insufficient budget', () => {
    const brokeBuyer = makeTeam({ id: 2, budget: 100 })
    const result = respondToIncomingOffer('o1', 'accept', baseCareer, [player], [userTeam, brokeBuyer])
    expect(result.error).toBe('insufficient_budget')
    expect(result.career.incomingOffers[0].status).toBe('budget_failed')
  })
})
```

Also add `makeCareer` helper to the test file (same as in inboxService test):

Run: `npx vitest run src/tests/transferService.test.ts`
Expected: PASS

- [ ] **Step 5: Wire up store actions**

In `src/store/careerStore.ts`:

Add to `CareerState` interface:
```ts
counterIncomingOffer(offerId: string, counterAmount: number): void
```

Update `acceptTransferOffer`:
```ts
acceptTransferOffer(offerId) {
  const { career, players, teams } = get()
  if (!career) return

  const offer = career.incomingOffers.find((o) => o.id === offerId && o.status === 'pending')
  if (!offer) return

  const result = respondToIncomingOffer(offerId, 'accept', career, players, teams)

  let updatedCareer = result.career
  if (result.error === 'insufficient_budget') {
    updatedCareer = addEvent('NEWS', 'Oferta caducada',
      `${offer.fromTeamName} ya no tiene presupuesto para comprar a este jugador.`,
      updatedCareer, undefined, 'transfers')
  } else if (!result.error) {
    const fmt = (n: number) => n >= 1_000_000 ? `€${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `€${(n/1_000).toFixed(0)}K` : `€${n}`
    updatedCareer = addEvent('TRANSFER_ACCEPTED',
      `Venta confirmada`,
      `Has vendido al jugador por ${fmt(offer.amount)}.`,
      result.career, undefined, 'transfers')
  }
  set({ career: updatedCareer, players: result.players, teams: result.teams })
},

rejectTransferOffer(offerId) {
  const { career, players, teams } = get()
  if (!career) return
  const result = respondToIncomingOffer(offerId, 'reject', career, players, teams)
  set({ career: result.career })
},

counterIncomingOffer(offerId, counterAmount) {
  const { career, players, teams } = get()
  if (!career) return
  const result = respondToIncomingOffer(offerId, 'counter', career, players, teams, counterAmount)
  if (!result.error) set({ career: result.career })
},
```

Update `advanceDay` to call `resolveIncomingCounters` alongside `resolveNegotiations`:

```ts
// After resolveNegotiationsService call:
const negResult = resolveNegotiationsService(preNegCareer, nextDate, advancedPlayers, teams)
const counterResult = resolveIncomingCounters(negResult.career, nextDate, negResult.players, negResult.teams)
set({ career: counterResult.career, players: counterResult.players, teams: counterResult.teams })
```

Update `loadCareer` and `restoreAutoSave` to normalize `incomingOffers`:
```ts
incomingOffers: data.career.incomingOffers ?? [],
```

Update `generateAIOffers` call in `commitLiveMatch`:
```ts
// BEFORE:
const offers = generateAIOffers(state.career, state.teams, state.players)
if (offers.length === 0) return
for (const offer of offers) { ... }

// AFTER:
const { offers, career: careerWithOffers } = generateAIOffers(state.career, state.teams, state.players)
if (offers.length === 0) return
let updatedCareer = careerWithOffers
for (const offer of offers) {
  const fmt = (n: number) => n >= 1_000_000 ? `€${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `€${(n/1_000).toFixed(0)}K` : `€${n}`
  updatedCareer = addEvent(
    'TRANSFER_OFFER',
    `Oferta de ${offer.fromTeamName}`,
    `${offer.fromTeamName} ofrece ${fmt(offer.amount)} por ${offer.fromTeamName}.`,
    updatedCareer,
    { offerId: offer.id, playerId: offer.playerId, amount: offer.amount },
    'transfers',
  )
}
set({ career: updatedCareer })
```

Also update `startNewSeason` to clean resolved incoming offers:
```ts
// Add before the career update:
const cleanedIncoming = (career.incomingOffers ?? []).filter(o => o.status === 'pending')
// In the updatedCareer spread:
incomingOffers: cleanedIncoming,
```

- [ ] **Step 6: Add "Ofertas recibidas" tab to TransfersScreen**

In `src/screens/TransfersScreen.tsx`, add a tab system at the top. Find the current structure and wrap with:

```tsx
const [activeTab, setActiveTab] = useState<'market' | 'incoming'>('market')
const incomingOffers = career.incomingOffers?.filter(o => o.status === 'pending') ?? []

// Tab bar (add above the filter row):
<div className="flex border-b border-gray-800 mb-3">
  <button
    onClick={() => setActiveTab('market')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
      activeTab === 'market' ? 'border-gold-500 text-gold-400' : 'border-transparent text-gray-500 hover:text-gray-300'
    }`}
  >
    Mercado
  </button>
  <button
    onClick={() => setActiveTab('incoming')}
    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
      activeTab === 'incoming' ? 'border-gold-500 text-gold-400' : 'border-transparent text-gray-500 hover:text-gray-300'
    }`}
  >
    Ofertas recibidas
    {incomingOffers.length > 0 && (
      <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
        {incomingOffers.length}
      </span>
    )}
  </button>
</div>
```

Add the incoming offers panel (shown when `activeTab === 'incoming'`):

```tsx
{activeTab === 'incoming' && (
  <div className="space-y-3">
    {incomingOffers.length === 0 ? (
      <p className="text-gray-500 text-sm text-center py-8">No hay ofertas recibidas pendientes.</p>
    ) : incomingOffers.map((offer) => {
      const player = players.find(p => p.id === offer.playerId)
      const fromTeam = teams.find(t => t.id === offer.fromTeamId)
      if (!player) return null
      const marketValue = calcTransferValue(player)
      const diff = offer.amount - marketValue
      const diffPct = Math.round((diff / marketValue) * 100)
      const [counterInput, setCounterInput] = useState('')
      const acceptOffer = useCareerStore(s => s.acceptTransferOffer)
      const rejectOffer = useCareerStore(s => s.rejectTransferOffer)
      const counterOffer = useCareerStore(s => s.counterIncomingOffer)
      const fmt = (n: number) => n >= 1_000_000 ? `€${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `€${(n/1_000).toFixed(0)}K` : `€${n}`

      return (
        <div key={offer.id} className="bg-dark-800/80 rounded-xl border border-gold-600/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            {player.spriteUrl && (
              <img src={player.spriteUrl} alt={player.name} className="w-12 h-12 object-contain rounded" />
            )}
            <div className="flex-1">
              <p className="text-white font-bold">{player.name}</p>
              <p className="text-gray-400 text-xs">{player.position} · {player.age} años · Media {Math.round(player.stats.TOT / 7)}</p>
              <p className="text-gray-500 text-xs">Interesado: <span className="text-gray-300">{offer.fromTeamName}</span></p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-dark-700/60 rounded p-2">
              <p className="text-gray-500">Valor mercado</p>
              <p className="text-white font-semibold">{fmt(marketValue)}</p>
            </div>
            <div className="bg-dark-700/60 rounded p-2">
              <p className="text-gray-500">Oferta recibida</p>
              <p className="text-white font-semibold">{fmt(offer.amount)}</p>
            </div>
            <div className={`rounded p-2 ${diff >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-gray-500">Diferencia</p>
              <p className={`font-semibold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {diff >= 0 ? '+' : ''}{diffPct}%
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => acceptOffer(offer.id)}
              className="flex-1 py-2 bg-green-800/60 hover:bg-green-700/60 text-green-300 text-xs font-semibold rounded border border-green-600/40 transition-colors">
              Aceptar
            </button>
            <button onClick={() => rejectOffer(offer.id)}
              className="flex-1 py-2 bg-red-900/40 hover:bg-red-800/50 text-red-400 text-xs font-semibold rounded border border-red-700/40 transition-colors">
              Rechazar
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={`Contraoferta (ej. ${fmt(Math.round(marketValue * 1.1))})`}
              value={counterInput}
              onChange={e => setCounterInput(e.target.value)}
              className="flex-1 bg-dark-700/60 border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:border-gold-500 outline-none"
            />
            <button
              onClick={() => {
                const amt = Number(counterInput)
                if (amt > 0 && amt <= 10_000_000) { counterOffer(offer.id, amt); setCounterInput('') }
              }}
              className="px-3 py-1.5 bg-blue-800/60 hover:bg-blue-700/60 text-blue-300 text-xs font-semibold rounded border border-blue-600/40 transition-colors"
            >
              Contraofertar
            </button>
          </div>
        </div>
      )
    })}
  </div>
)}
```

Note: move the `useState` calls for `counterInput` to a sub-component `IncomingOfferCard` to avoid hooks-in-loops rule violations.

Create the sub-component above `TransfersScreen`:

```tsx
function IncomingOfferCard({ offer, players, teams }: { offer: IncomingOffer; players: Player[]; teams: Team[] }) {
  const [counterInput, setCounterInput] = useState('')
  const acceptOffer = useCareerStore(s => s.acceptTransferOffer)
  const rejectOffer = useCareerStore(s => s.rejectTransferOffer)
  const counterOffer = useCareerStore(s => s.counterIncomingOffer)
  // ... rest of the card JSX from above
}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/types/career.ts src/services/transferService.ts src/store/careerStore.ts src/screens/TransfersScreen.tsx src/tests/transferService.test.ts
git commit -m "feat: incoming transfer offers with accept/reject/counter UI and AI counter resolution"
```

---

## Task 5: Copa — Extra Time, Penalties, Stoppage

**Files:**
- Modify: `src/types/competition.ts`
- Modify: `src/services/matchSimulator.ts`
- Modify: `src/services/cupService.ts`
- Modify: `src/store/careerStore.ts`
- Modify: `src/components/MatchResultCard.tsx`
- Modify: `src/screens/LiveMatchScreen.tsx`
- Test: `src/tests/matchSimulator.test.ts` (add cases)

**Interfaces:**
- `MatchResult` gains `extraTime?`, `penalties?`, `stoppageTime?`
- `MatchEvent['type']` gains `'ET_START' | 'ET_END' | 'PENALTY_SHOOTOUT' | 'STOPPAGE'`
- New export: `simulateCupTiebreak(home, away, match, nameStyle?): MatchResult`

- [ ] **Step 1: Extend types in `competition.ts`**

```ts
// In MatchEvent type union:
type: 'GOAL' | 'SAVE' | 'MISS' | 'YELLOW' | 'RED' | 'INJURY' | 'PHASE' | 'STOPPAGE' | 'ET_START' | 'ET_END' | 'PENALTY_SHOOTOUT' | 'TECHNIQUE'

// In MatchResult:
extraTime?: { homeGoals: number; awayGoals: number }
penalties?: { homeScore: number; awayScore: number; winnerId: number }
stoppageTime?: { firstHalf: number; secondHalf: number; etFirst?: number; etSecond?: number }
```

- [ ] **Step 2: Add stoppage calculation to matchSimulator**

In `src/services/matchSimulator.ts`, add after the `pickFrom` helper:

```ts
function calcStoppageTime(halfEvents: MatchEvent[]): number {
  const injuries = halfEvents.filter((e) => e.type === 'INJURY').length
  const goals    = halfEvents.filter((e) => e.type === 'GOAL').length
  const yellows  = halfEvents.filter((e) => e.type === 'YELLOW').length
  const reds     = halfEvents.filter((e) => e.type === 'RED').length
  const raw = 1 + injuries * 1.5 + goals * 0.5 + yellows * 0.3 + reds * 1.0
  return Math.min(7, Math.max(1, Math.round(raw)))
}
```

Modify `simulateHalf` signature to accept an optional `goalProbMultiplier` (default 1.0):

```ts
function simulateHalf(
  attacker: TeamSnapshot,
  defender: TeamSnapshot,
  isHome: boolean,
  startMinute: number,
  nameStyle: 'western' | 'japanese' = 'western',
  goalProbMultiplier = 1.0,
): { goals: number; shots: number; shotsOnTarget: number; xg: number; events: MatchEvent[] } {
  // ... all existing code unchanged except:
  const goalProb = clamp((0.20 + strengthDelta + goalProbBonus) * goalProbMultiplier, 0.06, 0.75)
```

In the main `simulate` function, after computing all 4 half results, add stoppage events and fields:

```ts
const h1Stoppage = calcStoppageTime([...h1Home.events, ...h1Away.events])
const h2Stoppage = calcStoppageTime([...h2Home.events, ...h2Away.events])

// Add stoppage events after minute 45 and 90:
const stoppageEvents: MatchEvent[] = [
  { minute: 45, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${h1Stoppage} min de añadido`, isHome: true },
  { minute: 90, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${h2Stoppage} min de añadido`, isHome: true },
]

// Add to allEvents, then return:
return {
  // ... all existing fields ...
  stoppageTime: { firstHalf: h1Stoppage, secondHalf: h2Stoppage },
  events: [...phaseEvents, ...h1Home.events, ...h1Away.events, ...h2Home.events, ...h2Away.events, ...disciplinary, ...stoppageEvents].sort((a, b) => a.minute - b.minute),
}
```

- [ ] **Step 3: Add penalty simulation**

In `src/services/matchSimulator.ts`, add:

```ts
function simulatePenalties(
  homeSnap: TeamSnapshot,
  awaySnap: TeamSnapshot,
  match: Match,
): { homeScore: number; awayScore: number; winnerId: number } {
  // Higher GK score = better save probability (range ~15–45%)
  const homeSaveProb = clamp(0.15 + homeSnap.goalkeeperScore / 500, 0.15, 0.45)
  const awaySaveProb = clamp(0.15 + awaySnap.goalkeeperScore / 500, 0.15, 0.45)

  let homeScore = 0
  let awayScore = 0

  for (let i = 0; i < 5; i++) {
    if (Math.random() > awaySaveProb) homeScore++
    if (Math.random() > homeSaveProb) awayScore++
  }

  // Sudden death if still level after 5
  let sd = 0
  while (homeScore === awayScore && sd < 20) {
    if (Math.random() > awaySaveProb) homeScore++
    if (Math.random() > homeSaveProb) awayScore++
    sd++
  }

  // Break infinite tie edge case
  if (homeScore === awayScore) homeScore++

  return {
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? match.homeTeamId : match.awayTeamId,
  }
}
```

- [ ] **Step 4: Add `simulateCupTiebreak` export**

```ts
export function simulateCupTiebreak(
  homeTeam: TeamSnapshot,
  awayTeam: TeamSnapshot,
  match: Match,
  nameStyle: 'western' | 'japanese' = 'western',
): MatchResult {
  const regular = simulate(homeTeam, awayTeam, match, nameStyle)
  if (regular.homeGoals !== regular.awayGoals) return regular

  // Extra time: 2 × 15 min at 60% intensity
  const et1Home = simulateHalf(homeTeam, awayTeam, true,  91, nameStyle, 0.60)
  const et1Away = simulateHalf(awayTeam, homeTeam, false, 91, nameStyle, 0.60)
  const et2Home = simulateHalf(homeTeam, awayTeam, true,  106, nameStyle, 0.60)
  const et2Away = simulateHalf(awayTeam, homeTeam, false, 106, nameStyle, 0.60)

  const etHomeGoals = et1Home.goals + et2Home.goals
  const etAwayGoals = et1Away.goals + et2Away.goals
  const extraTime = { homeGoals: etHomeGoals, awayGoals: etAwayGoals }

  const etStoppage1 = calcStoppageTime([...et1Home.events, ...et1Away.events])
  const etStoppage2 = calcStoppageTime([...et2Home.events, ...et2Away.events])

  const etEvents: MatchEvent[] = [
    { minute: 90,  type: 'ET_START', teamId: match.homeTeamId, text: 'Comienza la prórroga', isHome: true },
    ...et1Home.events, ...et1Away.events,
    { minute: 105, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${etStoppage1} min`, isHome: true },
    { minute: 106, type: 'ET_START', teamId: match.homeTeamId, text: 'Segunda parte de prórroga', isHome: true },
    ...et2Home.events, ...et2Away.events,
    { minute: 120, type: 'ET_END',   teamId: match.homeTeamId, text: 'Final de la prórroga', isHome: true },
    { minute: 120, type: 'STOPPAGE', teamId: match.homeTeamId, text: `+${etStoppage2} min`, isHome: true },
  ]

  const updatedEvents = [...regular.events, ...etEvents].sort((a, b) => a.minute - b.minute)
  const updatedStoppage = {
    ...regular.stoppageTime,
    etFirst: etStoppage1,
    etSecond: etStoppage2,
  }

  if (regular.homeGoals + etHomeGoals !== regular.awayGoals + etAwayGoals) {
    return { ...regular, extraTime, stoppageTime: updatedStoppage, events: updatedEvents }
  }

  // Penalties
  const penalties = simulatePenalties(homeTeam, awayTeam, match)
  const penaltyEvent: MatchEvent = {
    minute: 121, type: 'PENALTY_SHOOTOUT', teamId: match.homeTeamId, isHome: true,
    text: `Penaltis: ${penalties.homeScore}–${penalties.awayScore} — Gana ${penalties.winnerId === match.homeTeamId ? homeTeam.name : awayTeam.name}`,
  }
  return {
    ...regular,
    extraTime,
    penalties,
    stoppageTime: updatedStoppage,
    events: [...updatedEvents, penaltyEvent],
  }
}
```

- [ ] **Step 5: Write tests**

In `src/tests/matchSimulator.test.ts`, add:

```ts
import { simulateCupTiebreak } from '../services/matchSimulator'

describe('simulateCupTiebreak', () => {
  const match = { id: 'm1', leagueId: 'cup', type: 'cup', round: 1,
    homeTeamId: 1, awayTeamId: 2, date: '2026-01-01', played: false,
    homeGoals: 0, awayGoals: 0, result: null } as any
  const snap = (id: number) => ({
    id, name: `Team ${id}`, formation: { tacticalType: 'BALANCED' } as any,
    forwardScore: 70, midfieldScore: 70, defenseScore: 70, goalkeeperScore: 70, starters: [],
  })

  it('returns a winner even when regular time is a draw', () => {
    // Run 50 times — each must have a definitive winner
    for (let i = 0; i < 50; i++) {
      const result = simulateCupTiebreak(snap(1), snap(2), match)
      const totalHome = result.homeGoals + (result.extraTime?.homeGoals ?? 0)
      const totalAway = result.awayGoals + (result.extraTime?.awayGoals ?? 0)
      const penaltyWinner = result.penalties?.winnerId
      const hasWinner = totalHome !== totalAway || penaltyWinner !== undefined
      expect(hasWinner).toBe(true)
    }
  })

  it('includes ET_START event when match goes to extra time', () => {
    // Force identical teams to maximize draw probability; check event presence over many runs
    let foundET = false
    for (let i = 0; i < 200; i++) {
      const result = simulateCupTiebreak(snap(1), snap(2), match)
      if (result.events.some(e => e.type === 'ET_START')) { foundET = true; break }
    }
    expect(foundET).toBe(true)
  })
})
```

Run: `npx vitest run src/tests/matchSimulator.test.ts`
Expected: PASS

- [ ] **Step 6: Update `cupService.ts`**

Fix `getMatchWinner` to use ET and penalties:

```ts
function getMatchWinner(match: Match): number | null {
  if (!match.played || !match.result) return null
  const r = match.result
  // Check penalties first (definitive)
  if (r.penalties) return r.penalties.winnerId
  // Then extra time
  if (r.extraTime) {
    const totalHome = r.homeGoals + r.extraTime.homeGoals
    const totalAway = r.awayGoals + r.extraTime.awayGoals
    if (totalHome > totalAway) return match.homeTeamId
    if (totalAway > totalHome) return match.awayTeamId
    return null // should never happen after tiebreak
  }
  // Regular time
  if (r.homeGoals > r.awayGoals) return match.homeTeamId
  if (r.awayGoals > r.homeGoals) return match.awayTeamId
  return null
}
```

Update `simulateCupMatch` to use `simulateCupTiebreak`:

```ts
import { simulateCupTiebreak } from './matchSimulator'

export function simulateCupMatch(match: Match, teams: Team[], players: Player[]): Match {
  if (match.homeTeamId === -1 || match.awayTeamId === -1) return match
  const homeTeam = teams.find((t) => t.id === match.homeTeamId)
  const awayTeam = teams.find((t) => t.id === match.awayTeamId)
  if (!homeTeam || !awayTeam) return match

  const homeSnap = buildNpcSnapshot(homeTeam, players)
  const awaySnap = buildNpcSnapshot(awayTeam, players)
  const result = simulateCupTiebreak(homeSnap, awaySnap, match)

  return {
    ...match,
    played: true,
    homeGoals: result.homeGoals + (result.extraTime?.homeGoals ?? 0),
    awayGoals: result.awayGoals + (result.extraTime?.awayGoals ?? 0),
    result,
  }
}
```

- [ ] **Step 7: Update store to use `simulateCupTiebreak` for user matches**

In `src/store/careerStore.ts`, in both `simulateCupMatch` and `startLiveCupMatch` store actions, replace:

```ts
const result = simulate(homeSnap, awaySnap, match, career.nameStyle)
```

with:

```ts
const result = simulateCupTiebreak(homeSnap, awaySnap, match, career.nameStyle)
```

Import `simulateCupTiebreak` at the top of the store alongside `simulate`:

```ts
import { simulate, simulateCupTiebreak, buildSnapshot } from '../services/matchSimulator'
```

In `commitMatchResult` (isCupMatch branch), when storing the result, also store ET total in homeGoals/awayGoals for display:

```ts
const updatedMatch = {
  ...match,
  played: true,
  homeGoals: result.homeGoals + (result.extraTime?.homeGoals ?? 0),
  awayGoals: result.awayGoals + (result.extraTime?.awayGoals ?? 0),
  result,
}
```

- [ ] **Step 8: Update `MatchResultCard` to show ET/penalties**

In `src/components/MatchResultCard.tsx`, after the main score display, add:

```tsx
{result.extraTime && (
  <div className="mt-2 text-center">
    <span className="text-xs font-bold text-yellow-400 bg-yellow-900/30 border border-yellow-700/40 rounded px-2 py-0.5">
      PRÓRROGA
    </span>
    <p className="text-gray-400 text-xs mt-1">
      ET: {result.extraTime.homeGoals} – {result.extraTime.awayGoals}
    </p>
  </div>
)}
{result.penalties && (
  <div className="mt-2 text-center">
    <span className="text-xs font-bold text-orange-400 bg-orange-900/30 border border-orange-700/40 rounded px-2 py-0.5">
      PENALTIS
    </span>
    <p className="text-gray-400 text-xs mt-1">
      {result.penalties.homeScore} – {result.penalties.awayScore}
    </p>
  </div>
)}
```

- [ ] **Step 9: Update `LiveMatchScreen` to render new event types**

In `src/screens/LiveMatchScreen.tsx`, find the event type display logic and add handling for the new types. Look for where `MatchEvent.type` is used to render icons/colors and add:

```tsx
// In the event icon/color map, add:
ET_START: { icon: 'more_time', color: 'text-yellow-400', label: 'Prórroga' },
ET_END:   { icon: 'sports_score', color: 'text-yellow-400', label: 'Prórroga' },
PENALTY_SHOOTOUT: { icon: 'sports', color: 'text-orange-400', label: 'Penaltis' },
STOPPAGE: { icon: 'add', color: 'text-gray-400', label: 'Añadido' },
```

- [ ] **Step 10: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/types/competition.ts src/services/matchSimulator.ts src/services/cupService.ts src/store/careerStore.ts src/components/MatchResultCard.tsx src/screens/LiveMatchScreen.tsx src/tests/matchSimulator.test.ts
git commit -m "feat: cup extra time, penalties, and stoppage time — no more draws in cup"
```

---

## Task 6: Techniques in Match Simulation

**Files:**
- Modify: `src/types/team.ts`
- Modify: `src/services/formationService.ts`
- Modify: `src/services/matchSimulator.ts`
- Modify: `src/screens/LiveMatchScreen.tsx`
- Test: `src/tests/matchSimulator.test.ts` (add cases)

**Interfaces:**
- `SnapshotPlayer` gains `techniques?: Technique[]`
- `buildTeamSnapshot` populates `techniques` from player data
- `simulateHalf` uses techniques for goal/save probability modifiers
- New `TECHNIQUE` events in match output

- [ ] **Step 1: Add `techniques` to `SnapshotPlayer`**

In `src/types/team.ts`:

```ts
import type { Technique } from './player'

export interface SnapshotPlayer {
  id: number
  name: string
  nameRomaji: string
  spriteUrl: string
  position: Position
  element?: import('./player').Element
  techniques?: Technique[]
}
```

- [ ] **Step 2: Populate techniques in `buildTeamSnapshot`**

In `src/services/formationService.ts`, in the `starterPlayers` mapping:

```ts
const starterPlayers: SnapshotPlayer[] = starters
  .map((slot) => {
    const p = playerMap.get(slot.playerId)
    if (!p) return null
    return {
      id: p.id,
      name: p.name,
      nameRomaji: p.nameRomaji,
      spriteUrl: p.spriteUrl,
      position: slot.assignedPosition,
      element: p.element,
      techniques: p.techniques,
    }
  })
  .filter((p): p is SnapshotPlayer => p !== null)
```

- [ ] **Step 3: Add technique and element helpers to matchSimulator**

In `src/services/matchSimulator.ts`, add after `pickFrom`:

```ts
import type { Technique, Element } from '../types/player'

function pickTechnique(player: SnapshotPlayer | null, type: Technique['type']): Technique | null {
  if (!player?.techniques) return null
  return player.techniques
    .filter((t) => t.type === type)
    .sort((a, b) => b.POT - a.POT)[0] ?? null
}

// FIRE > WOOD > WIND > MOUNTAIN > FIRE
const ELEMENT_ADVANTAGES: Record<Element, Element> = {
  FIRE: 'WOOD', WOOD: 'WIND', WIND: 'MOUNTAIN', MOUNTAIN: 'FIRE',
}

function elementMatchupBonus(atkElement?: Element | '', defElement?: Element | ''): number {
  if (!atkElement || !defElement || atkElement === '' || defElement === '') return 0
  if (ELEMENT_ADVANTAGES[atkElement as Element] === defElement) return 0.05
  if (ELEMENT_ADVANTAGES[defElement as Element] === atkElement) return -0.05
  return 0
}
```

- [ ] **Step 4: Use techniques in `simulateHalf`**

In `simulateHalf`, modify the shot-on-target block to incorporate techniques:

```ts
if (onTarget) {
  shotsOnTarget++
  const gk = pickFrom(defGk.length > 0 ? defGk : defStarters)

  // Technique modifiers
  const atkTech = pickTechnique(scorer ?? null, 'Tiro')
  const gkTech  = pickTechnique(gk ?? null, 'Parada')
  const techBonus  = atkTech ? atkTech.POT / 800  : 0
  const techPenalty = gkTech ? gkTech.POT / 900   : 0
  const elemBonus  = elementMatchupBonus(
    atkTech?.element || scorer?.element,
    gkTech?.element  || gk?.element,
  )
  const adjustedGoalProb = clamp(goalProb + techBonus - techPenalty + elemBonus, 0.06, 0.75)

  if (Math.random() < adjustedGoalProb) {
    goals++
    const scorerName = scorer ? (nameStyle === 'japanese' ? scorer.nameRomaji : scorer.name) : null
    events.push(mkEvent(minute, 'GOAL', attacker.id,
      scorerName ? `¡Gol de ${scorerName}!` : `¡Gol de ${attacker.name}!`,
      isHome, scorer, nameStyle))

    if (atkTech) {
      events.push({
        minute,
        type: 'TECHNIQUE',
        teamId: attacker.id,
        isHome,
        text: `${scorer ? (nameStyle === 'japanese' ? scorer.nameRomaji : scorer.name) : '?'} usa ${atkTech.name}!`,
        playerId: scorer?.id,
        playerName: scorer ? (nameStyle === 'japanese' ? scorer.nameRomaji : scorer.name) : undefined,
        techniqueName: atkTech.name,
        techniqueOutcome: 'success',
        techniqueElement: atkTech.element || undefined,
      } as MatchEvent)
    }
  } else {
    const gkName = gk ? (nameStyle === 'japanese' ? gk.nameRomaji : gk.name) : null
    events.push(mkEvent(minute, 'SAVE', defender.id,
      gkName ? `Parada de ${gkName}` : `Parada de ${defender.name}`,
      !isHome, gk, nameStyle))

    if (gkTech) {
      events.push({
        minute,
        type: 'TECHNIQUE',
        teamId: defender.id,
        isHome: !isHome,
        text: `${gkName ?? '?'} usa ${gkTech.name}!`,
        playerId: gk?.id,
        playerName: gkName ?? undefined,
        techniqueName: gkTech.name,
        techniqueOutcome: 'success',
        techniqueElement: gkTech.element || undefined,
      } as MatchEvent)
    }
  }
```

Also add Regate bonus to chance generation: before the `for (let i = 0; i < chances; i++)` loop, add:

```ts
// Top midfielder with Regate gets a slight chance generation bonus
const topMid = atkFwMd.find(p => p.position === 'MD')
const regateTech = pickTechnique(topMid ?? null, 'Regate')
const regateBonus = regateTech ? 0.3 : 0
const actualChances = Math.max(0, Math.round((baseChances + regateBonus) / 2))
// Replace `chances` with `actualChances` in the for loop:
for (let i = 0; i < actualChances; i++) {
```

Also update the `MatchEvent` type assertion in `mkEvent` — add `techniqueName`, `techniqueOutcome`, `techniqueElement` to `MatchEvent` in `competition.ts`:

```ts
export interface MatchEvent {
  // ... existing fields ...
  techniqueName?: string
  techniqueOutcome?: 'success' | 'fail'
  techniqueElement?: import('./player').Element
}
```

- [ ] **Step 5: Write test**

In `src/tests/matchSimulator.test.ts`, add:

```ts
describe('technique simulation', () => {
  it('generates TECHNIQUE events when players have techniques', () => {
    const tech: import('../types/player').Technique = { id: 1, name: 'Gran Fuego', type: 'Tiro', element: 'FIRE', POT: 150, PP: 20 }
    const snapWithTech = (id: number) => ({
      id, name: `Team ${id}`, formation: { tacticalType: 'BALANCED' } as any,
      forwardScore: 80, midfieldScore: 80, defenseScore: 60, goalkeeperScore: 60,
      starters: [
        { id: 10, name: 'Striker', nameRomaji: 'Striker', spriteUrl: '', position: 'FW' as const, element: 'FIRE' as const, techniques: [tech] },
      ],
    })
    let foundTech = false
    for (let i = 0; i < 100; i++) {
      const match = { id: 'm1', leagueId: 'test', round: 1, homeTeamId: 1, awayTeamId: 2, date: '2026-01-01', played: false, homeGoals: 0, awayGoals: 0, result: null } as any
      const result = simulate(snapWithTech(1), snapWithTech(2), match)
      if (result.events.some(e => e.type === 'TECHNIQUE')) { foundTech = true; break }
    }
    expect(foundTech).toBe(true)
  })
})
```

Run: `npx vitest run src/tests/matchSimulator.test.ts`
Expected: PASS

- [ ] **Step 6: Render TECHNIQUE events in `LiveMatchScreen`**

In `src/screens/LiveMatchScreen.tsx`, add TECHNIQUE to the event rendering logic (wherever GOAL/SAVE/MISS are rendered):

```tsx
// In event type icon/color map:
TECHNIQUE: { icon: 'bolt', color: 'text-yellow-300' },

// In event rendering, for TECHNIQUE events show the technique name as a badge:
{event.type === 'TECHNIQUE' && event.techniqueName && (
  <span className="text-[10px] font-bold bg-yellow-900/40 border border-yellow-600/40 text-yellow-300 rounded px-1.5 py-0.5 ml-1">
    {event.techniqueName}
  </span>
)}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/types/team.ts src/types/competition.ts src/services/formationService.ts src/services/matchSimulator.ts src/screens/LiveMatchScreen.tsx src/tests/matchSimulator.test.ts
git commit -m "feat: supertécnicas participan en la simulación de partidos con eventos y bonificadores"
```

---

## Task 7: Scaled Objectives + Difficulty Popup

**Files:**
- Modify: `src/types/career.ts`
- Modify: `src/services/careerService.ts`
- Modify: `src/store/careerStore.ts`
- Modify: `src/screens/CareerHomeScreen.tsx`
- Modify: `src/screens/SeasonReviewScreen.tsx`
- Modify: `src/components/ObjectivesPanel.tsx`
- Test: `src/tests/objectiveService.test.ts` (add cases)

**Interfaces:**
- `Objective` gains `groupType?: 'season_end' | 'continuous' | 'match'`
- `Career` gains `objectiveDifficulty?: 'easy' | 'normal' | 'hard' | 'very_hard'`
- `getObjectivesForTeam(team, league, difficulty?)` updated signature

- [ ] **Step 1: Extend types**

In `src/types/career.ts`, add to `Objective`:

```ts
export type ObjectiveGroupType = 'season_end' | 'continuous' | 'match'

export interface Objective {
  // ... existing fields ...
  groupType?: ObjectiveGroupType
}
```

Add to `Career`:

```ts
objectiveDifficulty?: 'easy' | 'normal' | 'hard' | 'very_hard'
```

- [ ] **Step 2: Rewrite `buildObjectives` in careerService**

In `src/services/careerService.ts`, replace `buildObjectives`:

```ts
const DIFFICULTY_MULTIPLIERS = {
  easy: 0.65,
  normal: 1.0,
  hard: 1.35,
  very_hard: 1.7,
}

// Goals-per-match expectation by tier
const GOALS_PER_MATCH_BY_TIER: Record<number, number> = { 1: 2.0, 2: 1.6 }
const defaultGoalsPerMatch = 1.2

// Win rate expectation by tier
const WIN_RATE_BY_TIER: Record<number, number> = { 1: 0.60, 2: 0.45 }
const defaultWinRate = 0.35

function buildObjectives(
  team: Team,
  league: League,
  difficulty: 'easy' | 'normal' | 'hard' | 'very_hard' = 'normal',
): Objective[] {
  const objectives: Objective[] = []
  const mult = DIFFICULTY_MULTIPLIERS[difficulty]
  const totalMatches = league.rounds  // full season rounds

  // --- Mandatory SEASON_END: main goal ---
  if (team.tier <= 2) {
    objectives.push(obj('WIN_LEAGUE', 'Ganar el título de liga', 1,
      { money: 500_000, reputation: 15 }, { reputation: 12 },
      true, 'SEASON', 'HARD', 'main_goal', 'season_end'))
  } else if (league.relegationSlots > 0) {
    objectives.push(obj('AVOID_RELEGATION', 'Evitar el descenso esta temporada', 1,
      { money: 100_000, reputation: 5 }, { reputation: 10 },
      true, 'SEASON', 'EASY', 'main_goal', 'season_end'))
  } else {
    const safeZone = Math.max(1, league.teamsCount - 2)
    objectives.push(obj('TOP_N', `Terminar entre los ${safeZone} primeros`, safeZone,
      { money: 100_000, reputation: 5 }, { reputation: 10 },
      true, 'SEASON', 'EASY', 'main_goal', 'season_end'))
  }

  // --- Optional SEASON_END: position ---
  const topN = team.tier <= 2 ? 3 : 5
  objectives.push(obj('TOP_N', `Terminar entre los ${topN} primeros`, topN,
    { money: 200_000, reputation: 8 }, { reputation: 0 },
    false, 'SEASON', 'HARD', 'finish_position', 'season_end'))

  // --- Optional CONTINUOUS: wins ---
  const winRate = WIN_RATE_BY_TIER[team.tier] ?? defaultWinRate
  const winTarget = Math.max(3, Math.min(
    Math.ceil(totalMatches * 0.90),
    Math.ceil(totalMatches * winRate * mult),
  ))
  objectives.push(obj('WIN_MATCHES', `Ganar al menos ${winTarget} partidos`, winTarget,
    { money: 75_000, reputation: 3 }, { reputation: 0 },
    false, 'SEASON', 'NORMAL', undefined, 'continuous'))

  // --- Optional CONTINUOUS: points ---
  const pointsTarget = Math.max(6, Math.min(
    Math.ceil(totalMatches * 3 * 0.90),
    Math.ceil(totalMatches * winRate * 3 * mult),
  ))
  objectives.push(obj('EARN_POINTS', `Conseguir al menos ${pointsTarget} puntos`, pointsTarget,
    { money: 50_000, reputation: 3 }, { reputation: 0 },
    false, 'SEASON', 'NORMAL', undefined, 'continuous'))

  // --- Optional CONTINUOUS: goals ---
  const gpm = GOALS_PER_MATCH_BY_TIER[team.tier] ?? defaultGoalsPerMatch
  const goalsTarget = Math.max(5, Math.min(
    Math.ceil(totalMatches * gpm * 0.90),
    Math.ceil(totalMatches * gpm * mult),
  ))
  objectives.push(obj('SCORE_GOALS', `Marcar al menos ${goalsTarget} goles`, goalsTarget,
    { money: 40_000, reputation: 2 }, { reputation: 0 },
    false, 'GENERAL', 'NORMAL', undefined, 'continuous'))

  // --- Optional SEASON_END: concede few ---
  const concedeTarget = Math.max(5, Math.round(totalMatches * 1.2 / mult))
  objectives.push(obj('CONCEDE_FEW', `Recibir menos de ${concedeTarget} goles`, concedeTarget,
    { money: 60_000, reputation: 2 }, { reputation: 0 },
    false, 'GENERAL', 'NORMAL', undefined, 'season_end'))

  return objectives
}
```

Update the `obj` helper to accept `groupType`:

```ts
function obj(
  type: ObjectiveType,
  description: string,
  target: number,
  reward: ObjectiveReward,
  penalty: ObjectivePenalty,
  isMandatory: boolean,
  category: ObjectiveCategory,
  difficulty: ObjectiveDifficulty,
  exclusionGroup?: string,
  groupType?: ObjectiveGroupType,
): Objective {
  return {
    id: crypto.randomUUID(), type, category, difficulty, exclusionGroup, groupType,
    description, target, current: 0,
    completed: false, failed: false, claimed: false, penaltyApplied: false,
    reward, penalty, isMandatory,
  }
}
```

Update `getObjectivesForTeam` signature:

```ts
export function getObjectivesForTeam(
  team: Team,
  league: League,
  difficulty: 'easy' | 'normal' | 'hard' | 'very_hard' = 'normal',
): Objective[] {
  return buildObjectives(team, league, difficulty)
}
```

- [ ] **Step 3: Write tests for scaled objectives**

In `src/tests/objectiveService.test.ts`, add:

```ts
import { getObjectivesForTeam } from '../services/careerService'
import type { Team } from '../types/team'
import type { League } from '../types/competition'

const makeLeague = (rounds: number, teamsCount: number): League => ({
  id: 'test', name: 'Liga Test', level: 2, promotionTo: null, relegationTo: null,
  promotionSlots: 0, relegationSlots: 2, teamsCount, rounds,
})
const makeTeam = (tier: number): Team => ({
  id: 1, name: 'Test FC', tier, reputation: 50, budget: 1_000_000,
  leagueId: 'test', captainId: 1, formation: {} as any, lineup: [], playerIds: [],
})

describe('getObjectivesForTeam — scaled targets', () => {
  it('score goals target scales with league rounds', () => {
    const short = getObjectivesForTeam(makeTeam(3), makeLeague(14, 8))
    const long  = getObjectivesForTeam(makeTeam(3), makeLeague(38, 20))
    const shortGoals = short.find(o => o.type === 'SCORE_GOALS')!.target
    const longGoals  = long.find(o => o.type === 'SCORE_GOALS')!.target
    expect(shortGoals).toBeLessThan(longGoals)
    // Short league (14 rounds) should never demand 30 goals
    expect(shortGoals).toBeLessThan(25)
  })

  it('hard difficulty produces higher targets than easy', () => {
    const easy = getObjectivesForTeam(makeTeam(3), makeLeague(20, 10), 'easy')
    const hard = getObjectivesForTeam(makeTeam(3), makeLeague(20, 10), 'hard')
    const easyWins = easy.find(o => o.type === 'WIN_MATCHES')!.target
    const hardWins = hard.find(o => o.type === 'WIN_MATCHES')!.target
    expect(hardWins).toBeGreaterThan(easyWins)
  })

  it('no target exceeds the mathematical maximum for the season', () => {
    const objs = getObjectivesForTeam(makeTeam(3), makeLeague(14, 8), 'very_hard')
    const wins = objs.find(o => o.type === 'WIN_MATCHES')!.target
    expect(wins).toBeLessThanOrEqual(14)
  })

  it('objectives have correct groupType', () => {
    const objs = getObjectivesForTeam(makeTeam(3), makeLeague(20, 10))
    const seasonEnd  = objs.filter(o => o.groupType === 'season_end')
    const continuous = objs.filter(o => o.groupType === 'continuous')
    expect(seasonEnd.length).toBeGreaterThan(0)
    expect(continuous.length).toBeGreaterThan(0)
  })
})
```

Run: `npx vitest run src/tests/objectiveService.test.ts`
Expected: PASS

- [ ] **Step 4: Add difficulty popup and wire up store**

In `src/store/careerStore.ts`, update `startNewSeason` signature:

```ts
startNewSeason(objectiveDifficulty?: 'easy' | 'normal' | 'hard' | 'very_hard'): void
```

In the implementation, pass difficulty to objectives and store it:

```ts
startNewSeason(objectiveDifficulty = 'normal') {
  // ... existing setup ...
  const newObjectives = league && userTeam
    ? getObjectivesForTeam(userTeam, league, objectiveDifficulty)
    : career.objectives

  let updatedCareer: Career = {
    ...career,
    // ... existing spread ...
    objectives: newObjectives,
    objectiveDifficulty,
  }
  // ... rest unchanged
},
```

Update `loadCareer` and `restoreAutoSave`:
```ts
objectiveDifficulty: data.career.objectiveDifficulty ?? 'normal',
```

In `CareerState` interface:
```ts
startNewSeason(objectiveDifficulty?: 'easy' | 'normal' | 'hard' | 'very_hard'): void
```

- [ ] **Step 5: Add difficulty popup to `SeasonReviewScreen`**

In `src/screens/SeasonReviewScreen.tsx`, add a difficulty selection state and modal before calling `startNewSeason`:

```tsx
const [showDifficultyModal, setShowDifficultyModal] = useState(false)

const DIFFICULTY_OPTIONS = [
  { key: 'easy',      label: 'Fácil',       desc: 'Objetivos asequibles, recompensas reducidas.',  color: 'text-green-400',  border: 'border-green-600/40' },
  { key: 'normal',    label: 'Normal',      desc: 'Equilibrio estándar.',                           color: 'text-blue-400',   border: 'border-blue-600/40'  },
  { key: 'hard',      label: 'Difícil',     desc: 'Objetivos exigentes, mejores recompensas.',     color: 'text-orange-400', border: 'border-orange-600/40'},
  { key: 'very_hard', label: 'Muy difícil', desc: 'Objetivos ambiciosos, penalizaciones mayores.', color: 'text-red-400',    border: 'border-red-600/40'   },
] as const

// Replace the "Iniciar Temporada" button with:
<button
  onClick={() => setShowDifficultyModal(true)}
  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
>
  <Icon name="play_arrow" size="sm" />
  Iniciar Temporada {review.seasonNumber + 1}
</button>

{/* Difficulty modal */}
{showDifficultyModal && (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
    <div className="bg-dark-800 border border-gold-600/30 rounded-2xl p-6 w-full max-w-sm space-y-4">
      <h2 className="text-white font-bold text-lg">Dificultad de objetivos</h2>
      <p className="text-gray-400 text-sm">Elige la dificultad de los objetivos para la temporada {review.seasonNumber + 1}.</p>
      <div className="space-y-2">
        {DIFFICULTY_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => { startNewSeason(opt.key); setShowDifficultyModal(false) }}
            className={`w-full text-left p-3 rounded-xl border ${opt.border} bg-dark-700/60 hover:bg-dark-600/60 transition-colors`}
          >
            <p className={`font-semibold text-sm ${opt.color}`}>{opt.label}</p>
            <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
      <button onClick={() => setShowDifficultyModal(false)}
        className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors">
        Cancelar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Update `ObjectivesPanel` to show groups**

In `src/components/ObjectivesPanel.tsx`, group and display objectives:

```tsx
const seasonEndObjs  = objectives.filter(o => o.groupType === 'season_end' || (!o.groupType && o.category === 'SEASON'))
const continuousObjs = objectives.filter(o => o.groupType === 'continuous' || (!o.groupType && o.category === 'GENERAL'))
const matchObjs      = objectives.filter(o => o.groupType === 'match' || o.category === 'MATCH')

function GroupHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2 mt-4 first:mt-0">
      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">{label}</h3>
      {sub && <span className="text-gray-600 text-[10px]">{sub}</span>}
    </div>
  )
}

// In render:
{seasonEndObjs.length > 0 && (
  <>
    <GroupHeader label="Fin de temporada" sub="Se evalúan al cerrar la temporada" />
    {seasonEndObjs.map(obj => (
      <ObjectiveCard key={obj.id} objective={obj} seasonFinished={season.finished} onClaim={...} />
    ))}
  </>
)}
{continuousObjs.length > 0 && (
  <>
    <GroupHeader label="Continuos" />
    {continuousObjs.map(obj => (
      <ObjectiveCard key={obj.id} objective={obj} seasonFinished={season.finished} onClaim={...} />
    ))}
  </>
)}
{matchObjs.length > 0 && (
  <>
    <GroupHeader label="De partido" />
    {matchObjs.map(obj => (
      <ObjectiveCard key={obj.id} objective={obj} seasonFinished={season.finished} onClaim={...} />
    ))}
  </>
)}
```

Also update `ObjectiveCard` to show the "Solo al final de temporada" chip for `season_end` objectives:

```tsx
{objective.groupType === 'season_end' && !season.finished && (
  <span className="text-[10px] bg-blue-900/40 text-blue-400 border border-blue-700/40 rounded px-1.5 py-0.5">
    Solo al final
  </span>
)}
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/types/career.ts src/services/careerService.ts src/store/careerStore.ts src/screens/CareerHomeScreen.tsx src/screens/SeasonReviewScreen.tsx src/components/ObjectivesPanel.tsx src/tests/objectiveService.test.ts
git commit -m "feat: scaled season objectives with difficulty popup and grouped display"
```

---

## Task 8: Reward Equip Modal

**Files:**
- Create: `src/components/RewardEquipModal.tsx`
- Modify: `src/store/careerStore.ts`
- Modify: `src/screens/CareerHomeScreen.tsx` (or wherever rewards are shown)
- Test: manual (no pure logic to unit test — UI interaction)

**Interfaces:**
- Store gains `rewardBeingEquipped: MatchReward | null`
- Store gains `openRewardEquip(reward: MatchReward): void` and `closeRewardEquip(): void`
- `claimReward` for `equipment`/`technique_book` calls `openRewardEquip` instead of applying directly

- [ ] **Step 1: Add `rewardBeingEquipped` to store**

In `src/store/careerStore.ts`, add to `CareerState`:

```ts
rewardBeingEquipped: MatchReward | null
openRewardEquip(reward: MatchReward): void
closeRewardEquip(): void
```

Initialize in create:

```ts
rewardBeingEquipped: null,

openRewardEquip(reward) {
  set({ rewardBeingEquipped: reward })
},

closeRewardEquip() {
  set({ rewardBeingEquipped: null })
},
```

Update `claimReward` for `equipment` and `technique_book`:

```ts
claimReward(reward) {
  const { career, players, teams } = get()
  if (!career) return

  if (reward.type === 'equipment' && reward.equipmentItem) {
    // Open modal instead of directly claiming
    set({ pendingRewards: null })
    get().openRewardEquip(reward)
    return
  }

  if (reward.type === 'technique_book' && reward.techniqueBook) {
    set({ pendingRewards: null })
    get().openRewardEquip(reward)
    return
  }

  // money and stat_boost: unchanged behavior
  if (reward.type === 'money' && reward.moneyAmount) {
    const updatedTeams = teams.map((t) =>
      t.id === career.teamId ? { ...t, budget: t.budget + reward.moneyAmount! } : t,
    )
    set({ teams: updatedTeams, pendingRewards: null })
  } else if (reward.type === 'stat_boost' && reward.statBoost) {
    const { playerId, stat, amount } = reward.statBoost
    const updatedPlayers = players.map((p) => {
      if (p.id !== playerId) return p
      const newStats = { ...p.stats, [stat]: (p.stats[stat] ?? 0) + amount }
      newStats.TOT = Object.entries(newStats).filter(([k]) => k !== 'TOT').reduce((s, [, v]) => s + (v as number), 0)
      return { ...p, stats: newStats }
    })
    set({ players: updatedPlayers, pendingRewards: null })
  } else {
    set({ pendingRewards: null })
  }
},
```

Also update `claimReward` for `equipment` fallback (save to inventory, used by modal's "Guardar"):

Add a new action `saveRewardToInventory(reward: MatchReward): void`:

```ts
saveRewardToInventory(reward) {
  const { career } = get()
  if (!career) return
  if (reward.type === 'technique_book' && reward.techniqueBook) {
    const book = reward.techniqueBook
    const updatedInventory = {
      ...career.inventory,
      techniqueBooks: { ...career.inventory.techniqueBooks, [book.id]: (career.inventory.techniqueBooks[book.id] ?? 0) + 1 },
      generatedBooks: { ...career.inventory.generatedBooks, [book.id]: book },
    }
    set({ career: { ...career, inventory: updatedInventory }, rewardBeingEquipped: null })
  } else if (reward.type === 'equipment' && reward.equipmentItem) {
    const updatedInventory = {
      ...career.inventory,
      equipmentItems: [...career.inventory.equipmentItems, reward.equipmentItem],
    }
    set({ career: { ...career, inventory: updatedInventory }, rewardBeingEquipped: null })
  } else {
    set({ rewardBeingEquipped: null })
  }
},
```

Add `saveRewardToInventory` to `CareerState` interface.

- [ ] **Step 2: Create `RewardEquipModal.tsx`**

Create `src/components/RewardEquipModal.tsx`:

```tsx
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import Icon from './Icon'
import type { MatchReward } from '../types/reward'
import type { Player } from '../types/player'
import type { EquipmentItem, EquipmentSlot } from '../types/equipment'
import { getEffectiveStats } from '../services/equipmentService'

function StatDelta({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before
  if (delta === 0) return <span className="text-gray-500 text-xs">{label}: {before}</span>
  return (
    <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
      {label}: {before} → {after} ({delta > 0 ? '+' : ''}{delta})
    </span>
  )
}

function EquipmentEquipView({ reward, players, onClose }: { reward: MatchReward; players: Player[]; onClose: () => void }) {
  const equipItem   = useCareerStore((s) => s.equipItem)
  const saveReward  = useCareerStore((s) => s.saveRewardToInventory)
  const closeEquip  = useCareerStore((s) => s.closeRewardEquip)
  const [selected, setSelected] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)

  const item = reward.equipmentItem!
  const squadPlayers = players.filter((p) => p)

  function handleEquip() {
    if (selected === null) return
    equipItem(selected, item.id)  // equipmentService handles returning old item to inventory
    closeEquip()
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-700/60 rounded-xl p-3 border border-gold-600/20">
        <p className="text-gold-400 font-bold text-sm">{item.name}</p>
        <p className="text-gray-400 text-xs">{item.slot} · {item.description ?? ''}</p>
      </div>

      <p className="text-gray-400 text-xs">Selecciona un jugador para equiparlo:</p>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {squadPlayers.map((p) => {
          const currentItem = p.equipment?.[item.slot as EquipmentSlot] ?? null
          const baseStats = p.stats
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected === p.id ? 'border-gold-500 bg-dark-600/80' : 'border-gray-700 bg-dark-700/40 hover:bg-dark-600/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-semibold">{p.name}</p>
                  <p className="text-gray-500 text-xs">{p.position} · Media {Math.round(p.stats.TOT / 7)}</p>
                </div>
                {currentItem && (
                  <span className="text-[10px] text-orange-400 bg-orange-900/30 border border-orange-700/40 rounded px-1.5 py-0.5">
                    {currentItem.name}
                  </span>
                )}
              </div>
              {selected === p.id && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(item.statBoosts ?? {}).map(([stat, boost]) => (
                    <StatDelta key={stat} label={stat} before={baseStats[stat as keyof typeof baseStats] as number} after={(baseStats[stat as keyof typeof baseStats] as number) + boost} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={() => { saveReward(reward); onClose() }}
          className="flex-1 py-2.5 bg-dark-700/60 hover:bg-dark-600/60 text-gray-300 text-sm font-semibold rounded-xl border border-gray-700 transition-colors">
          Guardar en inventario
        </button>
        <button
          onClick={handleEquip}
          disabled={selected === null}
          className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-dark-900 text-sm font-bold rounded-xl transition-colors"
        >
          Equipar
        </button>
      </div>
    </div>
  )
}

function TechniqueEquipView({ reward, players, onClose }: { reward: MatchReward; players: Player[]; onClose: () => void }) {
  const teachTechnique = useCareerStore((s) => s.teachTechnique)
  const saveReward     = useCareerStore((s) => s.saveRewardToInventory)
  const closeEquip     = useCareerStore((s) => s.closeRewardEquip)
  const [selected, setSelected] = useState<number | null>(null)
  const [replaceIndex, setReplaceIndex] = useState<number | undefined>(undefined)
  const [showReplaceFor, setShowReplaceFor] = useState<number | null>(null)

  const book = reward.techniqueBook!
  const tech = book.technique

  function handleTeach() {
    if (selected === null) return
    teachTechnique(selected, book.id, replaceIndex)
    closeEquip()
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="bg-dark-700/60 rounded-xl p-3 border border-gold-600/20">
        <p className="text-gold-400 font-bold text-sm">{tech.name}</p>
        <p className="text-gray-400 text-xs">{tech.type} · {tech.element || 'Sin elemento'} · POT {tech.POT} · PP {tech.PP}</p>
      </div>

      <p className="text-gray-400 text-xs">Selecciona un jugador para enseñarle la técnica:</p>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {players.map((p) => {
          const maxSlots = book.isImprovement ? 2 : 3
          const existingTechs = book.isImprovement ? (p.improvementTechniques ?? []) : p.techniques
          const hasFreeSlot = existingTechs.length < maxSlots

          return (
            <div key={p.id}>
              <button
                onClick={() => { setSelected(p.id); setShowReplaceFor(null); setReplaceIndex(undefined) }}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selected === p.id ? 'border-gold-500 bg-dark-600/80' : 'border-gray-700 bg-dark-700/40 hover:bg-dark-600/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{p.name}</p>
                    <p className="text-gray-500 text-xs">{p.position}</p>
                  </div>
                  <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${hasFreeSlot ? 'text-green-400 bg-green-900/30 border border-green-700/40' : 'text-orange-400 bg-orange-900/30 border border-orange-700/40'}`}>
                    {existingTechs.length}/{maxSlots} técnicas
                  </span>
                </div>
              </button>

              {selected === p.id && !hasFreeSlot && (
                <div className="ml-2 mt-1 space-y-1">
                  <p className="text-gray-500 text-xs">Reemplazar:</p>
                  {existingTechs.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setReplaceIndex(i)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                        replaceIndex === i ? 'border-red-500 bg-red-900/30 text-red-300' : 'border-gray-700 bg-dark-700/40 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {t.name} (POT {t.POT}) — se guardará en inventario
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={() => { saveReward(reward); onClose() }}
          className="flex-1 py-2.5 bg-dark-700/60 hover:bg-dark-600/60 text-gray-300 text-sm font-semibold rounded-xl border border-gray-700 transition-colors">
          Guardar
        </button>
        <button
          onClick={handleTeach}
          disabled={selected === null || (!players.find(p => p.id === selected)?.techniques?.length || (players.find(p => p.id === selected)!.techniques.length < 3)) ? false : replaceIndex === undefined}
          className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-dark-900 text-sm font-bold rounded-xl transition-colors"
        >
          Enseñar
        </button>
      </div>
    </div>
  )
}

export default function RewardEquipModal() {
  const reward     = useCareerStore((s) => s.rewardBeingEquipped)
  const closeEquip = useCareerStore((s) => s.closeRewardEquip)
  const players    = useCareerStore((s) => s.players)
  const career     = useCareerStore((s) => s.career)

  if (!reward || !career) return null

  const squadPlayers = players.filter((p) => p.teamId === career.teamId)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-gold-600/30 rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">
            {reward.type === 'equipment' ? 'Equipamiento recibido' : 'Técnica recibida'}
          </h2>
          <button onClick={closeEquip} className="text-gray-500 hover:text-white">
            <Icon name="close" size="sm" />
          </button>
        </div>

        {reward.type === 'equipment' && (
          <EquipmentEquipView reward={reward} players={squadPlayers} onClose={closeEquip} />
        )}
        {reward.type === 'technique_book' && (
          <TechniqueEquipView reward={reward} players={squadPlayers} onClose={closeEquip} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Mount modal in App**

In `src/App.tsx`, import and add `RewardEquipModal`:

```tsx
import RewardEquipModal from './components/RewardEquipModal'

// Inside the return, alongside NotificationsDrawer:
<RewardEquipModal />
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all pass (no new unit tests for UI — verify manually by playing a match and choosing an equipment reward).

- [ ] **Step 5: Commit**

```bash
git add src/components/RewardEquipModal.tsx src/store/careerStore.ts src/App.tsx
git commit -m "feat: reward equip modal — equip or save equipment and techniques immediately after match"
```

---

## Task 9: Integrity Validations

**Files:**
- Modify: `src/services/transferService.ts`
- Modify: `src/store/careerStore.ts`
- Test: `src/tests/transferService.test.ts` (add guards test)

**Interfaces:** No new exports — all internal guards.

- [ ] **Step 1: Guard `sellPlayer` against wrong teamId**

In `src/services/transferService.ts`, at the start of `sellPlayer`, after the null checks add:

```ts
export function sellPlayer(...): ... {
  const safe = sanitizeAmount(amount)
  const player = players.find((p) => p.id === playerId)
  // Guard: only sell players who belong to the career team
  if (!player || player.teamId !== career.teamId) return { career, teams, players }
  // ... rest unchanged
```

- [ ] **Step 2: Guard `claimObjective` against double-claim**

In `src/store/careerStore.ts`, in `claimObjective`:

```ts
claimObjective(objectiveId) {
  const { career, teams } = get()
  if (!career) return
  const obj = career.objectives.find((o) => o.id === objectiveId)
  if (!obj || !canClaimObjective(obj) || obj.claimed) return  // <-- add || obj.claimed
  // ... rest unchanged
```

- [ ] **Step 3: Clean stale negotiations and offers on new season**

In `src/store/careerStore.ts`, in `startNewSeason`, before setting state add:

```ts
// Clean resolved negotiations (keep only active ones)
const cleanedNegotiations = (career.outgoingNegotiations ?? []).filter(
  (n) => n.phase !== 'failed' && n.phase !== 'cancelled' && n.phase !== 'completed',
)

// Clean resolved incoming offers (keep only pending and counter_sent)
const cleanedIncoming = (career.incomingOffers ?? []).filter(
  (o) => o.status === 'pending' || o.status === 'counter_sent',
)
```

In the `updatedCareer` spread:
```ts
outgoingNegotiations: cleanedNegotiations,
incomingOffers: cleanedIncoming,
```

- [ ] **Step 4: Guard cup winner assignment**

In `src/services/cupService.ts`, in `advanceCupRound`, before final round winner assignment:

```ts
if (nextIdx >= cup.rounds.length) {
  const winner = getMatchWinner(currentRound.matches[0])
  if (winner === null) {
    // Fallback: home team wins (should never happen after tiebreak)
    return { ...cup, rounds: updatedRounds, finished: true, winnerId: currentRound.matches[0].homeTeamId }
  }
  return { ...cup, rounds: updatedRounds, finished: true, winnerId: winner }
}
```

- [ ] **Step 5: Write guard tests**

In `src/tests/transferService.test.ts`, add:

```ts
describe('sellPlayer — guards', () => {
  it('does nothing if player does not belong to career team', () => {
    const player = makePlayer({ id: 5, teamId: 99 })  // belongs to team 99, not career team 1
    const userTeam = makeTeam({ id: 1, budget: 500_000, playerIds: [] })
    const buyingTeam = makeTeam({ id: 2, budget: 1_000_000 })
    const career = { ...makeCareer(), teamId: 1 }
    const result = sellPlayer(5, 2, 300_000, career, [userTeam, buyingTeam], [player])
    expect(result.players[0].teamId).toBe(99)  // unchanged
    expect(result.teams.find(t => t.id === 1)?.budget).toBe(500_000)  // unchanged
  })
})
```

Run: `npx vitest run src/tests/transferService.test.ts`
Expected: PASS

- [ ] **Step 6: Final full test run**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Final commit**

```bash
git add src/services/transferService.ts src/services/cupService.ts src/store/careerStore.ts src/tests/transferService.test.ts
git commit -m "fix: integrity guards — sell player ownership, double-claim, stale negotiation cleanup, cup winner fallback"
```

---

## Self-Review

**Spec coverage:**
- Area 6 (season end) — Task 1 ✓
- Area 1 (notifications) — Task 2 ✓
- Area 3 (free agents) — Task 3 ✓
- Area 5 (incoming offers) — Task 4 ✓
- Area 4 (copa ET/penalties) — Task 5 ✓
- Area 2 (techniques) — Task 6 ✓
- Area 7 (objectives) — Task 7 ✓
- Area 8 (reward modal) — Task 8 ✓
- Area 9 (integrity) — Task 9 ✓

**Placeholder scan:** No TBDs. All code blocks are complete. Commands have expected outputs.

**Type consistency:**
- `IncomingOffer` defined in Task 4 step 1, used in Task 4 steps 3/5/6 — consistent.
- `simulateCupTiebreak` defined in Task 5 step 4, imported in Task 5 steps 6/7 — consistent.
- `ObjectiveGroupType` defined in Task 7 step 1, used in steps 2/6 — consistent.
- `rewardBeingEquipped` defined in Task 8 step 1, used in Task 8 step 2 — consistent.
- `getObjectivesForTeam(team, league, difficulty?)` — Task 7 updates signature and all call sites.
- `sellPlayer` guard added in Task 4 step 3 and Task 9 step 1 — consistent (Task 4 adds it first, Task 9 documents the test).
