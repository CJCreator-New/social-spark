# Stabilize the Published App

## Problem observed
The published URL (https://contentforged.lovable.app) renders a fully black screen — no Landing, no Auth, no error UI. The dev preview works, so this is a production-only failure: a top-level JS exception is crashing React before any route mounts, and the current `ErrorBoundary` / `RouteFallback` aren't catching it (likely the error fires inside a provider above them, or a lazy chunk fails to load).

## Goal
1. Make the published build render something on every load (never a blank screen).
2. Find and fix the production crash so the real app loads.
3. Add guardrails so future regressions surface visibly instead of silently blanking the page.

---

## Plan

### 1. Reproduce & capture the production error
- Open the published URL with browser tools, capture console + network + the failing chunk.
- Confirm whether the failure is (a) a JS runtime exception, (b) a failed dynamic `import()` of a lazy route chunk, (c) a Supabase client construction error from missing/empty env vars at build time, or (d) a CSP/MIME issue on `index.html`.

### 2. Fix the most likely root causes
Based on the code already in context, the top suspects are:

- **`src/integrations/supabase/client.ts`** calls `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)` at module top-level. If either env var is missing in the published build it throws synchronously during the initial import graph — before `ErrorBoundary` mounts — producing exactly a black screen. Add a defensive check + a visible fallback UI rendered from `main.tsx` when config is missing.
- **`src/main.tsx`** has no try/catch around `createRoot(...).render(...)`. Wrap it so any synchronous bootstrap error paints a minimal HTML error panel instead of leaving `<div id="root">` empty.
- **`initSentry`** runs before render; if it throws on a malformed DSN it kills boot. Guard it.
- **Lazy chunk load failures** (common after a redeploy invalidates old hashed chunks for users with a cached `index.html`). Wrap each `lazy(() => import(...))` with a retry-on-failure helper that does one `location.reload()` on `ChunkLoadError`.

### 3. Make failures visible, never silent
- Move `ErrorBoundary` to wrap `ThemeProvider` (currently it sits *inside* `BrowserRouter`, so anything thrown by providers above it bypasses it).
- Add a hard fallback in `index.html` (`<div id="root">` gets a "Loading…" → swapped out by React; if React never mounts within 8s, show a "Something went wrong — reload" message via inline script). This guarantees no permanent black screen.
- Ensure `RouteFallback` uses themed tokens (it currently hardcodes `bg-[#07080d]` per the existing plan.md) so a Suspense state is never invisible.

### 4. Verify on the live published URL
- Re-publish, hard-reload the published URL, confirm Landing renders.
- Click through Auth → /app, confirm Supabase auth + a data query succeed in production.
- Check the published URL on a second device / incognito to rule out cache.

### 5. Add a small "always-on" health check
- A tiny `useEffect` in `App` that pings `supabase.auth.getSession()` once and logs a structured "boot_ok" telemetry event. If it fails in production we'll see it in telemetry instead of a blank screen.

---

## Technical details (for reviewers)

Files expected to change:
- `src/main.tsx` — wrap render in try/catch, render fallback panel on throw, guard `initSentry`.
- `src/integrations/supabase/client.ts` — validate env vars; if missing, export a stub client that throws on use with a clear message (don't crash module import). *(This file is auto-generated; if regeneration is a concern, do the env-var guard in a new `src/integrations/supabase/safeClient.ts` and route callers through it — but simplest is the inline guard.)*
- `src/App.tsx` — hoist `ErrorBoundary` above `ThemeProvider`/`QueryClientProvider`; wrap `lazy()` calls in a `lazyWithRetry` helper.
- `src/lib/lazyWithRetry.ts` — new helper that catches `ChunkLoadError`, reloads once.
- `index.html` — add an inline 8-second watchdog that swaps `#root` to a visible "reload" panel if React never paints.
- `src/components/layout/RouteFallback.tsx` — swap `bg-[#07080d]` / `font-serif` for themed tokens so Suspense fallback is visible and on-brand.

Verification:
- `npm run test:run` for the unit suite.
- Manual: published URL renders Landing within 2s, Auth works, `/app` loads, hard-reload on a deep link (e.g. `/app/schedule`) doesn't 404 or blank.
- Telemetry: a `boot_ok` event appears for each page load in production.

## Out of scope
- The broader Wave 1–4 items already tracked in `.lovable/plan.md` (RLS, draft autosave, design tokens). This plan is strictly about "the published app must load and stay loaded."
- No schema changes, no edge-function changes, no auth provider changes.
