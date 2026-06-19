# Data Editors — Dev Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full CRUD editors for players, teams, and leagues inside the Developer Menu, operating on the active profile stored in localStorage.

**Architecture:** Three new editor screens (DevPlayersScreen, DevTeamsScreen, DevLeaguesScreen) are added as new tabs in DevMenuScreen. Each screen reads the active profile via `profileService.getActiveProfile()`, mutates the data arrays inline, and persists via a new `updateProfileData()` service function. No auto-save on blur — user clicks "Guardar" explicitly. Editors work on whichever profile is currently active.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + Vitest

## Global Constraints

- Only Tailwind CSS for styling (no CSS-in-JS, no raw `style=` attributes, no external CSS files)
- No additional npm packages
- Editor screens use `<div className="h-full flex flex-col overflow-hidden">` as root (no GameLayout)
- TypeScript strict; no `any` types, no type assertions except where unavoidable (e.g. localStorage parse)
- All UI text in Spanish (e.g. "Jugadores", "Equipos", "Guardar", "Cancelar", "Nuevo jugador")
- Data is saved only when the user clicks the "Guardar" button inside the form
- Each player may have at most 3 normal techniques (`type !== 'Mejora'`) and at most 2 improvement techniques (`type === 'Mejora'`); enforce in UI by disabling the "Añadir técnica" button when limit reached
- `updateProfileData` replaces full arrays (not shallow merge of individual records)
- Tests use `vi.stubGlobal('localStorage', mock)` pattern already established in `src/tests/profileService.test.ts`

---

### Task 1: `updateProfileData` service function + DevMenuScreen new tab scaffold

**Files:**
- Modify: `src/services/profileService.ts` — add `updateProfileData` export
- Modify: `src/tests/profileService.test.ts` — add 3 tests for `updateProfileData`
- Modify: `src/screens/DevMenuScreen.tsx` — expand `DevTab` type, add 3 new tab buttons, add placeholder content areas

**Interfaces:**
- Produces: `export function updateProfileData(id: string, data: Partial<ProfileData>): void`
  - Reads profile by `id`; throws `Error('Profile not found: ' + id)` if missing
  - Merges partial: `{ ...profile.data, ...data }` (replaces full arrays, does NOT merge element-by-element)
  - Sets `profile.updatedAt = new Date().toISOString()`
  - Writes back via existing `writeProfile(profile)`
- Produces: `DevTab` type expanded to `'profiles' | 'players' | 'teams' | 'leagues'`

**Steps:**

- [ ] **Step 1: Add `updateProfileData` to `src/services/profileService.ts`**

  Add this export after the `deleteProfile` function (around line 171, before `ProfileExport`):

  ```typescript
  export function updateProfileData(id: string, data: Partial<ProfileData>): void {
    const profile = readProfile(id)
    if (!profile) throw new Error(`Profile not found: ${id}`)
    writeProfile({
      ...profile,
      data: { ...profile.data, ...data },
      updatedAt: new Date().toISOString(),
    })
  }
  ```

- [ ] **Step 2: Add 3 tests to `src/tests/profileService.test.ts`**

  Add a `describe('updateProfileData', ...)` block at the end of the test file (inside the top-level describe, before the closing `}`). The file already has `localStorage` mock and imports. Add:

  ```typescript
  describe('updateProfileData', () => {
    it('replaces the players array while keeping other data unchanged', () => {
      init()
      const p = createProfile('EditorTest', 'desc', ['custom'])
      const original = getProfile(p.id)!
      const fakePlayer = { id: 9001, name: 'Fake', nameRomaji: 'Fake' } as unknown as Player
      updateProfileData(p.id, { players: [fakePlayer] })
      const updated = getProfile(p.id)!
      expect(updated.data.players).toEqual([fakePlayer])
      // teams and leagues should remain unchanged
      expect(updated.data.teams).toEqual(original.data.teams)
      expect(updated.data.leagues).toEqual(original.data.leagues)
    })

    it('updates updatedAt to current time', () => {
      init()
      const before = new Date().toISOString()
      const p = createProfile('TimeTest', '', ['custom'])
      updateProfileData(p.id, { leagues: [] })
      const updated = getProfile(p.id)!
      expect(updated.updatedAt >= before).toBe(true)
    })

    it('throws if profile id does not exist', () => {
      init()
      expect(() => updateProfileData('no-such-id', { players: [] })).toThrow('Profile not found: no-such-id')
    })
  })
  ```

  Also add `Player` to the existing type import at the top if not already there:
  `import type { Player } from '../types/player'`
  
  And add `updateProfileData` to the import from profileService.

- [ ] **Step 3: Run tests to verify they pass**

  ```bash
  cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm run test -- --reporter=verbose src/tests/profileService.test.ts 2>&1 | tail -30
  ```

  All existing tests plus the 3 new ones must pass.

- [ ] **Step 4: Update `src/screens/DevMenuScreen.tsx`**

  Replace the `DevTab` type:
  ```typescript
  type DevTab = 'profiles' | 'players' | 'teams' | 'leagues'
  ```

  Replace the tab bar `<div className="flex border-b border-gray-800 shrink-0">` block with:
  ```tsx
  <div className="flex border-b border-gray-800 shrink-0 overflow-x-auto">
    {(['profiles', 'players', 'teams', 'leagues'] as const).map((tab) => {
      const labels = { profiles: 'Perfiles', players: 'Jugadores', teams: 'Equipos', leagues: 'Ligas' }
      return (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            activeTab === tab
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {labels[tab]}
        </button>
      )
    })}
  </div>
  ```

  Replace the content `<div className="flex-1 overflow-y-auto">` block with:
  ```tsx
  <div className="flex-1 overflow-y-auto">
    {activeTab === 'profiles' && <DevProfilesScreen />}
    {activeTab === 'players' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de jugadores</div>}
    {activeTab === 'teams' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de equipos</div>}
    {activeTab === 'leagues' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de ligas</div>}
  </div>
  ```

- [ ] **Step 5: Commit**

  ```bash
  cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite
  git add src/services/profileService.ts src/tests/profileService.test.ts src/screens/DevMenuScreen.tsx
  git commit -m "feat(dev): updateProfileData + DevMenu Jugadores/Equipos/Ligas tab scaffold"
  ```

---

### Task 2: DevPlayersScreen — full CRUD editor for players

**Files:**
- Create: `src/screens/DevPlayersScreen.tsx`
- Modify: `src/screens/DevMenuScreen.tsx` — import `DevPlayersScreen`, replace 'players' placeholder

**Interfaces:**
- Consumes from `../services/profileService`:
  - `getActiveProfile(): Profile | null`
  - `updateProfileData(id: string, data: Partial<ProfileData>): void`
- Consumes from `../types/player`:
  - `Player`, `Stats`, `Technique`, `Position`, `Element`, `Gender`, `CanonTier`, `statTotal`
- Consumes from `../components/Icon`: `Icon`

**UX pattern:**
- Header row: search `<input>` by name/nameRomaji, player count badge, "+ Nuevo jugador" button
- Scrollable list of compact player rows (one per player matching the search)
- Each row: jersey number | name | position | element | tier | TOT stat | Edit / Duplicate / Delete buttons
- Clicking "Editar" opens an inline form panel directly below that row (only one form open at a time)
- Clicking "+ Nuevo jugador" opens the form above the list
- Delete is immediate (no confirmation modal needed for a dev tool)
- Duplicate creates a copy with the same data, new auto-incremented id, and name "Copia de {original}"

**Helper: `statTotal` from `../types/player`** — use it to display TOT in the row and compute TOT for display in form.

**State:**
```typescript
const [players, setPlayers] = useState<Player[]>([])
const [profileId, setProfileId] = useState<string>('')
const [search, setSearch] = useState('')
const [editingId, setEditingId] = useState<number | 'new' | null>(null)
const [formData, setFormData] = useState<Player | null>(null)
```

**`refresh()` function (called on mount and after every mutation):**
```typescript
function refresh() {
  const p = getActiveProfile()
  if (!p) return
  setProfileId(p.id)
  setPlayers(p.data.players)
}
useEffect(() => { refresh() }, [])
```

**Next id helper:**
```typescript
function nextId(arr: Player[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map(p => p.id)) + 1
}
```

**Default new player:**
```typescript
function defaultPlayer(): Player {
  return {
    id: 0, // replaced on save
    name: 'Nuevo jugador',
    nameRomaji: 'New Player',
    gender: 'Masculino',
    position: 'MD',
    positionAlt: null,
    element: 'WIND',
    stats: { POT: 50, CON: 50, TEC: 50, PRE: 50, FIS: 50, AGI: 50, INT: 50, TOT: 350 },
    career: {
      maxLevel: 99,
      potential: 70,
      growthRate: 1,
      contractStatus: 'free',
      marketValue: 100000,
      salary: 5000,
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: null,
      positionChangePlan: null,
    },
    techniques: [],
    improvementTechniques: [],
    spriteUrl: '',
    stamina: 100,
    morale: 80,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 18,
    teamId: null,
    jerseyNumber: 0,
    canonTier: 'common',
    seasonStats: { goals: 0, assists: 0, cleanSheets: 0, matchesPlayed: 0, minutesPlayed: 0 },
  }
}
```

**Save handler:**
```typescript
function handleSave() {
  if (!formData || !profileId) return
  let next: Player[]
  if (editingId === 'new') {
    next = [...players, { ...formData, id: nextId(players) }]
  } else {
    next = players.map(p => p.id === formData.id ? formData : p)
  }
  updateProfileData(profileId, { players: next })
  refresh()
  setEditingId(null)
  setFormData(null)
}
```

**Delete handler:**
```typescript
function handleDelete(id: number) {
  const next = players.filter(p => p.id !== id)
  updateProfileData(profileId, { players: next })
  if (editingId === id) { setEditingId(null); setFormData(null) }
  refresh()
}
```

**Duplicate handler:**
```typescript
function handleDuplicate(player: Player) {
  const copy: Player = {
    ...JSON.parse(JSON.stringify(player)),
    id: nextId(players),
    name: `Copia de ${player.name}`,
  }
  updateProfileData(profileId, { players: [...players, copy] })
  refresh()
}
```

**Open edit form:**
```typescript
function handleEdit(player: Player) {
  if (editingId === player.id) {
    setEditingId(null); setFormData(null) // toggle close
  } else {
    setEditingId(player.id)
    setFormData(JSON.parse(JSON.stringify(player)))
  }
}

function handleNew() {
  setEditingId('new')
  setFormData(defaultPlayer())
}
```

**Filtered list:**
```typescript
const filtered = players.filter(p =>
  search === '' ||
  p.name.toLowerCase().includes(search.toLowerCase()) ||
  p.nameRomaji.toLowerCase().includes(search.toLowerCase())
)
```

**Inner `PlayerForm` component (defined at module level, not inside the parent):**

Props:
```typescript
interface PlayerFormProps {
  data: Player
  onChange: (updated: Player) => void
  onSave: () => void
  onCancel: () => void
}
```

Layout: two-column grid (`grid grid-cols-2 gap-4`) for basic info + career/stats, then a full-width techniques section.

**Left column — Basic info fields:**

Each field uses a label + input/select pair. Shared class for inputs:
`"w-full bg-dark-700 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"`

Fields (all in left column):
- name: `<input type="text" value={data.name} onChange={e => onChange({...data, name: e.target.value})}`
- nameRomaji: `<input type="text" value={data.nameRomaji} onChange={...}`
- age: `<input type="number" min="15" max="99" value={data.age} onChange={e => onChange({...data, age: +e.target.value})}`
- gender: `<select value={data.gender} onChange={e => onChange({...data, gender: e.target.value as Gender})}>`  options: Masculino, Femenino
- position: `<select>` options: GK, DF, MD, FW
- positionAlt: `<select value={data.positionAlt ?? ''}` onChange sets positionAlt to value || null. Options: `<option value="">— ninguna</option>` + GK, DF, MD, FW
- element: `<select>` options: FIRE, WOOD, WIND, MOUNTAIN
- canonTier: `<select>` options: common, rare, epic, legendary
- jerseyNumber: `<input type="number" min="0" max="99">`
- teamId: `<input type="number" value={data.teamId ?? 0}` onChange sets teamId to value === 0 ? null : value>
- spriteUrl: `<input type="text">`

**Right column — Career + Stats:**

Career fields (top of right column):
- maxLevel: `<input type="number" min="1" max="99">`
- potential: `<input type="number" min="1" max="99">`
- marketValue: `<input type="number" min="0">`
- salary: `<input type="number" min="0">`
- contractStatus: `<select>` options: free → "Libre", contracted → "Contratado"

Stats section (below career in right column), with a "Estadísticas" label:
Each stat (POT, CON, TEC, PRE, FIS, AGI, INT) is a row:
```tsx
<div className="flex items-center gap-2">
  <span className="text-gray-400 text-xs w-8">{stat}</span>
  <input
    type="number" min="1" max="99"
    value={data.stats[stat as keyof Stats]}
    onChange={e => onChange({
      ...data,
      stats: { ...data.stats, [stat]: +e.target.value, TOT: 0 } // TOT computed below
    })}
    className="w-16 bg-dark-700 border border-gray-700 rounded px-2 py-0.5 text-sm text-white text-center"
  />
</div>
```
TOT is shown as a read-only sum:
```tsx
<div className="flex items-center gap-2 pt-1 border-t border-gray-800">
  <span className="text-gray-300 text-xs font-semibold w-8">TOT</span>
  <span className="text-blue-300 text-sm font-bold">
    {data.stats.POT + data.stats.CON + data.stats.TEC + data.stats.PRE + data.stats.FIS + data.stats.AGI + data.stats.INT}
  </span>
</div>
```

**Techniques section (full width, below the two columns):**

Separate normal techniques (`isImprovement = false`, type !== 'Mejora') from improvement techniques.
Count: `normalTechs = (data.techniques ?? []).filter(t => t.type !== 'Mejora')`, `improveTechs = (data.improvementTechniques ?? [])`.

Default new technique:
```typescript
const newTech = (): Technique => ({
  id: Date.now(),
  name: '',
  type: 'Tiro',
  element: 'FIRE',
  POT: 50,
  PP: 5,
})
```

For each technique (in `techniques` array), show a row with:
- name: `<input type="text">`
- type: `<select>` options: Tiro, Regate, Bloqueo, Parada (for normal); type is readonly "Mejora" for improvement
- element: `<select>` options: FIRE, WOOD, WIND, MOUNTAIN, and `<option value="">— ninguno</option>`
- POT: `<input type="number" min="1" max="999">`
- PP: `<input type="number" min="1" max="99">`
- Remove button (×)

Mutation helpers for techniques:
```typescript
function updateTech(idx: number, field: keyof Technique, value: string | number) {
  if (!formData) return
  const techs = [...(formData.techniques ?? [])]
  techs[idx] = { ...techs[idx], [field]: value }
  onChange({ ...formData, techniques: techs })
}

function addTech() {
  if (!formData) return
  onChange({ ...formData, techniques: [...(formData.techniques ?? []), newTech()] })
}

function removeTech(idx: number) {
  if (!formData) return
  const techs = (formData.techniques ?? []).filter((_, i) => i !== idx)
  onChange({ ...formData, techniques: techs })
}

function updateImproveTech(idx: number, field: keyof Technique, value: string | number) {
  if (!formData) return
  const techs = [...(formData.improvementTechniques ?? [])]
  techs[idx] = { ...techs[idx], [field]: value }
  onChange({ ...formData, improvementTechniques: techs })
}

function addImproveTech() {
  if (!formData) return
  onChange({
    ...formData,
    improvementTechniques: [...(formData.improvementTechniques ?? []), { ...newTech(), type: 'Mejora' }],
  })
}

function removeImproveTech(idx: number) {
  if (!formData) return
  const techs = (formData.improvementTechniques ?? []).filter((_, i) => i !== idx)
  onChange({ ...formData, improvementTechniques: techs })
}
```

"Añadir técnica" button disabled when `(formData.techniques ?? []).length >= 3`.
"Añadir técnica de mejora" button disabled when `(formData.improvementTechniques ?? []).length >= 2`.

**Form wrapper styling:**
```tsx
<div className="bg-dark-800 border border-gray-700/50 rounded-lg mx-3 my-2 p-4 space-y-4">
  <div className="grid grid-cols-2 gap-4">
    {/* left col */}
    {/* right col */}
  </div>
  {/* techniques */}
  <div className="border-t border-gray-800 pt-3 space-y-3">...</div>
  {/* action buttons */}
  <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
    <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancelar</button>
    <button onClick={onSave} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium">Guardar</button>
  </div>
</div>
```

**Player row JSX structure:**
```tsx
<div className="flex items-center px-4 py-2.5 border-b border-gray-800/50 gap-3 hover:bg-dark-800/30">
  <span className="text-gray-600 text-xs w-6 shrink-0">#{player.jerseyNumber}</span>
  <span className="text-white text-sm flex-1 min-w-0 truncate">{player.name}</span>
  <span className="text-gray-500 text-xs shrink-0">{player.nameRomaji}</span>
  <span className={`text-xs font-bold shrink-0 ${positionColor(player.position)}`}>{player.position}</span>
  <span className="text-gray-400 text-xs shrink-0">{player.element}</span>
  <span className="text-gray-400 text-xs shrink-0">TOT {statTotal(player.stats)}</span>
  <button onClick={() => handleEdit(player)} className="text-blue-400 hover:text-blue-300 text-xs shrink-0 px-1.5 py-0.5 rounded hover:bg-blue-900/20">Editar</button>
  <button onClick={() => handleDuplicate(player)} className="text-gray-400 hover:text-white text-xs shrink-0 px-1.5 py-0.5 rounded hover:bg-gray-800">Dupl</button>
  <button onClick={() => handleDelete(player.id)} className="text-red-500 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5 rounded hover:bg-red-900/20">×</button>
</div>
```

Position color helper:
```typescript
function positionColor(pos: Position): string {
  return { GK: 'text-yellow-400', DF: 'text-blue-400', MD: 'text-green-400', FW: 'text-red-400' }[pos]
}
```

**Steps:**

- [ ] **Step 1: Create `src/screens/DevPlayersScreen.tsx`** with the full implementation described above

- [ ] **Step 2: Update `src/screens/DevMenuScreen.tsx`** — add import and replace the 'players' placeholder:

  Add import:
  ```typescript
  import DevPlayersScreen from './DevPlayersScreen'
  ```
  
  Replace:
  ```tsx
  {activeTab === 'players' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de jugadores</div>}
  ```
  with:
  ```tsx
  {activeTab === 'players' && <DevPlayersScreen />}
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm run build 2>&1 | grep "error TS" | head -20
  ```
  
  Fix any TypeScript errors before proceeding.

- [ ] **Step 4: Commit**

  ```bash
  cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite
  git add src/screens/DevPlayersScreen.tsx src/screens/DevMenuScreen.tsx
  git commit -m "feat(dev): DevPlayersScreen — CRUD editor for players in active profile"
  ```

---

### Task 3: DevTeamsScreen + DevLeaguesScreen

**Files:**
- Create: `src/screens/DevTeamsScreen.tsx`
- Create: `src/screens/DevLeaguesScreen.tsx`
- Modify: `src/screens/DevMenuScreen.tsx` — import both screens, replace placeholders

**Interfaces:**
- Consumes from `../services/profileService`: `getActiveProfile`, `updateProfileData`
- DevTeamsScreen also consumes: `Team`, `League` from types, `formations` from `../data/formations`, `formatMoney` from `../utils/formatMoney`
- DevLeaguesScreen consumes: `League`, `Team` from types

---

#### DevTeamsScreen

**Editable fields** (skip `formation`, `lineup`, `playerIds` — runtime state):
- name: `<input type="text">`
- tier: `<input type="number" min="1" max="10">`
- reputation: `<input type="number" min="1" max="100">`
- budget: `<input type="number" min="0">`
- leagueId: `<select>` — options built from `leagues` array in the same profile
- badgeUrl: `<input type="text">`

**State:**
```typescript
const [teams, setTeams] = useState<Team[]>([])
const [leagues, setLeagues] = useState<League[]>([])
const [profileId, setProfileId] = useState<string>('')
const [search, setSearch] = useState('')
const [editingId, setEditingId] = useState<number | 'new' | null>(null)
const [formData, setFormData] = useState<Team | null>(null)
```

**`refresh()`:**
```typescript
function refresh() {
  const p = getActiveProfile()
  if (!p) return
  setProfileId(p.id)
  setTeams(p.data.teams)
  setLeagues(p.data.leagues)
}
useEffect(() => { refresh() }, [])
```

**Next id:**
```typescript
function nextId(arr: Team[]): number {
  return arr.length === 0 ? 1 : Math.max(...arr.map(t => t.id)) + 1
}
```

**Default new team:**
```typescript
import { formations as seedFormations } from '../data/formations'

function defaultTeam(leagueList: League[]): Team {
  return {
    id: 0, // replaced on save
    name: 'Nuevo equipo',
    tier: 3,
    reputation: 50,
    budget: 500000,
    leagueId: leagueList[0]?.id ?? '',
    captainId: 0,
    keyPlayerId: undefined,
    badgeUrl: undefined,
    formation: seedFormations[0],
    lineup: [],
    playerIds: [],
    scoutLevel: 2,
    facilitiesLevel: 2,
  }
}
```

**Save handler:**
```typescript
function handleSave() {
  if (!formData || !profileId) return
  let next: Team[]
  if (editingId === 'new') {
    next = [...teams, { ...formData, id: nextId(teams) }]
  } else {
    next = teams.map(t => t.id === formData.id ? formData : t)
  }
  updateProfileData(profileId, { teams: next })
  refresh()
  setEditingId(null)
  setFormData(null)
}
```

**Delete and Duplicate handlers** follow the same pattern as DevPlayersScreen, with `teams` instead of `players` and `{ teams: next }` as partial data.

**Team row:**
```tsx
<div className="flex items-center px-4 py-2.5 border-b border-gray-800/50 gap-3 hover:bg-dark-800/30">
  <span className="text-gray-500 text-xs shrink-0">#{team.id}</span>
  <span className="text-white text-sm flex-1 min-w-0 truncate">{team.name}</span>
  <span className="text-gray-400 text-xs shrink-0">T{team.tier}</span>
  <span className="text-gray-400 text-xs shrink-0">Rep {team.reputation}</span>
  <span className="text-gray-500 text-xs shrink-0">{formatMoney(team.budget)}</span>
  <button onClick={() => handleEdit(team)} className="text-blue-400 hover:text-blue-300 text-xs shrink-0 px-1.5 py-0.5">Editar</button>
  <button onClick={() => handleDuplicate(team)} className="text-gray-400 hover:text-white text-xs shrink-0 px-1.5 py-0.5">Dupl</button>
  <button onClick={() => handleDelete(team.id)} className="text-red-500 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5">×</button>
</div>
```

**Team form** (inline, same panel pattern as PlayerForm):
```tsx
<div className="bg-dark-800 border border-gray-700/50 rounded-lg mx-3 my-2 p-4 space-y-3">
  <div className="grid grid-cols-2 gap-3">
    {/* name, tier, reputation, budget, leagueId dropdown, badgeUrl */}
  </div>
  <div className="flex justify-end gap-2 border-t border-gray-800 pt-3">
    <button onClick={handleCancel}>Cancelar</button>
    <button onClick={handleSave}>Guardar</button>
  </div>
</div>
```

leagueId select:
```tsx
<select value={formData.leagueId} onChange={e => setFormData({...formData, leagueId: e.target.value})}>
  {leagues.map(l => <option key={l.id} value={l.id}>{l.name} (L{l.level})</option>)}
</select>
```

---

#### DevLeaguesScreen

**All League fields are editable** (the League interface is a flat struct with no runtime state):

```typescript
export interface League {
  id: string          // editable — when changed, also update teams referencing old id
  name: string
  level: number
  promotionTo: string | null   // empty string in form → null when saving
  relegationTo: string | null
  promotionSlots: number
  relegationSlots: number
  teamsCount: number
  rounds: number
}
```

**State:**
```typescript
const [leagues, setLeagues] = useState<League[]>([])
const [teams, setTeams] = useState<Team[]>([])  // needed to cascade id renames
const [profileId, setProfileId] = useState<string>('')
const [search, setSearch] = useState('')
const [editingId, setEditingId] = useState<string | null>(null)  // null=closed, 'new'=create form, otherwise=league.id
const [formData, setFormData] = useState<League | null>(null)
```

**`refresh()`:**
```typescript
function refresh() {
  const p = getActiveProfile()
  if (!p) return
  setProfileId(p.id)
  setLeagues(p.data.leagues)
  setTeams(p.data.teams)
}
```

**Default new league:**
```typescript
function defaultLeague(): League {
  return {
    id: `liga-${Date.now()}`,
    name: 'Nueva liga',
    level: 1,
    promotionTo: null,
    relegationTo: null,
    promotionSlots: 0,
    relegationSlots: 0,
    teamsCount: 8,
    rounds: 14,
  }
}
```

**Save handler** (includes cascade on id rename):
```typescript
function handleSave() {
  if (!formData || !profileId) return
  const oldId = editingId !== 'new' ? editingId : null
  let nextLeagues: League[]
  let nextTeams = teams
  if (editingId === 'new') {
    nextLeagues = [...leagues, formData]
  } else {
    nextLeagues = leagues.map(l => l.id === oldId ? formData : l)
    if (oldId && formData.id !== oldId) {
      nextTeams = teams.map(t => t.leagueId === oldId ? { ...t, leagueId: formData.id } : t)
    }
  }
  updateProfileData(profileId, { leagues: nextLeagues, teams: nextTeams })
  refresh()
  setEditingId(null)
  setFormData(null)
}
```

**Delete handler** (also clears team leagueId references):
```typescript
function handleDelete(id: string) {
  const nextLeagues = leagues.filter(l => l.id !== id)
  // teams referencing this league get leagueId set to '' (leave repair to user)
  const nextTeams = teams.map(t => t.leagueId === id ? { ...t, leagueId: '' } : t)
  updateProfileData(profileId, { leagues: nextLeagues, teams: nextTeams })
  if (editingId === id) { setEditingId(null); setFormData(null) }
  refresh()
}
```

**League form** (`promotionTo`/`relegationTo` stored as string in input, converted to null on save if empty):

In the form, keep `promotionTo`/`relegationTo` as `string` using local string state coerced from the nullable:
```typescript
// Inside form, use formData directly but display null as empty string
value={formData.promotionTo ?? ''}
onChange={e => setFormData({ ...formData, promotionTo: e.target.value || null })}
```

**League row:**
```tsx
<div className="flex items-center px-4 py-2.5 border-b border-gray-800/50 gap-3 hover:bg-dark-800/30">
  <span className="text-blue-400 text-xs font-mono shrink-0">{league.id}</span>
  <span className="text-white text-sm flex-1 min-w-0 truncate">{league.name}</span>
  <span className="text-gray-400 text-xs shrink-0">L{league.level}</span>
  <span className="text-gray-500 text-xs shrink-0">{league.teamsCount} equipos</span>
  <button onClick={() => handleEdit(league)} className="text-blue-400 hover:text-blue-300 text-xs shrink-0 px-1.5 py-0.5">Editar</button>
  <button onClick={() => handleDelete(league.id)} className="text-red-500 hover:text-red-400 text-xs shrink-0 px-1.5 py-0.5">×</button>
</div>
```

(No duplicate for leagues — league ids must be unique and semantically meaningful.)

**Steps:**

- [ ] **Step 1: Create `src/screens/DevTeamsScreen.tsx`** with full implementation above

- [ ] **Step 2: Create `src/screens/DevLeaguesScreen.tsx`** with full implementation above

- [ ] **Step 3: Update `src/screens/DevMenuScreen.tsx`** — add two imports and replace placeholders:

  Add imports:
  ```typescript
  import DevTeamsScreen from './DevTeamsScreen'
  import DevLeaguesScreen from './DevLeaguesScreen'
  ```
  
  Replace:
  ```tsx
  {activeTab === 'teams' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de equipos</div>}
  {activeTab === 'leagues' && <div className="p-6 text-gray-500 text-sm">Próximamente — editor de ligas</div>}
  ```
  with:
  ```tsx
  {activeTab === 'teams' && <DevTeamsScreen />}
  {activeTab === 'leagues' && <DevLeaguesScreen />}
  ```

- [ ] **Step 4: Type-check**

  ```bash
  cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite && npm run build 2>&1 | grep "error TS" | head -20
  ```
  
  Fix any TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  cd /home/eru/Documents/Projects/inazuma/inazuma-eleven-lite
  git add src/screens/DevTeamsScreen.tsx src/screens/DevLeaguesScreen.tsx src/screens/DevMenuScreen.tsx
  git commit -m "feat(dev): DevTeamsScreen + DevLeaguesScreen — CRUD editors for teams and leagues"
  ```
