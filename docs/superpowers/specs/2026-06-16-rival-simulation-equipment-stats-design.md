# Spec: Simulación de rivales y stats de equipamiento

Fecha: 2026-06-16

---

## Problema 1: Partidos rivales en la liga del usuario no se simulan

### Situación actual

`career.season.matches` contiene **todos** los partidos de la liga del usuario, incluyendo los NPC vs NPC. Cuando el usuario avanza un día, `simulateExternalForDate` solo simula ligas externas (`allLeagueSeasons`) y partidos NPC de copa. Los partidos NPC vs NPC de la propia liga quedan sin jugarse indefinidamente.

### Comportamiento esperado

Al avanzar un día, todos los partidos de esa fecha deben resolverse:
- Partidos del usuario: solo si el usuario los ha jugado o simulado manualmente.
- Partidos NPC vs NPC de la liga del usuario: se simulan automáticamente.
- Partidos de ligas externas: ya se simulan (no cambia).
- Partidos NPC de copa: ya se simulan (no cambia).

### Diseño

#### Nueva función pura en `careerStore.ts`

```ts
function simulateSeasonNpcMatchesForDate(
  season: Career['season'],
  date: string,
  userTeamId: number,
  teams: Team[],
  players: Player[],
): Career['season']
```

Lógica:
1. Filtra `season.matches` por `m.date === date && !m.played && m.homeTeamId !== userTeamId && m.awayTeamId !== userTeamId`.
2. Para cada partido, llama a `simulateLeagueMatchFn` (ya existe).
3. Actualiza `season.standings` con `updateStandings` tras cada resultado.
4. Devuelve la temporada actualizada (matches + standings).
5. Si no hay partidos que simular, devuelve `season` sin cambios.

#### Refactor del avance de día

Extraer una función pura `applyOneDay(career, players, teams): { career: Career; players: Player[] }` que encapsule toda la lógica de avance de un día:

1. Calcula `nextDate = addDaysStr(career.season.currentDate, 1)`.
2. Simula NPC vs NPC en la liga del usuario con `simulateSeasonNpcMatchesForDate`.
3. Simula ligas externas y copa NPC con `simulateExternalForDate` (sin cambios).
4. Avanza la fecha de la temporada con `advanceDayService`.
5. Recupera stamina con `recoverStaminaForDays(..., 1, ...)`.
6. Avanza planes de cambio de posición con `advancePositionChange(..., 1)`.
7. Actualiza `seasonStatus` con `computeSeasonStatus`.
8. Devuelve `{ career, players }` actualizados.

#### `advanceDay()` en el store

Pasa a ser:
1. Comprueba que no hay partido pendiente del usuario hoy.
2. Llama a `applyOneDay(career, players, teams)`.
3. Hace `set()` con el resultado.

#### `advanceToNextMatch()` en el store

Pasa a ser un bucle que usa `applyOneDay` en lugar de tener lógica de simulación propia:

```
while current day has no user match AND season not finished:
  applyOneDay()
  if next day has a user match → stop
```

Concretamente:
1. Encuentra el próximo partido del usuario (liga o copa), el que sea anterior.
2. Si ya está en ese día o no hay partido, sale.
3. En bucle: llama a `applyOneDay` y comprueba si el nuevo `currentDate` ya tiene partido del usuario.
4. Actualiza el store con el estado final.

**Invariante de seguridad:** Si `currentDate` ya tiene un partido del usuario sin jugar, `advanceToNextMatch` no avanza nada (mismo comportamiento que `advanceDay`).

#### Prevención de doble simulación

Un partido solo se simula si `!m.played`. Como `simulateSeasonNpcMatchesForDate` solo actúa sobre `!m.played`, no hay riesgo de doble simulación. Los partidos del usuario quedan con `played = false` hasta que el usuario los juegue manualmente.

---

## Problema 2: Equipamiento no modifica stats visibles

### Situación actual

`player.stats` contiene stats base (nunca se modifican por equipamiento). `getEffectiveStats(player)` en `equipmentService.ts` ya calcula stats base + bonus de equipamiento correctamente y es usada por `formationService.ts` para la simulación de partidos.

El problema es que el UI usa `player.stats` directamente:
- `PlayerDetailScreen.tsx`: `StatBar` con `player.stats[stat]`, total/media con `getPlayerStatsSummary(player)`.
- `PlayerRow.tsx`: total/media con `getPlayerStatsSummary(player)` (usado en Plantilla).
- `FormationScreen.tsx`: importa `getPlayerStatsSummary` (usado en Formación).

### Comportamiento esperado

- Las stats mostradas deben ser stats efectivas (base + bonus de equipamiento).
- En `PlayerDetailScreen`, cada stat debe mostrar `+X` en verde si el equipamiento añade bonus.
- Total y media deben calcularse sobre stats efectivas.
- Si no hay equipamiento, el comportamiento es idéntico al actual.
- Los stats base del jugador no se modifican nunca.

### Diseño

#### Nueva función helper en `equipmentService.ts`

```ts
export function getEffectiveStatsSummary(player: Player): { total: number; media: number }
```

Usa `getEffectiveStats(player)` para calcular `total` y `media` (igual que `getPlayerStatsSummary` pero con stats efectivas).

#### `PlayerDetailScreen.tsx`

1. Importar `getEffectiveStats` y `getEffectiveStatsSummary` desde `equipmentService`.
2. Calcular `effectiveStats = getEffectiveStats(player)` una vez al inicio del render.
3. Sustituir `getPlayerStatsSummary(player)` por `getEffectiveStatsSummary(player)` para `total` y `media`.
4. En el bloque de stats, para cada `stat`:
   - Pasar `effectiveStats[stat]` al `StatBar` en lugar de `player.stats[stat]`.
   - Calcular `bonus = effectiveStats[stat] - player.stats[stat]`.
   - Si `bonus > 0`, mostrar `+${bonus}` en verde junto al valor (inline, sin romper el layout de `StatBar`).

Formato de display propuesto:
```
TEC  [████████░░]  84 +5
FIS  [██████░░░░]  115 +3
```

El `+X` se renderiza como texto pequeño en verde a la derecha del valor numérico. Para no romper el layout, se añade un prop opcional `bonus?: number` al componente `StatBar` que renderiza el `+X` a continuación del valor existente. El `StatBar` solo lo muestra si `bonus > 0`.

#### `PlayerRow.tsx`

1. Importar `getEffectiveStatsSummary` desde `equipmentService`.
2. Sustituir `getPlayerStatsSummary(player)` por `getEffectiveStatsSummary(player)`.
3. Sin cambios visuales adicionales (no se muestra `+X` en la fila de plantilla).

#### `FormationScreen.tsx`

1. Importar `getEffectiveStatsSummary` desde `equipmentService`.
2. Sustituir `getPlayerStatsSummary` por `getEffectiveStatsSummary` donde se use para mostrar media/total.
3. Sin cambios visuales adicionales.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/store/careerStore.ts` | Nueva `simulateSeasonNpcMatchesForDate`, `applyOneDay`; refactor `advanceDay` y `advanceToNextMatch` |
| `src/services/equipmentService.ts` | Nueva `getEffectiveStatsSummary` |
| `src/components/StatBar.tsx` | Prop opcional `bonus?: number` para mostrar `+X` |
| `src/screens/PlayerDetailScreen.tsx` | Usar stats efectivas y pasar `bonus` a `StatBar` |
| `src/components/PlayerRow.tsx` | Usar `getEffectiveStatsSummary` |
| `src/screens/FormationScreen.tsx` | Usar `getEffectiveStatsSummary` |

---

## Lo que no cambia

- La estructura de datos de `player.stats` (nunca se modifica permanentemente).
- La lógica de `getEffectiveStats` (ya correcta).
- La simulación de partidos (ya usa stats efectivas vía `formationService`).
- El modelo de `career.season.matches` y `career.allLeagueSeasons`.
- El estilo visual existente (solo se añade el `+X` en verde en `PlayerDetailScreen`).
