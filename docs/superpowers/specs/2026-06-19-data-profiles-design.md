# Data Profiles — Fase 1: MVP

**Fecha:** 2026-06-19  
**Proyecto:** Inazuma Eleven Lite  
**Estado:** Aprobado por el usuario

---

## Objetivo

Añadir un sistema de perfiles de datos que permita:

1. Tener distintos conjuntos de datos (jugadores, equipos, ligas, técnicas) para probar el juego con configuraciones diferentes.
2. Crear, duplicar, renombrar y eliminar perfiles desde un Menú de Desarrollador oculto.
3. Exportar e importar perfiles como ficheros JSON para compartirlos entre usuarios.
4. Las partidas guardadas registran qué perfil usaron.

**Fuera del alcance en Fase 1:** items/objetos, objetivos, validación de compatibilidad entre ficheros, librería de ficheros, edición de datos en caliente. Estos están hardcodeados en servicios y requieren extracción previa.

---

## Contexto de arquitectura

- App 100% frontend: sin backend ni acceso a sistema de ficheros en runtime.
- Datos actuales bundleados como módulos TypeScript: `src/data/players.ts`, `src/data/teams.ts`, `src/data/leagues.ts`, `src/data/techniqueBooks.ts`.
- Persistencia existente: `localStorage` (saves con prefijo `iel_save_`).
- No existe Menú de Desarrollador todavía.

---

## Enfoque elegido: localStorage puro (Opción A)

Los perfiles se almacenan íntegros como JSON en `localStorage`. El perfil "base" es un snapshot de los datos bundleados, creado automáticamente en el primer arranque.

**Estrategia de claves localStorage:**

| Clave | Contenido |
|---|---|
| `iel_profile_index` | `ProfileIndex` — activeProfileId + lista de IDs |
| `iel_profile_{id}` | `Profile` completo con datos embebidos |
| `iel_dev_mode` | `"1"` si el modo dev está activado |

---

## Tipos — `src/types/profile.ts`

```typescript
import type { Player } from './player'
import type { Team } from './team'
import type { League } from './competition'
import type { TechniqueBook } from './techniqueBook'  // o ruta equivalente

export type ProfileTag = 'base' | 'custom' | 'debug' | 'experimental'

export interface ProfileData {
  players: Player[]
  teams: Team[]
  leagues: League[]
  techniques: TechniqueBook[]
}

export interface Profile {
  id: string
  name: string
  description: string
  version: string        // semver del perfil, e.g. "1.0.0"
  author: string
  createdAt: string      // ISO date string
  updatedAt: string      // ISO date string
  tags: ProfileTag[]
  isBuiltIn: boolean     // true = perfil base, no se puede borrar ni sobrescribir
  data: ProfileData
}

export interface ProfileIndex {
  activeProfileId: string
  profileIds: string[]   // IDs; cada perfil vive en su propia clave localStorage
}
```

---

## Cambios en tipos existentes — `src/types/save.ts`

Añadir dos campos opcionales a `SaveData` para backwards compatibility con saves antiguos:

```typescript
export interface SaveData {
  // ... campos existentes sin cambios ...
  profileId?: string       // nuevo — ID del perfil activo al crear la carrera
  profileVersion?: string  // nuevo — versión del perfil en ese momento
}
```

Los saves sin `profileId` se tratan como si usaran el perfil base (`isBuiltIn: true`).

---

## Servicio — `src/services/profileService.ts`

Responsabilidades:
- Inicializar el perfil base en el primer arranque (snapshot de datos bundleados).
- CRUD de perfiles: `createProfile`, `duplicateProfile`, `updateProfile`, `deleteProfile`.
- Gestión del índice: `getIndex`, `setActiveProfile`.
- Import/export: `exportProfile` (devuelve string JSON), `importProfile` (recibe string JSON, valida, guarda).
- Fallback: si `getActiveProfileData()` falla, devuelve los datos bundleados.

### Formato de export/import

```json
{
  "format": "inazuma-eleven-lite-profile",
  "formatVersion": "1.0.0",
  "profile": { ...Profile completo incluyendo data... }
}
```

Fichero descargado con extensión `.ielite-profile.json`.

Validaciones al importar:
- Campo `format` === `"inazuma-eleven-lite-profile"`.
- Campo `formatVersion` compatible (actualmente solo `"1.0.0"`).
- `profile.data` contiene arrays `players`, `teams`, `leagues`, `techniques`.
- Si el `id` ya existe, preguntar al usuario si sobrescribir (gestionado en UI).

---

## Pantallas y componentes nuevos

### `src/screens/DevMenuScreen.tsx`
- Pantalla completa, nueva `Screen` en `App.tsx`: `'dev_menu'`.
- Barra de navegación interna con tabs (Fase 1: solo "Perfiles").
- Botón "← Volver" → navega a `main_menu`.
- En fases futuras se añadirán tabs: "Librería", "Validación", etc.

### `src/screens/DevProfilesScreen.tsx`
- Tab "Perfiles" dentro del Dev Menu.
- Lista de perfiles como cards con:
  - Nombre, tags, badge "ACTIVO" si corresponde.
  - Conteo de datos: "200 jugadores · 20 equipos · 2 ligas".
- Acciones por perfil: Activar, Duplicar, Renombrar, Exportar, Eliminar.
- Acciones globales: Crear nuevo, Importar fichero, Restaurar base.
- Crear nuevo: formulario con nombre, descripción, tags; datos inicializados como copia del perfil activo.
- Eliminar: modal de confirmación; bloqueado si `isBuiltIn = true`; si se borra el activo → activa el base.

---

## Cambios en pantallas existentes

### `src/screens/MainMenuScreen.tsx`
- El footer con el número de versión recibe un handler `onClick`.
- Al hacer clic/tap **5 veces seguidas en menos de 3 segundos**, activa dev mode: guarda `iel_dev_mode = "1"` y muestra badge "DEV".
- Si dev mode está activo, aparece un botón **"Menú Dev"** en el menú principal.

### `src/screens/NewCareerScreen.tsx`
- Sustituir los imports directos de `src/data/*` por una llamada a `profileService.getActiveProfileData()`.
- Fallback automático a datos bundleados si el servicio falla.
- En el paso "Confirmar", mostrar el nombre del perfil activo ("Datos: Perfil base" o "Datos: Mi perfil custom").

### `src/services/saveService.ts`
- Al guardar (`save()`), leer el perfil activo e incluir `profileId` y `profileVersion` en `SaveData`.
- Al cargar (`load()`), si `profileId` no existe en localStorage, el llamador puede optar por mostrar un aviso (la lógica de aviso va en el store, no en el servicio).

### `src/App.tsx`
- Añadir `'dev_menu'` al tipo `Screen`.
- Renderizar `<DevMenuScreen />` cuando `screen === 'dev_menu'`.

---

## Flujos principales

### Activar Dev Mode
1. Usuario hace clic 5 veces en el número de versión del footer del Main Menu.
2. Se guarda `iel_dev_mode = "1"` en localStorage.
3. Aparece badge "DEV" y botón "Menú Dev" en el Main Menu.
4. Para desactivar: botón dentro del Dev Menu que borra la clave y vuelve al Main Menu.

### Cambiar perfil activo
1. Usuario abre Dev Menu → tab Perfiles.
2. Hace clic en "Activar" sobre un perfil.
3. `profileService.setActiveProfile(id)` actualiza `iel_profile_index`.
4. El cambio no afecta carreras en curso; solo se aplica al crear una nueva carrera.

### Exportar perfil
1. Usuario hace clic en "Exportar" en un perfil.
2. `profileService.exportProfile(id)` devuelve el JSON con el wrapper de formato.
3. Se descarga como `{nombre}-profile.ielite-profile.json` mediante un `<a download>` temporal.

### Importar perfil
1. Usuario hace clic en "Importar" y selecciona un fichero.
2. Se lee con `FileReader`, se valida el formato.
3. Si el ID ya existe → modal de confirmación para sobrescribir.
4. Si es válido → `profileService.importProfile(json)` guarda en localStorage y refresca la lista.

### Cargar partida con perfil distinto
1. Al cargar un save, si `save.profileId` no existe en `iel_profile_index`:
   - Se muestra un aviso en `SaveLoadScreen`: *"Esta partida usó el perfil 'X' que ya no está disponible. Se cargarán los datos actuales."*
   - El usuario puede continuar igualmente (la partida tiene players+teams embebidos, funciona).

---

## Criterios de aceptación — Fase 1

- [ ] Activar dev mode con 5 taps en el número de versión.
- [ ] Acceder al Dev Menu desde el Main Menu.
- [ ] Ver la lista de perfiles disponibles.
- [ ] El perfil "base" existe siempre y no se puede borrar.
- [ ] Crear un perfil nuevo (copia del activo).
- [ ] Duplicar un perfil existente.
- [ ] Renombrar un perfil.
- [ ] Eliminar un perfil con confirmación (excepto el base).
- [ ] Activar un perfil distinto.
- [ ] Exportar un perfil como `.ielite-profile.json`.
- [ ] Importar un perfil desde fichero.
- [ ] Nueva carrera usa datos del perfil activo.
- [ ] El paso "Confirmar" de nueva carrera muestra el nombre del perfil.
- [ ] Los saves incluyen `profileId` y `profileVersion`.
- [ ] Cargar un save con perfil inexistente muestra aviso pero permite continuar.
- [ ] Ninguna funcionalidad existente se rompe.

---

## Lo que queda para Fase 2

- Extracción de items/objetos y objetivos a ficheros de datos → inclusión en perfiles.
- Validación de compatibilidad entre ficheros (jugadores referencian equipos válidos, etc.).
- Panel de errores de validación con sugerencias.
- Librería de ficheros de datos (ver todos los ficheros disponibles, usados por qué perfiles).
- Aviso al cargar partida si el perfil ha cambiado de versión.
- Edición de datos del perfil directamente desde el Dev Menu.
