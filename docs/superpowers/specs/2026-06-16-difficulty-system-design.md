# Sistema de Dificultad — Diseño

**Fecha:** 2026-06-16  
**Estado:** Aprobado

---

## Objetivo

Añadir un paso de selección de dificultad al final del flujo de creación de carrera. El jugador elige entre tres modos estándar (Fácil, Normal, Difícil) o un modo Custom que permite configurar manualmente todos los parámetros.

---

## Parámetros configurables

Se identificaron los siguientes parámetros hardcodeados en servicios que actualmente no tienen estructura para ser configurables por carrera:

| Parámetro | Servicio origen | Valor normal |
|---|---|---|
| `aiStrengthMultiplier` | matchSimulator (nuevo) | 1.0 |
| `staminaRecoveryPerDay` | energyService (default param) | 7 |
| `starterStaminaDrain` | energyService (constante) | 25 |
| `benchStaminaDrain` | energyService (constante) | 8 |
| `trainingGainMultiplier` | weeklyTrainingService + trainingService (nuevo) | 1.0 |
| `seasonGrowthMultiplier` | growthService (nuevo) | 1.0 |
| `positionChangeDaysMultiplier` | positionChangeService (nuevo) | 1.0 |
| `transferCostMultiplier` | transferService (nuevo) | 1.0 |
| `budgetMultiplier` | careerService (nuevo) | 1.0 |
| `scoutCostMultiplier` | potentialService (nuevo) | 1.0 |
| `rewardChoices` | career.rewardChoices (ya existe, siempre hardcodeado a 3) | 2 |

---

## Tipo `DifficultySettings`

```typescript
export interface DifficultySettings {
  // ── Partidos ──────────────────────────────────────────────────────────────
  aiStrengthMultiplier: number         // 0.7–1.3   | escala la fuerza de equipos NPC
  // ── Energía ───────────────────────────────────────────────────────────────
  staminaRecoveryPerDay: number        // 3–15 pts  | stamina recuperada por día
  starterStaminaDrain: number          // 15–35 pts | stamina perdida por partido (titular)
  benchStaminaDrain: number            // 4–15 pts  | stamina perdida por partido (banquillo)
  // ── Entrenamiento ─────────────────────────────────────────────────────────
  trainingGainMultiplier: number       // 0.5–2.0x  | plan semanal Y entrenamiento manual
  // ── Crecimiento ───────────────────────────────────────────────────────────
  seasonGrowthMultiplier: number       // 0.5–2.0x  | crecimiento al fin de temporada
  positionChangeDaysMultiplier: number // 0.5–2.0x  | duración del cambio de posición
  // ── Finanzas ──────────────────────────────────────────────────────────────
  transferCostMultiplier: number       // 0.5–2.0x  | precio de fichajes
  budgetMultiplier: number             // 0.5–2.0x  | presupuesto inicial del equipo
  // ── Ojeadores ─────────────────────────────────────────────────────────────
  scoutCostMultiplier: number          // 0.5–2.0x  | coste de análisis de potencial
  // ── Recompensas ───────────────────────────────────────────────────────────
  rewardChoices: 1 | 2 | 3            // opciones de recompensa por partido
}
```

---

## Presets

| Parámetro | Fácil | Normal | Difícil |
|---|---|---|---|
| `aiStrengthMultiplier` | 0.85 | 1.0 | 1.2 |
| `staminaRecoveryPerDay` | 10 | 7 | 5 |
| `starterStaminaDrain` | 20 | 25 | 30 |
| `benchStaminaDrain` | 6 | 8 | 10 |
| `trainingGainMultiplier` | 1.4 | 1.0 | 0.75 |
| `seasonGrowthMultiplier` | 1.25 | 1.0 | 0.8 |
| `positionChangeDaysMultiplier` | 0.75 | 1.0 | 1.5 |
| `transferCostMultiplier` | 0.8 | 1.0 | 1.25 |
| `budgetMultiplier` | 1.25 | 1.0 | 0.8 |
| `scoutCostMultiplier` | 0.75 | 1.0 | 1.5 |
| `rewardChoices` | 3 | 2 | 1 |

---

## Cambios de tipos

### `src/types/career.ts`
- Añadir `DifficultySettings` interface.
- Añadir `difficulty: DifficultySettings` a `Career`.
- **Eliminar** el campo suelto `rewardChoices: 1 | 2 | 3` de `Career` (queda absorbido dentro de `difficulty`).

---

## Cambios de servicios

Cada servicio recibe `DifficultySettings` como parámetro adicional donde sea necesario. No se añade estado global; las settings viajan desde `career.difficulty`.

### `energyService.ts`
- `drainStaminaAfterMatch` acepta `settings: DifficultySettings` y usa `settings.starterStaminaDrain` / `settings.benchStaminaDrain` en lugar de las constantes.
- `recoverStaminaForDays` ya acepta `recoveryPerDay`; el store pasa `career.difficulty.staminaRecoveryPerDay`.

### `weeklyTrainingService.ts`
- `executeWeeklyPlan` acepta `settings: DifficultySettings`.
- El `STAT_GAIN_PER_WEEK` se multiplica por `settings.trainingGainMultiplier` (redondeado a mínimo 1).

### `trainingService.ts`
- `trainPlayer` acepta `settings: DifficultySettings`.
- La ganancia de stat (+1) se convierte en `Math.max(1, Math.round(1 * settings.trainingGainMultiplier))`.

### `growthService.ts`
- `applySeasonGrowth` acepta `settings: DifficultySettings`.
- El `boosted` final se multiplica por `settings.seasonGrowthMultiplier`.

### `positionChangeService.ts`
- `calcPositionChangeDays` acepta `settings: DifficultySettings`.
- El resultado final se multiplica por `settings.positionChangeDaysMultiplier` antes del clamp.

### `transferService.ts`
- `calcTransferValue` **no cambia su firma**. El multiplicador se aplica en el call site (store / UI) al calcular el precio de compra que el usuario paga.
- El precio de venta cuando el usuario vende un jugador **no se multiplica** — el AI paga el valor real. Solo el precio de compra del usuario se escala.
- `generateAIOffers` tampoco cambia; las ofertas IA siguen siendo al valor real.

### `potentialService.ts`
- `calcAnalysisCost` acepta `settings: DifficultySettings`.
- El coste final se multiplica por `settings.scoutCostMultiplier`.

### `careerService.ts`
- `createCareer` acepta `settings: DifficultySettings`.
- Aplica `budgetMultiplier` al `team.budget` al copiar el equipo.
- Usa `settings.rewardChoices` en lugar del valor hardcodeado 3.
- Guarda `settings` en `career.difficulty`.

### `matchSimulator.ts` / store `buildNpcSnapshot`
- En el store, al construir snapshots NPC, se multiplican los scores por `career.difficulty.aiStrengthMultiplier`.
- No se modifica la firma de `simulate()`; el multiplicador se aplica antes de pasarle el snapshot.

---

## Cambios en el store (`careerStore.ts`)

- `startNewCareer(managerName, teamId, managerAvatar, difficulty)` — añade parámetro `difficulty`.
- Pasar `career.difficulty` a todos los servicios afectados en los action handlers.
- En `advanceDay` / `simulateMatch` / `executeWeeklyPlan` etc., leer `career.difficulty` del estado.

---

## Cambios de UI

### `NewCareerScreen.tsx`

El flujo pasa de 3 pasos a 4:

```
0: Entrenador  →  1: Equipo  →  2: Dificultad  →  3: Confirmar
```

El tipo `Step` pasa de `0 | 1 | 2` a `0 | 1 | 2 | 3`.  
`STEPS` array: `['Entrenador', 'Equipo', 'Dificultad', 'Confirmar']`.

#### Paso 2 — Dificultad

Muestra 4 tarjetas seleccionables:

- **Fácil** — descripción breve de qué hace más fácil
- **Normal** — modo balanceado
- **Difícil** — descripción breve de qué hace más difícil
- **Custom** — "Configura cada parámetro manualmente"

Al seleccionar Fácil/Normal/Difícil, se aplica el preset correspondiente al estado local `difficulty`.

Al seleccionar **Custom**, aparece debajo un panel de configuración con los 11 parámetros:
- `aiStrengthMultiplier`, `transferCostMultiplier`, `budgetMultiplier`, `seasonGrowthMultiplier`, `positionChangeDaysMultiplier`, `scoutCostMultiplier` → **slider** con paso 0.05, rango mostrado como "×0.70 — ×1.30" etc.
- `staminaRecoveryPerDay`, `starterStaminaDrain`, `benchStaminaDrain` → **stepper numérico** con botones +/−
- `trainingGainMultiplier` → **slider**
- `rewardChoices` → **selector 1 / 2 / 3**

#### Paso 3 — Confirmar

Añade una sección resumen de dificultad (nombre del preset o "Custom" con los valores que difieren de Normal).

### Helper `DIFFICULTY_PRESETS`

Constante exportada (no dentro del componente) con los tres presets y las settings de Normal como base para Custom:

```typescript
export const DIFFICULTY_PRESETS = {
  easy:   { ... },
  normal: { ... },
  hard:   { ... },
}
export const DEFAULT_DIFFICULTY = DIFFICULTY_PRESETS.normal
```

---

## Compatibilidad de guardados existentes

`Career.rewardChoices` se elimina. Los saves existentes no tienen `difficulty`. Al cargar un save antiguo en `saveService.ts`, se detecta la ausencia de `career.difficulty` y se inyecta `DEFAULT_DIFFICULTY` como fallback. El campo `rewardChoices` suelto se ignora.

---

## Lo que NO cambia

- Lógica interna de simulación de partidos (fórmulas, tácticas).
- Curvas de crecimiento por edad y afinidad de jugadores.
- Sistema de objetivos — los objetivos no se escalan por dificultad.
- Frecuencia de ofertas AI (0.05) — demasiado granular, queda fuera.
- Ventaja local (`homeBonus = 0.65`) — parámetro de realismo, no de dificultad.
