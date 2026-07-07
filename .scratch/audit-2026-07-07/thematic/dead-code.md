# Thematic — Dead Code

- **`_shared/promptHelpers.ts:855-862` `rejectFreeTierByok`** — marked `@deprecated`, kept as no-op.
- **`aiClientResolver.ts:26-40`** — the `platformAvailable=true` branch reads `VITE_PLATFORM_AI_KEY`; comment (`:16-20`) states every current caller passes `platformAvailable=false`. Confirm with grep before removal.
- **Calendar `body_variants` scoring** (`generate-calendar/index.ts:207-224`) — `p.body_variants` is never populated because the tool schema no longer includes it (per `:129-133`). Runs zero times per calendar; either restore or delete (F-008).
- **`E2ECrashRoute` in App.tsx:27-29 + :124** — DEV-only; used by e2e tests. Intentional; not dead.
- **`.scratch/dead-migrations/RUN_ME_combined_catchup.sql`** — labeled "dead" by directory name.
- **`localPostGenerator.ts`** — used only in offline path; verify via grep before pruning (test file `Index.offlineGeneration.test.tsx` exercises it, so keep).
