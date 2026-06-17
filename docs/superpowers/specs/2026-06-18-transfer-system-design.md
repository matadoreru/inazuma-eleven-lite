# Transfer System Redesign — FIFA-Style Negotiations

**Date:** 2026-06-18  
**Status:** Approved

---

## Overview

Replace the current instant-buy transfer system with a multi-phase asynchronous negotiation flow (FIFA-style). The user must first contact the rival club, wait for their response over 2–3 game days, and if the club accepts, wait for the player's decision over another 2–3 days. Selling logic is also improved: quick sell always applies a −5% discount, and incoming AI offers remain as-is.

---

## 1. New Data Types (`types/career.ts`)

### `NegotiationPhase`

```ts
export type NegotiationPhase =
  | 'club_pending'    // waiting for rival club response
  | 'player_pending'  // club accepted; waiting for player decision
  | 'completed'       // transfer completed successfully
  | 'failed'          // negotiation rejected definitively
  | 'cancelled'       // cancelled by the user
```

### `OutgoingNegotiation`

```ts
export interface OutgoingNegotiation {
  id: string
  playerId: number
  playerName: string
  targetClubId: number | null   // null = free agent (no club phase)
  targetClubName: string
  phase: NegotiationPhase
  currentOffer: number          // current amount offered to the club
  counterAmount?: number        // club counter-offer amount, if any
  offerRound: number            // 1–3 (initial offer + max 2 counter-offers)
  isFreeAgent: boolean
  resolutionDate: string        // ISO date: phase resolves on or after this date
}
```

### `Career` additions

```ts
outgoingNegotiations: OutgoingNegotiation[]
```

### New `InboxEventType` values

```ts
| 'OUTGOING_TRANSFER_CLUB_ACCEPTED'
| 'OUTGOING_TRANSFER_CLUB_REJECTED'
| 'OUTGOING_TRANSFER_CLUB_COUNTER'
| 'OUTGOING_TRANSFER_PLAYER_ACCEPTED'
| 'OUTGOING_TRANSFER_PLAYER_REJECTED'
```

---

## 2. Service Layer (`services/transferService.ts`)

### `evaluateClubOffer(offer, player, sellingTeam, allPlayers, teams) → 'accept' | 'counter' | 'reject'`

1. Compute `marketValue = calcTransferValue(player)`.
2. Hard reject if `offer < marketValue * 0.7` (too low, no counter).
3. Compute **replacement capacity**:
   - Count squad members of the same position in `sellingTeam` excluding the player being sold.
   - Critical positions (GK, DF): if remaining count < 1 → reject regardless of price.
   - If remaining count < 2 → apply a `replacementPenalty` that raises the acceptance threshold.
4. Compute **reputation factor**: `reputationFactor = 1.0 + (sellingTeam.reputation / 200)`. Higher reputation clubs demand more.
5. Compute `threshold = marketValue * reputationFactor * replacementPenalty`.
6. Decision:
   - `offer >= threshold` → `'accept'`
   - `offer >= threshold * 0.85` → `'counter'` (counter at `threshold * 1.05`)
   - else → `'reject'`

### `evaluatePlayerDecision(player, buyingTeam) → 'accept' | 'reject'`

- Based on `player.stats.TOT` (not potential):
  - TOT < 65 → always accepts
  - TOT 65–74 → accepts if `buyingTeam.reputation >= 30`
  - TOT 75–84 → accepts if `buyingTeam.reputation >= 50`
  - TOT 85+ → accepts if `buyingTeam.reputation >= 70`

### `initiateNegotiation(playerId, amount, career, players, teams) → Career`

- Validates: no existing active negotiation for same player, player is not in user team, budget check (soft — user can overspend on offer but transfer will fail if budget runs out at completion).
- Creates `OutgoingNegotiation` with:
  - `phase`: `'club_pending'` (or `'player_pending'` if free agent)
  - `offerRound: 1`
  - `resolutionDate`: `currentDate + rand(2, 3)` days
- Adds to `career.outgoingNegotiations`.

### `resolveNegotiations(career, players, teams) → { career, players, teams }`

Called from `advanceDay` after date advance. For each negotiation where `resolutionDate <= currentDate` and phase is active:

**`club_pending`:**
- Call `evaluateClubOffer`
- `'accept'` → set `phase = 'player_pending'`, new `resolutionDate = +2 or 3 days`, add `OUTGOING_TRANSFER_CLUB_ACCEPTED` inbox event
- `'counter'` → set `counterAmount`, add `OUTGOING_TRANSFER_CLUB_COUNTER` inbox event (phase stays `club_pending` until user responds)
- `'reject'` → set `phase = 'failed'`, add `OUTGOING_TRANSFER_CLUB_REJECTED` inbox event

**`player_pending`:**
- Call `evaluatePlayerDecision`
- `'accept'` → call `buyPlayer`, set `phase = 'completed'`, add `OUTGOING_TRANSFER_PLAYER_ACCEPTED` inbox event
- `'reject'` → set `phase = 'failed'`, add `OUTGOING_TRANSFER_PLAYER_REJECTED` inbox event

Note: when a counter-offer is pending, `resolutionDate` is not checked — it waits for user response. The user's response (accept counter, reject, or counter-offer) then sets a new `resolutionDate` and continues the cycle. `offerRound` increments with each counter. At `offerRound >= 3`, no further counters are allowed — user can only accept or reject the club's last counter.

### `respondToCounter(negotiationId, action, newAmount, career) → Career`

- `action: 'accept_counter' | 'reject' | 'counter'`
- `'accept_counter'` → sets `currentOffer = counterAmount`, clears `counterAmount`, sets new `resolutionDate` for player phase
- `'reject'` → sets `phase = 'failed'`
- `'counter'` → updates `currentOffer = newAmount`, increments `offerRound`, sets new `resolutionDate` for next club eval
- Only allowed if `offerRound < 3` for counter action

### `cancelNegotiation(negotiationId, career) → Career`

Sets `phase = 'cancelled'`.

### Quick sell fix

In `PlayerDetailScreen.handleQuickSell`:
```ts
const quickSellPrice = Math.round(calcTransferValue(player) * 0.95)
sellPlayer(player.id, targetTeam.id, quickSellPrice)
```

---

## 3. Store (`store/careerStore.ts`)

New actions:
```ts
initiateTransferNegotiation(playerId: number, amount: number): void
respondToCounterOffer(negotiationId: string, action: 'accept_counter' | 'reject' | 'counter', newAmount?: number): void
cancelNegotiation(negotiationId: string): void
```

`advanceDay` calls `resolveNegotiations` after date changes.

Migration: `outgoingNegotiations: []` added with default value so existing saves don't break.

---

## 4. UI Changes

### TransfersScreen

- Button "Fichar" → **"Ver ficha"** — navigates to `PlayerDetailScreen`. No direct purchase from the list.
- `TransferPlayerRow` `onBuy` prop → `onViewPlayer` prop (or rename). Calls `navigate + selectPlayer`.
- `handleBuy` action removed from `TransfersScreen`.

### PlayerDetailScreen — non-owned player

New "fichaje action block" replaces the old instant buy button:

| State | UI |
|---|---|
| No active negotiation | Button "Contactar club" / "Contactar agente" → opens offer modal |
| `club_pending` (no counter) | "Esperando respuesta del club · Est. {date}" + Cancel button |
| `club_pending` (counter received) | Yellow card: club counter amount, buttons Aceptar / Rechazar / Contra-ofrecer |
| `player_pending` | "El jugador está valorando la oferta · Est. {date}" + Cancel button |
| `completed` | Green badge "Fichaje completado" |
| `failed` | Red badge "Negociación fallida" + "Reintentar" button |
| `cancelled` | Gray badge "Cancelada" + "Nueva oferta" button |

**Offer modal** (mini-modal, not full screen):
- Shows player name, market value
- Amount input pre-filled with market value (respecting `transferCostMultiplier`)
- "Enviar oferta" button

### ScoutScreen — "Negociaciones activas" section

Added above watchlist. Only shown when `outgoingNegotiations` has active entries (phase ≠ completed/cancelled/failed with >7 days old).

Each card shows:
- Player sprite, name, position
- Target club name
- Current phase label + icon
- Estimated resolution date
- Current offer amount
- If counter pending: inline respond buttons
- "Cancelar" button

### PlayerDetailScreen — owned player sell modal

- Quick sell label shows price as `valor de mercado − 5%`
- Amount displayed as `fmt(calcTransferValue(player) * 0.95)`
- Actual sell called with that amount

---

## 5. Invariants & Edge Cases

- **Budget check at completion:** If user's budget < transfer fee when player phase resolves (budget may have been spent elsewhere), the transfer fails with a specific inbox message ("Sin presupuesto suficiente").
- **Player already transferred:** If `player.teamId` changed between negotiation start and resolution (another AI deal moved them), negotiation fails gracefully.
- **Multiple negotiations:** Allowed simultaneously for different players. Same player: only one active at a time (enforced in `initiateNegotiation`).
- **Free agents:** Skip `club_pending`, go directly to `player_pending` with a `resolutionDate`.
- **Max offer rounds:** `offerRound` caps at 3. Counter action disabled in UI when `offerRound >= 3`.
- **Save/load compatibility:** `outgoingNegotiations` defaults to `[]` in `createCareer` and in save migration.

---

## 6. Out of Scope

- Salary / contract system (not in game)
- Loan system
- Transfer window restrictions (season calendar gates are not implemented)
- Player-initiated transfer requests
