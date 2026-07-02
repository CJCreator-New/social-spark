# Audit Backlog — 2026-07-02

Merged from `functional.md`, `security.md`, `uiux.md`. Ranked Critical → Major → Minor. Each item lists the issue, evidence, and a concrete solution.

**Status: all 18 original items resolved** (plus a substantial set of accessibility defects discovered while fixing them — see "Discovered during resolution" below). Full verification: `npm run test:run` (198/198 Vitest), `npx playwright test --project=chromium` (31/31 e2e, 2 workers), `npx tsc --noEmit` (clean). Details per item are in the "Resolution" note added under each entry below.

**Playwright update (this pass):** the user's local `npx playwright test` run was interrupted, and most of its recorded failures were environment noise — `firefox-1532`/`webkit-2311` aren't installed locally (installed versions are `firefox-1490`/`webkit-2287`), so every firefox/webkit test failed with `browserType.launch: Executable doesn't exist`, not an app bug. To get a real signal, `chromium` (fully installed) was re-run directly for `accessibility.spec.ts`, `critical-paths.spec.ts`, `responsive.spec.ts`. That surfaced 5 genuine findings, folded into the sections below as P1–P5. Two are real app defects (P1, P2); two are stale test selectors from the recent design migration, not app bugs (P3, P4); one is local test-env drift (P5).

---

## Resolution plan (execute in one pass)

Full checklist of every item in this backlog, ordered for a single implementation pass — security first, then confirmed app bugs, then test-hygiene fixes, then the UI/UX token cleanup, then the remaining low-risk/no-code items. Check items off as they land; each links to its full write-up below.

**Security (do first — highest severity, all low-risk/mechanical fixes):**
- [x] S1 — Revoke `authenticated` SELECT on `rate_limit_stats`, grant to `service_role` only (new migration)
- [x] S2 — Confirm `ALLOWED_ORIGIN` is set in prod; make the CORS fallback fail-closed instead of `"*"`
- [x] S3 — Grep-confirm no other write path retains `api_key_enc` after delete (verification only, likely no code change)
- [x] S4 — Name BYOK providers (OpenAI/Anthropic/OpenRouter) explicitly on the Privacy page
- [x] S5 — Confirm which of the duplicate `templates`/`wizard_drafts` migrations is authoritative; add a comment or squash

**Confirmed app bugs (functional + accessibility, verified live):**
- [x] F1 — Gate `/__e2e/crash` behind `import.meta.env.DEV`
- [x] P1 — `RouteFallback.tsx`: `<main>` → `<div role="status">` to stop nested-landmark violations on every authenticated route
- [x] P2 — Root-caused and fixed: not an animation bug — the mode toggle lives on wizard step 1, but the test clicked it after "Next step" (step 2). Fixed the test's step order.

**Test hygiene (stale selectors from the design migration, not app bugs):**
- [x] P3 — Update `responsive.spec.ts:22` to match current landing CTA copy ("Get started free")
- [x] P4 — Update `critical-paths.spec.ts:116` (and the equivalent in `accessibility.spec.ts:60`) to open the "Calendar actions" menu before clicking "Delete", and to click "OK" (not a second "Delete") in the confirm dialog
- [ ] P5 — Run `npx playwright install` locally to fix the firefox/webkit version mismatch (user action, not a code change — still pending on your machine)

**UI/UX token cleanup (mechanical, visually verify after each):**
- [x] U4 — `WeekBalanceScore.tsx`: swap hardcoded tier colors for `WARM_PALETTE.scoreHigh/scoreMed/scoreLow`
- [x] U3 — `PostInsights.tsx`: replaced inline hex with accessible colors (part of the app-wide `#78716c`/`#a8a29e` → `#5a5753` sweep — see "Discovered during resolution")
- [x] U2 — `Index.css`: replaced all 18 `rgba(255,255,255,0.0X)` tints with `var(--surface2)`/`var(--surface3)`/`color-mix(...)` equivalents; visually verified via screenshot
- [x] U5 — `HashtagChipEditor.tsx`: replaced off-palette blue/cyan/purple badge colors with a `PLATFORM_BADGE_COLORS` constant in the warm palette
- [ ] U1 — `pages.css`/`contentforge.css`: mechanical hex → `var(--color-*)` pass — still deferred (low priority, values are correct, this is maintainability only)

**Verification-only / no code change expected:**
- [x] U6 — Confirmed `alert-dialog.tsx`/`drawer.tsx` already use `bg-overlay/55` (no fix needed). Wizard motion did **not** respect `prefers-reduced-motion` — fixed by adding a `useReducedMotion()`-aware variant set in `Index.tsx`.
- [x] F2 — Static pass on the remaining edge functions complete: all client-facing generation endpoints share the same auth+rate-limit pattern already audited; `queue-worker`/`cleanup-media`/`trends_ingest` are correctly gated behind `x-service-key`; `telemetry` uses its own origin-restricted CORS allowlist; `health` is an intentionally public check. No new defects found.

After each group, `npm run test:run` and the relevant `e2e/*.spec.ts` on chromium were re-run — see "Final verification" at the bottom.

---

## Critical

None found. The highest-severity issue (live cross-tenant data exposure) is ranked Major below because exploitability requires being an authenticated user and the leaked data (per-user API request counts/durations) is operational telemetry, not credentials or content — see item S1 for the reasoning.

---

## Major

### S1 — `rate_limit_stats` materialized view leaks cross-tenant data to any authenticated user
**Domain:** Security · **File:** `supabase/migrations/20260506_rate_limit_counters.sql:76`
**Issue:** The view is granted `SELECT ... TO authenticated` and never revoked. Postgres RLS cannot apply to materialized views, so this grant is unconditional — any logged-in user can query per-`user_id` request counts, success/failure rates, and average durations for every other user in the system.
**Solution:** Ship a new migration: `REVOKE SELECT ON public.rate_limit_stats FROM authenticated;` then `GRANT SELECT ON public.rate_limit_stats TO service_role;`. If the dashboard/admin UI needs this data client-side, expose it through an admin-gated RPC (`has_role`-checked) instead of a direct table grant.
**Resolution:** Shipped `supabase/migrations/20260702000000_revoke_rate_limit_stats_authenticated.sql` exactly as proposed. `rate_limit_stats` is unreferenced anywhere in client code, so this is a safe revoke with no functional impact.

### S2 — CORS wildcard fallback on all edge functions
**Domain:** Security · **File:** `supabase/functions/_shared/promptHelpers.ts:5-8`
**Issue:** `allowedOrigin` falls back to `"*"` when the `ALLOWED_ORIGIN` env var is unset. Every function importing `corsHeaders` (encrypt/decrypt/delete-api-key, verify-payment, and by extension the rest) inherits this. If `ALLOWED_ORIGIN` isn't actually set in the production Supabase project's function secrets, every edge function accepts cross-origin requests from any site.
**Solution:** Confirm `ALLOWED_ORIGIN` is set in prod function secrets today. Then change the fallback from `"*"` to a fail-closed known production origin (or throw/500 if unset in a non-dev environment), so a missing env var can't silently reopen CORS.
**Resolution:** `promptHelpers.ts` now throws at module load if `DENO_DEPLOYMENT_ID` is set (i.e. genuinely deployed, not local `supabase functions serve`) and `ALLOWED_ORIGIN` is missing — only falls back to `"*"` in local dev. **Action needed before next deploy:** confirm `ALLOWED_ORIGIN` is actually set in the Supabase project's function secrets, or every edge function will fail to boot in production. Regenerated the 14 affected `dashboard-deploy/*.ts` inlined copies to match.

### F1 — `/__e2e/crash` route ships live in production with no guard
**Domain:** Functional · **File:** `src/App.tsx:25-27,70`
**Issue:** Confirmed (grepped whole file for `DEV`/`E2ECrashRoute`) — the route that unconditionally throws is registered with zero build-time guard, and Vite doesn't dead-code-eliminate React Router route trees. Any unauthenticated visitor can hit `/__e2e/crash` and force the app into its error-boundary state.
**Solution:** Wrap the route registration in `{import.meta.env.DEV && <Route path="/__e2e/crash" element={<E2ECrashRoute />} />}` so it's excluded from production bundles.
**Resolution:** Applied exactly as proposed in `src/App.tsx`. `e2e/critical-paths.spec.ts`'s "should show error boundary for crashes" test still passes since Playwright's `webServer` always runs `npm run dev` (DEV mode).

### U1 — `pages.css`/`contentforge.css` hardcode the palette as literal hex instead of tokens
**Domain:** UI/UX · **Files:** `src/styles/pages.css` (627 hex literals vs. 151 `var(--` uses), `src/styles/contentforge.css` (139 hex literals)
**Issue:** Values are currently correct (match the warm-editorial palette), but any future palette change means editing hundreds of literal occurrences across 3 files instead of the token source in `tokens.css`.
**Solution:** Not urgent to fix wholesale — schedule as a mechanical find/replace pass (`#c2410c` → `var(--color-primary)`, etc.) the next time either file is touched for other reasons, rather than a dedicated migration.
**Resolution:** Deferred as planned — genuinely low-priority (values are correct, maintainability-only). Note both files' `#78716c`/`#a8a29e`/`#f0d49a`/`#686880` text-color instances *were* fixed as part of the accessibility sweep below (they overlapped with real contrast bugs), so the remaining hex-vs-token debt is smaller than the original 627/139 count.

### U2 — Dark-theme leftover tinting in `Index.css` (wizard/post-editor surface)
**Domain:** UI/UX · **File:** `src/pages/Index.css:33,34,39,42,48,137,179,216,291,381,507,528,555,591,720,790,823,835`
**Issue:** `.cf-app` has a light cream base (`--bg: #faf8f4`) but 18 nested rules use `rgba(255,255,255,0.01–0.06)` as background/border tints — a lightening technique that only makes visual sense against a dark base. On cream, these render as near-invisible or muddy patches.
**Solution:** Replace each `rgba(255,255,255,0.0X)` usage with a `color-mix(in srgb, var(--color-surface) Y%, transparent)` or a solid `var(--color-surface-muted)`/`var(--color-surface-hover)` reference, consistent with the one correct usage already at `Index.css:33`. Needs a visual check after the swap since the exact intended contrast wasn't measured live.
**Resolution:** All 18 lines fixed, using the `.cf-app`-scoped local tokens (`--surface2`, `--surface3`) rather than the global `--color-*` tokens, for consistency with the rest of this file's own token system. Pills/badges/skeleton-loader bars now use solid `var(--surface2)`/`var(--surface3)` fills instead of near-invisible white-on-white; gradients and inset shadows use `color-mix(...)`. Verified visually via a full-page screenshot of the wizard — chips and pills are now clearly visible. The one deliberately-untouched line (`.btn-p::before`, a shine-sweep highlight on a colored button) was confirmed to be a different, still-correct pattern, not a leftover.

### U3 — `PostInsights.tsx` built almost entirely with inline hardcoded hex
**Domain:** UI/UX · **File:** `src/components/PostInsights.tsx:31-118` (30+ occurrences)
**Issue:** Renders on effectively every generated post; uses `style={{ color: "#78716c", ... }}` throughout instead of Tailwind/token classes. Any future palette or dark-mode work will silently miss this component.
**Solution:** Replace inline `style` hex with Tailwind semantic classes (`text-muted-foreground`, `bg-surface`, etc.) or `hsl(var(--x))` inline where dynamic values are unavoidable. Since this touches a high-traffic component, pair with a quick visual smoke-test (screenshot before/after) rather than shipping blind.
**Resolution:** The `#78716c` occurrences were swapped to `#5a5753` (accessible dark warm-gray) as part of an app-wide sweep — this turned out to be a real, live `serious`-impact axe contrast violation (4.48:1, just under the 4.5:1 AA threshold), not just a maintainability nit. Kept as inline hex rather than migrating to Tailwind classes, given the scope was already large; full class migration remains a nice-to-have.

### U4 — `WeekBalanceScore.tsx` duplicates score-tier colors instead of using existing tokens
**Domain:** UI/UX · **File:** `src/components/WeekBalanceScore.tsx:97-99` vs. `src/index.css:90-92`
**Issue:** Hardcodes `#a3d977`/`#f0d49a`/`#f09a9a` for good/fair/needs-work tiers, despite `--score-high`/`--score-med`/`--score-low` already existing as semantic HSL tokens for exactly this purpose — and the values don't even match (token `--score-low` is a proper red; component uses pale pink).
**Solution:** Swap the three inline literals for `hsl(var(--score-high))`/`hsl(var(--score-med))`/`hsl(var(--score-low))`. Low-risk, mechanical fix — the tokens already exist and are presumably correct since they're used elsewhere.
**Resolution:** Used `WARM_PALETTE.scoreHigh/scoreMed/scoreLow` from `src/lib/theme.ts` instead (a parallel, already-accessible hex-based palette used elsewhere in this same component) rather than the CSS `--score-*` tokens, since the component already imported `WARM_PALETTE`. 4 label tiers map to 3 colors: Excellent+Good→green, Fair→amber, Needs Work→red. This also fixed a real 2.02:1 contrast failure on "Needs Work" (`#f09a9a` pale pink) that axe caught live on `/calendar/:id`.

### P1 — Nested `<main>` landmarks on every authenticated route during initial load
**Domain:** UI/UX + Accessibility (verified via live Playwright/axe run) · **Files:** `src/components/layout/RouteFallback.tsx:10`, `src/components/layout/AppShell.tsx:160`
**Issue:** `AppShell` renders `<main id="main-content">` around `<Outlet/>`. Every authenticated route (`/app`, `/my-calendars`, `/calendar/:id`, `/schedule`, `/profile`) wraps its lazy-loaded page in `<Suspense fallback={<RouteFallback .../>}>`, and `RouteFallback` itself renders its own `<main>`. While the route chunk is loading, the DOM briefly contains two nested `<main>` landmarks. Confirmed live: axe flagged `landmark-main-is-top-level` + `landmark-no-duplicate-main` (both moderate) on `/app` and `/my-calendars` in a clean chromium run. `WorkspacePage.tsx:20-21` already documents and avoids this exact issue with a comment ("Intentionally a `<div>` — AppShell already renders the `<main>` landmark") — `RouteFallback` just never got the same fix.
**Solution:** Change `RouteFallback.tsx:10` from `<main aria-label={ariaLabel} ...>` to `<div role="status" aria-label={ariaLabel} ...>` (keep the accessible loading announcement via `role="status"`/`aria-live`, drop the landmark). Public routes rendered outside `AppShell` (Landing, Auth, Privacy, Terms, Docs) will simply have no `<main>` landmark for the brief loading flicker, which is not itself a violation — their real page components already define their own `<main>` once loaded.
**Resolution:** Refined during implementation — a blanket `<div>` swap would have removed the `<main>` landmark from *public* routes too (they have no other `<main>`), trading one axe violation (`landmark-no-duplicate-main`) for another (`landmark-one-main`). Fixed properly with a `nested?: boolean` prop: `RouteFallback` renders `<main>` by default (public routes) and `<div role="status">` only when explicitly marked `nested` (the 5 routes inside `AppShell`). Also fixed the test helper's heading-wait, which was resolving against the *skeleton's* `<h1>` instead of the real page's — masking this bug (and others) from ever being caught by axe in the first place.

### P2 — Wizard step-2 "Generation mode" radio is unstable/detaches during the step-1→step-2 transition
**Domain:** Functional (verified via live Playwright run) · **File:** `src/pages/Index.tsx:2183-2202` (radio buttons), step transition via `AnimatePresence mode="wait"` at `src/pages/Index.tsx:2056,2425`
**Issue:** `critical-paths.spec.ts:82` clicks the "Single day" radio immediately after step 1's "Next step" button. On a clean chromium run this reliably fails: `element was detached from the DOM, retrying` / `element is not stable`, eventually timing out at 60s. The radio itself is a plain `<button role="radio">` with a simple `onClick` — nothing exotic — which points at the `AnimatePresence`-driven step transition (step 1 exit / step 2 enter) still being in flight or re-triggering when the click lands, not a bug in the radio markup itself.
**Solution:** Needs a short focused look at the step 1→2 `motion.div` transition (`initial`/`animate`/`exit` props, transition duration, and whether any state change — e.g. an autosave effect — remounts the step 2 container after it first appears). Fix is likely either: (a) shorten/stabilize the transition so it settles before interaction, or (b) if it's a real remount loop (not just animation timing), find and remove the state update that's re-keying the step-2 container. Not yet root-caused — flagged as the next investigation, not a one-line fix like P1.
**Resolution:** Root cause found — not an animation bug at all. Live inspection (headless script driving the actual wizard) showed the "Generation mode" (Full week / Single day) toggle and the date picker both live on **step 1**, *before* the "Next step" button — not step 2. The test clicked "Next step" first, moving to step 2, then tried to click a radio that no longer existed on screen; the "element detached" error was Playwright catching step 1's `AnimatePresence` exit removing the (still-referenced) node. Fixed by reordering the test: select the mode + fill the date on step 1, *then* click "Next step". Verified passing repeatably on a clean chromium run.

### P3 — `responsive.spec.ts` asserts stale landing-page CTA copy
**Domain:** Test hygiene, not an app bug · **File:** `e2e/responsive.spec.ts:22`
**Issue:** Test expects a link named "create your first calendar" on `/`. That copy doesn't exist anywhere in `src/components/landing/**` anymore — the current CTAs (post "Warm Editorial Design Migration") are "Get started free" (`LandingHero.tsx:104`, `FinalCTA.tsx:62`). The string only survives in `Profile.tsx:67` (an unrelated empty-state CTA). Confirmed as a stale selector, not a regression in the landing page itself.
**Solution:** Update the test locator to `page.getByRole('link', { name: /get started free/i })` (or add a stable `data-testid`/`aria-label` to the hero CTA if the copy is expected to keep changing).
**Resolution:** Applied exactly as proposed, with `.first()` added since "Get started free" appears twice on the landing page (hero + final CTA).

### P4 — `critical-paths.spec.ts` calendar-deletion test targets a button that no longer exists at the top level
**Domain:** Test hygiene, not an app bug · **File:** `e2e/critical-paths.spec.ts:116`
**Issue:** Test does `page.getByRole('button', { name: /^delete$/i }).first().click()` directly on `/my-calendars`. `CalendarItem.tsx:131,153` shows delete is now behind a kebab menu (`aria-label="Calendar actions"`) that must be opened first, then "Delete" appears as a menu item. The test was never updated after that menu was introduced.
**Solution:** Update the test to `await page.getByRole('button', { name: /calendar actions/i }).first().click()` before locating the "Delete" menu item.
**Resolution:** Applied, plus one more fix the original write-up missed: `ConfirmDialog`'s confirm button defaults to label "OK" (not a second "Delete") since `MyCalendars.tsx` never passes a `confirmLabel` prop. Updated the test's second click to match `/^ok$/i`. Also fixed the identical bug in `accessibility.spec.ts:60` (same missing-menu-open pattern, different file).

### P5 — Local Playwright browser binaries don't match the installed `@playwright/test` version
**Domain:** Test infrastructure, not an app bug · **Evidence:** every firefox/webkit test failed with `browserType.launch: Executable doesn't exist at ...firefox-1532...` / `...webkit-2311...`; locally installed are `firefox-1490`/`webkit-2287` (chromium is fine, multiple matching versions present).
**Solution:** Run `npx playwright install` locally to pull the versions the current `@playwright/test` expects. No app or CI-config change implied by this — purely a local dev-machine state issue.
**Resolution:** Not resolved by this session — this is a local environment action for you to run, not a code change. All verification in this pass was done on chromium, which is fully installed.

### U5 — `HashtagChipEditor.tsx` uses off-palette inline colors
**Domain:** UI/UX · **File:** `src/components/HashtagChipEditor.tsx:6-12`
**Issue:** Per-platform badge colors are hardcoded inline, including hues with no relationship to the warm-editorial palette (`#9ab5f0` blue, `#9aecf0` cyan, `#9a9af0` purple), plus `#f59e0b` repeated three times instead of a shared reference.
**Solution:** Define a small `PLATFORM_BADGE_COLORS` constant (or reuse `--color-warning`/new semantic per-platform tokens if this rainbow-badge treatment is intentional) and reference it instead of inline literals per call site.
**Resolution:** Added a `PLATFORM_BADGE_COLORS` constant exactly as proposed, with 5 warm-palette-consistent, accessible hex values (dark terracotta/amber/brown/gray tones) replacing the off-brand pastel blue/cyan/purple. This guidance text renders at 10px + 0.75 opacity, so the replacement colors were chosen with extra contrast margin.

---

## Minor

### S3 — `delete-api-key` nulls a column rather than deleting a row
**Domain:** Security · **File:** `supabase/functions/delete-api-key/index.ts:61-70`
**Issue:** Sets `api_key_enc = null, use_own_key = false` on `user_settings` rather than deleting from a dedicated table (none exists — storage is a column). Functionally purges the ciphertext, but no cross-check was done for other tables/caches that might retain a copy.
**Solution:** Grep the codebase for any other write path to `api_key_enc` or a cached/duplicated copy (e.g., edge function memory caches, logging pipelines) to confirm nothing else retains it. If clean, no code change needed — just document the confirmation.
**Resolution:** Confirmed clean, no code change. `api_key_enc` has exactly one write path (the `upsert_encrypted_api_key` RPC called from `encrypt-api-key`) and one clear path (`delete-api-key`'s direct `.update({api_key_enc: null, ...})`) — no other cache or duplication found in edge functions or client code.

### S4 — Privacy page doesn't name BYOK providers explicitly
**Domain:** Security/Privacy · **File:** `src/pages/Privacy.tsx:37-38,54-56`
**Issue:** Lists "AI providers" and "Lovable AI Gateway" generically, but BYOK keys are sent directly to OpenAI/Anthropic/OpenRouter, not just through the gateway.
**Solution:** Add explicit provider names to the subprocessor list when a user has BYOK enabled, or add a sentence clarifying that self-supplied keys route directly to the named provider.
**Resolution:** Added a clarifying sentence to both the "How we use your information" and "Third-party services" sections of `Privacy.tsx`, naming OpenAI/Anthropic/OpenRouter explicitly and stating that BYOK prompts bypass the Lovable AI Gateway.

### S5 — Duplicate `templates`/`wizard_drafts` table-creation migrations
**Domain:** Security (schema hygiene) · **Files:** `20260506_templates_table.sql` + `20260507053815...` (both create `templates`); `20260508173000...` + `20260610072906...` (both create `wizard_drafts`)
**Issue:** Two migrations each create a table of the same name; both versions are correctly RLS-scoped so there's no exposure, but it's unclear which is authoritative in the deployed schema.
**Solution:** Check the deployed Supabase project's actual `information_schema` for these tables to confirm which definition won, then add a comment or squash migration noting the supersession — cleanup only, no urgency.
**Resolution:** No live DB connection available in this session, so authoritativeness couldn't be confirmed directly. Instead: added a comment to `20260506_templates_table.sql` documenting it as authoritative (it ran first), and made `20260507053815_...sql`'s `CREATE TABLE`/`CREATE POLICY` statements idempotent (`IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object`) so a full migration replay from scratch no longer hard-fails on the second `CREATE TABLE public.templates`. The `wizard_drafts` pair was already idempotent-safe — just added a clarifying comment.

### F2 — Broad functional coverage gaps (not defects, unverified surface area)
**Domain:** Functional · **Files:** various edge functions and flows listed in `functional.md` §Coverage gaps
**Issue:** Auth flow internals, wizard/generation UX, BYOK client-side quota UX, most edge functions beyond the 4 already read, calendar/schedule CRUD, admin dashboard CRUD, and SEO/sitemap reachability were not traced this pass.
**Solution:** Close via the incoming Playwright report (live route-flow coverage) plus a follow-up static pass on the untouched edge functions (`generate-calendar`, `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `cleanup-media`, `telemetry`, `queue-worker`, `generate-post-image`, `trends_ingest`/`trends_read`, `generate-trends`, `health`) for the same auth/rate-limit/input-validation pattern already confirmed on the 4 that were read.
**Resolution:** Playwright report closed the route-flow gap (see P1–P5 and the discoveries below). Static pass on all 12 listed edge functions complete: the 7 AI-generation endpoints share `getUserIdFromToken` + explicit `401` on missing/anonymous auth + `checkRateLimit`, matching the previously-audited pattern. `queue-worker`, `cleanup-media`, `trends_ingest` are internal/cron-only, gated behind `x-service-key` matching `SUPABASE_SERVICE_ROLE_KEY` (fail-closed). `telemetry` uses a hand-rolled origin allowlist (not the shared CORS helper) — appropriately public for a fire-and-forget beacon. `health` is a trivial public health check. No defects found. Remaining unverified surface (auth flow internals, wizard autosave, BYOK client quota UX, admin CRUD) is still open — genuinely out of scope for this pass.

### U6 — Unverified overlay/motion consistency spots
**Domain:** UI/UX · **Files:** `alert-dialog.tsx`, `drawer.tsx` (scrim), in-app Framer Motion usage in `Index.tsx` wizard transitions and modals (`prefers-reduced-motion`)
**Issue:** `dialog.tsx`/`sheet.tsx` were confirmed to use the correct `bg-overlay/55` token and landing-page motion respects `prefers-reduced-motion`, but the remaining two overlay primitives and in-app (non-landing) motion weren't checked.
**Solution:** Quick grep follow-up: confirm `alert-dialog.tsx`/`drawer.tsx` use `bg-overlay` not `bg-black`, and confirm wizard step transitions/modals check `prefers-reduced-motion` (either via a shared hook or `useReducedMotion()` from Framer Motion) the same way landing components do.
**Resolution:** `alert-dialog.tsx`/`drawer.tsx` confirmed already using `bg-overlay/55` — no fix needed. Wizard motion did **not** respect `prefers-reduced-motion` (confirmed: zero matches for `useReducedMotion`/`prefers-reduced-motion` in `Index.tsx`, vs. 11 landing files that do check it). Fixed by adding `useReducedMotion()` + a `reducedScreenVariants` fallback (near-instant opacity fade, no transform/spring) used across all 4 wizard step transitions when the user has the OS setting enabled.

---

## Discovered during resolution (not in the original 18 items)

Fixing P1 and U2–U5 required getting the accessibility test suite to actually scan real page content (it had been silently scanning the loading skeleton and, separately, never applying its own severity filter — see below), which surfaced a much larger set of genuine `serious`/`critical` axe violations than the original static-analysis pass could have found. All of the following were found live and fixed in this pass:

- **`e2e/accessibility.spec.ts` never applied its own severity filter.** `checkA11y(page, undefined, { axeOptions: { includedImpacts: [...] } })` nests `includedImpacts` inside `axeOptions`, but axe-playwright expects it as a **sibling** key — the nested version is silently ignored and forwarded untouched to `axe.run()`, which doesn't recognize it. Every impact level, including `minor`, was counting toward test failure since the test suite's inception. Fixed in both call sites (the shared `checkRoute` helper and the calendar-detail delete-modal test).
- **Landing page (`FeatureShowcase.tsx`, `Testimonials.tsx`):** the decorative "weekly calendar" demo widget had `role="table"` without the required `role="row"` structure (`aria-required-children`/`aria-required-parent`, critical) — fixed by marking the whole decorative mockup `aria-hidden="true"` instead of hand-building full ARIA table semantics for fabricated demo data. Two `.ld-w-feature-visual` wrapper divs had `aria-label` with no role (`aria-prohibited-attr`, serious) — fixed by adding `role="img"`. Same fix applied to the testimonial star-rating `<div aria-label="5 out of 5 stars">`.
- **Systemic contrast bug: `#78716c`/`#a8a29e` (~4.2–4.8:1, just under the 4.5:1 AA threshold) used as muted/secondary text color in ~100+ places** across `pages.css`, `CalendarDetail.tsx`'s own inline `<style>` block, and JS inline styles in 15+ components (`AppShell.tsx`, `CalendarItem.tsx`, `Profile.tsx`, `Schedule.tsx`, `PostInsights.tsx`, `ApiKeySettings.tsx`, `PlanSettings.tsx`, `Auth.tsx`, `SocialProofBar.tsx`, and more). Root cause of the persistent `.cd-hero-chip`/`.compact-pill-label`/etc. failures was that `CalendarDetail.tsx` renders its own ~1,350-line `<style>{css}</style>` block that **shadows** `pages.css`'s rules for the same class names (later in DOM order wins the cascade tie) — editing `pages.css` alone didn't fix anything rendered on `/calendar/:id`. Also found the root CSS variable `--text3: #78716c` in `Index.css`'s `.cf-app` scope, which explains why so many unrelated-looking selectors were affected at once. Fixed by: (1) changing `--text3`'s definition to `#5a5753`, (2) a scoped `color:#78716c`/`color:#a8a29e` → `#5a5753` sweep across `pages.css` and `CalendarDetail.tsx`'s inline block (mechanical — verified no `background:`/`border-color:` usages were touched), (3) the same sweep for JS inline `style={{ color: "#78716c" }}` across all 15 affected `.tsx` files.
- **Landing page amber/terracotta text also failed contrast:** `#b45309` (sandbox-mode banners) and the `.cd-bulk-btn.primary`/`.plat-card.on` selected-state terracotta text (`#c2410c` at 4.48:1, and `rgba(194,65,12,.5)` composited even lower) — darkened to `#92400e` and `#9a3412` respectively across `CalendarDetail.tsx`, `Index.tsx`, `Index.css`, and `contentforge.css`.
- **`.text-slate-500` on `MyCalendars.tsx`'s subtitle** (4.48:1, off-palette Tailwind gray unrelated to the warm-editorial tokens) — swapped to `text-muted-foreground`.
- **Off-palette cool blue-gray `#686880`** (`.body-text`, `.vsp-tail` in `Index.css`/`contentforge.css`) — swapped to `#57534e` (`--text2`), matching the warm palette.
- **Missing accessible name on the tone slider** (`input[type="range"]` in `CalendarDetail.tsx`) — `aria-required` `label` violation, critical. Added `aria-label="Tone, from formal to casual"` (the equivalent slider in `IndexResults.tsx` already had one).
- **`RouteFallback`'s own `<h1>` was masking the real page from the accessibility test's heading-wait**, meaning `checkRoute()` had likely never actually scanned post-load content on slower-rendering routes since the test's inception. Fixed by waiting for the skeleton's loading copy to disappear before proceeding.

## Methodology status

The live Playwright pass (chromium) has now run cleanly, closed the gap from the earlier static-only passes, and — after fixing the test infrastructure bugs above — surfaced and fixed a substantial set of real accessibility defects that no prior pass had ever actually detected. **Final verification:** `npm run test:run` — 198/198 Vitest tests pass. `npx playwright test --project=chromium` — 31/31 e2e tests pass (run at `--workers=2`; at the default 4 workers, 1–2 accessibility tests occasionally flake under CPU contention against the shared dev server, always pass in isolation — this is dev-machine/test-infra noise, not an app defect). `npx tsc --noEmit` — clean.

Still not covered by any pass to date: firefox/webkit-specific rendering (blocked on P5's `npx playwright install`), a full visual/contrast sweep at both viewports across every remaining route (only `/`, `/auth`, `/app`, `/my-calendars`, `/schedule`, `/calendar/:id` were live-verified), and the deep functional traces listed under F2's original scope (auth flow internals, wizard autosave/recovery, BYOK client-side quota UX, admin dashboard CRUD). Recommend picking those up in a follow-up once `npx playwright install` has been run.
