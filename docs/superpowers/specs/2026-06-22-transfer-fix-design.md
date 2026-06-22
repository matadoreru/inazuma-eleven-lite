# Diseño: Corrección de lógica de fichajes entre clubes

**Fecha:** 2026-06-22  
**Estado:** Aprobado

---

## Problema raíz

`buildTeamSnapshot` (formationService.ts) construye el snapshot de un equipo leyendo `team.lineup`, no `team.playerIds`. Cuando se ejecuta un traspaso (`buyPlayer` / `sellPlayer`), se actualizan correctamente `player.teamId` y los `team.playerIds` de ambos clubes, pero **`team.lineup` del club vendedor no se limpia**. El jugador traspasado sigue en los once del vendedor y participa en sus simulaciones de partido.

---

## Alcance

- Corregir el bug del jugador duplicado en lineup tras un traspaso.
- Añadir lógica de búsqueda de reemplazo para clubes IA vendedores.
- Garantizar atomicidad: la operación se completa entera o no cambia nada.
- Cubrir todos los caminos de traspaso: usuario compra a IA, IA compra al usuario, usuario compra agente libre.

---

## Arquitectura

### Nueva función central: `executeTransfer`

```typescript
executeTransfer(
  playerId: number,
  buyingTeamId: number,
  amount: number,
  career: Career,
  teams: Team[],
  players: Player[],
): TransferResult
```

```typescript
type TransferResult =
  | { ok: true; career: Career; teams: Team[]; players: Player[] }
  | { ok: false; reason: TransferRejectionReason }

type TransferRejectionReason =
  | 'invalid_amount'
  | 'player_not_found'
  | 'insufficient_budget'
  | 'seller_needs_replacement'
```

#### Secuencia de pasos (todos o ninguno)

1. Validar: `amount` válido, jugador existe, `buyingTeam` tiene presupuesto.
2. Identificar `sellingTeam` (`player.teamId`).
3. Si `sellingTeam` es club IA (no el equipo del usuario):
   - `needsReplacement(sellingTeam, soldPlayer, allPlayers)` → ¿necesita?
   - Si sí → `findReplacement(...)` → busca en orden: plantilla propia → agentes libres → otros clubes IA.
   - Si no encuentra reemplazo → `{ ok: false, reason: 'seller_needs_replacement' }` sin tocar nada.
4. Ejecutar atómicamente:
   - `player.teamId = buyingTeamId`
   - `sellingTeam`: `playerIds −= player`, `budget += amount`
   - `buyingTeam`: `playerIds += player`, `budget −= amount`
   - `updateLineupAfterSale(sellingTeam, soldPlayer, replacement, allPlayers)`
   - Si el reemplazo es de mercado: firmar jugador (descontar coste del vendedor, añadir a sus `playerIds`).
   - Registrar en `career.transferHistory`.
5. Devolver `{ ok: true; career; teams; players }`.

---

## Helpers de reemplazo

### `needsReplacement`

Cuenta jugadores de **reserva** en la posición del vendido (excluyendo al propio vendido y a los titulares de esa posición):

```
reservas = jugadores del vendedor en esa posición
         − el jugador vendido
         − titulares en esa posición (isStarter: true en lineup)
```

| Posición | Mínimo de reservas | Dispara reemplazo si |
|---|---|---|
| GK | 3 | reservas < 3 |
| DF / MD / FW | 4 | reservas < 4 |

### `findReplacement`

Búsqueda en orden de preferencia (para en el primer éxito):

**1. Plantilla propia** (sin coste)
- Misma posición, no titular, no es el jugador vendido.
- Selecciona el de mayor TOT.

**2. Agentes libres** (`teamId === null || teamId === 0`)
- Misma posición.
- Coste = `calcTransferValue(player) * 0.78`.
- Coste ≤ `sellerBudget + amountReceived`.
- Selecciona el de mayor TOT dentro del presupuesto.

**3. Otros clubes IA** (instantáneo)
- Misma posición, no pertenecen al equipo del usuario.
- Coste = `calcTransferValue(player)` (valor de mercado).
- Coste ≤ presupuesto disponible.
- El club origen debe quedar con al menos 1 reserva en esa posición tras perder al jugador.
- Selecciona el de mayor TOT asequible.

Si ninguna opción tiene éxito → devuelve `null` → traspaso rechazado.

**Nota sobre presupuesto:** El dinero recibido de la venta está disponible inmediatamente para el reemplazo. El presupuesto efectivo del vendedor para buscar en el mercado es `sellerTeam.budget + amountReceived`.

---

## Gestión del lineup

### `updateLineupAfterSale`

```
1. Eliminar el slot del jugador vendido de team.lineup.
2. Si el jugador vendido ERA titular (isStarter: true):
     Buscar mejor jugador disponible en esa posición (plantilla propia o recién fichado).
     → Añadir como titular (isStarter: true, assignedPosition = posición natural del jugador).
3. Si el reemplazo proviene del mercado (no estaba previamente en el lineup):
     → Añadir como suplente (isStarter: false, assignedPosition = posición natural).
     → Aplicar paso 2 si también se necesitaba cubrir un hueco de titular.
```

---

## Callers que cambian

| Caller | Cambio |
|---|---|
| `confirmTransfer` | Reemplaza `buyPlayer(...)` por `executeTransfer(...)` |
| `respondToIncomingOffer` (accept) | Reemplaza `sellPlayer(...)` por `executeTransfer(...)` |
| Store action `buyPlayer` | Reemplaza `buyPlayerService(...)` por `executeTransfer(...)` |

`buyPlayer` y `sellPlayer` se conservan como utilidades internas (siguen siendo usados por tests existentes y como primitivas).

---

## Aplicabilidad por dirección del traspaso

| Dirección | Lógica de reemplazo | Limpieza de lineup |
|---|---|---|
| Usuario compra a club IA | Sí (club IA es vendedor) | Sí (club IA) |
| Club IA compra al usuario | No (usuario gestiona su plantilla) | Sí (equipo del usuario) |
| Agente libre → usuario | No (no hay club vendedor) | N/A |

---

## Plan de pruebas

### Integridad y atomicidad

1. Tras traspaso exitoso: jugador en exactamente un `playerIds` (sin duplicado ni pérdida).
2. Tras traspaso exitoso: jugador no aparece en `lineup` del club vendedor.
3. Cuando `seller_needs_replacement` y no hay reemplazo: ningún campo de estado cambia.
4. Con reemplazo de mercado: presupuesto del vendedor refleja ingreso de venta menos gasto de fichaje.

### `needsReplacement`

5. Devuelve `false` cuando hay reservas suficientes tras la venta.
6. Devuelve `true` para GK si reservas caen por debajo de 3.
7. Devuelve `true` para otras posiciones si reservas caen a 3 o menos.

### `findReplacement`

8. Prioriza plantilla propia antes que el mercado.
9. Devuelve `null` si no hay ningún reemplazo asequible.

### Flujos completos de `executeTransfer`

10. Sin necesidad de reemplazo: completa correctamente.
11. Con reemplazo de plantilla propia: completa sin gasto adicional.
12. Con reemplazo de agente libre: vendedor pierde el coste del agente libre.
13. Con reemplazo de otro club IA: el jugador de reemplazo cambia de equipo correctamente.
14. Rechazado si necesita reemplazo y no puede permitírselo.

### Equipo del usuario como vendedor

15. Cuando IA compra al usuario, el jugador sale del `lineup` del usuario sin bloqueo ni auto-reemplazo.
