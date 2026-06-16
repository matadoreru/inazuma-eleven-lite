# Career Menu Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign MainMenuScreen and NewCareerScreen to feel like a real game menu with a centered save-slot loader and a 3-step new-career wizard.

**Architecture:** MainMenuScreen handles two internal views (`menu` | `load`). NewCareerScreen manages a 3-step wizard (coach → team → confirm) with a shared StepperBar. New reusable components (SaveSlotCard, AvatarPicker, TeamSelectCard, TeamBadgeImage) keep screens thin. Team badge images are served from `public/teams/`, manager avatars from `public/avatars/`.

**Tech Stack:** Vite, React 18, TypeScript 5, Tailwind CSS 4, Zustand 5, localStorage

**Spec:** `docs/superpowers/specs/2026-06-14-career-menu-redesign.md`

---

## File Structure

```
public/
  teams/                       ← copied from Godot project
    brain.webp
    farm.webp
    Inazuma Kids FC.webp
    Kirkwood.webp
    Occult.webp
    Otaku.webp
    Raimon.webp
    Raimon Veterans.webp
    Royal Academy.webp
    Shuriken.webp
    Street Sally's.webp
    Umbrellla MS.webp           ← 3 l's (original filename)
    Wild.webp
    Zeus.png
    default_team_icon.png
  avatars/
    avatar-1.svg … avatar-5.svg

src/
  types/
    career.ts                  ← add managerAvatar: string
    save.ts                    ← add managerAvatar to SaveSummary
    team.ts                    ← add badgeUrl?: string to Team
  data/
    teams.ts                   ← add badgeUrl field to each team object
  store/
    careerStore.ts             ← startNewCareer accepts managerAvatar param
  components/
    StepperBar.tsx             ← NEW: horizontal step indicator
    TeamBadgeImage.tsx         ← NEW: <img> with fallback to default badge
    SaveSlotCard.tsx           ← NEW: save slot row (avatar + badge + info + button)
    AvatarPicker.tsx           ← NEW: 5 predefined SVG avatars + upload
    TeamSelectCard.tsx         ← NEW: team card with real badge for wizard step 2
  screens/
    MainMenuScreen.tsx         ← REWRITE: menu | load views
    NewCareerScreen.tsx        ← REWRITE: 3-step wizard
```

---

## Task 1: Assets — badges and avatars

**Files:**
- Create: `public/teams/` (directory + files copied from Godot)
- Create: `public/avatars/avatar-1.svg` through `avatar-5.svg`

- [ ] Copy team badge images from Godot project to `public/teams/`:

```bash
mkdir -p public/teams public/avatars
GODOT_TEAMS="/home/eru/Documents/Projects/inazuma/inazuma-eleven-universe/assets/sprites/teams"
cp "$GODOT_TEAMS/brain.webp" public/teams/
cp "$GODOT_TEAMS/farm.webp" public/teams/
cp "$GODOT_TEAMS/Inazuma Kids FC.webp" public/teams/
cp "$GODOT_TEAMS/Kirkwood.webp" public/teams/
cp "$GODOT_TEAMS/Occult.webp" public/teams/
cp "$GODOT_TEAMS/Otaku.webp" public/teams/
cp "$GODOT_TEAMS/Raimon.webp" public/teams/
cp "$GODOT_TEAMS/Raimon Veterans.webp" public/teams/
cp "$GODOT_TEAMS/Royal Academy.webp" public/teams/
cp "$GODOT_TEAMS/Shuriken.webp" public/teams/
cp "$GODOT_TEAMS/Street Sally's.webp" public/teams/
cp "$GODOT_TEAMS/Umbrellla MS.webp" public/teams/
cp "$GODOT_TEAMS/Wild.webp" public/teams/
cp "$GODOT_TEAMS/Zeus.png" public/teams/
cp "$GODOT_TEAMS/default_team_icon.png" public/teams/
```

- [ ] Verify 15 files in public/teams/: `ls public/teams/ | wc -l` → 15

- [ ] Create `public/avatars/avatar-1.svg` (blue):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="32" fill="#1d4ed8"/>
  <circle cx="32" cy="22" r="10" fill="#bfdbfe"/>
  <ellipse cx="32" cy="50" rx="16" ry="12" fill="#bfdbfe"/>
</svg>
```

- [ ] Create `public/avatars/avatar-2.svg` (purple):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="32" fill="#7c3aed"/>
  <circle cx="32" cy="22" r="10" fill="#ddd6fe"/>
  <ellipse cx="32" cy="50" rx="16" ry="12" fill="#ddd6fe"/>
</svg>
```

- [ ] Create `public/avatars/avatar-3.svg` (orange):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="32" fill="#ea580c"/>
  <circle cx="32" cy="22" r="10" fill="#fed7aa"/>
  <ellipse cx="32" cy="50" rx="16" ry="12" fill="#fed7aa"/>
</svg>
```

- [ ] Create `public/avatars/avatar-4.svg` (green):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="32" fill="#16a34a"/>
  <circle cx="32" cy="22" r="10" fill="#bbf7d0"/>
  <ellipse cx="32" cy="50" rx="16" ry="12" fill="#bbf7d0"/>
</svg>
```

- [ ] Create `public/avatars/avatar-5.svg` (red):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="32" fill="#dc2626"/>
  <circle cx="32" cy="22" r="10" fill="#fecaca"/>
  <ellipse cx="32" cy="50" rx="16" ry="12" fill="#fecaca"/>
</svg>
```

- [ ] Verify: `ls public/avatars/` → 5 files

---

## Task 2: Type changes

**Files:**
- Modify: `src/types/career.ts`
- Modify: `src/types/save.ts`
- Modify: `src/types/team.ts`

- [ ] Add `managerAvatar` to `Career` in `src/types/career.ts`:

Find the `Career` interface and add this field after `managerName`:
```ts
managerAvatar: string
```

- [ ] Add `managerAvatar` to `SaveSummary` in `src/types/save.ts`:

Find the `SaveSummary` interface and add:
```ts
managerAvatar: string
```

- [ ] Add `badgeUrl` to `Team` in `src/types/team.ts`:

Find the `Team` interface and add after `captainId`:
```ts
badgeUrl?: string
```

- [ ] Run `npx tsc --noEmit` — expect errors only in `careerStore.ts` and `saveService.ts` (they build `Career`/`SaveSummary` without the new fields). Note the count.

---

## Task 3: Update data — teams badgeUrl

**Files:**
- Modify: `src/data/teams.ts`

The `teams.ts` file has 17 team objects. Add `badgeUrl` to each.

Badge URL mapping (use `/teams/default_team_icon.png` for teams without a file):
```
id 0  Brain              → /teams/brain.webp
id 1  Farm               → /teams/farm.webp
id 2  Inazuma Kids FC    → /teams/Inazuma Kids FC.webp
id 3  Kirkwood           → /teams/Kirkwood.webp
id 4  Occult             → /teams/Occult.webp
id 5  Otaku              → /teams/Otaku.webp
id 6  Raimon             → /teams/Raimon.webp
id 7  Raimon Veterans    → /teams/Raimon Veterans.webp
id 8  Royal Academy      → /teams/Royal Academy.webp
id 9  Shuriken           → /teams/Shuriken.webp
id 10 Street Sally's     → /teams/Street Sally's.webp
id 11 Umbrella MS        → /teams/Umbrellla MS.webp
id 12 Wild               → /teams/Wild.webp
id 13 Zeus               → /teams/Zeus.png
id 14 Servicio Secreto   → /teams/default_team_icon.png
id 15 Tormenta de Geminis→ /teams/default_team_icon.png
id 16 Alpino             → /teams/default_team_icon.png
```

- [ ] For each team object in `src/data/teams.ts`, add `badgeUrl: '/teams/...'` after the `captainId` line. Example for team 0:

```ts
{
  id: 0,
  name: "Brain",
  tier: 3,
  reputation: 50,
  budget: 150000,
  leagueId: "second_division",
  captainId: 75,
  badgeUrl: '/teams/brain.webp',   // ← add this line
  formation: { ... },
  ...
}
```

- [ ] Run `npx tsc --noEmit` — same error count as before (badgeUrl is optional so no new errors).

---

## Task 4: Update store and saveService

**Files:**
- Modify: `src/store/careerStore.ts`
- Modify: `src/services/saveService.ts`

- [ ] In `src/store/careerStore.ts`, find `startNewCareer` and update its signature and body:

Find the action definition (it calls `careerService.createCareer`). Change:
```ts
startNewCareer: (managerName: string, teamId: number) => {
```
to:
```ts
startNewCareer: (managerName: string, teamId: number, managerAvatar = '/avatars/avatar-1.svg') => {
```

Then after `createCareer` returns the `career` object, set:
```ts
career.managerAvatar = managerAvatar
```

- [ ] In `src/services/saveService.ts`, find `buildSummary` and add `managerAvatar` to the returned object:

```ts
function buildSummary(career: Career, players: Player[], teams: Team[]): SaveSummary {
  // ... existing code ...
  return {
    teamName: team?.name ?? 'Unknown',
    managerName: career.managerName,
    managerAvatar: career.managerAvatar ?? '/avatars/avatar-1.svg',   // ← add
    seasonNumber: career.seasonNumber,
    leagueName: career.season.leagueId,
    currentDate: career.season.currentDate,
    leaguePosition: position > 0 ? position : sorted.length,
    budget: team?.budget ?? 0,
  }
}
```

- [ ] Also in `careerService.ts`, find where `Career` is constructed and add `managerAvatar: ''` as a placeholder (the store will overwrite it):

```ts
let career: Career = {
  id: crypto.randomUUID(),
  managerName,
  managerAvatar: '',    // ← add this line
  teamId,
  // ...
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 5: New component — StepperBar

**Files:**
- Create: `src/components/StepperBar.tsx`

- [ ] Create `src/components/StepperBar.tsx`:

```tsx
interface Props {
  steps: string[]
  current: number  // 0-based index
}

export default function StepperBar({ steps, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 px-6 py-4 bg-gray-900 border-b border-gray-800">
      {steps.map((label, i) => {
        const isDone = i < current
        const isActive = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-16 mx-2 mb-4 ${i < current ? 'bg-green-500' : 'bg-gray-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 6: New component — TeamBadgeImage

**Files:**
- Create: `src/components/TeamBadgeImage.tsx`

- [ ] Create `src/components/TeamBadgeImage.tsx`:

```tsx
const SIZE_CLASSES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
}

interface Props {
  teamName: string
  badgeUrl?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function TeamBadgeImage({ teamName, badgeUrl, size = 'md' }: Props) {
  const src = badgeUrl ?? '/teams/default_team_icon.png'
  return (
    <img
      src={src}
      alt={teamName}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/teams/default_team_icon.png' }}
      className={`${SIZE_CLASSES[size]} object-contain rounded`}
    />
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 7: New component — SaveSlotCard

**Files:**
- Create: `src/components/SaveSlotCard.tsx`

- [ ] Create `src/components/SaveSlotCard.tsx`:

```tsx
import type { SaveSlot } from '../types/save'
import { teams } from '../data/teams'

interface Props {
  slot: SaveSlot | null
  slotNumber: number
  onLoad: () => void
  onDelete?: () => void
}

export default function SaveSlotCard({ slot, slotNumber, onLoad, onDelete }: Props) {
  if (!slot) {
    return (
      <div className="flex items-center justify-center border border-dashed border-gray-700 rounded-xl px-6 py-5 text-gray-600 text-sm">
        Ranura {slotNumber + 1} — vacía
      </div>
    )
  }

  const team = teams.find((t) => t.name === slot.summary.teamName)
  const savedAt = new Date(slot.savedAtUnix).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="flex items-center gap-4 bg-gray-800 rounded-xl px-5 py-4 border border-gray-700">
      {/* Manager avatar */}
      <img
        src={slot.summary.managerAvatar || '/avatars/avatar-1.svg'}
        alt="Entrenador"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
        className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-gray-700"
      />
      {/* Team badge */}
      <img
        src={team?.badgeUrl ?? '/teams/default_team_icon.png'}
        alt={slot.summary.teamName}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/teams/default_team_icon.png' }}
        className="w-10 h-10 object-contain flex-shrink-0"
      />
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{slot.summary.teamName}</p>
        <p className="text-gray-400 text-xs">
          Temp. {slot.summary.seasonNumber} · {slot.summary.leagueName === 'first_division' ? '1ª Div.' : '2ª Div.'} · {slot.summary.leaguePosition}ª posición
        </p>
        <p className="text-gray-500 text-xs">{slot.summary.managerName} · {savedAt}</p>
      </div>
      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onLoad}
          className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors"
        >
          Cargar
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 8: New component — AvatarPicker

**Files:**
- Create: `src/components/AvatarPicker.tsx`

- [ ] Create `src/components/AvatarPicker.tsx`:

```tsx
import { useRef } from 'react'

const PREDEFINED = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
]

interface Props {
  value: string
  onChange: (url: string) => void
}

export default function AvatarPicker({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') onChange(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {PREDEFINED.map((src) => (
        <button
          key={src}
          type="button"
          onClick={() => onChange(src)}
          className={`rounded-full overflow-hidden transition-all focus:outline-none
            ${value === src ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-gray-900' : 'opacity-70 hover:opacity-100'}`}
        >
          <img src={src} alt="Avatar" className="w-14 h-14 object-cover" />
        </button>
      ))}
      {/* Upload button */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`w-14 h-14 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-xs gap-0.5
          ${!PREDEFINED.includes(value) && value ? 'border-blue-500 ring-4 ring-blue-500 ring-offset-2 ring-offset-gray-900' : 'border-gray-600'}`}
      >
        {!PREDEFINED.includes(value) && value ? (
          <img src={value} alt="Avatar personalizado" className="w-full h-full rounded-full object-cover" />
        ) : (
          <>
            <span className="text-lg leading-none">+</span>
            <span>Subir</span>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 9: New component — TeamSelectCard

**Files:**
- Create: `src/components/TeamSelectCard.tsx`

- [ ] Create `src/components/TeamSelectCard.tsx`:

```tsx
import type { Team } from '../types/team'
import TeamBadgeImage from './TeamBadgeImage'

const LEAGUE_LABELS: Record<string, string> = {
  first_division: 'Primera División',
  second_division: 'Segunda División',
}

interface Props {
  team: Team
  isSelected: boolean
  onClick: () => void
}

export default function TeamSelectCard({ team, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl p-3 border-2 text-left transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-900/20'
          : 'border-gray-700 bg-gray-800 hover:border-gray-500'}`}
    >
      <TeamBadgeImage teamName={team.name} badgeUrl={team.badgeUrl} size="md" />
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm truncate">{team.name}</p>
        <p className="text-gray-400 text-xs">{LEAGUE_LABELS[team.leagueId] ?? team.leagueId}</p>
        <p className="text-gray-500 text-xs">Tier {team.tier} · Rep. {team.reputation}</p>
      </div>
      {isSelected && <span className="ml-auto text-blue-400 text-lg flex-shrink-0">✓</span>}
    </button>
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 10: Rewrite MainMenuScreen

**Files:**
- Modify: `src/screens/MainMenuScreen.tsx`

- [ ] Replace the entire contents of `src/screens/MainMenuScreen.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { listSaves, deleteSave } from '../services/saveService'
import SaveSlotCard from '../components/SaveSlotCard'
import type { SaveSlot } from '../types/save'
import { MAX_SAVE_SLOTS } from '../types/save'

type View = 'menu' | 'load'

export default function MainMenuScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const loadCareer = useCareerStore((s) => s.loadCareer)
  const [view, setView] = useState<View>('menu')
  const [saves, setSaves] = useState<(SaveSlot | null)[]>([])

  function refreshSaves() {
    const filled = listSaves()
    const slots: (SaveSlot | null)[] = Array.from({ length: MAX_SAVE_SLOTS }, (_, i) =>
      filled.find((s) => s.slot === i) ?? null
    )
    setSaves(slots)
  }

  useEffect(() => {
    if (view === 'load') refreshSaves()
  }, [view])

  function handleDelete(slot: number) {
    deleteSave(slot)
    refreshSaves()
  }

  if (view === 'load') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setView('menu')}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
            >
              ← Volver
            </button>
            <h2 className="text-white text-2xl font-bold">Cargar Partida</h2>
          </div>
          <div className="flex flex-col gap-3">
            {saves.map((slot, i) => (
              <SaveSlotCard
                key={i}
                slot={slot}
                slotNumber={i}
                onLoad={() => loadCareer(i)}
                onDelete={slot ? () => handleDelete(i) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-900 gap-10">
      <div className="text-center">
        <div className="text-6xl mb-4">⚽</div>
        <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">
          Inazuma Eleven Lite
        </h1>
        <p className="text-gray-400 text-lg">Modo Carrera</p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate('new_career')}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xl transition-colors shadow-lg shadow-blue-900/40"
        >
          Nueva Carrera
        </button>
        <button
          onClick={() => setView('load')}
          className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-bold text-xl transition-colors"
        >
          Cargar Partida
        </button>
      </div>
    </div>
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.

---

## Task 11: Rewrite NewCareerScreen

**Files:**
- Modify: `src/screens/NewCareerScreen.tsx`

- [ ] Replace the entire contents of `src/screens/NewCareerScreen.tsx` with:

```tsx
import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { teams } from '../data/teams'
import { players } from '../data/players'
import StepperBar from '../components/StepperBar'
import AvatarPicker from '../components/AvatarPicker'
import TeamSelectCard from '../components/TeamSelectCard'
import TeamBadgeImage from '../components/TeamBadgeImage'
import PositionBadge from '../components/PositionBadge'
import type { Team } from '../types/team'

type Step = 0 | 1 | 2

const STEPS = ['Entrenador', 'Equipo', 'Confirmar']

const LEAGUE_LABELS: Record<string, string> = {
  first_division: 'Primera División',
  second_division: 'Segunda División',
}

export default function NewCareerScreen() {
  const navigate = useCareerStore((s) => s.navigate)
  const startNewCareer = useCareerStore((s) => s.startNewCareer)

  const [step, setStep] = useState<Step>(0)
  const [managerName, setManagerName] = useState('')
  const [managerAvatar, setManagerAvatar] = useState('/avatars/avatar-1.svg')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  const selectedTeam: Team | undefined = teams.find((t) => t.id === selectedTeamId)
  const squadPlayers = selectedTeam
    ? players.filter((p) => selectedTeam.playerIds.includes(p.id))
    : []
  const starters = squadPlayers.filter((p) => {
    const slot = selectedTeam?.lineup.find((l) => l.playerId === p.id)
    return slot?.isStarter
  })

  function handleCreate() {
    if (!managerName.trim() || selectedTeamId === null) return
    startNewCareer(managerName.trim(), selectedTeamId, managerAvatar)
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <StepperBar steps={STEPS} current={step} />

      <div className="flex-1 overflow-y-auto">
        {/* ── STEP 0: Coach ── */}
        {step === 0 && (
          <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold mb-1">Crear Entrenador</h2>
              <p className="text-gray-400 text-sm">¿Cómo se llama tu entrenador?</p>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Nombre del Entrenador
              </label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Tu nombre..."
                maxLength={30}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-lg"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-3">
                Avatar del Entrenador
              </label>
              <AvatarPicker value={managerAvatar} onChange={setManagerAvatar} />
            </div>
          </div>
        )}

        {/* ── STEP 1: Team ── */}
        {step === 1 && (
          <div className="flex h-full">
            {/* Team list */}
            <div className="w-64 flex-shrink-0 border-r border-gray-800 overflow-y-auto px-4 py-6 flex flex-col gap-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Selecciona tu Equipo
              </p>
              {teams.map((team) => (
                <TeamSelectCard
                  key={team.id}
                  team={team}
                  isSelected={selectedTeamId === team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                />
              ))}
            </div>

            {/* Team detail */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {selectedTeam ? (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-5">
                    <TeamBadgeImage teamName={selectedTeam.name} badgeUrl={selectedTeam.badgeUrl} size="lg" />
                    <div>
                      <h2 className="text-white text-2xl font-bold">{selectedTeam.name}</h2>
                      <p className="text-gray-400">{LEAGUE_LABELS[selectedTeam.leagueId]}</p>
                      <p className="text-gray-500 text-sm">Tier {selectedTeam.tier} · Reputación {selectedTeam.reputation}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">
                      Plantilla titular ({starters.length} jugadores)
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {starters.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                          <img
                            src={p.spriteUrl}
                            alt={p.name}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            className="w-8 h-8 object-contain rounded flex-shrink-0"
                          />
                          <span className="text-white text-sm font-medium flex-1 truncate">{p.name}</span>
                          <PositionBadge position={p.position} size="sm" />
                          <span className="text-gray-400 text-xs w-8 text-right">{p.stats.TOT}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  <p>← Selecciona un equipo</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Confirm ── */}
        {step === 2 && selectedTeam && (
          <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
            <div>
              <h2 className="text-white text-2xl font-bold mb-1">Confirmar Carrera</h2>
              <p className="text-gray-400 text-sm">Revisa los datos antes de comenzar.</p>
            </div>

            {/* Manager summary */}
            <div className="bg-gray-800 rounded-2xl p-5 flex items-center gap-4 border border-gray-700">
              <img
                src={managerAvatar}
                alt="Entrenador"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/avatars/avatar-1.svg' }}
                className="w-16 h-16 rounded-full object-cover bg-gray-700 flex-shrink-0"
              />
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Entrenador</p>
                <p className="text-white text-xl font-bold">{managerName}</p>
              </div>
            </div>

            {/* Team summary */}
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <TeamBadgeImage teamName={selectedTeam.name} badgeUrl={selectedTeam.badgeUrl} size="lg" />
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Equipo</p>
                  <p className="text-white text-xl font-bold">{selectedTeam.name}</p>
                  <p className="text-gray-400 text-sm">{LEAGUE_LABELS[selectedTeam.leagueId]}</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Titular ({starters.length} jugadores)
              </p>
              <div className="flex flex-col gap-1.5">
                {starters.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <PositionBadge position={p.position} size="sm" />
                    <span className="text-white flex-1 truncate">{p.name}</span>
                    <span className="text-gray-500 text-xs">{p.stats.TOT}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav bar ── */}
      <div className="flex-shrink-0 border-t border-gray-800 px-6 py-4 flex gap-3 bg-gray-900">
        <button
          onClick={() => {
            if (step === 0) navigate('main_menu')
            else setStep((s) => (s - 1) as Step)
          }}
          className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
        >
          ← Atrás
        </button>
        {step < 2 ? (
          <button
            onClick={() => {
              if (step === 0 && !managerName.trim()) return
              if (step === 1 && selectedTeamId === null) return
              setStep((s) => (s + 1) as Step)
            }}
            disabled={
              (step === 0 && !managerName.trim()) ||
              (step === 1 && selectedTeamId === null)
            }
            className="ml-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
          >
            Continuar →
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="ml-auto px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
          >
            ⚡ Crear Carrera
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] Run `npx tsc --noEmit` → 0 errors.
- [ ] Run `npm run dev` — verify app loads without crash.

---

## Self-Review Checklist

- [x] All spec requirements covered: MainMenu (menu + load views), 3-step wizard (coach/team/confirm), SaveSlotCard with avatar+badge, AvatarPicker with predefined+upload, TeamSelectCard with real badge, StepperBar
- [x] No TBD/TODO in plan
- [x] Type names consistent across tasks: `managerAvatar` on `Career` and `SaveSummary`, `badgeUrl` on `Team`, `SaveSlotCard` props match component definition
- [x] Asset paths consistent: `/teams/...` and `/avatars/...` (public-relative)
- [x] `deleteSave` imported in MainMenuScreen from `saveService` — exists in `src/services/saveService.ts`
- [x] `MAX_SAVE_SLOTS` imported from `src/types/save` — exists
