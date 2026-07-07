# Thematic — Architecture

- **Zustand** wizard store is single-slice with 20+ actions and 4 selectors (`useWizardStore.ts:5-38`). Reasonable for a single-flow app. No persist middleware (F-010).
- **React Query** at `App.tsx:41-49` — global defaults. `refetchOnWindowFocus:false` hurts dashboards (F-017).
- **Edge functions** share `_shared/promptHelpers.ts` (2379 loc). This is a **god-module** — 30+ exports, mixed concerns (auth, rate-limit, quota, AI orchestration, hashtag policy, normalization, telemetry). Refactor into `auth.ts`, `quota.ts`, `ai/*`, `text/*` submodules would be justified — but per audit rules, no speculative refactor is proposed. Flagged only.
- **Two supabase clients** are constructed inside edge functions per request (`createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {global.headers.Authorization})` + `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`). Normal pattern for Deno-hosted functions.
- **MCP integration** injects a Vite plugin that auto-generates `supabase/functions/mcp/index.ts` from `src/lib/mcp/*`. The generated file is checked in and marked as `AUTO-GENERATED`. Correct pattern.
- **`dashboard-deploy/`** appears to hold packaged copies of each edge function (verified via file listing). Duplication with `supabase/functions/*`. Likely the deploy shim. Not a defect but worth noting for maintainers.
- **Test scaffolding**: `src/lib/__tests__/`, `src/hooks/__tests__/`, `src/pages/__tests__/`, `src/stores/__tests__/`, and `supabase/tests/` for SQL. Vitest + Playwright present in `package.json:175-181`. See `missing-tests.md`.
- **Migration hygiene**: 45 migrations; naming mixes ISO + slugified timestamps + one-shot `promote_owner.sql`. `20260703*` cluster (5 files) shows migration-churn as the same GRANTs were repaired multiple times (F-022).
- **Feature flags**: `src/lib/featureFlags.ts` present. Not deep-read; assumed simple env-var boolean.
- **Sentry monitoring**: `src/lib/sentry.ts` + `monitoring.ts` present.
- **`src/lib/e2eStore.ts` + `e2eFixtures.ts`**: DEV-only mocking. Gated by `import.meta.env.DEV` at every consumption site (verified in AuthContext, apiKeyManager).
