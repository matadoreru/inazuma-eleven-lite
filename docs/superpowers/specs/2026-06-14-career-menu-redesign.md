# Career Menu Redesign — Spec

**Date:** 2026-06-14
**Status:** Approved

## Goal

Redesign `MainMenuScreen` and `NewCareerScreen` to feel like a real game menu: professional, centered, clear, with a proper multi-step new-career wizard and polished save-slot loading.

---

## Approved Design Decisions

- **Layout pattern**: Full-screen with stepper (option C from mockup)
- **Save slots**: Vertical list (option A) — avatar + badge + info + Cargar button, all centered

---

## Assets

### Team badges
Copy from `/home/eru/Documents/Projects/inazuma/inazuma-eleven-universe/assets/sprites/teams/` to `public/teams/`.

Mapping (team name → filename):
- Brain → `brain.webp`
- Farm → `farm.webp`
- Inazuma Kids FC → `Inazuma Kids FC.webp`
- Kirkwood → `Kirkwood.webp`
- Occult → `Occult.webp`
- Otaku → `Otaku.webp`
- Raimon → `Raimon.webp`
- Raimon Veterans → `Raimon Veterans.webp`
- Royal Academy → `Royal Academy.webp`
- Shuriken → `Shuriken.webp`
- Street Sally's → `Street Sally's.webp`
- Umbrella MS → `Umbrellla MS.webp` (3 l's in original filename)
- Wild → `Wild.webp`
- Zeus → `Zeus.png`
- Servicio Secreto → no file → use `default_team_icon.png`
- Tormenta de Geminis → no file → use `default_team_icon.png`
- Alpino → no file → use `default_team_icon.png`

Also copy `default_team_icon.png` for fallback.

### Manager avatars
Create 5 SVG avatar files in `public/avatars/`: `avatar-1.svg` through `avatar-5.svg`.
Each is a colored circle with a simple coach silhouette SVG, using distinct color palettes (blue, purple, orange, green, red).
A 6th option allows uploading a local image (stored as base64 data URL in Career state).

---

## Type Changes

### `src/types/career.ts`
Add to `Career` interface:
```ts
managerAvatar: string  // relative URL ('/avatars/avatar-1.svg') or base64 data URL
```

### `src/types/save.ts`
Add to `SaveSummary` interface:
```ts
managerAvatar: string
```

### `src/data/teams.ts`
Add `badgeUrl: string` field to each `Team` object — relative URL like `/teams/Raimon.webp`.
This requires updating the `Team` type in `src/types/team.ts` to include `badgeUrl?: string` (optional, not in service logic).

---

## New Components

### `src/components/StepperBar.tsx`
Props: `{ steps: string[]; current: number }`
Horizontal bar showing numbered steps. Active step is highlighted blue. Past steps show a checkmark.

### `src/components/SaveSlotCard.tsx`
Props: `{ slot: SaveSlot; onLoad: () => void; onDelete?: () => void }`
- Shows manager avatar (image with fallback)
- Shows team badge image via `TeamBadgeImage`
- Shows: team name, manager name, season number, league position, save date
- Cargar button (green), optional Borrar button (red, small)
- Empty slot variant: dashed border, "Ranura vacía" centered text

### `src/components/AvatarPicker.tsx`
Props: `{ value: string; onChange: (url: string) => void }`
- Grid of 5 predefined avatar images (`/avatars/avatar-1.svg` … `avatar-5.svg`)
- Selected avatar has blue ring border
- Upload button: `<input type="file" accept="image/*">` → reads as base64 and calls onChange
- Default: `avatar-1.svg`

### `src/components/TeamSelectCard.tsx`
Props: `{ team: Team; players: Player[]; isSelected: boolean; onClick: () => void }`
- Shows `TeamBadgeImage` (real badge), team name, league label, tier
- Blue ring when selected
- On click → triggers selection

### `src/components/TeamBadgeImage.tsx`
Props: `{ teamName: string; badgeUrl?: string; size?: 'sm' | 'md' | 'lg' }`
- Renders `<img src={badgeUrl}>` if available
- Falls back to `/teams/default_team_icon.png`
- On img error → also falls back to default

---

## Modified Screens

### `src/screens/MainMenuScreen.tsx`

Internal state: `view: 'menu' | 'load'`

**View `menu`:**
- Full-screen centered layout (bg-gray-900)
- Game logo / title
- Two large buttons: "Nueva Carrera" → `navigate('new_career')`, "Cargar Partida" → `setView('load')`

**View `load`:**
- Full-screen centered layout
- Title "Cargar Partida"
- Centered container (max-w-lg) with 5 `SaveSlotCard` components (slots 0–4)
  - Filled slots: show data + Cargar button → calls `loadCareer(slot.slot)`
  - Empty slots: dashed border
- "Volver" button → `setView('menu')`
- Reads slots via `listSaves()` directly (no store)

### `src/screens/NewCareerScreen.tsx`

Internal state:
```ts
type Step = 'coach' | 'team' | 'confirm'
interface WizardState {
  step: Step
  managerName: string
  managerAvatar: string      // default: '/avatars/avatar-1.svg'
  selectedTeamId: number | null
}
```

**All steps share:**
- Full-screen bg-gray-900
- `StepperBar` at top with steps: ["Entrenador", "Equipo", "Confirmar"]
- Back/Continue button bar at bottom

**Step `coach` (Paso 1 — Crear Entrenador):**
- Input: manager name (required, trimmed)
- `AvatarPicker` to choose/upload avatar
- Atrás → `navigate('main_menu')`
- Continuar → validate name not empty → go to `team`

**Step `team` (Paso 2 — Elegir Equipo):**
- Two-column layout:
  - Left: scrollable grid of `TeamSelectCard` for all 17 teams
  - Right: detail panel for selected team — `TeamBadgeImage` (large), league, tier, top 5 players list
- Atrás → go to `coach`
- Continuar → validate team selected → go to `confirm`

**Step `confirm` (Paso 3 — Confirmar):**
- Summary card: manager avatar (large) + name
- Summary card: team badge (large) + name + league + squad count
- Scrollable player list (top 11 starters)
- Atrás → go to `team`
- "Crear Carrera" → calls `startNewCareer(managerName, selectedTeamId, managerAvatar)` → navigates to `career_home`

---

## Store Change

`startNewCareer(managerName: string, teamId: number, managerAvatar?: string): void`

- Add optional `managerAvatar` parameter (defaults to `'/avatars/avatar-1.svg'` if not provided)
- Set `career.managerAvatar = managerAvatar`
- Set `summary.managerAvatar = managerAvatar` in save operations

---

## Out of Scope

- Music or sound effects
- Animated transitions between steps
- Online multiplayer or cloud saves
- Editing an existing career's manager name or avatar
