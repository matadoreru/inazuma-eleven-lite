# Transfer System — FIFA-Style Negotiations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant-buy transfer flow with a multi-phase async negotiation system (contact club → club responds in 2-3 days → player decides in 2-3 more days), while fixing quick-sell price to market value −5%.

**Architecture:** A new `OutgoingNegotiation` state machine lives in `career.outgoingNegotiations[]`. `advanceDay` and `advanceToNextMatch` call `resolveNegotiations()` to advance phases. The inbox receives read-only notification events; UI reads `outgoingNegotiations` directly for live state.

**Tech Stack:** TypeScript, React, Zustand, Vitest

## Global Constraints

- All amounts validated with existing `sanitizeAmount()` before use
- Game currency formatted with existing `fmt()` helper (`€500K`, `€1.2M`)
- No new npm packages — use existing utilities only
- All new text in Spanish to match the existing UI
- Test command: `npx vitest run src/tests/transferService.test.ts`
- Full test suite: `npm run test`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/career.ts` | Modify | Add `NegotiationPhase`, `OutgoingNegotiation`, new `InboxEventType` values, `outgoingNegotiations` field on `Career` |
| `src/services/transferService.ts` | Modify | Add all negotiation logic: `evaluateClubOffer`, `evaluatePlayerDecision`, `initiateNegotiation`, `cancelNegotiation`, `respondToCounter`, `resolveNegotiations` |
| `src/services/careerService.ts` | Modify | Add `outgoingNegotiations: []` default in `createCareer` |
| `src/store/careerStore.ts` | Modify | Three new actions + wire `resolveNegotiations` into `advanceDay` / `advanceToNextMatch` |
| `src/tests/transferService.test.ts` | Modify | Add `outgoingNegotiations: []` to `makeCareer` + new test suites |
| `src/components/TransferPlayerRow.tsx` | Modify | Rename `onBuy` prop to `onView`, change button label "Fichar" → "Ver ficha" |
| `src/screens/TransfersScreen.tsx` | Modify | Remove direct-buy logic; navigate to `PlayerDetailScreen` on click |
| `src/screens/ScoutScreen.tsx` | Modify | Remove direct-buy from watchlist; add "Negociaciones activas" section |
| `src/screens/PlayerDetailScreen.tsx` | Modify | Add negotiation block for non-owned players; fix quick-sell price to −5% |

---

### Task 1: Types foundation

**Files:**
- Modify: `src/types/career.ts` — add `NegotiationPhase`, `OutgoingNegotiation`, new `InboxEventType` values, `outgoingNegotiations` on `Career`
- Modify: `src/services/careerService.ts` — add default field in `createCareer`
- Modify: `src/tests/transferService.test.ts` — update `makeCareer` fixture

**Interfaces:**
- Produces: `NegotiationPhase`, `OutgoingNegotiation` — used by Tasks 2, 3, 4, 5, 6, 7

- [ ] **Step 1: Add types to `src/types/career.ts`**

Open `src/types/career.ts`. After the `TransferOffer` interface (around line 71), add:

```ts
// ─── Transfer Negotiations ────────────────────────────────────────────────────

export type NegotiationPhase =
  | 'club_pending'    // waiting for rival club response
  | 'player_pending'  // club accepted; waiting for player decision
  | 'completed'       // transfer completed successfully
  | 'failed'          // rejected definitively
  | 'cancelled'       // cancelled by user

export interface OutgoingNegotiation {
  id: string
  playerId: number
  playerName: string
  targetClubId: number | null   // null = free agent
  targetClubName: string
  phase: NegotiationPhase
  currentOffer: number          // current amount offered
  counterAmount?: number        // club counter-offer, if pending
  offerRound: number            // 1–3 (initial + max 2 counters)
  isFreeAgent: boolean
  resolutionDate: string        // ISO date when this phase resolves
}
```

Then update the `InboxEventType` union (around line 47) to add at the end:

```ts
  | 'OUTGOING_TRANSFER_CLUB_ACCEPTED'
  | 'OUTGOING_TRANSFER_CLUB_REJECTED'
  | 'OUTGOING_TRANSFER_CLUB_COUNTER'
  | 'OUTGOING_TRANSFER_PLAYER_ACCEPTED'
  | 'OUTGOING_TRANSFER_PLAYER_REJECTED'
```

Then add `outgoingNegotiations` to the `Career` interface (end of the interface, before closing brace):

```ts
  outgoingNegotiations: OutgoingNegotiation[]
```

- [ ] **Step 2: Add default in `createCareer` (`src/services/careerService.ts`)**

In the `career` object literal returned by `createCareer` (around line 195), add after `lastSeasonReview: null`:

```ts
    outgoingNegotiations: [],
```

- [ ] **Step 3: Update `makeCareer` in `src/tests/transferService.test.ts`**

In the `makeCareer` function (around line 60), add after `lastSeasonReview: null`:

```ts
  outgoingNegotiations: [],
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors appear, they will be in files that construct `Career` objects — add `outgoingNegotiations: []` to each.

- [ ] **Step 5: Run existing tests to confirm nothing is broken**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/career.ts src/services/careerService.ts src/tests/transferService.test.ts
git commit -m "feat: add OutgoingNegotiation types and Career field"
```

---

### Task 2: Service — evaluation functions and negotiation mutations

**Files:**
- Modify: `src/services/transferService.ts` — add 5 new exported functions + 3 private helpers
- Modify: `src/tests/transferService.test.ts` — add test suites for the new functions

**Interfaces:**
- Consumes: `OutgoingNegotiation`, `NegotiationPhase`, `Career`, `Player`, `Team` from Task 1
- Produces:
  - `evaluateClubOffer(offer: number, player: Player, sellingTeam: Team, allPlayers: Player[], teams: Team[]): ClubDecision`
  - `evaluatePlayerDecision(player: Player, buyingTeam: Team): 'accept' | 'reject'`
  - `initiateNegotiation(playerId: number, amount: number, career: Career, players: Player[], teams: Team[]): Career | null`
  - `cancelNegotiation(negotiationId: string, career: Career): Career`
  - `respondToCounter(negotiationId: string, action: 'accept_counter' | 'reject' | 'counter', career: Career, newAmount?: number): Career`
  - `export type ClubDecision`

- [ ] **Step 1: Write the failing tests in `src/tests/transferService.test.ts`**

Add these imports at the top of the test file:

```ts
import {
  evaluateClubOffer,
  evaluatePlayerDecision,
  initiateNegotiation,
  cancelNegotiation,
  respondToCounter,
} from '../services/transferService'
import type { OutgoingNegotiation } from '../types/career'
```

Then add at the end of the test file:

```ts
// ─── helpers ────────────────────────────────────────────────────────────────

const makeNegotiation = (overrides: Partial<OutgoingNegotiation> = {}): OutgoingNegotiation => ({
  id: 'neg-1',
  playerId: 10,
  playerName: 'Test Player',
  targetClubId: 2,
  targetClubName: 'Team 2',
  phase: 'club_pending',
  currentOffer: 50_000,
  offerRound: 1,
  isFreeAgent: false,
  resolutionDate: '2026-01-03',
  ...overrides,
})

// ─── evaluateClubOffer ───────────────────────────────────────────────────────

describe('evaluateClubOffer', () => {
  it('rejects when offer is below 70% of market value', () => {
    const player = makePlayer({ id: 10, teamId: 2, age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11, 12])
    const players = [
      player,
      makePlayer({ id: 11, teamId: 2, position: 'FW' }),
      makePlayer({ id: 12, teamId: 2, position: 'FW' }),
    ]
    const marketValue = calcTransferValue(player) // ~60000
    const result = evaluateClubOffer(Math.round(marketValue * 0.5), player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('reject')
  })

  it('rejects when critical-position player has no replacement (GK with 0 other GKs)', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'GK' })
    const sellingTeam = makeTeam(2, 100_000, [10]) // only GK
    const players = [player]
    const marketValue = calcTransferValue(player)
    const result = evaluateClubOffer(marketValue * 2, player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('reject')
  })

  it('accepts when offer meets threshold (enough replacements, matching rep)', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'FW', age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11, 12, 13]) // 3 other FWs
    const players = [
      player,
      makePlayer({ id: 11, teamId: 2, position: 'FW' }),
      makePlayer({ id: 12, teamId: 2, position: 'FW' }),
      makePlayer({ id: 13, teamId: 2, position: 'FW' }),
    ]
    // Threshold = marketValue * reputationFactor (rep=50 → 1.25) * no replacement penalty
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * (1 + 50 / 200))
    const result = evaluateClubOffer(threshold, player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('accept')
  })

  it('returns counter when offer is in 85%–99% of threshold', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'FW', age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11, 12, 13])
    const players = [
      player,
      makePlayer({ id: 11, teamId: 2, position: 'FW' }),
      makePlayer({ id: 12, teamId: 2, position: 'FW' }),
      makePlayer({ id: 13, teamId: 2, position: 'FW' }),
    ]
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * (1 + 50 / 200))
    const offerAt90Pct = Math.round(threshold * 0.90)
    const result = evaluateClubOffer(offerAt90Pct, player, sellingTeam, players, [sellingTeam])
    expect(result.decision).toBe('counter')
    if (result.decision === 'counter') {
      expect(result.counterAmount).toBe(Math.round(threshold * 1.05))
    }
  })

  it('applies replacement penalty when only 1 same-position player remains', () => {
    const player = makePlayer({ id: 10, teamId: 2, position: 'FW', age: 25, stats: { ...makePlayer().stats, TOT: 50 }, career: { ...makePlayer().career, potential: 50 } })
    const sellingTeam = makeTeam(2, 100_000, [10, 11]) // only 1 other FW
    const players = [player, makePlayer({ id: 11, teamId: 2, position: 'FW' })]
    const marketValue = calcTransferValue(player)
    // With penalty: threshold = marketValue * repFactor * 1.15
    const threshold = Math.round(marketValue * (1 + 50 / 200) * 1.15)
    // Offer at exactly marketValue * repFactor (would accept without penalty) → now rejected
    const offerWithoutPenalty = Math.round(marketValue * (1 + 50 / 200))
    const result = evaluateClubOffer(offerWithoutPenalty, player, sellingTeam, players, [sellingTeam])
    // Should not be accept since threshold is higher now
    expect(['reject', 'counter'].includes(result.decision)).toBe(true)
    // Offer at full threshold with penalty → accept
    const result2 = evaluateClubOffer(threshold, player, sellingTeam, players, [sellingTeam])
    expect(result2.decision).toBe('accept')
  })
})

// ─── evaluatePlayerDecision ──────────────────────────────────────────────────

describe('evaluatePlayerDecision', () => {
  it('player with TOT < 65 always accepts regardless of team reputation', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 60 } })
    const poorTeam = makeTeam(1, 100_000)
    poorTeam.reputation = 10
    expect(evaluatePlayerDecision(player, poorTeam)).toBe('accept')
  })

  it('player TOT 65–74: accepts if buyingTeam.reputation >= 30', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 70 } })
    const goodTeam = { ...makeTeam(1, 100_000), reputation: 30 }
    const badTeam = { ...makeTeam(1, 100_000), reputation: 29 }
    expect(evaluatePlayerDecision(player, goodTeam)).toBe('accept')
    expect(evaluatePlayerDecision(player, badTeam)).toBe('reject')
  })

  it('player TOT 75–84: accepts if buyingTeam.reputation >= 50', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 80 } })
    const goodTeam = { ...makeTeam(1, 100_000), reputation: 50 }
    const badTeam = { ...makeTeam(1, 100_000), reputation: 49 }
    expect(evaluatePlayerDecision(player, goodTeam)).toBe('accept')
    expect(evaluatePlayerDecision(player, badTeam)).toBe('reject')
  })

  it('player TOT >= 85: accepts if buyingTeam.reputation >= 70', () => {
    const player = makePlayer({ stats: { ...makePlayer().stats, TOT: 90 } })
    const goodTeam = { ...makeTeam(1, 100_000), reputation: 70 }
    const badTeam = { ...makeTeam(1, 100_000), reputation: 69 }
    expect(evaluatePlayerDecision(player, goodTeam)).toBe('accept')
    expect(evaluatePlayerDecision(player, badTeam)).toBe('reject')
  })
})

// ─── initiateNegotiation ────────────────────────────────────────────────────

describe('initiateNegotiation', () => {
  it('returns null when player is in user team', () => {
    const player = makePlayer({ id: 10, teamId: 1 })
    const career = makeCareer(1)
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000, [10])])
    expect(result).toBeNull()
  })

  it('returns null when active negotiation already exists for player', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ playerId: 10, phase: 'club_pending' })],
    }
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])
    expect(result).toBeNull()
  })

  it('returns null for invalid offer amount', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = makeCareer(1)
    expect(initiateNegotiation(10, -1, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])).toBeNull()
    expect(initiateNegotiation(10, 0, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])).toBeNull()
  })

  it('creates club_pending negotiation for player with a club', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = makeCareer(1)
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])
    expect(result).not.toBeNull()
    expect(result!.outgoingNegotiations).toHaveLength(1)
    expect(result!.outgoingNegotiations[0].phase).toBe('club_pending')
    expect(result!.outgoingNegotiations[0].offerRound).toBe(1)
    expect(result!.outgoingNegotiations[0].isFreeAgent).toBe(false)
  })

  it('creates player_pending negotiation for free agent (teamId null)', () => {
    const player = makePlayer({ id: 10, teamId: null as unknown as number })
    const career = makeCareer(1)
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000)])
    expect(result).not.toBeNull()
    expect(result!.outgoingNegotiations[0].phase).toBe('player_pending')
    expect(result!.outgoingNegotiations[0].isFreeAgent).toBe(true)
  })

  it('sets resolutionDate 2 or 3 days after current date', () => {
    const player = makePlayer({ id: 10, teamId: 2 })
    const career = { ...makeCareer(1), season: { ...makeCareer(1).season, currentDate: '2026-03-01' } }
    const result = initiateNegotiation(10, 50_000, career, [player], [makeTeam(1, 500_000), makeTeam(2, 100_000, [10])])
    expect(result).not.toBeNull()
    expect(['2026-03-03', '2026-03-04'].includes(result!.outgoingNegotiations[0].resolutionDate)).toBe(true)
  })
})

// ─── cancelNegotiation ──────────────────────────────────────────────────────

describe('cancelNegotiation', () => {
  it('sets the negotiation phase to cancelled', () => {
    const career = { ...makeCareer(1), outgoingNegotiations: [makeNegotiation({ id: 'neg-1', phase: 'club_pending' })] }
    const result = cancelNegotiation('neg-1', career)
    expect(result.outgoingNegotiations[0].phase).toBe('cancelled')
  })

  it('leaves other negotiations untouched', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [
        makeNegotiation({ id: 'neg-1', phase: 'club_pending' }),
        makeNegotiation({ id: 'neg-2', phase: 'player_pending' }),
      ],
    }
    const result = cancelNegotiation('neg-1', career)
    expect(result.outgoingNegotiations[1].phase).toBe('player_pending')
  })
})

// ─── respondToCounter ────────────────────────────────────────────────────────

describe('respondToCounter', () => {
  const baseCareer = {
    ...makeCareer(1),
    season: { ...makeCareer(1).season, currentDate: '2026-03-01' },
    outgoingNegotiations: [
      makeNegotiation({ id: 'neg-1', phase: 'club_pending', counterAmount: 75_000, offerRound: 1 }),
    ],
  }

  it('accept_counter moves to player_pending and clears counterAmount', () => {
    const result = respondToCounter('neg-1', 'accept_counter', baseCareer)
    const neg = result.outgoingNegotiations[0]
    expect(neg.phase).toBe('player_pending')
    expect(neg.counterAmount).toBeUndefined()
    expect(neg.currentOffer).toBe(75_000)
  })

  it('reject sets phase to failed', () => {
    const result = respondToCounter('neg-1', 'reject', baseCareer)
    expect(result.outgoingNegotiations[0].phase).toBe('failed')
  })

  it('counter increments offerRound and sets new resolutionDate', () => {
    const result = respondToCounter('neg-1', 'counter', baseCareer, 65_000)
    const neg = result.outgoingNegotiations[0]
    expect(neg.offerRound).toBe(2)
    expect(neg.currentOffer).toBe(65_000)
    expect(neg.counterAmount).toBeUndefined()
    expect(['2026-03-03', '2026-03-04'].includes(neg.resolutionDate)).toBe(true)
  })

  it('counter is blocked when offerRound >= 3', () => {
    const career = {
      ...baseCareer,
      outgoingNegotiations: [makeNegotiation({ id: 'neg-1', phase: 'club_pending', counterAmount: 75_000, offerRound: 3 })],
    }
    const result = respondToCounter('neg-1', 'counter', career, 70_000)
    // Returns unchanged career
    expect(result.outgoingNegotiations[0].offerRound).toBe(3)
  })

  it('returns unchanged career when negotiation has no counterAmount', () => {
    const career = {
      ...baseCareer,
      outgoingNegotiations: [makeNegotiation({ id: 'neg-1', phase: 'club_pending' })],
    }
    const result = respondToCounter('neg-1', 'accept_counter', career)
    expect(result).toBe(career)
  })
})
```

- [ ] **Step 2: Run tests to confirm they all fail as expected**

```bash
npx vitest run src/tests/transferService.test.ts 2>&1 | tail -20
```

Expected: many failures like `evaluateClubOffer is not a function`.

- [ ] **Step 3: Implement the new functions in `src/services/transferService.ts`**

Add these imports at the top of `transferService.ts` (update existing career import line):

```ts
import type { Career, TransferOffer, OutgoingNegotiation, NegotiationPhase, InboxEventType, InboxEvent } from '../types/career'
```

Then add at the end of the file (after `generateAIOffers`):

```ts
// ─── Private helpers ─────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function updateNeg(career: Career, id: string, updates: Partial<OutgoingNegotiation>): Career {
  return {
    ...career,
    outgoingNegotiations: career.outgoingNegotiations.map((n) =>
      n.id === id ? { ...n, ...updates } : n,
    ),
  }
}

function makeEvent(
  type: InboxEventType,
  title: string,
  body: string,
  date: string,
  data?: Record<string, unknown>,
): InboxEvent {
  return { id: crypto.randomUUID(), type, title, body, date, read: false, data }
}

function pushEvent(career: Career, event: InboxEvent): Career {
  return { ...career, inbox: [event, ...career.inbox] }
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

export type ClubDecision =
  | { decision: 'accept' }
  | { decision: 'counter'; counterAmount: number }
  | { decision: 'reject' }

export function evaluateClubOffer(
  offer: number,
  player: Player,
  sellingTeam: Team,
  allPlayers: Player[],
  _teams: Team[],
): ClubDecision {
  const marketValue = calcTransferValue(player)

  if (offer < marketValue * 0.7) return { decision: 'reject' }

  // Replacement capacity: count same-position players in the selling team excluding this player
  const replacements = allPlayers.filter(
    (p) => p.teamId === sellingTeam.id && p.id !== player.id && p.position === player.position,
  ).length

  const isCritical = player.position === 'GK' || player.position === 'DF'
  if (isCritical && replacements < 1) return { decision: 'reject' }

  const replacementPenalty = replacements < 2 ? 1.15 : 1.0
  const reputationFactor = 1.0 + sellingTeam.reputation / 200

  const threshold = Math.round(marketValue * reputationFactor * replacementPenalty)

  if (offer >= threshold) return { decision: 'accept' }
  if (offer >= Math.round(threshold * 0.85)) {
    return { decision: 'counter', counterAmount: Math.round(threshold * 1.05) }
  }
  return { decision: 'reject' }
}

export function evaluatePlayerDecision(player: Player, buyingTeam: Team): 'accept' | 'reject' {
  const tot = player.stats.TOT
  if (tot < 65) return 'accept'
  if (tot < 75) return buyingTeam.reputation >= 30 ? 'accept' : 'reject'
  if (tot < 85) return buyingTeam.reputation >= 50 ? 'accept' : 'reject'
  return buyingTeam.reputation >= 70 ? 'accept' : 'reject'
}

// ─── Mutation functions ───────────────────────────────────────────────────────

export function initiateNegotiation(
  playerId: number,
  amount: number,
  career: Career,
  players: Player[],
  teams: Team[],
): Career | null {
  const player = players.find((p) => p.id === playerId)
  if (!player || player.teamId === career.teamId) return null

  const alreadyActive = career.outgoingNegotiations.some(
    (n) => n.playerId === playerId && (n.phase === 'club_pending' || n.phase === 'player_pending'),
  )
  if (alreadyActive) return null

  const safe = sanitizeAmount(amount)
  if (safe === null) return null

  const isFreeAgent = player.teamId === null
  const targetClub = player.teamId !== null ? teams.find((t) => t.id === player.teamId) : null

  const negotiation: OutgoingNegotiation = {
    id: crypto.randomUUID(),
    playerId,
    playerName: player.nameRomaji,
    targetClubId: player.teamId ?? null,
    targetClubName: isFreeAgent ? 'Agente Libre' : (targetClub?.name ?? 'Desconocido'),
    phase: isFreeAgent ? 'player_pending' : 'club_pending',
    currentOffer: safe,
    offerRound: 1,
    isFreeAgent,
    resolutionDate: addDays(career.season.currentDate, randInt(2, 3)),
  }

  return { ...career, outgoingNegotiations: [...career.outgoingNegotiations, negotiation] }
}

export function cancelNegotiation(negotiationId: string, career: Career): Career {
  return updateNeg(career, negotiationId, { phase: 'cancelled' })
}

export function respondToCounter(
  negotiationId: string,
  action: 'accept_counter' | 'reject' | 'counter',
  career: Career,
  newAmount?: number,
): Career {
  const neg = career.outgoingNegotiations.find((n) => n.id === negotiationId)
  if (!neg || neg.phase !== 'club_pending' || neg.counterAmount === undefined) return career

  if (action === 'accept_counter') {
    return updateNeg(career, negotiationId, {
      currentOffer: neg.counterAmount,
      counterAmount: undefined,
      phase: 'player_pending',
      resolutionDate: addDays(career.season.currentDate, randInt(2, 3)),
    })
  }

  if (action === 'reject') {
    return updateNeg(career, negotiationId, { phase: 'failed' })
  }

  // counter
  if (neg.offerRound >= 3 || newAmount === undefined) return career
  const safe = sanitizeAmount(newAmount)
  if (safe === null) return career
  return updateNeg(career, negotiationId, {
    currentOffer: safe,
    counterAmount: undefined,
    offerRound: neg.offerRound + 1,
    resolutionDate: addDays(career.season.currentDate, randInt(2, 3)),
  })
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/transferService.test.ts 2>&1 | tail -30
```

Expected: all new suites pass. Full suite still passing.

- [ ] **Step 5: Commit**

```bash
git add src/services/transferService.ts src/tests/transferService.test.ts
git commit -m "feat: add evaluateClubOffer, evaluatePlayerDecision, initiateNegotiation, cancelNegotiation, respondToCounter"
```

---

### Task 3: Service — `resolveNegotiations`

**Files:**
- Modify: `src/services/transferService.ts` — add `resolveNegotiations`
- Modify: `src/tests/transferService.test.ts` — add test suite

**Interfaces:**
- Consumes: all functions from Task 2, `buyPlayer` (already in the file), `ClubDecision`, `OutgoingNegotiation`
- Produces: `resolveNegotiations(career: Career, currentDate: string, players: Player[], teams: Team[]): { career: Career; players: Player[]; teams: Team[] }`

- [ ] **Step 1: Write the failing tests in `src/tests/transferService.test.ts`**

Add this import at top of file:

```ts
import { resolveNegotiations } from '../services/transferService'
```

Add at the end of the test file:

```ts
describe('resolveNegotiations', () => {
  const userTeam = makeTeam(1, 1_000_000, [])
  const sellingTeam = { ...makeTeam(2, 100_000, [10, 11, 12]), reputation: 50 }
  const player = makePlayer({
    id: 10,
    teamId: 2,
    position: 'FW',
    age: 25,
    stats: { ...makePlayer().stats, TOT: 50 },
    career: { ...makePlayer().career, potential: 50 },
  })
  const otherFW1 = makePlayer({ id: 11, teamId: 2, position: 'FW' })
  const otherFW2 = makePlayer({ id: 12, teamId: 2, position: 'FW' })
  const allPlayers = [player, otherFW1, otherFW2]

  it('skips negotiations where resolutionDate is in the future', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', resolutionDate: '2026-01-05' })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('club_pending')
  })

  it('skips club_pending when counterAmount is set (waiting for user)', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', counterAmount: 80_000, resolutionDate: '2026-01-01' })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].counterAmount).toBe(80_000)
  })

  it('club_pending resolves to player_pending when club accepts (high offer)', () => {
    // Threshold = calcTransferValue(player) * (1 + 50/200) * 1.0 (3 same-pos → no penalty)
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * 1.25)
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', currentOffer: threshold, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    const neg = result.career.outgoingNegotiations[0]
    expect(neg.phase).toBe('player_pending')
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_CLUB_ACCEPTED')).toBe(true)
  })

  it('club_pending sets counterAmount when club makes counter-offer', () => {
    const marketValue = calcTransferValue(player)
    const threshold = Math.round(marketValue * 1.25)
    const offerAt90pct = Math.round(threshold * 0.90)
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', currentOffer: offerAt90pct, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    const neg = result.career.outgoingNegotiations[0]
    expect(neg.counterAmount).toBeDefined()
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_CLUB_COUNTER')).toBe(true)
  })

  it('club_pending sets failed when club rejects (low offer)', () => {
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'club_pending', currentOffer: 1_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', allPlayers, [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('failed')
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_CLUB_REJECTED')).toBe(true)
  })

  it('player_pending resolves to completed when player accepts (low TOT, any rep)', () => {
    const lowTotPlayer = makePlayer({ id: 10, teamId: 2, stats: { ...makePlayer().stats, TOT: 50 } })
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'player_pending', currentOffer: 50_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', [lowTotPlayer, otherFW1, otherFW2], [userTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('completed')
    // Player moved to user team
    const transferred = result.players.find((p) => p.id === 10)
    expect(transferred?.teamId).toBe(1)
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_PLAYER_ACCEPTED')).toBe(true)
  })

  it('player_pending sets failed when player rejects (high TOT, low rep)', () => {
    const starPlayer = makePlayer({ id: 10, teamId: 2, stats: { ...makePlayer().stats, TOT: 90 } })
    const poorRepTeam = { ...userTeam, reputation: 30 } // < 70 needed for TOT 90
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'player_pending', currentOffer: 50_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', [starPlayer, otherFW1, otherFW2], [poorRepTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('failed')
    expect(result.career.inbox.some((e) => e.type === 'OUTGOING_TRANSFER_PLAYER_REJECTED')).toBe(true)
  })

  it('player_pending fails gracefully when user team has insufficient budget', () => {
    const brokTeam = { ...userTeam, budget: 100 }
    const lowTotPlayer = makePlayer({ id: 10, teamId: 2, stats: { ...makePlayer().stats, TOT: 50 } })
    const career = {
      ...makeCareer(1),
      outgoingNegotiations: [makeNegotiation({ phase: 'player_pending', currentOffer: 500_000, resolutionDate: '2026-01-01', playerId: 10 })],
    }
    const result = resolveNegotiations(career, '2026-01-01', [lowTotPlayer, otherFW1, otherFW2], [brokTeam, sellingTeam])
    expect(result.career.outgoingNegotiations[0].phase).toBe('failed')
    // Player NOT transferred
    const p = result.players.find((p) => p.id === 10)
    expect(p?.teamId).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm new suite fails**

```bash
npx vitest run src/tests/transferService.test.ts 2>&1 | grep "resolveNegotiations" | head -5
```

Expected: `resolveNegotiations is not a function`.

- [ ] **Step 3: Implement `resolveNegotiations` in `src/services/transferService.ts`**

Add at the end of `transferService.ts`:

```ts
export function resolveNegotiations(
  career: Career,
  currentDate: string,
  players: Player[],
  teams: Team[],
): { career: Career; players: Player[]; teams: Team[] } {
  let c = career
  let p = players
  let t = teams

  for (const neg of career.outgoingNegotiations) {
    if (neg.phase !== 'club_pending' && neg.phase !== 'player_pending') continue
    if (neg.phase === 'club_pending' && neg.counterAmount !== undefined) continue
    if (neg.resolutionDate > currentDate) continue

    const player = p.find((pl) => pl.id === neg.playerId)
    const fmtAmt = (n: number) =>
      n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `€${(n / 1_000).toFixed(0)}K` : `€${n}`

    // Player no longer exists or moved to a different club
    if (!player || (neg.targetClubId !== null && player.teamId !== neg.targetClubId)) {
      c = updateNeg(c, neg.id, { phase: 'failed' })
      c = pushEvent(c, makeEvent(
        'OUTGOING_TRANSFER_CLUB_REJECTED',
        `Negociación fallida: ${neg.playerName}`,
        `${neg.playerName} ya no está disponible.`,
        currentDate, { negotiationId: neg.id },
      ))
      continue
    }

    if (neg.phase === 'club_pending') {
      const sellingTeam = t.find((tm) => tm.id === neg.targetClubId)
      if (!sellingTeam) { c = updateNeg(c, neg.id, { phase: 'failed' }); continue }

      const clubResult = evaluateClubOffer(neg.currentOffer, player, sellingTeam, p, t)

      if (clubResult.decision === 'accept') {
        c = updateNeg(c, neg.id, {
          phase: 'player_pending',
          resolutionDate: addDays(currentDate, randInt(2, 3)),
        })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_ACCEPTED',
          `Club acepta: ${neg.playerName}`,
          `${sellingTeam.name} acepta tu oferta de ${fmtAmt(neg.currentOffer)} por ${neg.playerName}. El jugador decidirá en breve.`,
          currentDate, { negotiationId: neg.id },
        ))
      } else if (clubResult.decision === 'counter') {
        c = updateNeg(c, neg.id, { counterAmount: clubResult.counterAmount })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_COUNTER',
          `Contra-oferta: ${neg.playerName}`,
          `${sellingTeam.name} propone ${fmtAmt(clubResult.counterAmount)} por ${neg.playerName}.`,
          currentDate, { negotiationId: neg.id, counterAmount: clubResult.counterAmount },
        ))
      } else {
        c = updateNeg(c, neg.id, { phase: 'failed' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_CLUB_REJECTED',
          `Oferta rechazada: ${neg.playerName}`,
          `${sellingTeam.name} rechaza tu oferta por ${neg.playerName}.`,
          currentDate, { negotiationId: neg.id },
        ))
      }
    } else {
      // player_pending
      const buyingTeam = t.find((tm) => tm.id === career.teamId)
      if (!buyingTeam) continue

      const playerDecision = evaluatePlayerDecision(player, buyingTeam)

      if (playerDecision === 'accept') {
        if (buyingTeam.budget < neg.currentOffer) {
          c = updateNeg(c, neg.id, { phase: 'failed' })
          c = pushEvent(c, makeEvent(
            'OUTGOING_TRANSFER_PLAYER_REJECTED',
            `Sin presupuesto: ${neg.playerName}`,
            `${neg.playerName} aceptó pero no tienes suficiente presupuesto.`,
            currentDate, { negotiationId: neg.id },
          ))
          continue
        }

        const buyResult = buyPlayer(neg.playerId, career.teamId, neg.currentOffer, c, t, p)
        c = updateNeg(buyResult.career, neg.id, { phase: 'completed' })
        p = buyResult.players
        t = buyResult.teams
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_PLAYER_ACCEPTED',
          `¡Fichaje completado! ${neg.playerName}`,
          `${neg.playerName} se une a tu equipo por ${fmtAmt(neg.currentOffer)}.`,
          currentDate, { negotiationId: neg.id },
        ))
      } else {
        c = updateNeg(c, neg.id, { phase: 'failed' })
        c = pushEvent(c, makeEvent(
          'OUTGOING_TRANSFER_PLAYER_REJECTED',
          `Jugador rechaza: ${neg.playerName}`,
          `${neg.playerName} ha decidido no unirse a tu equipo.`,
          currentDate, { negotiationId: neg.id },
        ))
      }
    }
  }

  return { career: c, players: p, teams: t }
}
```

- [ ] **Step 4: Run all tests**

```bash
npm run test
```

Expected: all tests pass including the new `resolveNegotiations` suite.

- [ ] **Step 5: Commit**

```bash
git add src/services/transferService.ts src/tests/transferService.test.ts
git commit -m "feat: add resolveNegotiations service function"
```

---

### Task 4: careerStore — new actions and `advanceDay` wiring

**Files:**
- Modify: `src/store/careerStore.ts` — add 3 new store actions, wire `resolveNegotiations` into `advanceDay` and `advanceToNextMatch`

**Interfaces:**
- Consumes: `initiateNegotiation`, `cancelNegotiation`, `respondToCounter`, `resolveNegotiations` from Task 3
- Produces: store actions `initiateTransferNegotiation`, `cancelNegotiation` (store), `respondToCounterOffer`

- [ ] **Step 1: Add imports to `src/store/careerStore.ts`**

Find the existing transfer imports block (around line 28):

```ts
import {
  buyPlayer as buyPlayerService,
  sellPlayer as sellPlayerService,
  generateAIOffers,
  sanitizeAmount,
} from '../services/transferService'
```

Replace it with:

```ts
import {
  buyPlayer as buyPlayerService,
  sellPlayer as sellPlayerService,
  generateAIOffers,
  sanitizeAmount,
  initiateNegotiation as initiateNegotiationService,
  cancelNegotiation as cancelNegotiationService,
  respondToCounter as respondToCounterService,
  resolveNegotiations as resolveNegotiationsService,
} from '../services/transferService'
```

- [ ] **Step 2: Add the 3 new action signatures to the `CareerState` interface**

Find the Transfer section of the interface (around line 583):

```ts
  // Transfer
  setTransferFilter(filter: Partial<TransferFilter>): void
  buyPlayer(playerId: number, amount: number): void
  sellPlayer(playerId: number, toTeamId: number, amount: number): void
  acceptTransferOffer(offerId: string): void
  rejectTransferOffer(offerId: string): void
```

Add after `rejectTransferOffer`:

```ts
  initiateTransferNegotiation(playerId: number, amount: number): void
  respondToCounterOffer(negotiationId: string, action: 'accept_counter' | 'reject' | 'counter', newAmount?: number): void
  cancelNegotiation(negotiationId: string): void
```

- [ ] **Step 3: Implement the 3 new actions in the store**

Find the `rejectTransferOffer` implementation (around line 1207) and add immediately after it:

```ts
  initiateTransferNegotiation(playerId, amount) {
    const { career, players, teams } = get()
    if (!career) return
    const updated = initiateNegotiationService(playerId, amount, career, players, teams)
    if (updated) set({ career: updated })
  },

  respondToCounterOffer(negotiationId, action, newAmount) {
    const { career } = get()
    if (!career) return
    const updated = respondToCounterService(negotiationId, action, career, newAmount)
    set({ career: updated })
  },

  cancelNegotiation(negotiationId) {
    const { career } = get()
    if (!career) return
    const updated = cancelNegotiationService(negotiationId, career)
    set({ career: updated })
  },
```

- [ ] **Step 4: Wire `resolveNegotiations` into `advanceDay`**

Find the end of `advanceDay` (around line 965). Replace:

```ts
    const updatedCareer: Career = {
      ...career,
      season: updatedSeason,
      allLeagueSeasons,
      cup,
      seasonStatus: computeSeasonStatus({ ...career, season: updatedSeason, allLeagueSeasons, cup }),
    }
    set({ career: updatedCareer, players: advancedPlayers })
  },
```

With:

```ts
    const preNegCareer: Career = {
      ...career,
      season: updatedSeason,
      allLeagueSeasons,
      cup,
      seasonStatus: computeSeasonStatus({ ...career, season: updatedSeason, allLeagueSeasons, cup }),
    }
    const negResult = resolveNegotiationsService(preNegCareer, nextDate, advancedPlayers, teams)
    set({ career: negResult.career, players: negResult.players, teams: negResult.teams })
  },
```

- [ ] **Step 5: Wire `resolveNegotiations` into `advanceToNextMatch`**

Find the end of `advanceToNextMatch` (around line 1017). Replace:

```ts
    const updatedCareer: Career = {
      ...career,
      season: updatedSeason,
      allLeagueSeasons,
      cup,
      seasonStatus: computeSeasonStatus({ ...career, season: updatedSeason, allLeagueSeasons, cup }),
    }
    set({ career: updatedCareer, players: advancedPlayers })
  },
```

With:

```ts
    const preNegCareer: Career = {
      ...career,
      season: updatedSeason,
      allLeagueSeasons,
      cup,
      seasonStatus: computeSeasonStatus({ ...career, season: updatedSeason, allLeagueSeasons, cup }),
    }
    const negResult = resolveNegotiationsService(preNegCareer, targetDate, advancedPlayers, teams)
    set({ career: negResult.career, players: negResult.players, teams: negResult.teams })
  },
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/store/careerStore.ts
git commit -m "feat: add negotiation store actions and wire resolveNegotiations into advanceDay"
```

---

### Task 5: UI — remove direct-buy from TransferPlayerRow, TransfersScreen, ScoutScreen watchlist

**Files:**
- Modify: `src/components/TransferPlayerRow.tsx` — rename `onBuy` → `onView`, button "Fichar" → "Ver ficha"
- Modify: `src/screens/TransfersScreen.tsx` — remove `buyPlayer`, replace `handleBuy` with navigate action
- Modify: `src/screens/ScoutScreen.tsx` — remove `buyPlayer` from watchlist, use navigate instead

**Interfaces:**
- Consumes: `selectPlayer` and `navigate` store actions (already exist)

- [ ] **Step 1: Update `src/components/TransferPlayerRow.tsx`**

Replace the entire file content with:

```tsx
import type { Player } from '../types/player'
import PositionSprite from './PositionSprite'
import ElementBadge from './ElementBadge'
import { statColor } from './StatBar'
import { getPlayerStatsSummary } from '../types/player'
import { calcTransferValue } from '../services/transferService'

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

interface Props {
  player: Player
  teamName: string
  isFreeAgent: boolean
  onView?: () => void
}

export default function TransferPlayerRow({ player, teamName, isFreeAgent, onView }: Props) {
  const { media } = getPlayerStatsSummary(player)
  const value = calcTransferValue(player)

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-700/40 transition-colors">
      <td className="py-1.5 px-2 w-12">
        <img
          src={player.spriteUrl}
          alt={player.nameRomaji}
          className="w-10 h-10 object-contain rounded"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='5' fill='%234b5563'/%3E%3C/svg%3E"
          }}
        />
      </td>
      <td className="py-1.5 px-3">
        <span className="text-white text-sm font-medium block leading-tight truncate max-w-[140px]">
          {player.nameRomaji}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <PositionSprite position={player.position} size={20} />
          <ElementBadge element={player.element} size="sm" />
        </div>
      </td>
      <td className="py-1.5 px-3 text-right tabular-nums w-14">
        <span className="text-sm font-bold" style={{ color: statColor(media, 250) }}>{media}</span>
      </td>
      <td className="py-1.5 px-3 w-32">
        {isFreeAgent ? (
          <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/50">
            Libre
          </span>
        ) : (
          <span className="text-gray-400 text-xs truncate block max-w-[110px]">{teamName}</span>
        )}
      </td>
      <td className="py-1.5 px-3 text-right tabular-nums w-20">
        <span className="text-gray-300 text-xs font-medium">{fmt(value)}</span>
      </td>
      <td className="py-1.5 px-3 w-20 text-center">
        {onView && (
          <button
            onClick={onView}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-700 text-white hover:bg-blue-600 transition-colors font-semibold"
          >
            Ver ficha
          </button>
        )}
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Update `src/screens/TransfersScreen.tsx`**

Remove the `buyPlayer` store selector and `handleBuy` function. Add `selectPlayer` and `navigate`. Replace the `onBuy` handler call.

At the top of `TransfersScreen` (around line 63), find:

```ts
  const buyPlayer = useCareerStore((s) => s.buyPlayer)
```

Replace with:

```ts
  const selectPlayer = useCareerStore((s) => s.selectPlayer)
  const navigate = useCareerStore((s) => s.navigate)
```

Find and delete the `handleBuy` function (around line 105):

```ts
  function handleBuy(playerId: number) {
    const player = players.find((p) => p.id === playerId)
    if (!player || !career) return
    const marketValue = Math.round(calcTransferValue(player) * (career.difficulty.transferCostMultiplier ?? 1))
    buyPlayer(playerId, marketValue)
  }
```

In the JSX where `TransferPlayerRow` is rendered (around line 208), replace:

```tsx
                      <TransferPlayerRow
                        key={player.id}
                        player={player}
                        teamName={playerTeam?.name ?? ''}
                        isFreeAgent={isFreeAgent}
                        onBuy={() => handleBuy(player.id)}
                      />
```

With:

```tsx
                      <TransferPlayerRow
                        key={player.id}
                        player={player}
                        teamName={playerTeam?.name ?? ''}
                        isFreeAgent={isFreeAgent}
                        onView={() => { selectPlayer(player.id); navigate('player_detail') }}
                      />
```

Also remove the unused `calcTransferValue` import if it's no longer used anywhere in the file — check the full file first.

- [ ] **Step 3: Update `src/screens/ScoutScreen.tsx` watchlist**

Find the `buyPlayer` selector at the top of ScoutScreen:

```ts
  const buyPlayer = useCareerStore((s) => s.buyPlayer)
```

Replace with:

```ts
  const selectPlayer = useCareerStore((s) => s.selectPlayer)
```

In the watchlist `TransferPlayerRow` render (around line 105), replace:

```tsx
                        <TransferPlayerRow
                          key={player.id}
                          player={player}
                          teamName={playerTeam?.name ?? ''}
                          isFreeAgent={player.teamId === null}
                          onBuy={() => buyPlayer(player.id, Math.round(calcTransferValue(player) * (career?.difficulty.transferCostMultiplier ?? 1)))}
                        />
```

With:

```tsx
                        <TransferPlayerRow
                          key={player.id}
                          player={player}
                          teamName={playerTeam?.name ?? ''}
                          isFreeAgent={player.teamId === null}
                          onView={() => { selectPlayer(player.id); navigate('player_detail') }}
                        />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TransferPlayerRow.tsx src/screens/TransfersScreen.tsx src/screens/ScoutScreen.tsx
git commit -m "feat: replace direct-buy with navigate-to-player flow in transfer market and watchlist"
```

---

### Task 6: UI — PlayerDetailScreen negotiation block for non-owned players

**Files:**
- Modify: `src/screens/PlayerDetailScreen.tsx` — add negotiation block + offer modal for non-owned players

**Interfaces:**
- Consumes: `initiateTransferNegotiation`, `respondToCounterOffer`, `cancelNegotiation` store actions from Task 4
- Consumes: `career.outgoingNegotiations` for reading negotiation state

- [ ] **Step 1: Add store selectors and state in `PlayerDetailScreen.tsx`**

After the existing selectors (around line 599, after `teachTechnique`), add:

```ts
  const initiateTransferNegotiation = useCareerStore((s) => s.initiateTransferNegotiation)
  const respondToCounterOffer = useCareerStore((s) => s.respondToCounterOffer)
  const cancelNegotiationAction = useCareerStore((s) => s.cancelNegotiation)
```

After `const [techModal, setTechModal] = useState(...)` (around line 605), add:

```ts
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerInput, setOfferInput] = useState('')
  const [counterInput, setCounterInput] = useState('')
```

- [ ] **Step 2: Compute active negotiation for the current player**

After the existing `const analysis = ...` block (around line 652), add:

```ts
  const activeNegotiation = !isInUserTeam
    ? career.outgoingNegotiations.find(
        (n) => n.playerId === player.id && (n.phase === 'club_pending' || n.phase === 'player_pending'),
      ) ?? null
    : null

  const recentNegotiation = !isInUserTeam && !activeNegotiation
    ? career.outgoingNegotiations
        .filter((n) => n.playerId === player.id && (n.phase === 'failed' || n.phase === 'cancelled' || n.phase === 'completed'))
        .at(-1) ?? null
    : null

  const marketValueForOffer = Math.round(calcTransferValue(player) * (career.difficulty.transferCostMultiplier ?? 1))
```

- [ ] **Step 3: Add negotiation block in JSX — non-owned players section**

Find the action buttons block (around line 760):

```tsx
            {/* Action buttons */}
            {isInUserTeam && (
              <div className="shrink-0 flex flex-col gap-1">
```

After that entire `{isInUserTeam && (...)}` block (which ends with `</div>\n            )}` around line 796), add:

```tsx
            {/* Negotiation block for non-owned players */}
            {!isInUserTeam && (
              <div className="shrink-0 flex flex-col gap-1">
                {!activeNegotiation && !recentNegotiation && (
                  <button
                    onClick={() => { setOfferInput(String(marketValueForOffer)); setShowOfferModal(true) }}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
                  >
                    <span className="material-icons leading-none" style={{ fontSize: '14px' }}>
                      {player.teamId === null ? 'handshake' : 'send'}
                    </span>
                    {player.teamId === null ? 'Contactar agente' : 'Contactar club'}
                  </button>
                )}

                {activeNegotiation && activeNegotiation.phase === 'club_pending' && !activeNegotiation.counterAmount && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 text-[0.625rem] leading-tight">Esperando respuesta del club</span>
                    <span className="text-gray-500 text-[0.5rem]">Est. {activeNegotiation.resolutionDate}</span>
                    <button
                      onClick={() => cancelNegotiationAction(activeNegotiation.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-semibold transition-colors"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>cancel</span>
                      Cancelar
                    </button>
                  </div>
                )}

                {activeNegotiation && activeNegotiation.phase === 'club_pending' && activeNegotiation.counterAmount && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-yellow-400 text-[0.625rem] font-semibold">
                      Contra: {activeNegotiation.counterAmount >= 1_000_000
                        ? `€${(activeNegotiation.counterAmount / 1_000_000).toFixed(1)}M`
                        : `€${(activeNegotiation.counterAmount / 1_000).toFixed(0)}K`}
                    </span>
                    <button
                      onClick={() => respondToCounterOffer(activeNegotiation.id, 'accept_counter')}
                      className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Aceptar
                    </button>
                    {activeNegotiation.offerRound < 3 && (
                      <button
                        onClick={() => { setCounterInput(String(activeNegotiation.currentOffer)); setShowOfferModal(true) }}
                        className="flex items-center gap-1 px-2 py-1 bg-yellow-700 hover:bg-yellow-600 text-white rounded text-xs font-semibold transition-colors"
                      >
                        Contra-ofrecer
                      </button>
                    )}
                    <button
                      onClick={() => respondToCounterOffer(activeNegotiation.id, 'reject')}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-semibold transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                )}

                {activeNegotiation && activeNegotiation.phase === 'player_pending' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-blue-400 text-[0.625rem] leading-tight">Jugador valorando oferta</span>
                    <span className="text-gray-500 text-[0.5rem]">Est. {activeNegotiation.resolutionDate}</span>
                    <button
                      onClick={() => cancelNegotiationAction(activeNegotiation.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs font-semibold transition-colors"
                    >
                      <span className="material-icons leading-none" style={{ fontSize: '12px' }}>cancel</span>
                      Cancelar
                    </button>
                  </div>
                )}

                {recentNegotiation && recentNegotiation.phase === 'failed' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-red-400 text-[0.625rem]">Negociación fallida</span>
                    <button
                      onClick={() => { setOfferInput(String(marketValueForOffer)); setShowOfferModal(true) }}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {recentNegotiation && recentNegotiation.phase === 'cancelled' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 text-[0.625rem]">Cancelada</span>
                    <button
                      onClick={() => { setOfferInput(String(marketValueForOffer)); setShowOfferModal(true) }}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Nueva oferta
                    </button>
                  </div>
                )}

                {recentNegotiation && recentNegotiation.phase === 'completed' && (
                  <span className="text-green-400 text-[0.625rem] font-semibold">Fichaje completado</span>
                )}
              </div>
            )}
```

- [ ] **Step 4: Add the offer modal JSX**

Find the existing sell modal block (around line 1016) and add BEFORE it:

```tsx
      {/* ── Offer modal (initiate negotiation / counter-offer) ── */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-5 w-full max-w-sm border border-gray-700 space-y-4">
            <div>
              <h2 className="text-white text-base font-bold">
                {activeNegotiation?.counterAmount ? 'Contra-oferta' : (player.teamId === null ? 'Contactar agente' : 'Enviar oferta al club')}
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">{player.nameRomaji}</p>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-700">
              <span className="text-gray-400 text-xs">Valor de mercado</span>
              <span className="text-white text-sm font-bold tabular-nums">
                {calcTransferValue(player) >= 1_000_000
                  ? `€${(calcTransferValue(player) / 1_000_000).toFixed(1)}M`
                  : `€${(calcTransferValue(player) / 1_000).toFixed(0)}K`}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-400 text-xs">Tu oferta (€)</label>
              <input
                type="number"
                value={activeNegotiation?.counterAmount ? counterInput : offerInput}
                onChange={(e) => activeNegotiation?.counterAmount ? setCounterInput(e.target.value) : setOfferInput(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                min={1}
              />
            </div>

            <button
              onClick={() => {
                const raw = activeNegotiation?.counterAmount ? parseInt(counterInput) : parseInt(offerInput)
                if (isNaN(raw) || raw <= 0) return
                if (activeNegotiation?.counterAmount) {
                  respondToCounterOffer(activeNegotiation.id, 'counter', raw)
                } else {
                  initiateTransferNegotiation(player.id, raw)
                }
                setShowOfferModal(false)
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Enviar oferta
            </button>

            <button
              onClick={() => setShowOfferModal(false)}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-semibold text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/PlayerDetailScreen.tsx
git commit -m "feat: add negotiation block and offer modal for non-owned players in PlayerDetailScreen"
```

---

### Task 7: UI — ScoutScreen "Negociaciones activas" section + quick-sell fix

**Files:**
- Modify: `src/screens/ScoutScreen.tsx` — add "Negociaciones activas" section
- Modify: `src/screens/PlayerDetailScreen.tsx` — fix quick-sell to market value −5%

- [ ] **Step 1: Add "Negociaciones activas" section to ScoutScreen**

Add these store selectors at the top of the `ScoutScreen` component (after existing selectors):

```ts
  const respondToCounterOffer = useCareerStore((s) => s.respondToCounterOffer)
  const cancelNegotiationAction = useCareerStore((s) => s.cancelNegotiation)
```

Add a helper inside the component (before the return):

```ts
  const activeNegotiations = career.outgoingNegotiations.filter(
    (n) => n.phase === 'club_pending' || n.phase === 'player_pending',
  )
```

Then add a format helper (or import `calcTransferValue` and use it):

```ts
  function fmtAmt(n: number): string {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
    return `€${n}`
  }
```

In the JSX, add before the existing `{/* Transfer Offers */}` block:

```tsx
          {/* Active outgoing negotiations */}
          {activeNegotiations.length > 0 && (
            <div className="mb-6">
              <h2 className="text-white text-lg font-semibold mb-3">
                Negociaciones activas ({activeNegotiations.length})
              </h2>
              <div className="flex flex-col gap-2">
                {activeNegotiations.map((neg) => (
                  <div
                    key={neg.id}
                    className={`bg-gray-800 rounded-xl p-3 border ${
                      neg.counterAmount ? 'border-yellow-700' : 'border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{neg.playerName}</p>
                        <p className="text-gray-500 text-xs">{neg.targetClubName}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {neg.phase === 'club_pending' && !neg.counterAmount && 'Esperando respuesta del club'}
                          {neg.phase === 'club_pending' && neg.counterAmount && `Contra-oferta: ${fmtAmt(neg.counterAmount)}`}
                          {neg.phase === 'player_pending' && 'Jugador valorando oferta'}
                        </p>
                        <p className="text-gray-600 text-[0.625rem]">
                          Oferta: {fmtAmt(neg.currentOffer)} · Est. {neg.resolutionDate}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col gap-1 items-end">
                        {neg.counterAmount && (
                          <>
                            <button
                              onClick={() => respondToCounterOffer(neg.id, 'accept_counter')}
                              className="text-[0.625rem] px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded font-semibold transition-colors"
                            >
                              Aceptar
                            </button>
                            <button
                              onClick={() => respondToCounterOffer(neg.id, 'reject')}
                              className="text-[0.625rem] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-semibold transition-colors"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {!neg.counterAmount && (
                          <button
                            onClick={() => cancelNegotiationAction(neg.id)}
                            className="text-[0.625rem] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-semibold transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 2: Fix quick-sell price in `PlayerDetailScreen.tsx`**

Find `handleQuickSell` (around line 668):

```ts
  function handleQuickSell() {
    const targetTeam = teams.find((t) => t.id !== career!.teamId)
    if (!targetTeam) return
    sellPlayer(player!.id, targetTeam.id, calcTransferValue(player!))
    setShowSellModal(false)
    navigate('squad')
  }
```

Replace with:

```ts
  function handleQuickSell() {
    const targetTeam = teams.find((t) => t.id !== career!.teamId)
    if (!targetTeam) return
    const quickSellPrice = Math.round(calcTransferValue(player!) * 0.95)
    sellPlayer(player!.id, targetTeam.id, quickSellPrice)
    setShowSellModal(false)
    navigate('squad')
  }
```

Then update the sell modal UI to show the −5% price. Find the quick sell section in the sell modal (around line 1036):

```tsx
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-xs font-semibold">Venta rápida</span>
                <span className="text-white text-sm font-bold tabular-nums">
                  {fmt(calcTransferValue(player))}
                </span>
              </div>
```

Replace with:

```tsx
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-xs font-semibold">Venta rápida</span>
                <div className="text-right">
                  <span className="text-white text-sm font-bold tabular-nums block">
                    {fmt(Math.round(calcTransferValue(player) * 0.95))}
                  </span>
                  <span className="text-gray-500 text-[0.625rem]">−5% del valor</span>
                </div>
              </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ScoutScreen.tsx src/screens/PlayerDetailScreen.tsx
git commit -m "feat: add active negotiations section to ScoutScreen and fix quick-sell to market value -5%"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| `OutgoingNegotiation` type with all fields | Task 1 |
| New `InboxEventType` values (5 new) | Task 1 |
| `outgoingNegotiations: []` in Career + createCareer | Task 1 |
| `evaluateClubOffer` with replacement check | Task 2 |
| `evaluatePlayerDecision` with TOT thresholds | Task 2 |
| `initiateNegotiation` + free-agent path | Task 2 |
| `cancelNegotiation` | Task 2 |
| `respondToCounter` with offerRound cap at 3 | Task 2 |
| `resolveNegotiations` + all phase transitions | Task 3 |
| Budget check at player_pending accept | Task 3 |
| Player already moved guard | Task 3 |
| 3 new careerStore actions | Task 4 |
| `advanceDay` wiring | Task 4 |
| `advanceToNextMatch` wiring | Task 4 |
| TransfersScreen "Ver ficha" button | Task 5 |
| ScoutScreen watchlist uses navigate | Task 5 |
| PlayerDetailScreen negotiation block + offer modal | Task 6 |
| ScoutScreen "Negociaciones activas" section | Task 7 |
| Quick-sell = market value −5% | Task 7 |
| Multiple simultaneous negotiations allowed | Tasks 2+3 (no single-negotiation guard) |
| offerRound cap enforced in UI (hide counter button) | Task 6 |
| Counter respond from ScoutScreen | Task 7 |
