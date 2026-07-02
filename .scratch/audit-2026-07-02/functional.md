# Functional Audit — 2026-07-02

**Method note:** Conducted directly (see method note in `security.md`). Route inventory and automated test run are complete and verified; the deep per-flow trace (wizard→generation, BYOK toggle UX, calendar/schedule interactions, admin gating) was not completed in this pass due to time spent on subagent-failure recovery — see Coverage Gaps below.

## Automated test run

`npm run test:run` (Vitest) — **Pass: 198/198 tests, 22/22 files**, duration 37.74s. No failing tests. Output included expected intentional error-boundary noise (`ErrorBoundary.test.tsx` deliberately throws `"Some other error"`, `"Some network error"`, `"test error"`, `"generic error"` to test the boundary's catch behavior — these are test fixtures, not real failures).

`npx playwright test` was **not run** — no dev server was started in this session, and confirming it would work requires spinning up the app, which was out of scope for a read-only static pass. Recommend running `e2e/critical-paths.spec.ts`, `e2e/api-key-settings.spec.ts`, `e2e/responsive.spec.ts`, `e2e/accessibility.spec.ts` in a follow-up with the dev server live.

## Route inventory

From `src/App.tsx:64-122`:

| Route | Page | Protection |
|---|---|---|
| `/auth` | `Auth` | Public |
| `/reset-password` | `ResetPassword` | Public |
| `/` | `Landing` | Public |
| `/privacy` | `Privacy` | Public |
| `/terms` | `Terms` | Public |
| `/docs` | `Docs` | Public |
| `/__e2e/crash` | `E2ECrashRoute` (throws intentionally) | Public — **see finding below** |
| `/app` | `Index` | `ProtectedRoute` + `AppShell` |
| `/profile` | `Profile` | `ProtectedRoute` + `AppShell` |
| `/my-calendars` | `MyCalendars` | `ProtectedRoute` + `AppShell` |
| `/calendar/:id` | `CalendarDetail` | `ProtectedRoute` + `AppShell` |
| `/schedule` | `Schedule` | `ProtectedRoute` + `AppShell` |
| `/admin` | `Admin` (`AdminDashboard`) | `ProtectedRoute` + `AdminRoute` |
| `*` | `NotFound` | Public (404 handled) |

All routes are lazy-loaded via `lazyWithRetry` (`src/App.tsx:17-35`) with a `Suspense`/`RouteFallback` per route, and the whole tree is wrapped in a top-level `ErrorBoundary` (`src/App.tsx:55`). 404 route confirmed present (`src/App.tsx:122`).

**Finding — Confirmed Major:** `/__e2e/crash` (`src/App.tsx:25-27,70`) is registered unconditionally with **no `import.meta.env.DEV` (or any other) guard anywhere in `App.tsx`** — confirmed by grepping the whole file for `DEV`/`E2ECrashRoute` and finding only the two lines already cited. Nothing in `vite.config.ts` strips routes at build time (Vite doesn't do route-level dead-code elimination for React Router trees like this). This means `/__e2e/crash` ships live in production: any unauthenticated visitor can hit it and force the app into its error-boundary state at will. Low exploitability (it's a self-inflicted crash, not a data exposure), but it's unpolished and trivially fixed — wrap the `<Route>` in `{import.meta.env.DEV && (...)}`.

## Follow-up verification this session

- **`create-order` price derivation (was flagged as unverified in `security.md`):** now read in full. `supabase/functions/create-order/index.ts:63-71` derives the Razorpay order amount from `getPlan(planId)` server-side (`_shared/plans.ts`), rejects any `planId` that isn't `isPaidPlan(...)`, and the client only ever supplies a plan identifier, never an amount. This closes the loop with `verify-payment`'s server-side amount cross-check documented in `security.md` — the full create→verify payment path is tamper-resistant. **Resolved, not a defect.**

## Coverage gaps (not completed this pass)

The following checklist items from the audit plan were **not verified** in this session and should be picked up in a follow-up:
- Auth flows (sign-up/sign-in/OAuth/reset) — only route wiring confirmed, not `AuthContext`/`ProtectedRoute` internals (8s timeout fallback, `SUPABASE_NOT_CONFIGURED`/`AUTH_SESSION_ERROR` surfacing)
- Wizard → generation flow, draft autosave/recovery
- BYOK quota/fallback UX (the *server-side* BYOK security logic was verified — see `security.md` — but the client-side quota-exhaustion prompt and error surfacing were not traced)
- Edge functions `generate-calendar`, `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `create-order`, `cleanup-media`, `telemetry`, `queue-worker`, `generate-post-image`, `trends_ingest`/`trends_read`, `generate-trends`, `health` — only `verify-payment`, `decrypt-api-key`, `encrypt-api-key`, `delete-api-key` were read (see `security.md`)
- Calendar/schedule CRUD, ICS export, timezone handling
- Admin dashboard gating and CRUD
- SEO tags, sitemap/robots reachability

## Remediation (ranked)

1. **Major (confirmed) — gate `/__e2e/crash` behind a dev-only build flag.** `src/App.tsx:25-27,70`. Wrap the route registration in `import.meta.env.DEV &&` so it's excluded from production bundles entirely.
2. **Scope gap, not a defect** — the coverage gaps above represent unverified surface area, not confirmed bugs. Recommend a follow-up pass (ideally with a working dev server for live Playwright execution) to close them before treating the functional audit as complete.
