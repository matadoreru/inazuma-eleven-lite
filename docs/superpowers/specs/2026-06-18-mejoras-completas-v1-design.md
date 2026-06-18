# Diseño: Mejoras completas v1 — Inazuma Eleven Lite

**Fecha:** 2026-06-18  
**Prioridad de implementación:** en orden (área 6 primero por ser bloqueante)

---

## Área 6 — Arreglo del avance de temporada (bloqueante)

### Diagnóstico
Dos causas confirmadas en código:

1. `advanceDay` en `careerStore.ts` bloquea si hay un partido de copa en `career.season.currentDate`, aunque `career.season.finished === true`. El usuario queda atascado si la liga acaba el mismo día que tiene una copa pendiente.
2. `computeSeasonStatus` requiere que **todas** las ligas externas tengan `finished: true` para pasar a `'all_finished'`. Si el usuario deja de avanzar días, nunca llega a poder cerrar la temporada.

### Cambios

**`careerStore.ts` — `advanceDay`:**
- Eliminar el bloqueo por copa (`todayCupMatchIsToday`) cuando `career.season.finished === true`. Si la liga ya terminó, el usuario puede avanzar días libremente aunque tenga copa pendiente (puede ir a jugarla desde la pantalla de copa cuando quiera).
- Mantener el bloqueo de copa solo cuando `career.season.finished === false`.

**`careerStore.ts` — nuevo helper `simulateAllRemainingAndClose`:**
- Función que itera día a día desde `currentDate` hasta que `computeSeasonStatus` devuelva `'all_finished'` (máx 200 iteraciones para evitar loop infinito).
- En cada iteración: simula NPC league + NPC cup, avanza día.
- Al terminar llama `closeSeason()` automáticamente.

**`CareerHomeScreen.tsx` — `UserFinishedBanner`:**
- Añadir botón "Simular todo y cerrar temporada" que llama a `simulateAllRemainingAndClose`.
- Mantener botones "+1 día" y "Siguiente evento" actuales.

**Tipos afectados:** ninguno nuevo.  
**Saves existentes:** compatibles (no añade nuevos campos).

---

## Área 1 — Notificaciones navegables

### Cambios

**`src/types/career.ts` — `InboxEvent`:**
```ts
export interface InboxEvent {
  // campos existentes...
  targetScreen?: Screen          // pantalla destino si es navegable
  targetEntityId?: string        // playerId, matchId, etc.
}
```

**`src/services/inboxService.ts` — `addEvent`:**
- Añadir parámetros opcionales `targetScreen` y `targetEntityId`.
- Pasarlos al InboxEvent creado.

**`careerStore.ts` — todos los `addEvent` call-sites** con evento navegable reciben sus targets:
- `TRANSFER_OFFER` → `targetScreen: 'transfers'`
- `OUTGOING_TRANSFER_*` → `targetScreen: 'transfers'`
- `PLAYER_INJURED` → `targetScreen: 'squad'`, `targetEntityId: playerId.toString()`
- `OBJECTIVE_COMPLETE` → `targetScreen: 'career_home'`
- `MATCH_RESULT` → `targetScreen: 'match'`, `targetEntityId: matchId`

**`NotificationsDrawer.tsx` — `NotificationItem`:**
- Recibe `navigate` y `setUIPanel` como props.
- Si `event.targetScreen` existe: al hacer click navega, cierra el drawer, marca leído.
- Si no: solo marca leído al hacer click.
- Visual: añadir `<Icon name="chevron_right" />` al final de la fila para eventos navegables.

---

## Área 3 — Agentes libres más razonables

### Cambios

**`src/services/transferService.ts` — `evaluatePlayerDecision` (rama `isFreeAgent`):**

Nuevos umbrales (reemplaza los actuales):
```
ratio ≥ 0.80 → pAccept 0.92, pCounter 0.06
ratio ≥ 0.65 → pAccept 0.65, pCounter 0.25
ratio ≥ 0.50 → pAccept 0.25, pCounter 0.50
ratio <  0.50 → pAccept 0.05, pCounter 0.25
```

`repBonus` cambia de ±0.10 a ±0.15:
```ts
const repBonus = Math.max(-0.15, Math.min(0.15, (buyingTeam.reputation - 50) / 100))
```

Añadir bonus de "club nuevo/desconocido": si `buyingTeam.reputation < 20`, aplicar +0.05 adicional a `pAccept` (jugadores libres ven oportunidad en clubs emergentes).

**UI — `TransferPlayerRow.tsx` / `ScoutScreen`:**
- Para jugadores libres (`teamId === null || teamId === 0`): mostrar badge "LIBRE" y valor de oferta recomendada = `Math.round(calcTransferValue(player) * 0.75)` en texto secundario.

---

## Área 5 — Ofertas recibidas + contraofertas

### Nuevos tipos

**`src/types/career.ts`:**
```ts
export interface IncomingOffer {
  id: string
  fromTeamId: number
  fromTeamName: string
  playerId: number
  amount: number
  date: string
  status: 'pending' | 'accepted' | 'rejected' | 'player_rejected' | 'counter_sent' | 'counter_accepted' | 'counter_rejected'
  counterAmount?: number
  counterDate?: string    // fecha límite de respuesta de la IA
}
```

Añadir a `Career`:
```ts
incomingOffers: IncomingOffer[]
```

### Cambios de lógica

**`transferService.ts`:**
- `generateAIOffers` devuelve `IncomingOffer[]` además de / en lugar de `TransferOffer[]`. Mantener compatibilidad con `TransferOffer` para historial.
- Nueva función `respondToIncomingOffer(offerId, action: 'accept'|'reject'|'counter', career, players, teams, counterAmount?)`:
  - `accept`: ejecuta `sellPlayer`, marca `status: 'accepted'`, genera InboxEvent confirmación.
  - `reject`: marca `status: 'rejected'`, genera InboxEvent.
  - `counter`: valida `counterAmount ≤ MAX_TRANSFER_VALUE`, calcula si la IA acepta según `(counterAmount / marketValue)`. Si el counter es ≤ 130% del valor de mercado, la IA tiene 70% de aceptar. Genera InboxEvent de resolución con 1-2 días de delay.
- Nueva función `resolveIncomingCounters(career, currentDate, players, teams)`: procesa counters pendientes en `counterDate`.
- `sellPlayer` mejorado: antes de ejecutar, verifica `buyingTeam.budget >= amount`. Si no, devuelve un error descriptivo en lugar de `{ career, teams, players }` silencioso.

**`careerStore.ts`:**
- `acceptTransferOffer` → delega a `respondToIncomingOffer(..., 'accept')`
- `rejectTransferOffer` → delega a `respondToIncomingOffer(..., 'reject')`
- Nueva acción `counterIncomingOffer(offerId, counterAmount)`
- `advanceDay` llama `resolveIncomingCounters` junto con `resolveNegotiations`
- `loadCareer` normaliza `incomingOffers: data.career.incomingOffers ?? []`

### UI

**`TransfersScreen.tsx`:**
- Nueva pestaña "Ofertas" (junto a la tabla de jugadores disponibles).
- Por cada oferta pendiente: tarjeta con sprite del jugador, nombre, posición, media, edad, valor de mercado, oferta recibida + indicador visual (verde si > valor, rojo si < valor, amarillo si similar).
- Botones: **Aceptar** / **Rechazar** / **Contraofertar** (abre input de precio).
- Validación en Contraofertar: alerta si el precio supera `MAX_TRANSFER_VALUE` o es < oferta recibida.

---

## Área 4 — Copa: prórroga, penaltis y añadido

### Cambios de tipos

**`src/types/competition.ts` — `MatchResult`:**
```ts
extraTime?: { homeGoals: number; awayGoals: number }
penalties?: { homeScore: number; awayScore: number; winnerId: number }
stoppageTime?: { firstHalf: number; secondHalf: number; etFirst?: number; etSecond?: number }
```

**`src/types/competition.ts` — `MatchEvent.type`:**
Añadir `'STOPPAGE' | 'ET_START' | 'ET_END' | 'PENALTY_SHOOTOUT' | 'TECHNIQUE'`.

### Cambios de lógica

**`matchSimulator.ts`:**
- Nueva función `calcStoppageTime(events: MatchEvent[], baseMinutes: number): number`:
  ```
  injuries × 1.5 + goals × 0.5 + yellows × 0.3 + reds × 1.0 → redondeado, mínimo 1, máximo 7
  ```
- En `simulate`, los eventos de cada mitad se generan hasta `minute + stoppage`. Añadir evento `STOPPAGE` al inicio del añadido.
- Nueva función exportada `simulateCupTiebreak(homeSnap, awaySnap, match, nameStyle)`:
  - Llama `simulate` normal → si empate:
    - Llama `simulateExtraTime` (2 mitades de 15 min, probabilidad de gol al 60% de la normal)
    - Si sigue empate: llama `simulatePenalties`
  - Devuelve `MatchResult` con campos `extraTime` y/o `penalties` rellenos

**`cupService.ts`:**
- `simulateCupMatch` usa `simulateCupTiebreak` en lugar de `simulate`.
- `getMatchWinner` lee `result.penalties?.winnerId` si existe, luego ET, luego goles normales.
- `getMatchWinner` nunca devuelve un ganador por defecto (devuelve null si no hay resultado).

**`careerStore.ts` — `simulateCupMatch` y `startLiveCupMatch`:**
- Usan `simulateCupTiebreak` en lugar de `simulate`.

### UI

**`MatchResultCard.tsx` / `LiveMatchScreen.tsx`:**
- Si `result.extraTime`: mostrar sección "Prórroga" con marcador ET.
- Si `result.penalties`: mostrar sección "Penaltis" con `homeScore - awayScore` y "Ganador por penaltis".
- Si `result.stoppageTime`: mostrar "90+X'" o "45+X'" en eventos del partido.

---

## Área 2 — Simulación con supertécnicas

### Cambios de tipos

**`src/types/competition.ts` — `MatchEvent`:**
```ts
techniqueName?: string
techniqueOutcome?: 'success' | 'fail'
techniqueElement?: Element
```

### Cambios de lógica

**`matchSimulator.ts`:**

Nueva función `pickPlayerTechnique(player, type: Technique['type']): Technique | null`:
- Devuelve la técnica de mayor POT del tipo requerido si existe.

Nueva función `elementMatchup(atkElement: Element, defElement: Element): number`:
- Tabla rock-paper-scissors: FIRE>WOOD>WIND>MOUNTAIN>FIRE
- Ventaja: +0.05, Desventaja: -0.05, Neutro: 0

En `simulateHalf`, en cada oportunidad de disparo:
- Si `onTarget`:
  - Buscar técnica de Tiro del atacante (`pickPlayerTechnique(scorer, 'Tiro')`)
  - Buscar técnica de Parada del portero (`pickPlayerTechnique(gk, 'Parada')`)
  - Si el atacante tiene técnica: `bonus = tech.POT / 800`. Generar evento `TECHNIQUE` con `techniqueOutcome: Math.random() < (goalProb + bonus) ? 'success' : 'fail'`
  - Si el portero tiene técnica: `penalty = gkTech.POT / 900`
  - Aplicar matchup elemental entre técnica atacante y técnica portero (si ambas existen y tienen elemento)
  - La `goalProb` final = `clamp(baseGoalProb + bonus - penalty + elementBonus, 0.06, 0.75)`
- Si no `onTarget` y el shooter tiene Regate: +3% a la probabilidad de que el próximo intento sea `onTarget`

En la generación de chances (`baseChances`):
- Si el centrocampista titular con más TEC tiene una técnica de Regate: `+0.3` a `baseChances`

Generación de evento TECHNIQUE:
```ts
events.push(mkEvent(minute, 'TECHNIQUE', ..., {
  techniqueName: tech.name,
  techniqueOutcome: ...,
  techniqueElement: tech.element || undefined,
}))
```

### UI

**`LiveMatchScreen.tsx` / `InboxEventCard.tsx`:**
- Evento `TECHNIQUE`: mostrar badge dorado con nombre de la técnica, icono de rayo, resultado en color (verde=éxito, rojo=fallo).

---

## Área 7 — Objetivos de temporada escalados + popup de dificultad

### Nuevos tipos

**`src/types/career.ts`:**
```ts
export type ObjectiveGroupType = 'season_end' | 'continuous' | 'match'
// Añadir campo a Objective:
groupType?: ObjectiveGroupType
```

```ts
export type ObjectiveDifficultyPreset = 'easy' | 'normal' | 'hard' | 'very_hard'
// Añadir a Career:
objectiveDifficulty?: ObjectiveDifficultyPreset
```

### Cambios de lógica

**`careerService.ts` — `buildObjectives`:**
- Recibe `objectiveDifficulty: ObjectiveDifficultyPreset` (default `'normal'`).
- Multiplicadores de targets por dificultad: `{ easy: 0.65, normal: 1.0, hard: 1.35, very_hard: 1.7 }`
- `SCORE_GOALS` target: `Math.ceil(league.rounds * goalsPerMatchByTier * multiplier)`
  - Tier 1: `goalsPerMatchByTier = 2.0`, tier 2: `1.6`, tier 3+: `1.2`
- `EARN_POINTS` target: `Math.ceil(league.rounds * winsExpected * 3 * pointsMultiplier)`
  - `winsExpected` por tier: tier 1 = 0.60, tier 2 = 0.45, tier 3+ = 0.35
- `WIN_MATCHES` target: `Math.ceil(league.rounds * winsExpected * multiplier)`
- Objetivos TOP_N, WIN_LEAGUE, AVOID_RELEGATION mantienen lógica existente pero se etiquetan con `groupType: 'season_end'`
- `SCORE_GOALS`, `EARN_POINTS`, `WIN_MATCHES` → `groupType: 'continuous'`
- Validación: ningún target puede superar `league.rounds * maxReasonableFactor` (evita imposibles matemáticos)

**`careerStore.ts` — `startNewSeason`:**
- Antes de generar objetivos, leer `career.objectiveDifficulty ?? 'normal'`
- Pasar al `getObjectivesForTeam`

**`SeasonReviewScreen.tsx` / `CareerHomeScreen.tsx`:**
- Al iniciar nueva temporada (después de `closeSeason`), mostrar `ObjectiveDifficultyModal` antes de llamar `startNewSeason`.
- Modal muestra 4 opciones con descripción e impacto estimado en recompensas.
- Al seleccionar, guarda en store y llama `startNewSeason(chosenDifficulty)`.

**`ObjectivesPanel.tsx`:**
- Separar objetivos en tres secciones: "Fin de temporada", "Continuos", "De partido".
- Los de `season_end` muestran chip "Solo al final de temporada".
- Los `continuous` muestran progreso en tiempo real con barra.

---

## Área 8 — Popup de recompensas: equipar o guardar

### Nuevos componentes

**`src/components/RewardEquipModal.tsx`:**
Modal que se muestra cuando `pendingRewards` contiene tipo `equipment` o `technique_book` y el usuario hace click en reclamar.

Flujo para `equipment`:
1. Muestra el item con sus stats.
2. Opción A: "Guardar en inventario" → comportamiento actual.
3. Opción B: "Equipar ahora" → lista de jugadores de la plantilla con slot relevante.
   - Para cada jugador: mostrar item actual en ese slot (si existe) con comparativa de stats (delta en verde/rojo).
   - Al confirmar un jugador: `equipItem(playerId, itemId)`. El item reemplazado vuelve al inventario automáticamente (ya lo gestiona `equipmentService`).

Flujo para `technique_book`:
1. Muestra la técnica con sus stats (POT, PP, tipo, elemento).
2. Opción A: "Guardar en inventario".
3. Opción B: "Enseñar ahora" → lista de jugadores con sus huecos de técnica (3 normales + 2 mejora).
   - Para cada jugador: mostrar huecos vacíos y ocupados.
   - Si hay hueco libre: añadir directamente.
   - Si no: mostrar técnica a reemplazar con advertencia. Al confirmar, la técnica reemplazada vuelve al inventario.
   - Usar `teachTechnique(playerId, bookId, replaceIndex?)` del store.

**`careerStore.ts` — `claimReward`:**
- Para `money` y `stat_boost`: comportamiento actual sin cambios (aplica y cierra `pendingRewards`).
- Para `equipment` y `technique_book`: NO aplica la recompensa ni cierra `pendingRewards`. En su lugar setea `rewardBeingEquipped: reward`. El modal `RewardEquipModal` se encarga de la lógica final y de cerrar tanto `rewardBeingEquipped` como `pendingRewards`.
- Nuevo campo en el store (no en Career): `rewardBeingEquipped: MatchReward | null` — estado efímero de UI, no se persiste en save.

---

## Área 9 — Validaciones de integridad transversales

Cambios distribuidos en varios archivos:

**`transferService.ts` — `sellPlayer`:**
- Antes de ejecutar: `if (player.teamId !== career.teamId) return { career, teams, players }` — evita vender a jugadores que no son del equipo.
- Si `buyingTeam.budget < amount`: devolver resultado con flag `error: 'insufficient_budget'` (cambio de signature mínimo o via InboxEvent).

**`transferService.ts` — `respondToIncomingOffer` accept:**
- Verificar `buyingTeam.budget >= amount` antes de ejecutar la venta. Si no: marcar `status: 'player_rejected'` y generar event "El club comprador ya no tiene presupuesto".

**`careerStore.ts` — `claimObjective`:**
- Añadir guard: `if (obj.claimed) return` antes de aplicar la recompensa.

**`careerStore.ts` — `startNewSeason`:**
- Limpiar `incomingOffers` con `status !== 'pending'` (no dejar ofertas viejas resueltas acumuladas).
- Limpiar negociaciones outgoing con `phase === 'failed' | 'cancelled' | 'completed'`.

**`cupService.ts` — `advanceCupRound`:**
- Tras determinar el ganador, verificar que `winnerId !== null` antes de asignarlo. Log de warning si es null (indica bug upstream).

**`careerStore.ts` — `loadCareer`:**
- Normalizar `incomingOffers: data.career.incomingOffers ?? []`
- Normalizar `objectiveDifficulty: data.career.objectiveDifficulty ?? 'normal'`

---

## Orden de implementación

1. Área 6 — Season end fix (bloqueante)
2. Área 1 — Notificaciones navegables
3. Área 3 — Free agents
4. Área 5 — Incoming offers + counteroffers
5. Área 4 — Copa extra time + penalties + stoppage
6. Área 2 — Técnicas en simulación
7. Área 7 — Objetivos escalados + popup dificultad
8. Área 8 — Reward equip modal
9. Área 9 — Validaciones transversales (intercaladas con las anteriores)

---

## Archivos principales afectados

| Archivo | Áreas |
|---|---|
| `src/types/career.ts` | 1, 5, 7, 8, 9 |
| `src/types/competition.ts` | 2, 4 |
| `src/services/matchSimulator.ts` | 2, 4 |
| `src/services/transferService.ts` | 3, 5, 9 |
| `src/services/cupService.ts` | 4, 9 |
| `src/services/careerService.ts` | 7 |
| `src/services/inboxService.ts` | 1 |
| `src/store/careerStore.ts` | 1, 3, 4, 5, 6, 7, 8, 9 |
| `src/components/NotificationsDrawer.tsx` | 1 |
| `src/screens/TransfersScreen.tsx` | 5 |
| `src/screens/CareerHomeScreen.tsx` | 6, 7 |
| `src/screens/SeasonReviewScreen.tsx` | 7 |
| `src/components/ObjectivesPanel.tsx` | 7 |
| `src/screens/LiveMatchScreen.tsx` | 2, 4 |
| `src/components/MatchResultCard.tsx` | 4 |
| `src/components/RewardEquipModal.tsx` | 8 (nuevo) |

## Notas de compatibilidad con saves existentes

- Todos los nuevos campos se normalizan con `?? defaultValue` en `loadCareer` y `restoreAutoSave`.
- `InboxEvent.targetScreen` es opcional → saves existentes sin el campo no se rompen.
- `MatchResult.extraTime/penalties` son opcionales → resultados existentes no se rompen.
- `Objective.groupType` es opcional → objetivos existentes sin él siguen funcionando.
