# Market Value & Sell Flow — Design Spec

**Date:** 2026-06-17  
**Status:** Approved

---

## Problem

1. The sell modal in `PlayerDetailScreen` accepts any number via a free-form `<input type="number">`, allowing the player to receive arbitrary amounts (e.g. `9999999999999`), breaking the economy.
2. `calcTransferValue` is a simple formula with no validation, no cap, and ignores several meaningful factors (canon importance, season performance, injury, team context).
3. `generateAIOffers` exists in `transferService.ts` but is never called — AI offers never appear in practice.

---

## Scope

- Add `canonTier` and `seasonStats` to `Player` type
- Redesign `calcTransferValue` with a multi-factor multiplicative formula
- Add `sanitizeAmount` for economic validation at all transaction boundaries
- Remove free-form sell input; replace with quick-sell (market value) + AI offer accept/reject
- Wire `generateAIOffers` to fire after `commitLiveMatch`
- Migrate all seed players and any readers of `seasonMatchMinutes`

---

## 1. Data Model Changes

### `src/types/player.ts`

Add to `Player`:

```ts
canonTier: 'common' | 'rare' | 'epic' | 'legendary'

seasonStats: {
  goals: number
  assists: number
  cleanSheets: number      // meaningful for GK/DF
  matchesPlayed: number
  minutesPlayed: number    // replaces optional seasonMatchMinutes
}
```

Remove the existing optional `seasonMatchMinutes?: number` field. All reads of `seasonMatchMinutes` migrate to `seasonStats.minutesPlayed`.

`seasonStats` resets to all-zeros at the start of each new season (in the `startNewSeason` store action).

### `src/data/players.ts`

Every player entry receives:
- `canonTier`: assigned per character significance. Default `'common'` for generic/unnamed characters.
- `seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 }`

Canon tier assignment guidelines:
- `'legendary'`: main protagonists and iconic rivals central to the main story arc
- `'epic'`: team captains, arc antagonists, named story characters with significant screen time
- `'rare'`: named support characters, team regulars with some story presence
- `'common'`: generic players, unnamed roster filler

---

## 2. Market Value Formula

### Location: `src/services/transferService.ts`

```
marketValue =
  TOT × 1_000
  × factorAge
  × factorPotential
  × factorCanon
  × factorPerformance
  × factorInjury
  × factorImportance    (optional context)
  × factorDivision      (optional context)
```

**Factor definitions:**

| Factor | Condition | Multiplier |
|---|---|---|
| Age | ≤ 22 | 1.4 |
| Age | ≤ 26 | 1.2 |
| Age | ≤ 30 | 1.0 |
| Age | > 30 | 0.7 |
| Potential | > 80 | 1.3 |
| Potential | > 60 | 1.1 |
| Potential | ≤ 60 | 1.0 |
| Canon | `'legendary'` | 2.2 |
| Canon | `'epic'` | 1.6 |
| Canon | `'rare'` | 1.3 |
| Canon | `'common'` | 1.0 |
| Performance | — | `1 + clamp(goals×0.01 + assists×0.005 + cleanSheets×0.008, 0, 0.30)` |
| Injury | `isInjured` | 0.85 |
| Injury | healthy | 1.0 |
| Importance | starter | 1.1 |
| Importance | bench | 1.0 |
| Importance | not called up | 0.95 |
| Division | teamReputation 0–100 | `0.85 + (teamReputation / 100) × 0.30` → range 0.85–1.15 |

**Signature:**

```ts
function calcTransferValue(
  player: Player,
  ctx?: { isStarter?: boolean; teamReputation?: number }
): number
```

`ctx` is optional. Callers that omit it get importance=1.0 and division=1.0 (neutral).

**Indicative ranges:**
- Young legendary player in form: ~€600K–900K
- Average common player, no performance: ~€60K–120K
- Veteran legendary with injury: ~€180K–250K

**Hard cap:** `MAX_TRANSFER_VALUE = 10_000_000`. No computed or accepted value ever exceeds €10M.

---

## 3. Economic Validation

### `sanitizeAmount` in `src/services/transferService.ts`

```ts
export const MAX_TRANSFER_VALUE = 10_000_000

export function sanitizeAmount(amount: unknown): number | null {
  const n = Number(amount)
  if (!Number.isFinite(n) || Number.isNaN(n)) return null
  if (n <= 0) return null
  if (n > MAX_TRANSFER_VALUE) return null
  return Math.round(n)
}
```

Applied at every transaction boundary:
- `buyPlayer` (service) — before deducting from budget
- `sellPlayer` (service) — before crediting to budget
- `acceptTransferOffer` (store) — before calling `sellPlayer`

If `sanitizeAmount` returns `null`, the operation is silently cancelled (same behavior as today when player or team is not found).

---

## 4. Sell Flow & UI

### `PlayerDetailScreen` — sell modal

The free-form `<input type="number">` is removed entirely.

The modal shows:

```
Vender jugador

Valor de mercado          €220.400

┌─ Venta rápida ─────────────────────┐
│ Recibes: €220.400                  │
│ [sell icon]  Vender ahora          │
└────────────────────────────────────┘

┌─ Oferta de Raimon FC ──────────────┐  ← only shown if a pending
│ €264.000  (+€43.600 / +20%)        │    TRANSFER_OFFER inbox event
│ [check icon]  Aceptar oferta       │    exists for this player
│ [close icon]  Rechazar             │
└────────────────────────────────────┘

[close]  Cancelar
```

- **Quick sell** calls `sellPlayer` with `calcTransferValue(player)` — no user input.
- **Offer panel** only renders when `career.inbox` contains a `TRANSFER_OFFER` event whose `data.playerId` matches the current player. Shows offer amount, delta vs market value, and accept/reject buttons that call the existing `acceptTransferOffer` / `rejectTransferOffer` store actions.
- `ScoutScreen` continues to show all incoming offers aggregated. It no longer duplicates logic — both screens call the same store actions.

### State owned by `PlayerDetailScreen`

No new state needed. The offer lookup is a derived value from `career.inbox` (already available via the store).

---

## 5. AI Offer Generation

`generateAIOffers` in `transferService.ts` is already implemented but never called.

Wire it to `commitLiveMatch` in `src/store/careerStore.ts`:

```
after commitLiveMatch resolves:
  with 20% probability, call generateAIOffers(career, teams, players)
  for each offer returned:
    push a TRANSFER_OFFER inbox event with offer data
```

The existing `generateAIOffers` logic offers 80–130% of `calcTransferValue` and checks that the bidding AI team has enough budget. No changes needed to the function itself.

---

## 6. Files Modified

| File | Change |
|---|---|
| `src/types/player.ts` | Add `canonTier`, `seasonStats`; remove `seasonMatchMinutes` |
| `src/data/players.ts` | Add `canonTier` and initial `seasonStats` to every player entry |
| `src/services/transferService.ts` | New `calcTransferValue`, add `sanitizeAmount`, export `MAX_TRANSFER_VALUE` |
| `src/store/careerStore.ts` | Apply `sanitizeAmount` in `buyPlayer`/`sellPlayer`/`acceptTransferOffer`; wire `generateAIOffers` in `commitLiveMatch`; reset `seasonStats` in `startNewSeason` |
| `src/screens/PlayerDetailScreen.tsx` | Remove free-form sell input; add quick-sell button and conditional offer panel |
| `src/screens/ScoutScreen.tsx` (minor) | Use `seasonStats.minutesPlayed` if referenced; no structural change |

Any other file that reads `player.seasonMatchMinutes` migrates to `player.seasonStats.minutesPlayed`.

---

## 7. Out of Scope

- Manual price negotiation (no free-form input, ever)
- Contract duration factor (field doesn't exist yet; formula is ready to add a `contractFactor` multiplier when it does)
- Per-player title/trophy tracking (no field exists; can be added as a `seasonStats.titlesWon` counter in a future iteration)
