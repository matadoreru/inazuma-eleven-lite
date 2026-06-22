#!/usr/bin/env python3
"""
Import free agents from the Inazuma Eleven universe database into players.ts.
Run from the project root: python3 scripts/import-free-agents.py
"""
import json, re
from pathlib import Path

DB_PATH = Path('/home/eru/Documents/Projects/inazuma/inazuma-eleven-universe/content/database/players/players.json')
PLAYERS_TS = Path('src/data/players.ts')
SUPERTECHNIQUES_TS = Path('src/data/supertechniques.ts')

POS_MAP = {'MF': 'MD', 'GK': 'GK', 'DF': 'DF', 'FW': 'FW'}
VALID_ELEMENTS = {'FIRE', 'WOOD', 'WIND', 'MOUNTAIN'}
VALID_TYPES = {'Tiro', 'Regate', 'Bloqueo', 'Parada', 'Mejora'}


def media(s: dict) -> int:
    return round((int(s['POT']) + int(s['CON']) + int(s['TEC']) + int(s['PRE']) + int(s['FIS']) + int(s['AGI']) + int(s['INT'])) / 7)


def get_existing_ids(ts_path: Path) -> set:
    content = ts_path.read_text(encoding='utf-8')
    # Match only top-level player ids (4-space indent, not technique ids which are inline)
    return set(int(m) for m in re.findall(r'^    id: (\d+),', content, re.MULTILINE))


def format_techniques(supertechniques: list) -> str:
    # Filter for valid types and take first 3
    valid_techs = [t for t in supertechniques if t.get('type', '') in VALID_TYPES][:3]
    keys = [f'{int(t.get("id", 0))}:{t.get("name", "")}' for t in valid_techs]
    return 'getSupertechniques(' + json.dumps(keys, ensure_ascii=False) + ')'


def format_catalog_entry(t: dict) -> str:
    elem = t.get('element', '') if t.get('element', '') in VALID_ELEMENTS else ''
    tech_type = t.get('type', 'Tiro')
    power = int(t.get('POT', 0))
    action_stats = {
        'Tiro': ('POT', 'TEC'), 'Regate': ('CON', 'AGI'),
        'Bloqueo': ('PRE', 'FIS'), 'Parada': ('PRE', 'AGI'), 'Mejora': ('INT', 'TEC'),
    }
    primary, secondary = action_stats[tech_type]
    primary_value = max(1, min(15, round(power / 8))) if power > 0 else 0
    boosts = '{}' if power <= 0 else f'{{ {primary}: {primary_value}, {secondary}: {max(1, round(primary_value / 2))} }}'
    key = f'{int(t.get("id", 0))}:{t.get("name", "")}'
    return (
        f'  {json.dumps(key, ensure_ascii=False)}: {{ id: {int(t.get("id", 0))}, '
        f'name: {json.dumps(t.get("name", ""), ensure_ascii=False)}, type: "{tech_type}", '
        f'element: "{elem}", POT: {power}, PP: {int(t.get("PP", 0))}, statBoosts: {boosts} }},'
    )


def build_entry(p: dict) -> str:
    s = p['stats']
    career = p['career']
    pos = POS_MAP.get(p['position'], 'MD')
    pos_alt_raw = p.get('position_alternative') or ''
    # Only use positionAlt if it's a valid position or mapped position
    if pos_alt_raw and pos_alt_raw != '?' and pos_alt_raw in POS_MAP:
        pos_alt = f'"{POS_MAP.get(pos_alt_raw)}"'
    else:
        pos_alt = 'null'
    elem = p.get('element', 'FIRE')
    if elem not in VALID_ELEMENTS:
        elem = 'FIRE'
    techs = format_techniques(p.get('supertechniques', []))
    sprite = p.get('sprite_url', '')
    name = p['name'].replace('"', '\\"')
    name_romaji = (p.get('name_romaji') or p['name']).replace('"', '\\"')

    player_id = int(p['id'])
    max_level = int(career.get('max_level', 80))
    potential = int(career.get('potential', 60))
    growth_rate = float(career.get('growth_rate', 1.0))
    market_value = int(career.get('market_value', 50000))
    salary = int(career.get('salary', 1000))

    return f'''  {{
    id: {player_id},
    name: "{name}",
    nameRomaji: "{name_romaji}",
    gender: "Masculino",
    position: "{pos}",
    positionAlt: {pos_alt},
    element: "{elem}",
    stats: {{
      POT: {int(s["POT"])}, CON: {int(s["CON"])},
      TEC: {int(s["TEC"])}, PRE: {int(s["PRE"])},
      FIS: {int(s["FIS"])}, AGI: {int(s["AGI"])},
      INT: {int(s["INT"])}, TOT: {media(s)}
    }},
    career: {{
      maxLevel: {max_level},
      potential: {potential},
      growthRate: {growth_rate},
      contractStatus: "free",
      marketValue: {market_value},
      salary: {salary},
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

    catalog = SUPERTECHNIQUES_TS.read_text(encoding='utf-8')
    catalog_entries = []
    for player in new_players:
        for technique in player.get('supertechniques', []):
            if technique.get('type', '') not in VALID_TYPES:
                continue
            key = f'{int(technique.get("id", 0))}:{technique.get("name", "")}'
            if json.dumps(key, ensure_ascii=False) not in catalog:
                catalog_entries.append(format_catalog_entry(technique))
    if catalog_entries:
        marker = '\n}\n\nexport function'
        catalog = catalog.replace(marker, '\n' + '\n'.join(catalog_entries) + marker, 1)
        SUPERTECHNIQUES_TS.write_text(catalog, encoding='utf-8')
    print(f'Done. Added {len(new_players)} free agents to src/data/players.ts')


if __name__ == '__main__':
    main()
