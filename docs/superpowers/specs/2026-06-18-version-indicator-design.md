---
title: Version Indicator
date: 2026-06-18
status: approved
---

## Goal

Show the current app version (semantic + git hash) in two places so the developer can instantly know which build is running on Railway vs local.

## Format

`v0.2 · c7d4986` — semantic version from `package.json` + short git commit hash injected at build time.

## Changes

### `vite.config.ts`
Add a `define` entry that runs `git rev-parse --short HEAD` via `execSync` and injects it as `__GIT_HASH__`. Add `VITE_APP_VERSION` from `package.json` via `loadEnv` or direct import.

### `src/vite-env.d.ts` (or equivalent)
Declare `__GIT_HASH__: string` so TypeScript doesn't complain.

### `src/utils/version.ts`
```ts
export const APP_VERSION = `v${import.meta.env.VITE_APP_VERSION} · ${__GIT_HASH__}`
```

### `src/screens/MainMenuScreen.tsx`
Add `<span>` with `absolute bottom-3 right-3 text-xs text-gray-600` inside the main container (add `relative` to it).

### `src/components/SettingsDrawer.tsx`
Replace hardcoded `APP_VERSION = '0.1.0'` with import from `src/utils/version.ts`. The existing `InfoRow label="Versión"` already renders it.
