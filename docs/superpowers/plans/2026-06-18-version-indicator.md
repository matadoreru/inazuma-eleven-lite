# Version Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `v0.2 · c7d4986` (package.json version + git short hash) bottom-right of MainMenuScreen and in the SettingsDrawer version row.

**Architecture:** Vite injects `__GIT_HASH__` and `VITE_APP_VERSION` at build time via `define`; a single `src/utils/version.ts` combines them; both UI locations import from there.

**Tech Stack:** Vite 5, React 18, TypeScript, Tailwind CSS

## Global Constraints

- No runtime git calls — hash is baked in at build time only
- `package.json` `"version"` field is the source of truth for the semantic version
- Text style: `text-xs text-gray-600` — subtle, not intrusive

---

### Task 1: Inject version globals in Vite and declare their types

**Files:**
- Modify: `vite.config.ts`
- Create: `src/vite-env.d.ts`

**Interfaces:**
- Produces: global `__GIT_HASH__: string` and `import.meta.env.VITE_APP_VERSION: string` available in all source files

- [ ] **Step 1: Modify `vite.config.ts`**

Add `execSync` import and `define` block. The complete updated config:

```ts
import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
})()

export default defineConfig({
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Inazuma Eleven Lite',
        short_name: 'IE Lite',
        description: 'Juego de gestión de fútbol Inazuma Eleven',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
  },
})
```

- [ ] **Step 2: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

declare const __GIT_HASH__: string

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors about `__GIT_HASH__` or `VITE_APP_VERSION`

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts src/vite-env.d.ts
git commit -m "build: inject git hash and app version via Vite define"
```

---

### Task 2: Create version utility and wire up both UI locations

**Files:**
- Create: `src/utils/version.ts`
- Modify: `src/screens/MainMenuScreen.tsx`
- Modify: `src/components/SettingsDrawer.tsx`

**Interfaces:**
- Consumes: `__GIT_HASH__` and `import.meta.env.VITE_APP_VERSION` from Task 1
- Produces: `APP_VERSION: string` exported from `src/utils/version.ts`

- [ ] **Step 1: Create `src/utils/version.ts`**

```ts
export const APP_VERSION = `v${import.meta.env.VITE_APP_VERSION} · ${__GIT_HASH__}`
```

- [ ] **Step 2: Update `MainMenuScreen.tsx`**

Add `relative` to the main container and an absolute-positioned version badge. The main `return` block (view === 'menu') becomes:

```tsx
return (
  <div className="relative h-full flex flex-col items-center justify-center bg-gray-900 gap-10">
    <div className="text-center">
      <div className="mb-4 flex justify-center">
        <span className="material-icons text-blue-500" style={{ fontSize: 64 }}>sports_soccer</span>
      </div>
      <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">
        Inazuma Eleven Lite
      </h1>
      <p className="text-gray-400 text-lg">Modo Carrera</p>
    </div>
    <div className="flex flex-col gap-4 w-full max-w-xs">
      <button
        onClick={() => navigate('new_career')}
        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xl transition-colors shadow-lg shadow-blue-900/40"
      >
        Nueva Carrera
      </button>
      <button
        onClick={() => setView('load')}
        className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-bold text-xl transition-colors"
      >
        Cargar Partida
      </button>
    </div>
    <span className="absolute bottom-3 right-3 text-xs text-gray-600 select-none">
      {APP_VERSION}
    </span>
  </div>
)
```

Also add the import at the top of the file:
```ts
import { APP_VERSION } from '../utils/version'
```

- [ ] **Step 3: Update `SettingsDrawer.tsx`**

Remove the hardcoded `const APP_VERSION = '0.1.0'` line and add the import:

```ts
import { APP_VERSION } from '../utils/version'
```

The existing `<InfoRow label="Versión" value={APP_VERSION} />` in the "Aplicación" section already uses this name — no other change needed.

- [ ] **Step 4: Verify build compiles and version appears**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

Then run: `npm run dev` and open the app. Verify:
- Main menu shows `v0.1.0 · <hash>` bottom-right (subtle gray text)
- Settings drawer → Aplicación section → Versión row shows the same string

- [ ] **Step 5: Commit**

```bash
git add src/utils/version.ts src/screens/MainMenuScreen.tsx src/components/SettingsDrawer.tsx
git commit -m "feat: version indicator — semantic version + git hash in main menu and settings"
```
