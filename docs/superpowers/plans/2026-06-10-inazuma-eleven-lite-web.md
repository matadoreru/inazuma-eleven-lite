# Inazuma Eleven Lite Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete functional career-mode web game based on Inazuma Eleven Universe, using Vite + React + TypeScript + Tailwind + Zustand + LocalStorage.

**Architecture:** Single-page app with Zustand as the global state manager; all game logic lives in pure service functions (`src/services/`); React components are thin presentational shells connected to the store; navigation is internal state (no router needed). Data seeded from the Godot project's `content/database/` JSONs.

**Tech Stack:** Vite, React 18, TypeScript 5, Tailwind CSS 4, Zustand 5, LocalStorage (via saveService), Vitest + @testing-library/react

---

## File Structure

```
inazuma-eleven-lite/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   ├── player.ts          # Player, Stats, Technique, PlayerCareer
│   │   ├── team.ts            # Team, Formation, LineupSlot
│   │   ├── competition.ts     # League, Season, CalendarDay, Match, Standings
│   │   ├── career.ts          # Career, Objective, InboxEvent
│   │   ├── transfer.ts        # TransferOffer, TransferFilter
│   │   └── save.ts            # SaveSlot, SaveData
│   ├── data/
│   │   ├── players.ts         # 200+ players seeded from universe DB
│   │   ├── teams.ts           # 17 teams seeded from universe DB
│   │   ├── leagues.ts         # first_division + second_division
│   │   └── formations.ts      # Preset formations (Basic, 4-4-2, etc.)
│   ├── services/
│   │   ├── careerService.ts   # createCareer, chooseTeam
│   │   ├── seasonService.ts   # initSeason, endSeason, generateCalendar
│   │   ├── calendarService.ts # advanceDay, getNextMatch, getMatchday
│   │   ├── standingsService.ts # updateStandings, sortStandings
│   │   ├── matchSimulator.ts  # simulate, buildSnapshot, calcScores
│   │   ├── formationService.ts # applyFormation, positionModifier
│   │   ├── transferService.ts  # buyPlayer, sellPlayer, receiveOffers
│   │   ├── trainingService.ts  # trainStat, rest, calcFatigue
│   │   ├── growthService.ts    # applySeasonGrowth, calcGrowth
│   │   ├── saveService.ts      # save, load, list, delete (localStorage)
│   │   ├── objectiveService.ts # checkObjectives, completeObjective
│   │   └── inboxService.ts     # addEvent, markRead
│   ├── store/
│   │   └── careerStore.ts     # Zustand store — all actions
│   ├── screens/
│   │   ├── MainMenuScreen.tsx
│   │   ├── NewCareerScreen.tsx
│   │   ├── CareerHomeScreen.tsx
│   │   ├── ClubScreen.tsx
│   │   ├── SquadScreen.tsx
│   │   ├── PlayerDetailScreen.tsx
│   │   ├── FormationScreen.tsx
│   │   ├── TrainingScreen.tsx
│   │   ├── CalendarScreen.tsx
│   │   ├── MatchScreen.tsx
│   │   ├── StandingsScreen.tsx
│   │   ├── TransfersScreen.tsx
│   │   ├── ScoutScreen.tsx
│   │   └── SaveLoadScreen.tsx
│   └── components/
│       ├── PlayerCard.tsx
│       ├── PlayerRow.tsx
│       ├── TeamBadge.tsx
│       ├── StatBar.tsx
│       ├── PositionBadge.tsx
│       ├── ElementBadge.tsx
│       ├── CalendarMonth.tsx
│       ├── MatchResultCard.tsx
│       ├── FormationPitch.tsx
│       ├── TransferPlayerRow.tsx
│       ├── ObjectiveCard.tsx
│       ├── InboxEventCard.tsx
│       ├── TechniqueBadge.tsx
│       ├── BudgetDisplay.tsx
│       ├── TopNavigation.tsx
│       └── SideNavigation.tsx
└── src/tests/
    ├── standingsService.test.ts
    ├── matchSimulator.test.ts
    ├── formationService.test.ts
    ├── transferService.test.ts
    ├── growthService.test.ts
    ├── saveService.test.ts
    └── objectiveService.test.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

- [ ] Write all 9 config + entry files (see Task 1 in execution)
- [ ] Run `npm install` → should succeed
- [ ] Run `npm run dev` → should serve on localhost:5173
- [ ] Commit: `feat: bootstrap vite+react+ts+tailwind project`

---

## Task 2: TypeScript Models

**Files:**
- Create: `src/types/player.ts`
- Create: `src/types/team.ts`
- Create: `src/types/competition.ts`
- Create: `src/types/career.ts`
- Create: `src/types/transfer.ts`
- Create: `src/types/save.ts`

- [ ] Write all type files
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat: add TypeScript domain models`

---

## Task 3: Seed Data

**Files:**
- Create: `src/data/players.ts`    (subset of universe players — all 17 teams × ~16 players)
- Create: `src/data/teams.ts`      (17 teams from universe)
- Create: `src/data/leagues.ts`    (first_division 9 teams, second_division 8 teams)
- Create: `src/data/formations.ts` (preset formation templates)

- [ ] Write seed data files
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat: add seeded game data from universe database`

---

## Task 4: Services — Core Logic

**Files:**
- Create: `src/services/formationService.ts`
- Create: `src/services/standingsService.ts`
- Create: `src/services/matchSimulator.ts`
- Create: `src/services/seasonService.ts`
- Create: `src/services/calendarService.ts`
- Create: `src/services/careerService.ts`
- Create: `src/services/transferService.ts`
- Create: `src/services/trainingService.ts`
- Create: `src/services/growthService.ts`
- Create: `src/services/saveService.ts`
- Create: `src/services/objectiveService.ts`
- Create: `src/services/inboxService.ts`

- [ ] Write service files
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat: add game logic services`

---

## Task 5: Zustand Store

**Files:**
- Create: `src/store/careerStore.ts`

- [ ] Write store with all actions
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Commit: `feat: add zustand career store`

---

## Task 6: Reusable Components

**Files:** All files under `src/components/`

- [ ] Write all 16 components
- [ ] `npm run dev` → renders without crash
- [ ] Commit: `feat: add reusable UI components`

---

## Task 7: Screens

**Files:** All files under `src/screens/`

- [ ] Write all 14 screens
- [ ] Wire screens to store actions
- [ ] Full playable flow works end-to-end
- [ ] Commit: `feat: add all game screens`

---

## Task 8: Tests

**Files:** All files under `src/tests/`

- [ ] Write 7 test files
- [ ] `npm run test` → all pass
- [ ] Commit: `test: add vitest unit tests`

---

## Key Algorithms (for implementor reference)

### Position modifier (from lineup_slot.gd)
```
same position     → 1.0
DF↔MD or MD↔FW   → 0.82  (close position)
everything else   → 0.65
GK out of goal    → 0.30  (extra penalty added in web version)
```

### Score formulas (from lineup_slot.gd)
```
forward_score  = POT×0.40 + TEC×0.25 + CON×0.15 + AGI×0.10 + INT×0.10
midfield_score = CON×0.30 + TEC×0.25 + INT×0.25 + PRE×0.10 + AGI×0.10
defense_score  = PRE×0.35 + FIS×0.25 + INT×0.20 + AGI×0.10 + CON×0.10
goalkeeper_score = PRE×0.30 + AGI×0.25 + FIS×0.20 + INT×0.15 + TEC×0.10
```

### Chance calculation (from chance_calculator.gd)
```
creation_power  = fw×0.42 + md×0.43 + df×0.05 + avg×0.10
prevention_power = md×0.28 + df×0.47 + gk×0.25
score_bonus     = clamp((creation - prevention) / 14, -3.5, 3.5)
base_chances    = 5.5 + score_bonus + home_bonus(0.65) + tactical_bonus + variance(-1.1..1.1)
```

### Goal probability (from chance_resolver.gd)
```
finishing_power = fw×0.62 + md×0.25 + avg×0.13
save_power      = gk×0.55 + df×0.35 + md×0.10
strength_delta  = clamp((finishing - save) / 165, -0.10, 0.11)
goal_prob       = clamp(0.20 + strength_delta + tactical_bonus, 0.06, 0.65)
```

### Tactical modifiers (from tactical_resolver.gd)
```
OFFENSIVE:     fw×1.06, df×0.97
DEFENSIVE:     df×1.06, fw×0.97
HIGH_PRESS:    md×1.05, fw×1.02
MIDFIELD_CTRL: +0.45 chance bonus
COUNTER_ATK:   +0.20 chance bonus, +0.025 goal prob
```
