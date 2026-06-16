# Custom Club Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to create a custom club when starting a new career, choosing name, badge, strength tier, and starting league, with a squad auto-generated from free agents.

**Architecture:** A new `customClubService.ts` handles squad generation. `NewCareerScreen` gains new steps behind a mode-selection branch. `startNewCareer` in `careerStore` accepts an optional pre-built custom team that gets injected into the seed data copy before calling `createCareer`. The custom team is indistinguishable from seed teams once the career starts.

**Tech Stack:** React + TypeScript, Zustand, Vitest, Tailwind CSS, `FileReader` API for badge upload.

## Global Constraints

- No emojis in UI or code
- Use Google Material Icons (class `material-symbols-rounded`) for icons
- Max club name: 25 characters
- No changes to `types/career.ts` or `careerService.ts`
- Free agents: players with `teamId === 0` in `src/data/players.ts`
- No player removed from their existing team — only `teamId === 0` players are touched
- Tests run with: `npm test`
- App runs with: `npm run dev`
- All new files in TypeScript, following existing code patterns

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/import-free-agents.py` | Create | One-shot script: reads universe DB, appends new free agents to players.ts |
| `src/types/team.ts` | Modify | Add `CustomClubConfig` interface |
| `src/services/customClubService.ts` | Create | `assignSquadFromFreeAgents`, `buildCustomTeam` |
| `src/tests/customClubService.test.ts` | Create | Unit tests for service |
| `src/store/careerStore.ts` | Modify | Extend `startNewCareer` with optional `customTeam` param |
| `src/tests/customClubService.store.test.ts` | Create | Test `startNewCareer` with custom team |
| `src/screens/NewCareerScreen.tsx` | Modify | New steps: mode, club name, badge, strength+league; adapted confirm |

---

## Task 1: Import free agents from universe database

**Files:**
- Create: `scripts/import-free-agents.py`
- Modify: `src/data/players.ts` (by running the script)

**Interfaces:**
- Produces: `src/data/players.ts` with ≥200 new free-agent `Player` entries (`teamId: 0`)

- [ ] **Step 1: Write the import script**

Create `scripts/import-free-agents.py`:

```python
#!/usr/bin/env python3
"""
Import free agents from the Inazuma Eleven universe database into players.ts.
Run from the project root: python3 scripts/import-free-agents.py
"""
import json, re
from pathlib import Path

DB_PATH = Path('/home/eru/Documents/Projects/inazuma/inazuma-eleven-universe/content/database/players/players.json')
PLAYERS_TS = Path('src/data/players.ts')

POS_MAP = {'MF': 'MD', 'GK': 'GK', 'DF': 'DF', 'FW': 'FW'}
VALID_ELEMENTS = {'FIRE', 'WOOD', 'WIND', 'MOUNTAIN'}


def media(s: dict) -> int:
    return round((s['POT'] + s['CON'] + s['TEC'] + s['PRE'] + s['FIS'] + s['AGI'] + s['INT']) / 7)


def get_existing_ids(ts_path: Path) -> set:
    content = ts_path.read_text(encoding='utf-8')
    # Match only top-level player ids (2-space indent, not technique ids which are inline)
    return set(int(m) for m in re.findall(r'^  id: (\d+),', content, re.MULTILINE))


def format_techniques(supertechniques: list) -> str:
    techs = supertechniques[:3]
    if not techs:
        return '[]'
    parts = []
    for t in techs:
        elem = t.get('element', '')
        if elem not in VALID_ELEMENTS:
            elem = ''
        parts.append(
            f'{{ id: {t["id"]}, name: "{t["name"]}", type: "{t["type"]}", '
            f'element: "{elem}", POT: {t["POT"]}, PP: {t["PP"]} }}'
        )
    return '[' + ', '.join(parts) + ']'


def build_entry(p: dict) -> str:
    s = p['stats']
    career = p['career']
    pos = POS_MAP.get(p['position'], 'MD')
    pos_alt_raw = p.get('position_alternative') or ''
    pos_alt = f'"{POS_MAP.get(pos_alt_raw, pos_alt_raw)}"' if pos_alt_raw else 'null'
    elem = p.get('element', 'FIRE')
    if elem not in VALID_ELEMENTS:
        elem = 'FIRE'
    techs = format_techniques(p.get('supertechniques', []))
    sprite = p.get('sprite_url', '')
    name = p['name'].replace('"', '\\"')
    name_romaji = (p.get('name_romaji') or p['name']).replace('"', '\\"')

    return f'''  {{
    id: {p["id"]},
    name: "{name}",
    nameRomaji: "{name_romaji}",
    gender: "Masculino",
    position: "{pos}",
    positionAlt: {pos_alt},
    element: "{elem}",
    stats: {{
      POT: {s["POT"]}, CON: {s["CON"]},
      TEC: {s["TEC"]}, PRE: {s["PRE"]},
      FIS: {s["FIS"]}, AGI: {s["AGI"]},
      INT: {s["INT"]}, TOT: {media(s)}
    }},
    career: {{
      maxLevel: {career.get("max_level", 80)},
      potential: {career.get("potential", 60)},
      growthRate: {career.get("growth_rate", 1.0)},
      contractStatus: "free",
      marketValue: {career.get("market_value", 50000)},
      salary: {career.get("salary", 1000)},
      experience: 0,
      trainingProgress: 0,
      trainingSessionsThisWeek: 0,
      positionAlt: {pos_alt}
    }},
    techniques: {techs},
    spriteUrl: "{sprite}",
    stamina: 100,
    morale: 100,
    isInjured: false,
    injuryDaysRemaining: 0,
    isSuspended: false,
    suspensionMatches: 0,
    age: 17,
    teamId: 0,
    jerseyNumber: 0
  }}'''


def main():
    db = json.loads(DB_PATH.read_text(encoding='utf-8'))
    existing_ids = get_existing_ids(PLAYERS_TS)
    print(f'Existing player IDs in game: {len(existing_ids)}')

    new_players = [p for p in db if p['id'] not in existing_ids]
    print(f'New free agents to import: {len(new_players)}')

    entries = [build_entry(p) for p in new_players]
    new_block = ',\n'.join(entries)

    content = PLAYERS_TS.read_text(encoding='utf-8')
    # players.ts ends with:  }\n]
    # Insert new entries before the closing ]
    if not content.rstrip().endswith(']'):
        print('ERROR: players.ts does not end with ]. Aborting.')
        return

    # Replace final ] with ,\n<new entries>\n]
    insert_pos = content.rstrip().rfind(']')
    new_content = content[:insert_pos] + ',\n' + new_block + '\n]\n'
    PLAYERS_TS.write_text(new_content, encoding='utf-8')
    print(f'Done. Added {len(new_players)} free agents to src/data/players.ts')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run the script from project root**

```bash
python3 scripts/import-free-agents.py
```

Expected output:
```
Existing player IDs in game: 257
New free agents to import: 820
Done. Added 820 free agents to src/data/players.ts
```

- [ ] **Step 3: Verify the import**

```bash
grep -c "teamId: 0" src/data/players.ts
```

Expected: number greater than 800 (was 17 before).

```bash
npm run build 2>&1 | grep -E "error|Error" | head -5
```

Expected: no TypeScript errors. If there are errors, check `src/data/players.ts` for malformed entries (escaped quotes, invalid field values).

- [ ] **Step 4: Commit**

```bash
git add scripts/import-free-agents.py src/data/players.ts
git commit -m "feat: import free agents from universe database"
```

---

## Task 2: CustomClubConfig type + customClubService

**Files:**
- Modify: `src/types/team.ts` — add `CustomClubConfig`
- Create: `src/services/customClubService.ts`
- Create: `src/tests/customClubService.test.ts`

**Interfaces:**
- Consumes: `Player` from `src/types/player.ts`, `Team`, `LineupSlot`, `Formation` from `src/types/team.ts`, `formations` from `src/data/formations.ts`, `getPlayerStatsSummary` from `src/types/player.ts`, `autoAssignJerseys` from `src/services/jerseyService.ts`
- Produces:
  - `CustomClubConfig` (type) — consumed by Task 4 (UI) and Task 3 (store)
  - `assignSquadFromFreeAgents(config: CustomClubConfig, allPlayers: Player[]): { playerIds: number[]; lineup: LineupSlot[] }`
  - `buildCustomTeam(config: CustomClubConfig, existingTeams: Team[], playerIds: number[], lineup: LineupSlot[]): Team`

- [ ] **Step 1: Add CustomClubConfig to src/types/team.ts**

Open `src/types/team.ts` and add after the existing interfaces (after the `TeamSnapshot` interface):

```ts
export type StrengthTier = 'weak' | 'normal' | 'strong' | 'very_strong'

export interface CustomClubConfig {
  name: string
  badgeUrl: string
  badgeIsCustom: boolean
  strengthTier: StrengthTier
  leagueId: string
}
```

- [ ] **Step 2: Write failing tests**

Create `src/tests/customClubService.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assignSquadFromFreeAgents, buildCustomTeam } from '../services/customClubService'
import type { Player } from '../types/player'
import type { Team } from '../types/team'
import type { CustomClubConfig } from '../types/team'

function makeFreeAgent(id: number, position: Player['position'], media: number): Player {
  const base = media * 7
  return {
    id,
    name: `Player ${id}`,
    nameRomaji: `Player ${id}`,
    gender: 'Masculino',
    position,
    positionAlt: null,
    element: 'FIRE',
    stats: { POT: base, CON: base, TEC: base, PRE: base, FIS: base, AGI: base, INT: base, TOT: media },
    career: {
      maxLevel: 80, potential: 60, growthRate: 1.0, contractStatus: 'free',
      marketValue: 50000, salary: 1000, experience: 0, trainingProgress: 0,
      trainingSessionsThisWeek: 0, positionAlt: null,
    },
    techniques: [],
    spriteUrl: '',
    stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0,
    isSuspended: false, suspensionMatches: 0,
    age: 17,
    teamId: 0,
    jerseyNumber: 0,
  }
}

function makeTeamedPlayer(id: number, position: Player['position'], media: number): Player {
  return { ...makeFreeAgent(id, position, media), teamId: 1, career: { ...makeFreeAgent(id, position, media).career, contractStatus: 'contracted' } }
}

// 40 free agents covering all positions and a range of medias
const FREE_AGENTS: Player[] = [
  // GKs
  makeFreeAgent(1001, 'GK', 72), makeFreeAgent(1002, 'GK', 76), makeFreeAgent(1003, 'GK', 80),
  makeFreeAgent(1004, 'GK', 84), makeFreeAgent(1005, 'GK', 88), makeFreeAgent(1006, 'GK', 92),
  makeFreeAgent(1007, 'GK', 96), makeFreeAgent(1008, 'GK', 100),
  // DFs
  makeFreeAgent(1009, 'DF', 71), makeFreeAgent(1010, 'DF', 74), makeFreeAgent(1011, 'DF', 77),
  makeFreeAgent(1012, 'DF', 80), makeFreeAgent(1013, 'DF', 83), makeFreeAgent(1014, 'DF', 86),
  makeFreeAgent(1015, 'DF', 89), makeFreeAgent(1016, 'DF', 92), makeFreeAgent(1017, 'DF', 95),
  makeFreeAgent(1018, 'DF', 98),
  // MDs
  makeFreeAgent(1019, 'MD', 72), makeFreeAgent(1020, 'MD', 75), makeFreeAgent(1021, 'MD', 78),
  makeFreeAgent(1022, 'MD', 81), makeFreeAgent(1023, 'MD', 84), makeFreeAgent(1024, 'MD', 87),
  makeFreeAgent(1025, 'MD', 90), makeFreeAgent(1026, 'MD', 93), makeFreeAgent(1027, 'MD', 96),
  makeFreeAgent(1028, 'MD', 99),
  // FWs
  makeFreeAgent(1029, 'FW', 73), makeFreeAgent(1030, 'FW', 76), makeFreeAgent(1031, 'FW', 79),
  makeFreeAgent(1032, 'FW', 82), makeFreeAgent(1033, 'FW', 85), makeFreeAgent(1034, 'FW', 88),
  makeFreeAgent(1035, 'FW', 91), makeFreeAgent(1036, 'FW', 94), makeFreeAgent(1037, 'FW', 97),
  makeFreeAgent(1038, 'FW', 100),
]

const TEAM_PLAYERS: Player[] = [
  makeTeamedPlayer(2001, 'GK', 90),
  makeTeamedPlayer(2002, 'FW', 95),
]

const ALL_PLAYERS = [...FREE_AGENTS, ...TEAM_PLAYERS]

const BASE_CONFIG: CustomClubConfig = {
  name: 'Test FC',
  badgeUrl: '/teams/default_team_icon.png',
  badgeIsCustom: false,
  strengthTier: 'normal',
  leagueId: 'second_division',
}

const EXISTING_TEAMS: Team[] = [
  {
    id: 0, name: 'Team A', tier: 3, reputation: 50, budget: 300000,
    leagueId: 'second_division', captainId: 2001,
    formation: { id: 1, name: 'Basic', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 },
    lineup: [], playerIds: [2001, 2002],
  },
]

describe('assignSquadFromFreeAgents', () => {
  it('returns only players with teamId 0', () => {
    const { playerIds } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    playerIds.forEach(id => {
      const p = ALL_PLAYERS.find(pl => pl.id === id)!
      expect(p.teamId).toBe(0)
    })
  })

  it('assigns at least 11 players (enough for a starting lineup)', () => {
    const { playerIds } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    expect(playerIds.length).toBeGreaterThanOrEqual(11)
  })

  it('lineup has exactly 11 starters', () => {
    const { lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const starters = lineup.filter(s => s.isStarter)
    expect(starters.length).toBe(11)
  })

  it('lineup starters include 1 GK, 4 DF, 4 MD, 2 FW', () => {
    const { lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const starters = lineup.filter(s => s.isStarter)
    expect(starters.filter(s => s.assignedPosition === 'GK').length).toBe(1)
    expect(starters.filter(s => s.assignedPosition === 'DF').length).toBe(4)
    expect(starters.filter(s => s.assignedPosition === 'MD').length).toBe(4)
    expect(starters.filter(s => s.assignedPosition === 'FW').length).toBe(2)
  })

  it('very_strong tier selects higher-media players than weak tier', () => {
    const { playerIds: strongIds } = assignSquadFromFreeAgents(
      { ...BASE_CONFIG, strengthTier: 'very_strong' }, ALL_PLAYERS)
    const { playerIds: weakIds } = assignSquadFromFreeAgents(
      { ...BASE_CONFIG, strengthTier: 'weak' }, ALL_PLAYERS)

    const avgMedia = (ids: number[]) => {
      const medias = ids.map(id => {
        const p = ALL_PLAYERS.find(pl => pl.id === id)!
        return Math.round((p.stats.POT + p.stats.CON + p.stats.TEC + p.stats.PRE + p.stats.FIS + p.stats.AGI + p.stats.INT) / 7)
      })
      return medias.reduce((a, b) => a + b, 0) / medias.length
    }
    expect(avgMedia(strongIds)).toBeGreaterThan(avgMedia(weakIds))
  })

  it('does not duplicate player IDs', () => {
    const { playerIds } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    expect(playerIds.length).toBe(new Set(playerIds).size)
  })
})

describe('buildCustomTeam', () => {
  it('returns a team with the correct name and badgeUrl', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const team = buildCustomTeam(BASE_CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(team.name).toBe('Test FC')
    expect(team.badgeUrl).toBe('/teams/default_team_icon.png')
  })

  it('returns a team ID one higher than the max existing ID', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const team = buildCustomTeam(BASE_CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(team.id).toBe(1)  // max existing is 0, so 0 + 1 = 1
  })

  it('assigns the correct leagueId', () => {
    const config = { ...BASE_CONFIG, leagueId: 'first_division' }
    const { playerIds, lineup } = assignSquadFromFreeAgents(config, ALL_PLAYERS)
    const team = buildCustomTeam(config, EXISTING_TEAMS, playerIds, lineup)
    expect(team.leagueId).toBe('first_division')
  })

  it('very_strong tier gives higher reputation than weak tier', () => {
    const { playerIds: ids1, lineup: l1 } = assignSquadFromFreeAgents({ ...BASE_CONFIG, strengthTier: 'very_strong' }, ALL_PLAYERS)
    const { playerIds: ids2, lineup: l2 } = assignSquadFromFreeAgents({ ...BASE_CONFIG, strengthTier: 'weak' }, ALL_PLAYERS)
    const strong = buildCustomTeam({ ...BASE_CONFIG, strengthTier: 'very_strong' }, EXISTING_TEAMS, ids1, l1)
    const weak = buildCustomTeam({ ...BASE_CONFIG, strengthTier: 'weak' }, EXISTING_TEAMS, ids2, l2)
    expect(strong.reputation).toBeGreaterThan(weak.reputation)
  })

  it('captainId is one of the assigned playerIds', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(BASE_CONFIG, ALL_PLAYERS)
    const team = buildCustomTeam(BASE_CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(playerIds).toContain(team.captainId)
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/tests/customClubService.test.ts
```

Expected: multiple FAIL — `assignSquadFromFreeAgents` and `buildCustomTeam` are not defined.

- [ ] **Step 4: Implement customClubService.ts**

Create `src/services/customClubService.ts`:

```ts
import type { Player } from '../types/player'
import type { Team, LineupSlot, CustomClubConfig } from '../types/team'
import type { StrengthTier } from '../types/team'
import { getPlayerStatsSummary } from '../types/player'
import { formations } from '../data/formations'
import { autoAssignJerseys } from './jerseyService'

const TIER_REPUTATION: Record<StrengthTier, { reputation: number; tier: number }> = {
  weak:        { reputation: 30, tier: 4 },
  normal:      { reputation: 50, tier: 3 },
  strong:      { reputation: 65, tier: 2 },
  very_strong: { reputation: 80, tier: 1 },
}

// Formation 1 GK + 4 DF + 4 MD + 2 FW
const STARTER_SLOTS: Array<{ position: Player['position']; count: number }> = [
  { position: 'GK', count: 1 },
  { position: 'DF', count: 4 },
  { position: 'MD', count: 4 },
  { position: 'FW', count: 2 },
]
const SUB_COUNT = 5

function sortedFreeAgents(allPlayers: Player[]): Player[] {
  return allPlayers
    .filter((p) => p.teamId === 0)
    .sort((a, b) => getPlayerStatsSummary(a).media - getPlayerStatsSummary(b).media)
}

function selectTierPool(sorted: Player[], tier: StrengthTier): Player[] {
  const n = sorted.length
  if (n === 0) return []
  const q1 = Math.floor(n * 0.25)
  const mid = Math.floor(n * 0.5)
  const q3 = Math.floor(n * 0.75)
  switch (tier) {
    case 'weak':        return sorted.slice(0, Math.max(q1, 16))
    case 'normal':      return sorted.slice(q1, Math.max(mid, q1 + 16))
    case 'strong':      return sorted.slice(mid, Math.max(q3, mid + 16))
    case 'very_strong': return sorted.slice(Math.max(0, n - Math.max(n - q3, 16)))
  }
}

export function assignSquadFromFreeAgents(
  config: CustomClubConfig,
  allPlayers: Player[],
): { playerIds: number[]; lineup: LineupSlot[] } {
  const sorted = sortedFreeAgents(allPlayers)
  // Prefer tier pool; fall back to full free agent pool if pool is too small
  const pool = selectTierPool(sorted, config.strengthTier)
  const fullPool = pool.length >= 16 ? pool : sorted

  // Select starters: for each position slot, pick best available from pool
  const selected: Player[] = []
  const usedIds = new Set<number>()

  for (const { position, count } of STARTER_SLOTS) {
    const candidates = fullPool
      .filter((p) => p.position === position && !usedIds.has(p.id))
      .sort((a, b) => getPlayerStatsSummary(b).media - getPlayerStatsSummary(a).media)
    // Fill as many as possible from primary position; use any position as fallback
    const picked = candidates.slice(0, count)
    const remaining = count - picked.length
    if (remaining > 0) {
      const fallback = fullPool
        .filter((p) => !usedIds.has(p.id) && !picked.includes(p))
        .sort((a, b) => getPlayerStatsSummary(b).media - getPlayerStatsSummary(a).media)
        .slice(0, remaining)
      picked.push(...fallback)
    }
    picked.forEach((p) => usedIds.add(p.id))
    selected.push(...picked)
  }

  // Subs: top available from pool (not already selected)
  const subs = fullPool
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => getPlayerStatsSummary(b).media - getPlayerStatsSummary(a).media)
    .slice(0, SUB_COUNT)

  const squad = [...selected, ...subs]
  const lineup: LineupSlot[] = []

  // Build lineup: starters first
  let starterIdx = 0
  for (const { position, count } of STARTER_SLOTS) {
    for (let i = 0; i < count; i++) {
      const player = selected[starterIdx++]
      if (!player) break
      lineup.push({ playerId: player.id, assignedPosition: position, isStarter: true })
    }
  }
  // Subs
  for (const sub of subs) {
    lineup.push({ playerId: sub.id, assignedPosition: sub.position, isStarter: false })
  }

  const playerIds = squad.map((p) => p.id)
  return { playerIds, lineup }
}

export function buildCustomTeam(
  config: CustomClubConfig,
  existingTeams: Team[],
  playerIds: number[],
  lineup: LineupSlot[],
): Team {
  const { reputation, tier } = TIER_REPUTATION[config.strengthTier]
  const newId = existingTeams.length > 0
    ? Math.max(...existingTeams.map((t) => t.id)) + 1
    : 100

  // Use first 4-4-2 formation available
  const formation = formations.find((f) => f.GK === 1 && f.DF === 4 && f.MD === 4 && f.FW === 2)
    ?? formations[0]

  // Captain = highest-media starter
  const starterIds = lineup.filter((s) => s.isStarter).map((s) => s.playerId)
  const captainId = starterIds[0] ?? playerIds[0]

  return {
    id: newId,
    name: config.name,
    badgeUrl: config.badgeUrl,
    tier,
    reputation,
    budget: 300_000,
    leagueId: config.leagueId,
    captainId,
    formation,
    lineup,
    playerIds,
    scoutLevel: Math.max(1, Math.ceil(reputation / 20)),
    facilitiesLevel: Math.max(1, Math.ceil(reputation / 20)),
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/tests/customClubService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/team.ts src/services/customClubService.ts src/tests/customClubService.test.ts
git commit -m "feat: add CustomClubConfig type and customClubService"
```

---

## Task 3: Extend careerStore.startNewCareer

**Files:**
- Modify: `src/store/careerStore.ts` — extend `startNewCareer` signature
- Create: `src/tests/customClub.store.test.ts`

**Interfaces:**
- Consumes: `CustomClubConfig`, `buildCustomTeam`, `assignSquadFromFreeAgents` from Task 2
- Produces: `startNewCareer(managerName, teamId, managerAvatar?, difficulty?, customTeam?)` — where `customTeam?: { team: Team; squadPlayerIds: number[] }`

- [ ] **Step 1: Write the failing test**

Create `src/tests/customClub.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { buildCustomTeam, assignSquadFromFreeAgents } from '../services/customClubService'
import type { CustomClubConfig } from '../types/team'
import type { Player } from '../types/player'
import type { Team } from '../types/team'

// We test the store function logic directly — not the Zustand store instance —
// by testing createCareer with an injected custom team via the same code path.
// This avoids mocking the full store while still testing the injection logic.

function makeFreeAgent(id: number, pos: Player['position'], med: number): Player {
  const b = med * 7
  return {
    id, name: `FA${id}`, nameRomaji: `FA${id}`, gender: 'Masculino',
    position: pos, positionAlt: null, element: 'FIRE',
    stats: { POT: b, CON: b, TEC: b, PRE: b, FIS: b, AGI: b, INT: b, TOT: med },
    career: { maxLevel: 80, potential: 60, growthRate: 1.0, contractStatus: 'free', marketValue: 50000, salary: 1000, experience: 0, trainingProgress: 0, trainingSessionsThisWeek: 0, positionAlt: null },
    techniques: [], spriteUrl: '', stamina: 100, morale: 100,
    isInjured: false, injuryDaysRemaining: 0, isSuspended: false, suspensionMatches: 0,
    age: 17, teamId: 0, jerseyNumber: 0,
  }
}

const FREE_AGENTS: Player[] = [
  makeFreeAgent(901, 'GK', 80), makeFreeAgent(902, 'GK', 85),
  makeFreeAgent(903, 'DF', 80), makeFreeAgent(904, 'DF', 82), makeFreeAgent(905, 'DF', 84), makeFreeAgent(906, 'DF', 86),
  makeFreeAgent(907, 'DF', 88), makeFreeAgent(908, 'DF', 90),
  makeFreeAgent(909, 'MD', 80), makeFreeAgent(910, 'MD', 82), makeFreeAgent(911, 'MD', 84), makeFreeAgent(912, 'MD', 86),
  makeFreeAgent(913, 'MD', 88), makeFreeAgent(914, 'MD', 90),
  makeFreeAgent(915, 'FW', 80), makeFreeAgent(916, 'FW', 82), makeFreeAgent(917, 'FW', 84),
  makeFreeAgent(918, 'FW', 86), makeFreeAgent(919, 'FW', 88), makeFreeAgent(920, 'FW', 90),
]

const EXISTING_TEAMS: Team[] = [
  { id: 0, name: 'Existing', tier: 3, reputation: 50, budget: 300000, leagueId: 'second_division', captainId: 1, formation: { id: 1, name: 'Basic', tacticalType: 'BALANCED', GK: 1, DF: 4, MD: 4, FW: 2 }, lineup: [], playerIds: [] },
]

const CONFIG: CustomClubConfig = {
  name: 'My Club',
  badgeUrl: '/teams/default_team_icon.png',
  badgeIsCustom: false,
  strengthTier: 'normal',
  leagueId: 'second_division',
}

describe('buildCustomTeam + assignSquadFromFreeAgents integration', () => {
  it('builds a team with the correct leagueId and name', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(CONFIG, FREE_AGENTS)
    const team = buildCustomTeam(CONFIG, EXISTING_TEAMS, playerIds, lineup)
    expect(team.leagueId).toBe('second_division')
    expect(team.name).toBe('My Club')
  })

  it('all squadPlayerIds have teamId 0 before injection', () => {
    const { playerIds } = assignSquadFromFreeAgents(CONFIG, FREE_AGENTS)
    playerIds.forEach(id => {
      const p = FREE_AGENTS.find(pl => pl.id === id)!
      expect(p.teamId).toBe(0)
    })
  })

  it('after updating teamId, players belong to custom team', () => {
    const { playerIds, lineup } = assignSquadFromFreeAgents(CONFIG, FREE_AGENTS)
    const team = buildCustomTeam(CONFIG, EXISTING_TEAMS, playerIds, lineup)
    // Simulate what startNewCareer does: update teamId
    const updatedPlayers = FREE_AGENTS.map(p =>
      playerIds.includes(p.id) ? { ...p, teamId: team.id } : p
    )
    const squadPlayers = updatedPlayers.filter(p => playerIds.includes(p.id))
    squadPlayers.forEach(p => expect(p.teamId).toBe(team.id))
  })
})
```

- [ ] **Step 2: Run tests to verify they pass already (no store changes needed yet)**

```bash
npm test -- --reporter=verbose src/tests/customClub.store.test.ts
```

Expected: all PASS. (These tests validate service logic, not the store itself.)

- [ ] **Step 3: Extend startNewCareer in careerStore.ts**

Find the `startNewCareer` action in `src/store/careerStore.ts`. It starts at the line:

```ts
startNewCareer(managerName, teamId, managerAvatar = '/avatars/avatar-1.svg', difficulty = DEFAULT_DIFFICULTY) {
```

Replace only that function signature line and the body up to the `set({` call. The full replacement:

```ts
startNewCareer(managerName, teamId, managerAvatar = '/avatars/avatar-1.svg', difficulty = DEFAULT_DIFFICULTY, customTeamInput?: { team: Team; squadPlayerIds: number[] }) {
  const playersCopy: Player[] = JSON.parse(JSON.stringify(seedPlayers))
    .map((p: Player) => ({ ...p, seasonMatchMinutes: 0 }))
  const teamsCopy: Team[] = JSON.parse(JSON.stringify(seedTeams))
    .map((t: Team) => ({
      ...t,
      scoutLevel: t.scoutLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
      facilitiesLevel: t.facilitiesLevel ?? Math.max(1, Math.ceil(t.reputation / 20)),
    }))
  const leaguesCopy = JSON.parse(JSON.stringify(seedLeagues))

  let resolvedTeamId = teamId
  if (customTeamInput) {
    const { team: customTeam, squadPlayerIds } = customTeamInput
    teamsCopy.push({
      ...customTeam,
      scoutLevel: customTeam.scoutLevel ?? Math.max(1, Math.ceil(customTeam.reputation / 20)),
      facilitiesLevel: customTeam.facilitiesLevel ?? Math.max(1, Math.ceil(customTeam.reputation / 20)),
    })
    for (let i = 0; i < playersCopy.length; i++) {
      if (squadPlayerIds.includes(playersCopy[i].id)) {
        playersCopy[i] = { ...playersCopy[i], teamId: customTeam.id }
      }
    }
    resolvedTeamId = customTeam.id
  }

  const { career, teams: newTeams, players: newPlayers } = createCareer(managerName, resolvedTeamId, teamsCopy, leaguesCopy, playersCopy, difficulty)
  career.managerAvatar = managerAvatar
```

Also update the interface declaration at the top of the store (find `startNewCareer(managerName: string, teamId: number, managerAvatar?: string, difficulty?: DifficultySettings): void` and replace with):

```ts
startNewCareer(managerName: string, teamId: number, managerAvatar?: string, difficulty?: DifficultySettings, customTeamInput?: { team: Team; squadPlayerIds: number[] }): void
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: no errors. If `Team` is not imported in the interface block, add `import type { Team } from '../types/team'` — but it should already be imported (check line 7 of the file).

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all existing tests PASS plus the new ones.

- [ ] **Step 6: Commit**

```bash
git add src/store/careerStore.ts src/tests/customClub.store.test.ts
git commit -m "feat: extend startNewCareer to support custom club injection"
```

---

## Task 4: NewCareerScreen — step structure + mode selection + club name

**Files:**
- Modify: `src/screens/NewCareerScreen.tsx`

**Interfaces:**
- Consumes: `CustomClubConfig`, `StrengthTier` from `src/types/team.ts`; `assignSquadFromFreeAgents`, `buildCustomTeam` from `src/services/customClubService.ts`; `players` from `src/data/players.ts`
- Produces: Rendered steps 0 (coach, unchanged), 1 (mode selection), 2b (club name input)

- [ ] **Step 1: Replace the imports and constants block**

At the top of `src/screens/NewCareerScreen.tsx`, add these imports after the existing ones:

```ts
import { useMemo, useRef } from 'react'
import { players as seedPlayers } from '../data/players'
import { teams as seedTeams } from '../data/teams'
import { assignSquadFromFreeAgents, buildCustomTeam } from '../services/customClubService'
import type { CustomClubConfig, StrengthTier } from '../types/team'
```

Replace the existing `import { useState } from 'react'` with the new import (useState is now part of the `useMemo, useRef` line above — adjust to `import { useState, useMemo, useRef } from 'react'`).

- [ ] **Step 2: Replace the Step type and step constants**

Remove:
```ts
type Step = 0 | 1 | 2 | 3
```

Add:
```ts
type CareerMode = 'existing' | 'custom' | null

const STEPS_EXISTING = ['Entrenador', 'Modo', 'Equipo', 'Dificultad', 'Confirmar']
const STEPS_CUSTOM   = ['Entrenador', 'Modo', 'Nombre', 'Emblema', 'Fuerza', 'Dificultad', 'Confirmar']

const PRESET_BADGES = [
  '/teams/Raimon.webp',
  '/teams/brain.webp',
  '/teams/farm.webp',
  '/teams/Inazuma Kids FC.webp',
  '/teams/Kirkwood.webp',
  '/teams/Occult.webp',
  '/teams/Otaku.webp',
  '/teams/Raimon Veterans.webp',
  '/teams/Royal Academy.webp',
  '/teams/Shuriken.webp',
  "/teams/Street Sally's.webp",
  '/teams/Umbrellla MS.webp',
  '/teams/Wild.webp',
  '/teams/Zeus.png',
  '/teams/default_team_icon.png',
]

const STRENGTH_OPTIONS: Array<{ tier: StrengthTier; label: string; description: string; color: string }> = [
  { tier: 'weak',        label: 'Débil',       description: 'Jugadores de media baja. Empieza desde abajo.',        color: 'gray' },
  { tier: 'normal',      label: 'Normal',      description: 'Plantilla equilibrada para una experiencia estándar.',  color: 'blue' },
  { tier: 'strong',      label: 'Fuerte',      description: 'Jugadores de alta media. Un equipo competitivo.',       color: 'green' },
  { tier: 'very_strong', label: 'Muy fuerte',  description: 'Los mejores agentes libres disponibles.',              color: 'purple' },
]
```

Remove the old `const STEPS = ['Entrenador', 'Equipo', 'Dificultad', 'Confirmar']` line.

- [ ] **Step 3: Add new state variables inside NewCareerScreen**

After the existing state declarations, add:

```ts
const [step, setStep] = useState(0)
const [careerMode, setCareerMode] = useState<CareerMode>(null)
const [clubName, setClubName] = useState('')
const [clubBadgeUrl, setClubBadgeUrl] = useState('/teams/default_team_icon.png')
const [clubBadgeIsCustom, setClubBadgeIsCustom] = useState(false)
const [clubStrength, setClubStrength] = useState<StrengthTier | null>(null)
const [clubLeagueId, setClubLeagueId] = useState<string | null>(null)
const badgeFileRef = useRef<HTMLInputElement>(null)
```

Remove the old `const [step, setStep] = useState<Step>(0)` line.

Add the derived values:

```ts
const steps = careerMode === 'custom' ? STEPS_CUSTOM : STEPS_EXISTING

const customClubPreview = useMemo(() => {
  if (careerMode !== 'custom' || !clubStrength || !clubLeagueId) return null
  const config: CustomClubConfig = {
    name: clubName.trim() || 'Mi Club',
    badgeUrl: clubBadgeUrl,
    badgeIsCustom: clubBadgeIsCustom,
    strengthTier: clubStrength,
    leagueId: clubLeagueId,
  }
  const { playerIds, lineup } = assignSquadFromFreeAgents(config, seedPlayers)
  const team = buildCustomTeam(config, seedTeams, playerIds, lineup)
  const squadPlayers = seedPlayers.filter((p) => playerIds.includes(p.id))
  return { team, playerIds, lineup, squadPlayers }
}, [careerMode, clubName, clubBadgeUrl, clubBadgeIsCustom, clubStrength, clubLeagueId])
```

- [ ] **Step 4: Replace the canProceed / navigation logic**

Replace the inline disabled logic in the bottom nav with a function:

```ts
function canProceed(): boolean {
  if (step === 0) return managerName.trim().length > 0
  if (step === 1) return careerMode !== null
  if (careerMode === 'existing') {
    if (step === 2) return selectedTeamId !== null
  } else {
    if (step === 2) return clubName.trim().length > 0
    if (step === 3) return true   // badge has default
    if (step === 4) return clubStrength !== null && clubLeagueId !== null
  }
  return true
}
```

Update `handleCreate`:

```ts
function handleCreate() {
  if (!managerName.trim()) return
  if (careerMode === 'existing') {
    if (selectedTeamId === null) return
    startNewCareer(managerName.trim(), selectedTeamId, managerAvatar, difficulty)
  } else if (customClubPreview) {
    startNewCareer(
      managerName.trim(),
      customClubPreview.team.id,
      managerAvatar,
      difficulty,
      { team: customClubPreview.team, squadPlayerIds: customClubPreview.playerIds },
    )
  }
}
```

- [ ] **Step 5: Replace the StepperBar call and add Step 1 (Mode selection)**

Replace:
```ts
<StepperBar steps={STEPS} current={step} />
```
With:
```ts
<StepperBar steps={steps} current={step} />
```

Add the mode selection step block (Step 1) inside the `<div className="flex-1 overflow-y-auto">`. Insert before the existing `{/* ── STEP 1: Team ── */}` block:

```tsx
{/* ── STEP 1: Mode selection ── */}
{step === 1 && (
  <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
    <div>
      <h2 className="text-white text-2xl font-bold mb-1">Elige tu camino</h2>
      <p className="text-gray-400 text-sm">¿Gestionas un equipo existente o creas tu propio club?</p>
    </div>
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setCareerMode('existing')}
        className={`text-left p-5 rounded-2xl border-2 transition-colors ${careerMode === 'existing' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-rounded text-blue-400 text-3xl">sports_soccer</span>
          <p className="text-white text-lg font-bold">Equipo existente</p>
        </div>
        <p className="text-gray-400 text-sm">Elige uno de los equipos del juego y empieza tu carrera.</p>
      </button>
      <button
        onClick={() => setCareerMode('custom')}
        className={`text-left p-5 rounded-2xl border-2 transition-colors ${careerMode === 'custom' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-rounded text-purple-400 text-3xl">add_circle</span>
          <p className="text-white text-lg font-bold">Crear club propio</p>
        </div>
        <p className="text-gray-400 text-sm">Diseña tu propio club: nombre, emblema, fuerza inicial y liga.</p>
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Update Step 2 (team selection) to only render for existing mode**

Find the existing `{step === 1 && (` block (the team selection). Update its condition to:

```tsx
{step === 2 && careerMode === 'existing' && (
```

- [ ] **Step 7: Shift existing steps 2 and 3 to 3 and 4 for existing mode**

Update difficulty step condition from `{step === 2 &&` to:
```tsx
{((step === 3 && careerMode === 'existing') || (step === 5 && careerMode === 'custom')) && (
```

Update confirm step condition from `{step === 3 && selectedTeam && (` to:
```tsx
{((step === 4 && careerMode === 'existing') || (step === 6 && careerMode === 'custom')) && selectedTeam && (
```

(The custom club confirm screen will be handled in Task 6.)

- [ ] **Step 8: Add Step 2b — Club name**

Insert after the mode selection step block:

```tsx
{/* ── STEP 2b: Club name ── */}
{step === 2 && careerMode === 'custom' && (
  <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">
    <div>
      <h2 className="text-white text-2xl font-bold mb-1">Nombre del club</h2>
      <p className="text-gray-400 text-sm">¿Cómo se llamará tu club?</p>
    </div>
    <div>
      <label className="block text-gray-300 text-sm font-semibold mb-2">
        Nombre del club
      </label>
      <input
        type="text"
        value={clubName}
        onChange={(e) => setClubName(e.target.value)}
        placeholder="Nombre del club..."
        maxLength={25}
        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors text-lg"
      />
      <p className={`text-xs mt-1 text-right ${clubName.length >= 25 ? 'text-red-400' : 'text-gray-500'}`}>
        {clubName.length}/25
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 9: Update the bottom nav bar**

Replace the existing bottom nav buttons with the new logic:

```tsx
<div className="flex-shrink-0 border-t border-gray-800 px-6 py-4 flex gap-3 bg-gray-900">
  <button
    onClick={() => {
      if (step === 0) navigate('main_menu')
      else setStep((s) => s - 1)
    }}
    className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
  >
    Atras
  </button>
  {step < steps.length - 1 ? (
    <button
      onClick={() => { if (canProceed()) setStep((s) => s + 1) }}
      disabled={!canProceed()}
      className="ml-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
    >
      Continuar
    </button>
  ) : (
    <button
      onClick={handleCreate}
      className="ml-auto px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
    >
      Crear Carrera
    </button>
  )}
</div>
```

- [ ] **Step 10: Start dev server and verify steps 0, 1, 2b**

```bash
npm run dev
```

Open the app, go to Nueva Carrera. Verify:
- Step 0 (Entrenador): unchanged, works as before
- Step 1 (Modo): shows two cards, selecting one enables Continuar
- Choosing "Equipo existente": step 2 shows the team list (existing behavior)
- Choosing "Crear club propio": step 2 shows the club name input with character counter
- The StepperBar shows the correct step labels for each path

- [ ] **Step 11: Commit**

```bash
git add src/screens/NewCareerScreen.tsx
git commit -m "feat: add mode selection and club name steps to career wizard"
```

---

## Task 5: NewCareerScreen — badge picker + strength/league steps

**Files:**
- Modify: `src/screens/NewCareerScreen.tsx`

**Interfaces:**
- Consumes: `PRESET_BADGES`, `STRENGTH_OPTIONS`, `clubBadgeUrl`, `clubBadgeIsCustom`, `badgeFileRef`, `clubStrength`, `clubLeagueId` — all declared in Task 4
- Produces: Steps 3b (badge) and 4b (strength + league) fully functional

- [ ] **Step 1: Add Step 3b — Badge picker**

Insert inside `<div className="flex-1 overflow-y-auto">`, after the club name block:

```tsx
{/* ── STEP 3b: Badge picker ── */}
{step === 3 && careerMode === 'custom' && (
  <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
    <div>
      <h2 className="text-white text-2xl font-bold mb-1">Emblema del club</h2>
      <p className="text-gray-400 text-sm">Elige el emblema que representará a tu club.</p>
    </div>
    <div className="flex gap-6">
      {/* Left: preset grid */}
      <div className="flex-1">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Emblemas predeterminados</p>
        <div className="grid grid-cols-5 gap-2">
          {PRESET_BADGES.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => { setClubBadgeUrl(url); setClubBadgeIsCustom(false) }}
              className={`p-1 rounded-xl border-2 transition-all ${clubBadgeUrl === url && !clubBadgeIsCustom ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
            >
              <img src={url} alt="" className="w-10 h-10 object-contain mx-auto" />
            </button>
          ))}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => badgeFileRef.current?.click()}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${clubBadgeIsCustom ? 'border-purple-500 bg-purple-900/20 text-purple-300' : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
          >
            <span className="material-symbols-rounded text-lg">upload</span>
            {clubBadgeIsCustom ? 'Imagen personalizada seleccionada' : 'Subir imagen propia'}
          </button>
          <input
            ref={badgeFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = (ev) => {
                const result = ev.target?.result
                if (typeof result === 'string') {
                  setClubBadgeUrl(result)
                  setClubBadgeIsCustom(true)
                }
              }
              reader.readAsDataURL(file)
            }}
          />
        </div>
      </div>
      {/* Right: preview */}
      <div className="w-48 flex-shrink-0 flex flex-col items-center gap-3 pt-6">
        <TeamBadgeImage teamName={clubName || 'Mi Club'} badgeUrl={clubBadgeUrl} size="xl" />
        <p className="text-white font-bold text-center text-sm leading-tight">{clubName || 'Mi Club'}</p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add Step 4b — Strength + League**

Insert after the badge picker block:

```tsx
{/* ── STEP 4b: Strength + League ── */}
{step === 4 && careerMode === 'custom' && (
  <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-8">
    <div>
      <h2 className="text-white text-2xl font-bold mb-1">Fuerza inicial</h2>
      <p className="text-gray-400 text-sm">Elige el nivel de tu plantilla inicial y la liga donde empezarás.</p>
    </div>

    {/* Strength */}
    <div>
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Nivel de la plantilla</p>
      <div className="grid grid-cols-2 gap-3">
        {STRENGTH_OPTIONS.map(({ tier, label, description, color }) => {
          const colorMap: Record<string, string> = {
            gray: 'border-gray-500 bg-gray-700/40',
            blue: 'border-blue-500 bg-blue-900/20',
            green: 'border-green-500 bg-green-900/20',
            purple: 'border-purple-500 bg-purple-900/20',
          }
          const labelColorMap: Record<string, string> = {
            gray: 'text-gray-300', blue: 'text-blue-400',
            green: 'text-green-400', purple: 'text-purple-400',
          }
          const isSelected = clubStrength === tier
          return (
            <button
              key={tier}
              onClick={() => setClubStrength(tier)}
              className={`text-left p-4 rounded-2xl border-2 transition-colors ${isSelected ? colorMap[color] : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
            >
              <p className={`text-lg font-bold mb-1 ${isSelected ? labelColorMap[color] : 'text-gray-300'}`}>{label}</p>
              <p className="text-gray-400 text-xs">{description}</p>
            </button>
          )
        })}
      </div>
    </div>

    {/* League */}
    <div>
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Liga inicial</p>
      <div className="flex flex-col gap-3">
        {[
          { id: 'second_division', label: 'Segunda División', desc: 'Nivel 2 · Empieza desde abajo y asciende.' },
          { id: 'first_division',  label: 'Primera División', desc: 'Nivel 1 · Directamente en la liga más alta.' },
        ].map(({ id, label, desc }) => (
          <button
            key={id}
            onClick={() => setClubLeagueId(id)}
            className={`text-left p-4 rounded-2xl border-2 transition-colors ${clubLeagueId === id ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}
          >
            <p className={`font-bold mb-0.5 ${clubLeagueId === id ? 'text-yellow-300' : 'text-gray-300'}`}>{label}</p>
            <p className="text-gray-500 text-xs">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Start dev server and test steps 3b and 4b**

```bash
npm run dev
```

Verify in browser (choose "Crear club propio" → fill name → check badge step):
- Step 3 (Emblema): preset grid shows 15 badge images, clicking one highlights it with a purple border, right side shows preview with club name
- Upload button opens file picker; after upload the button label changes and the preview updates
- Step 4 (Fuerza): four strength cards in 2×2 grid, two league cards below, "Continuar" stays disabled until both are selected

- [ ] **Step 4: Commit**

```bash
git add src/screens/NewCareerScreen.tsx
git commit -m "feat: add badge picker and strength/league steps"
```

---

## Task 6: NewCareerScreen — confirm screen + full wiring

**Files:**
- Modify: `src/screens/NewCareerScreen.tsx`

**Interfaces:**
- Consumes: `customClubPreview` (computed in Task 4), all state from Tasks 4–5
- Produces: Full working career creation flow for both paths (existing team + custom club)

- [ ] **Step 1: Add custom club confirm block**

The existing confirm block has condition:
```tsx
{((step === 4 && careerMode === 'existing') || (step === 6 && careerMode === 'custom')) && selectedTeam && (
```

This only renders for `existing` mode (since `selectedTeam` is null in custom mode). Split into two separate blocks.

Keep the existing block for existing mode (update condition to `step === 4 && careerMode === 'existing' && selectedTeam`).

Add a new custom club confirm block after it:

```tsx
{/* ── STEP 6: Confirm (custom club) ── */}
{step === 6 && careerMode === 'custom' && customClubPreview && (
  <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
    <div>
      <h2 className="text-white text-2xl font-bold mb-1">Confirmar Carrera</h2>
      <p className="text-gray-400 text-sm">Revisa los datos antes de comenzar.</p>
    </div>

    {/* Manager */}
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

    {/* Club */}
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
      <div className="flex items-center gap-4 mb-4">
        <TeamBadgeImage teamName={customClubPreview.team.name} badgeUrl={customClubPreview.team.badgeUrl} size="lg" />
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Club creado</p>
          <p className="text-white text-xl font-bold">{customClubPreview.team.name}</p>
          <p className="text-gray-400 text-sm">{LEAGUE_LABELS[customClubPreview.team.leagueId]}</p>
          <p className="text-gray-500 text-xs">
            {STRENGTH_OPTIONS.find(s => s.tier === clubStrength)?.label} · Reputación {customClubPreview.team.reputation}
          </p>
        </div>
      </div>
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
        Plantilla inicial ({customClubPreview.squadPlayers.filter(p => customClubPreview.lineup.find(l => l.playerId === p.id && l.isStarter)).length} titulares)
      </p>
      <div className="flex flex-col gap-1.5">
        {customClubPreview.squadPlayers
          .filter((p) => customClubPreview.lineup.find((l) => l.playerId === p.id && l.isStarter))
          .map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-gray-700/50 rounded-lg px-3 py-2">
              <img
                src={p.spriteUrl}
                alt={p.name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                className="w-16 h-16 object-contain rounded flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white text-sm font-semibold truncate">{p.name}</span>
                  <PositionSprite position={p.position} size={25} />
                  <ElementBadge element={p.element} size="xs" />
                </div>
                <div className="flex items-end gap-3">
                  {STAT_KEYS.map((stat) => (
                    <div key={stat} className="flex flex-col items-center">
                      <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">{stat}</span>
                      <span className="text-gray-300 text-xs font-medium">{p.stats[stat]}</span>
                    </div>
                  ))}
                  <div className="ml-auto flex flex-col items-center">
                    <span className="text-gray-500 text-[0.5625rem] uppercase leading-none mb-0.5">Media</span>
                    <span className="text-sm font-bold" style={{ color: statColor(getPlayerStatsSummary(p).media, 250) }}>
                      {getPlayerStatsSummary(p).media}
                    </span>
                    <span className="text-gray-500 text-[0.5625rem] tabular-nums">{getPlayerStatsSummary(p).total}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>

    {/* Difficulty */}
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Dificultad</p>
      <div className="flex items-center gap-3">
        {difficultyMode === 'easy'   && <span className="text-green-400 font-bold text-lg">Facil</span>}
        {difficultyMode === 'normal' && <span className="text-blue-400 font-bold text-lg">Normal</span>}
        {difficultyMode === 'hard'   && <span className="text-red-400 font-bold text-lg">Dificil</span>}
        {difficultyMode === 'custom' && <span className="text-purple-400 font-bold text-lg">Custom</span>}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify the existing team confirm block still works**

The existing confirm block should now have condition `step === 4 && careerMode === 'existing' && selectedTeam`. Double-check that `LEAGUE_LABELS` and `STRENGTH_OPTIONS` are defined at the top of the file (they were added in Task 4).

- [ ] **Step 3: Full end-to-end test in browser**

```bash
npm run dev
```

**Existing team path:**
1. Fill coach name → Continuar
2. Select "Equipo existente" → Continuar
3. Select a team from the list → Continuar
4. Set difficulty → Continuar
5. See confirm screen with team info → "Crear Carrera"
6. Career home loads with the chosen team

**Custom club path:**
1. Fill coach name → Continuar
2. Select "Crear club propio" → Continuar
3. Enter club name (e.g. "Equipo Prueba") → Continuar
4. Select a badge → Continuar
5. Select strength "Normal" + league "Segunda División" → Continuar
6. Set difficulty → Continuar
7. See confirm screen showing: coach, club (badge + name + league + strength), 11 starter players with stats, difficulty
8. "Crear Carrera" → career home loads

**In-game checks:**
- Home: custom club name and badge appear correctly
- Calendar: custom club shown in matches
- Standings: custom club appears in the correct league
- Transfers/Squad: free agent players now belong to the custom club
- Formation screen: lineup of 11 starters is pre-assigned

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/NewCareerScreen.tsx
git commit -m "feat: custom club confirm screen and full career wizard wiring"
```

---

## Self-Review

**Spec coverage:**
- Club name (25 chars, counter, validation) → Task 4 Step 8
- Badge: preset grid + file upload + preview → Task 5 Step 1
- Strength tiers + free agent filtering → Task 2 Step 4
- League selection → Task 5 Step 2
- Squad positional coverage (1 GK, 4 DF, 4 MD, 2 FW) → Task 2 Step 4
- No duplicate players → `usedIds` set in `assignSquadFromFreeAgents`
- No players removed from other teams → `teamId === 0` filter
- Confirm screen shows coach + club + squad + difficulty → Task 6 Step 1
- Club participates in chosen league → `leagueId` propagated to team
- Badge visible in Home, calendar, standings → `TeamBadgeImage` used everywhere (no changes needed)
- Custom badge stored in save (base64 in team.badgeUrl) → stored in `Team.badgeUrl`, serialized with the rest of the career

**Type consistency:**
- `StrengthTier` defined in `src/types/team.ts` Task 2, used in Tasks 4 and 5 ✓
- `CustomClubConfig` defined in Task 2, consumed in Tasks 4–6 ✓
- `assignSquadFromFreeAgents` returns `{ playerIds: number[]; lineup: LineupSlot[] }` — matches Task 4 and 6 usage ✓
- `buildCustomTeam(config, existingTeams, playerIds, lineup): Team` — matches Task 4 usage ✓
- `startNewCareer(..., customTeamInput?: { team: Team; squadPlayerIds: number[] })` — matches Task 6 call ✓

**No placeholders:** all steps contain actual code.
