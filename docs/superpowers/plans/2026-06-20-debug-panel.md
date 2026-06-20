# Debug Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen Debug Panel accessible via a new nav tab (only in dev mode) that groups cheat/debug actions into sections, replacing the ad-hoc cheat buttons currently in the Settings drawer.

**Architecture:** New `DevDebugScreen.tsx` wraps `GameLayout` and makes direct `useCareerStore.setState()` mutations for all cheat actions — no new store actions needed. `GameLayout.tsx` appends a Debug tab conditionally based on `isDevModeActive()`. `App.tsx` adds `'debug'` to the Screen union and renders the new screen. The existing cheat section in `SettingsDrawer.tsx` is removed.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, Vite (existing stack).

## Global Constraints

- Dev mode check: `isDevModeActive()` from `src/services/profileService.ts`
- Player stamina field: `player.stamina` (top-level, not nested)
- Player injury fields: `player.isInjured: boolean`, `player.injuryDaysRemaining: number`
- Stats type: `{ POT, CON, TEC, PRE, FIS, AGI, INT, TOT }` — TOT = `Math.round((POT+CON+TEC+PRE+FIS+AGI+INT)/7)`, cap each base stat at 99 before computing
- Team fields: `team.budget`, `team.reputation` (clamp 0–100), `team.leagueId`, `team.tier`
- League fields: `league.promotionTo: string | null`, `league.relegationTo: string | null`, `league.level: number`
- On promotion: `team.leagueId = league.promotionTo`, `team.tier = targetLeague.level`
- On relegation: `team.leagueId = league.relegationTo`, `team.tier = targetLeague.level`
- `tier === league.level` (1 = Primera División, 2 = Segunda División)
- Equipment item: `{ id, slot: EquipmentSlot, name, statBonuses: Partial<Stats>, tier: 1|2|3, rarity?: RewardRarity }`
- `leagues` array: accessed via `useCareerStore((s) => s.leagues)`
- Screen type union is defined in `src/App.tsx` and exported as `Screen`
- Nav tabs defined in `NAV_ITEMS` array in `src/components/GameLayout.tsx`
- Feedback toast: visible 1.5 s, no confirmation modals

---

## File Map

| Action | File |
|---|---|
| Create | `src/screens/DevDebugScreen.tsx` |
| Modify | `src/App.tsx` (add `'debug'` to Screen union + render) |
| Modify | `src/components/GameLayout.tsx` (conditional Debug tab) |
| Modify | `src/components/SettingsDrawer.tsx` (remove cheat section) |

---

### Task 1: Create `DevDebugScreen.tsx`

**Files:**
- Create: `src/screens/DevDebugScreen.tsx`

**Interfaces:**
- Consumes: `useCareerStore` (career, teams, leagues, players, navigate), `isDevModeActive` (for the empty-state guard)
- Produces: default export `DevDebugScreen` component used by App.tsx

- [ ] **Step 1: Create the screen file with all sections**

Create `src/screens/DevDebugScreen.tsx` with this exact content:

```tsx
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import GameLayout from '../components/GameLayout'
import Icon from '../components/Icon'
import type { EquipmentItem } from '../types/equipment'

const DEV_ITEM: EquipmentItem = {
  id: 'dev_item_placeholder',
  slot: 'boots',
  name: 'Botas del Desarrollador',
  statBonuses: { POT: 5, CON: 5, TEC: 5, PRE: 5 },
  tier: 3,
  rarity: 'legendary',
}

function SectionHeader({ icon, label, color = 'text-purple-400' }: { icon: string; label: string; color?: string }) {
  return (
    <h3 className={`${color} text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5`}>
      <span className="material-icons text-sm">{icon}</span>
      {label}
    </h3>
  )
}

function CheatBtn({ label, icon, onClick, disabled = false }: {
  label: string; icon: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors w-full ${
        disabled
          ? 'border-gray-700 text-gray-600 cursor-not-allowed'
          : 'border-purple-600/30 bg-purple-900/20 hover:bg-purple-900/40 text-purple-300'
      }`}
    >
      <span className="material-icons text-sm">{icon}</span>
      {label}
    </button>
  )
}

export default function DevDebugScreen() {
  const career = useCareerStore((s) => s.career)
  const teams = useCareerStore((s) => s.teams)
  const leagues = useCareerStore((s) => s.leagues)
  const navigate = useCareerStore((s) => s.navigate)

  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }

  if (!career) {
    return (
      <GameLayout>
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500 text-sm">No hay carrera activa.</p>
        </div>
      </GameLayout>
    )
  }

  const userTeam = teams.find((t) => t.id === career.teamId)!
  const currentLeague = leagues.find((l) => l.id === userTeam.leagueId)
  const promotionLeague = currentLeague?.promotionTo
    ? leagues.find((l) => l.id === currentLeague.promotionTo)
    : null
  const relegationLeague = currentLeague?.relegationTo
    ? leagues.find((l) => l.id === currentLeague.relegationTo)
    : null

  // ── Economía ──────────────────────────────────────────────
  function addBudget(delta: number) {
    const { career: c, teams: ts } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      teams: ts.map((t) =>
        t.id === c.teamId ? { ...t, budget: Math.max(0, t.budget + delta) } : t
      ),
    })
    flash(`${delta > 0 ? '+' : ''}${(delta / 1000).toFixed(0)}k€`)
  }

  // ── Club ──────────────────────────────────────────────────
  function addReputation(delta: number) {
    const { career: c, teams: ts } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      teams: ts.map((t) =>
        t.id === c.teamId
          ? { ...t, reputation: Math.min(100, Math.max(0, t.reputation + delta)) }
          : t
      ),
    })
    flash(`${delta > 0 ? '+' : ''}${delta} Reputación`)
  }

  // ── Plantilla ─────────────────────────────────────────────
  function fullEnergy() {
    const { career: c, players } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      players: players.map((p) =>
        p.teamId === c.teamId ? { ...p, stamina: 100 } : p
      ),
    })
    flash('Energía completa')
  }

  function cureInjuries() {
    const { career: c, players } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      players: players.map((p) =>
        p.teamId === c.teamId
          ? { ...p, isInjured: false, injuryDaysRemaining: 0 }
          : p
      ),
    })
    flash('Lesiones curadas')
  }

  function boostStats() {
    const { career: c, players } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      players: players.map((p) => {
        if (p.teamId !== c.teamId) return p
        const s = p.stats
        const POT = Math.min(99, s.POT + 10)
        const CON = Math.min(99, s.CON + 10)
        const TEC = Math.min(99, s.TEC + 10)
        const PRE = Math.min(99, s.PRE + 10)
        const FIS = Math.min(99, s.FIS + 10)
        const AGI = Math.min(99, s.AGI + 10)
        const INT = Math.min(99, s.INT + 10)
        const TOT = Math.round((POT + CON + TEC + PRE + FIS + AGI + INT) / 7)
        return { ...p, stats: { POT, CON, TEC, PRE, FIS, AGI, INT, TOT } }
      }),
    })
    flash('+10 stats plantilla')
  }

  // ── Inventario ────────────────────────────────────────────
  function addItem() {
    const { career: c } = useCareerStore.getState()
    if (!c) return
    const item: EquipmentItem = { ...DEV_ITEM, id: `dev_item_${Date.now()}` }
    useCareerStore.setState({
      career: {
        ...c,
        inventory: {
          ...c.inventory,
          equipmentItems: [...c.inventory.equipmentItems, item],
        },
      },
    })
    flash('Objeto añadido')
  }

  // ── Liga ──────────────────────────────────────────────────
  function changeLeague(targetLeague: typeof promotionLeague) {
    if (!targetLeague) return
    const { career: c, teams: ts } = useCareerStore.getState()
    if (!c) return
    useCareerStore.setState({
      teams: ts.map((t) =>
        t.id === c.teamId
          ? { ...t, leagueId: targetLeague.id, tier: targetLeague.level }
          : t
      ),
    })
    flash(`Liga → ${targetLeague.name} (próxima temporada)`)
  }

  return (
    <GameLayout>
      <main className="h-full overflow-y-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-icons text-purple-400 text-lg">bug_report</span>
            <h1 className="text-white font-bold text-base">Panel de Debug</h1>
          </div>
          <span className="text-[0.6rem] text-purple-500 uppercase tracking-widest font-semibold bg-purple-900/30 border border-purple-700/40 px-2 py-0.5 rounded-full">
            Dev Mode
          </span>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-purple-800 border border-purple-500/60 text-purple-100 text-sm font-semibold rounded-full shadow-lg">
            ✓ {toast}
          </div>
        )}

        {/* Economía */}
        <section>
          <SectionHeader icon="payments" label="Economía" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="+100.000€" icon="add" onClick={() => addBudget(100_000)} />
            <CheatBtn label="+500.000€" icon="add_circle" onClick={() => addBudget(500_000)} />
            <CheatBtn label="−100.000€" icon="remove" onClick={() => addBudget(-100_000)} />
            <CheatBtn label="−500.000€" icon="remove_circle" onClick={() => addBudget(-500_000)} />
          </div>
        </section>

        {/* Club */}
        <section>
          <SectionHeader icon="shield" label="Club" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="+5 Reputación" icon="star" onClick={() => addReputation(5)} />
            <CheatBtn label="+10 Reputación" icon="star_rate" onClick={() => addReputation(10)} />
            <CheatBtn label="−10 Reputación" icon="star_border" onClick={() => addReputation(-10)} />
          </div>
        </section>

        {/* Plantilla */}
        <section>
          <SectionHeader icon="groups" label="Plantilla" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="Energía completa" icon="bolt" onClick={fullEnergy} />
            <CheatBtn label="Curar lesiones" icon="healing" onClick={cureInjuries} />
            <CheatBtn label="+10 stats" icon="trending_up" onClick={boostStats} />
          </div>
        </section>

        {/* Inventario */}
        <section>
          <SectionHeader icon="backpack" label="Inventario" />
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn label="Objeto legendario" icon="sprint" onClick={addItem} />
          </div>
        </section>

        {/* Liga */}
        <section>
          <SectionHeader icon="leaderboard" label="Liga" />
          <p className="text-gray-500 text-[0.625rem] mb-2">
            El cambio afecta a la siguiente temporada.
            Liga actual: <span className="text-gray-300">{currentLeague?.name ?? userTeam.leagueId}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <CheatBtn
              label={promotionLeague ? `↑ ${promotionLeague.name}` : 'Sin ascenso'}
              icon="arrow_upward"
              onClick={() => changeLeague(promotionLeague)}
              disabled={!promotionLeague}
            />
            <CheatBtn
              label={relegationLeague ? `↓ ${relegationLeague.name}` : 'Sin descenso'}
              icon="arrow_downward"
              onClick={() => changeLeague(relegationLeague)}
              disabled={!relegationLeague}
            />
          </div>
        </section>

        {/* Dev Menu link */}
        <section>
          <SectionHeader icon="edit_note" label="Editor de datos" />
          <button
            onClick={() => navigate('dev_menu')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-600/30 bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 text-sm transition-colors w-full"
          >
            <span className="material-icons text-sm">database</span>
            Abrir DevMenu (jugadores, equipos, ligas)
          </button>
        </section>

      </main>
    </GameLayout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm run build 2>&1 | grep "error TS"
```

Expected: no output (zero TS errors). If errors appear, fix field names against `src/types/player.ts`, `src/types/team.ts`, `src/types/competition.ts`.

---

### Task 2: Wire `DevDebugScreen` into `App.tsx` and `GameLayout.tsx`

**Files:**
- Modify: `src/App.tsx` (Screen union + import + render)
- Modify: `src/components/GameLayout.tsx` (conditional Debug tab)

**Interfaces:**
- Consumes: `DevDebugScreen` default export from Task 1
- Produces: `'debug'` screen navigable from the nav bar

- [ ] **Step 1: Add `'debug'` to the Screen union in `App.tsx`**

In `src/App.tsx`, find the Screen type (around line 27-41). Add `| 'debug'` after `| 'dev_menu'`:

```ts
export type Screen =
  | 'main_menu'
  | 'new_career'
  | 'career_home'
  | 'club'
  | 'squad'
  | 'player_detail'
  | 'formation'
  | 'training'
  | 'calendar'
  | 'match'
  | 'match_live'
  | 'standings'
  | 'transfers'
  | 'scout'
  | 'save_load'
  | 'season_review'
  | 'dev_menu'
  | 'debug'
```

- [ ] **Step 2: Import and render `DevDebugScreen` in `App.tsx`**

Add the import at the top of `src/App.tsx` (with the other screen imports):

```ts
import DevDebugScreen from './screens/DevDebugScreen'
```

Add the render condition inside the return, after the `dev_menu` line:

```tsx
{screen === 'debug' && <DevDebugScreen />}
```

- [ ] **Step 3: Add the Debug tab to `GameLayout.tsx`**

In `src/components/GameLayout.tsx`, add the `isDevModeActive` import at the top:

```ts
import { isDevModeActive } from '../services/profileService'
```

Then replace the `NAV_ITEMS` constant with a computed version that appends the Debug tab when dev mode is active. Change from:

```ts
const NAV_ITEMS: NavItem[] = [
  { screen: 'career_home', label: 'Inicio', icon: 'home' },
  ...
  { screen: 'transfers', label: 'Fichajes', icon: 'swap_horiz' },
]
```

to:

```ts
const BASE_NAV_ITEMS: NavItem[] = [
  { screen: 'career_home', label: 'Inicio', icon: 'home' },
  { screen: 'club', label: 'Club', icon: 'shield' },
  { screen: 'squad', label: 'Plantilla', icon: 'groups' },
  { screen: 'formation', label: 'Formación', icon: 'dashboard' },
  { screen: 'training', label: 'Entreno', icon: 'fitness_center' },
  { screen: 'calendar', label: 'Calendario', icon: 'calendar_month' },
  { screen: 'standings', label: 'Clasificación', icon: 'leaderboard' },
  { screen: 'transfers', label: 'Fichajes', icon: 'swap_horiz' },
]

const NAV_ITEMS: NavItem[] = isDevModeActive()
  ? [...BASE_NAV_ITEMS, { screen: 'debug' as Screen, label: 'Debug', icon: 'bug_report' }]
  : BASE_NAV_ITEMS
```

Note: `NavItem.screen` is typed as `Screen`, so the `'debug'` addition requires that Task 2 Step 1 is done first.

- [ ] **Step 4: Verify build and nav tab**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm run build 2>&1 | grep "error TS"
```

Expected: no output. Then start the app (`npm run dev`) in a terminal, activate dev mode (the existing mechanism in MainMenuScreen), load a career, and confirm the Debug tab appears at the end of the nav bar.

- [ ] **Step 5: Commit**

```bash
git add src/screens/DevDebugScreen.tsx src/App.tsx src/components/GameLayout.tsx
git commit -m "feat(dev): DevDebugScreen — debug panel tab with cheat sections"
```

---

### Task 3: Clean up `SettingsDrawer.tsx`

**Files:**
- Modify: `src/components/SettingsDrawer.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: SettingsDrawer without the cheat section (and without unused imports)

- [ ] **Step 1: Remove the cheat section from `SettingsDrawer.tsx`**

Remove the following from `src/components/SettingsDrawer.tsx`:

1. The two imports at the top:
```ts
import { isDevModeActive } from '../services/profileService'
import type { EquipmentItem } from '../types/equipment'
```

2. The `CHEAT_ITEM` constant (lines ~34–41):
```ts
const CHEAT_ITEM: EquipmentItem = {
  id: 'dev_cheat_item',
  slot: 'boots',
  name: 'Botas del Desarrollador',
  statBonuses: { POT: 5, CON: 5, TEC: 5, PRE: 5 },
  tier: 3,
  rarity: 'legendary',
}
```

3. Inside the component, remove:
   - `const [devMode] = useState(() => isDevModeActive())`
   - `const [cheatFeedback, setCheatFeedback] = useState<string | null>(null)`
   - The `flashCheat`, `cheatAddMoney`, `cheatAddReputation`, `cheatAddItem` functions
   - The entire `{devMode && career && ( ... )}` JSX block at the bottom

- [ ] **Step 2: Verify build**

```bash
cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm run build 2>&1 | grep "error TS"
```

Expected: no output.

- [ ] **Step 3: Run tests**

```bash
npm run test 2>&1 | tail -8
```

Expected: all tests pass (290 tests, 21 files).

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsDrawer.tsx
git commit -m "refactor(settings): remove cheat buttons (moved to DevDebugScreen)"
```
