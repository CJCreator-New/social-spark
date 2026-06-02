## Findings

I ran type-check, lint, unit tests, and a production build across the app.

- TypeScript: clean
- ESLint: clean
- Unit tests: 32/32 passing
- Runtime errors: none reported
- **Production build: FAILS** with one case-sensitivity import bug

### The one real issue

`src/pages/Admin.tsx` imports from `@/components/ui/Card` (capital C), but the actual file is `src/components/ui/card.tsx`. This works in the dev preview (case-insensitive resolution) but breaks the production Vite build on Linux:

```
[vite:load-fallback] Could not load /dev-server/src/components/ui/Card
(imported by src/pages/Admin.tsx)
```

This means the Admin page would not deploy, and any publish currently silently ships a stale bundle.

## Plan

1. Fix the import in `src/pages/Admin.tsx`:
   - Change `from '@/components/ui/Card'` → `from '@/components/ui/card'`.
2. Re-run `vite build` to confirm a clean production build.
3. Re-run lint, type-check, and the unit suite to confirm nothing regressed.

No other files need changes — the remaining capitalized imports (`Modal`, `ConfirmDialog`) match real PascalCase filenames and are fine.

## Out of scope

The app is otherwise healthy. I won't touch unrelated code, refactor pages, or change behavior — just the one-line fix and verification.