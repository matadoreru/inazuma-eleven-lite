#!/usr/bin/env python3
"""Generate TypeScript seed data files from Godot JSON database."""

import json
import os

# Paths
DB_DIR = "/home/eru/Documents/Projects/inazuma/inazuma-eleven-universe/content/database"
OUT_DIR = "/home/eru/Documents/Projects/inazuma/inazuma-eleven-lite/src/data"

# ─── Load source JSONs ───────────────────────────────────────────────────────

with open(f"{DB_DIR}/players/players.json", encoding="utf-8") as f:
    all_players_raw = json.load(f)

with open(f"{DB_DIR}/teams/teams.json", encoding="utf-8") as f:
    teams_raw = json.load(f)["teams"]

with open(f"{DB_DIR}/competitions/leagues.json", encoding="utf-8") as f:
    leagues_raw = json.load(f)["leagues"]

# ─── Team-to-player mapping (from task spec) ────────────────────────────────

TEAM_PLAYERS = {
    0:  [75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95, 97, 99, 101, 103, 104, 96],
    1:  [142, 143, 144, 145, 146, 157, 147, 148, 149, 150, 152, 153, 151, 154, 155, 156],
    2:  [192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207],
    3:  [159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174],
    4:  [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
    5:  [107, 108, 111, 119, 121, 109, 110, 112, 113, 115, 116, 120, 114, 117, 118, 122],
    6:  [1, 5, 6, 8, 16, 9, 11, 12, 15, 2, 7, 1051, 13, 10, 14, 1050],
    7:  [209, 210, 211, 222, 223, 212, 213, 214, 215, 216, 218, 217, 219, 220, 221],
    8:  [20, 21, 22, 23, 24, 25, 26, 29, 28, 30, 31, 27, 32, 33, 34, 35],
    9:  [125, 126, 127, 128, 129, 130, 131, 132, 134, 133, 135, 140, 137, 138, 136, 139],
    10: [241, 242, 243, 244, 245, 246, 247, 248, 250, 249, 251, 252, 253, 254, 255, 256],
    11: [224, 225, 226, 227, 228, 237, 229, 230, 231, 233, 232, 235, 234, 236, 238, 239],
    12: [57, 59, 60, 61, 70, 62, 63, 64, 65, 66, 67, 72, 58, 68, 69, 71],
    13: [176, 177, 178, 179, 180, 181, 182, 183, 186, 184, 185, 187, 188, 189, 190, 191],
    14: [10002, 10001, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010, 10011],
    15: [10017, 10018, 10019, 10020, 10021, 10022, 10023, 10024, 10025, 10026, 10027],
    16: [10028, 10029, 10030, 10031, 10032, 10033, 10034, 10035, 10036, 10037, 10038],
}

# Build reverse map: player_id → team_id
player_team_map = {}
for team_id, player_ids in TEAM_PLAYERS.items():
    for pid in player_ids:
        player_team_map[pid] = team_id

# Build set of all player IDs we need
needed_player_ids = set(player_team_map.keys())

# ─── Mapping helpers ─────────────────────────────────────────────────────────

def map_position(pos):
    return "MD" if pos == "MF" else pos

VALID_POSITIONS = {"GK", "DF", "MF", "FW"}

def map_position_alt(pos):
    if not pos or pos == "" or pos not in VALID_POSITIONS:
        return None
    return "MD" if pos == "MF" else pos

def map_technique_type(t):
    mapping = {
        "Tiro": "Tiro",
        "Regate": "Regate",
        "Defensa": "Bloqueo",
        "Portería": "Parada",
        "Keshin": "Tiro",
        "": "Tiro",
    }
    return mapping.get(t, "Tiro")

def map_contract_status(s):
    return "free" if s == "free_agent" else "contracted"

def map_tactical_type(n):
    mapping = {
        0: "BALANCED",
        1: "DEFENSIVE",
        2: "OFFENSIVE",
        3: "MIDFIELD_CONTROL",
        4: "COUNTER_ATTACK",
        5: "HIGH_PRESS",
    }
    return mapping.get(n, "BALANCED")

def map_lineup_position(n):
    mapping = {0: "GK", 1: "DF", 2: "MD", 3: "FW"}
    return mapping.get(n, "MD")

def tier_budget(tier):
    return {1: 500000, 2: 300000, 3: 150000}.get(tier, 150000)

# ─── Build player index ──────────────────────────────────────────────────────

players_by_id = {int(p["id"]): p for p in all_players_raw}

# ─── Generate players.ts ─────────────────────────────────────────────────────

def quote(s):
    """Escape and quote a string for TS."""
    s = str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{s}"'

def ts_bool(b):
    return "true" if b else "false"

def ts_null_or_str(v):
    return "null" if v is None else quote(v)

def ts_null_or_int(v):
    return "null" if v is None else str(int(v))

VALID_ELEMENTS = {"FIRE", "WOOD", "WIND", "MOUNTAIN"}

def normalize_element(el):
    """Normalize element to valid Element type or empty string."""
    if not el:
        return ""
    upper = el.upper()
    return upper if upper in VALID_ELEMENTS else ""

def technique_key(tech):
    return f"{int(tech.get('id', 0))}:{tech['name']}"

TECHNIQUE_ACTION_STATS = {
    "Tiro": ("POT", "TEC"),
    "Regate": ("CON", "AGI"),
    "Bloqueo": ("PRE", "FIS"),
    "Parada": ("PRE", "AGI"),
    "Mejora": ("INT", "TEC"),
}

def technique_boosts(tech):
    tech_type = map_technique_type(tech.get("type", ""))
    power = int(tech.get("POT", 0))
    if power <= 0:
        return "{}"
    primary, secondary = TECHNIQUE_ACTION_STATS[tech_type]
    primary_value = max(1, min(15, round(power / 8)))
    return "{ " + f"{primary}: {primary_value}, {secondary}: {max(1, round(primary_value / 2))}" + " }"

def build_supertechnique(tech):
    return (
        f"  {quote(technique_key(tech))}: {{ "
        f"id: {int(tech.get('id', 0))}, name: {quote(tech['name'])}, "
        f"type: {quote(map_technique_type(tech.get('type', '')))}, "
        f"element: {quote(normalize_element(tech.get('element', '')))}, "
        f"POT: {int(tech.get('POT', 0))}, PP: {int(tech.get('PP', 0))}, "
        f"statBoosts: {technique_boosts(tech)} }}"
    )

def build_player(raw, team_id):
    pos_alt = map_position_alt(raw.get("position_alternative", ""))
    career = raw["career"]
    techniques = raw.get("supertechniques", [])
    technique_keys = ", ".join(quote(technique_key(t)) for t in techniques)

    lines = [
        "  {",
        f"    id: {int(raw['id'])},",
        f"    name: {quote(raw['name'])},",
        f"    nameRomaji: {quote(raw.get('name_romaji', ''))},",
        f"    gender: {quote(raw['gender'])},",
        f"    position: {quote(map_position(raw['position']))},",
        f"    positionAlt: {ts_null_or_str(pos_alt)},",
        f"    element: {quote(raw['element'])},",
        "    stats: {",
        f"      POT: {raw['stats']['POT']}, CON: {raw['stats']['CON']},",
        f"      TEC: {raw['stats']['TEC']}, PRE: {raw['stats']['PRE']},",
        f"      FIS: {raw['stats']['FIS']}, AGI: {raw['stats']['AGI']},",
        f"      INT: {raw['stats']['INT']}, TOT: {raw['stats']['TOT']}",
        "    },",
        "    career: {",
        f"      maxLevel: {int(career['max_level'])},",
        f"      potential: {int(career['potential'])},",
        f"      growthRate: {career['growth_rate']},",
        f"      contractStatus: {quote(map_contract_status(career['contract_status']))},",
        f"      marketValue: {int(career['market_value'])},",
        f"      salary: {int(career['salary'])},",
        "      experience: 0,",
        "      trainingProgress: 0,",
        "      trainingSessionsThisWeek: 0,",
        f"      positionAlt: {ts_null_or_str(pos_alt)}",
        "    },",
        f"    techniques: getSupertechniques([{technique_keys}]),",
        f"    spriteUrl: {quote(raw.get('sprite_url', ''))},",
        "    stamina: 100,",
        "    morale: 100,",
        "    isInjured: false,",
        "    injuryDaysRemaining: 0,",
        "    isSuspended: false,",
        "    suspensionMatches: 0,",
        "    age: 20,",
        f"    teamId: {ts_null_or_int(team_id)},",
        "    jerseyNumber: 0",
        "  }",
    ]
    return "\n".join(lines)

# Collect only needed players in a stable order (sorted by id for determinism)
needed_players = []
for pid in sorted(needed_player_ids):
    if pid in players_by_id:
        needed_players.append((pid, players_by_id[pid]))
    else:
        print(f"WARNING: player id {pid} not found in players.json!")

print(f"Players to export: {len(needed_players)}")

player_blocks = [build_player(raw, player_team_map[pid]) for pid, raw in needed_players]
players_ts = (
    "import type { Player } from '../types/player'\n"
    "import { getSupertechniques } from './supertechniques'\n\n"
    "export const players: Player[] = [\n"
    + ",\n".join(player_blocks)
    + "\n]\n"
)

with open(f"{OUT_DIR}/players.ts", "w", encoding="utf-8") as f:
    f.write(players_ts)

print("Written players.ts")

# Supertécnicas live in their own master catalog; players only keep references.
supertechniques = {}
for _, raw in needed_players:
    for technique in raw.get("supertechniques", []):
        supertechniques[technique_key(technique)] = technique

supertechnique_blocks = [
    build_supertechnique(supertechniques[key])
    for key in sorted(supertechniques, key=lambda k: (int(k.split(":", 1)[0]), k))
]
supertechniques_ts = (
    "import type { Technique } from '../types/player'\n\n"
    "// Catálogo maestro. statBoosts define qué atributos aumenta cada técnica al usarse.\n"
    "export const supertechniques: Readonly<Record<string, Technique>> = {\n"
    + ",\n".join(supertechnique_blocks)
    + "\n}\n\n"
    "export function getSupertechniques(keys: string[]): Technique[] {\n"
    "  return keys.map((key) => {\n"
    "    const technique = supertechniques[key]\n"
    "    if (!technique) throw new Error(`Supertécnica desconocida: ${key}`)\n"
    "    return technique\n"
    "  })\n"
    "}\n"
)
with open(f"{OUT_DIR}/supertechniques.ts", "w", encoding="utf-8") as f:
    f.write(supertechniques_ts)

print("Written supertechniques.ts")

# ─── Generate teams.ts ───────────────────────────────────────────────────────

def build_lineup_slot(slot):
    return (
        "{ "
        f"playerId: {int(slot['player_id'])}, "
        f"assignedPosition: {quote(map_lineup_position(slot['assigned_position']))}, "
        f"isStarter: {ts_bool(slot['is_starter'])}"
        " }"
    )

def build_team(raw):
    tid = int(raw["id"])
    formation = raw["active_formation"]
    lineup = raw["active_lineup"]
    player_ids = TEAM_PLAYERS.get(tid, [])

    fmt_str = (
        "{ "
        f"id: {int(formation['id'])}, "
        f"name: {quote(formation['name'])}, "
        f"tacticalType: {quote(map_tactical_type(formation['tactical_type']))}, "
        f"GK: {int(formation['GK_num'])}, "
        f"DF: {int(formation['DF_num'])}, "
        f"MD: {int(formation['MD_num'])}, "
        f"FW: {int(formation['FW_num'])}"
        " }"
    )

    lineup_items = ", ".join(build_lineup_slot(s) for s in lineup)
    player_ids_str = ", ".join(str(p) for p in player_ids)

    lines = [
        "  {",
        f"    id: {tid},",
        f"    name: {quote(raw['team'])},",
        f"    tier: {int(raw['tier'])},",
        f"    reputation: {int(raw['reputation'])},",
        f"    budget: {tier_budget(int(raw['tier']))},",
        f"    leagueId: {quote(raw['initial_league_id'])},",
        f"    captainId: {int(raw['captain_id'])},",
        f"    formation: {fmt_str},",
        f"    lineup: [{lineup_items}],",
        f"    playerIds: [{player_ids_str}]",
        "  }",
    ]
    return "\n".join(lines)

team_blocks = [build_team(t) for t in teams_raw]
teams_ts = (
    "import type { Team } from '../types/team'\n\n"
    "export const teams: Team[] = [\n"
    + ",\n".join(team_blocks)
    + "\n]\n"
)

with open(f"{OUT_DIR}/teams.ts", "w", encoding="utf-8") as f:
    f.write(teams_ts)

print("Written teams.ts")

# ─── Generate leagues.ts ─────────────────────────────────────────────────────

def build_league(raw):
    lines = [
        "  {",
        f"    id: {quote(raw['id'])},",
        f"    name: {quote(raw['name'])},",
        f"    level: {raw['level']},",
        f"    promotionTo: {ts_null_or_str(raw['promotion_to'])},",
        f"    relegationTo: {ts_null_or_str(raw['relegation_to'])},",
        f"    promotionSlots: {raw['promotion_slots']},",
        f"    relegationSlots: {raw['relegation_slots']},",
        f"    teamsCount: {raw['teams_count']},",
        f"    rounds: {raw['rounds']}",
        "  }",
    ]
    return "\n".join(lines)

league_blocks = [build_league(l) for l in leagues_raw]
leagues_ts = (
    "import type { League } from '../types/competition'\n\n"
    "export const leagues: League[] = [\n"
    + ",\n".join(league_blocks)
    + "\n]\n"
)

with open(f"{OUT_DIR}/leagues.ts", "w", encoding="utf-8") as f:
    f.write(leagues_ts)

print("Written leagues.ts")

# ─── Generate formations.ts ──────────────────────────────────────────────────

PRESET_FORMATIONS = [
    {"id": 1, "name": "4-4-2",   "tacticalType": "BALANCED",         "GK": 1, "DF": 4, "MD": 4, "FW": 2},
    {"id": 2, "name": "4-3-3",   "tacticalType": "OFFENSIVE",        "GK": 1, "DF": 4, "MD": 3, "FW": 3},
    {"id": 3, "name": "5-3-2",   "tacticalType": "DEFENSIVE",        "GK": 1, "DF": 5, "MD": 3, "FW": 2},
    {"id": 4, "name": "3-5-2",   "tacticalType": "MIDFIELD_CONTROL", "GK": 1, "DF": 3, "MD": 5, "FW": 2},
    {"id": 5, "name": "4-1-4-1", "tacticalType": "HIGH_PRESS",       "GK": 1, "DF": 4, "MD": 5, "FW": 1},
    {"id": 6, "name": "Counter", "tacticalType": "COUNTER_ATTACK",   "GK": 1, "DF": 5, "MD": 3, "FW": 2},
]

def build_formation(f):
    return (
        "  { "
        f"id: {f['id']}, "
        f"name: {quote(f['name'])}, "
        f"tacticalType: {quote(f['tacticalType'])}, "
        f"GK: {f['GK']}, DF: {f['DF']}, MD: {f['MD']}, FW: {f['FW']}"
        " }"
    )

formation_blocks = [build_formation(f) for f in PRESET_FORMATIONS]
formations_ts = (
    "import type { Formation } from '../types/team'\n\n"
    "export const formations: Formation[] = [\n"
    + ",\n".join(formation_blocks)
    + "\n]\n"
)

with open(f"{OUT_DIR}/formations.ts", "w", encoding="utf-8") as f:
    f.write(formations_ts)

print("Written formations.ts")
print("Done.")
