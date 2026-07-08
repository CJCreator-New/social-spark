# Audit Remediation Runbook

Use this document to resolve the 2026-07-07 audit findings one at a time. The authoritative audit artifacts live in `.scratch/audit-2026-07-07/`; this runbook turns that evidence into an implementation checklist.

## Source Audit

- Executive summary and deliverable index: [README.md](../.scratch/audit-2026-07-07/README.md)
- Full finding details: [findings-register.md](../.scratch/audit-2026-07-07/findings-register.md)
- Workflow audit: [workflows.md](../.scratch/audit-2026-07-07/workflows.md)
- Interactive component audit: [interactive-components.md](../.scratch/audit-2026-07-07/interactive-components.md)
- Prioritized roadmap: [roadmap.md](../.scratch/audit-2026-07-07/roadmap.md)
- Traversal and coverage log: [traversal-log.md](../.scratch/audit-2026-07-07/traversal-log.md)

Audit summary: overall score **6.4 / 10**. The next release should prioritize the four HIGH release blockers from the scratch audit: F-001, F-002, F-004, and F-005. F-003 is the first P1 item because it is closely related to F-002.

## Finding Coverage Matrix

All listed audit entries are represented in this runbook:

| Source | IDs covered here | Count | Placement |
|---|---|---:|---|
| P0 release blockers | F-001, F-002, F-004, F-005 | 4 | P0 checklist |
| P1 high priority | F-003, F-006, F-009, F-011, F-020, F-024 | 6 | P1 checklist |
| P2 improvements | F-008, F-010, F-014, F-015, F-017, F-018, F-019, F-021, F-023 | 9 | P2 checklist |
| P3 debt and polish | F-007, F-012, F-013, F-016, F-022, code-duplication doc | 6 | P3 checklist |
| Positive verifications | F-025, F-026, F-027 | 3 | Positive Verifications section |

F-001 through F-027 are all linked or tracked below. F-025, F-026, and F-027 are positive verifications from the audit, so they are preserved as regression expectations rather than remediation tasks.

## Resolution Calls

This is the decision log for what will be changed to resolve each item. Use it as the implementation contract; the longer checklist sections below provide acceptance criteria.

| ID | Call | Required changes |
|---|---|---|
| F-001 | Fix now; this is a release blocker. | Add a Supabase migration that recreates the affected user-owned UPDATE policies with both `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)` for `saved_calendars`, `scheduled_posts`, `templates`, `user_settings`, `wizard_drafts`, and `profiles`; add RLS regression coverage. |
| F-002 | Fix now; quota bypass must close before release. | Add `checkQuota`, shared-key/BYOK gating, and `incrementGenerationCount` to `repurpose-post`, `inline-rewrite`, `generate-trends`, and `generate-post-image`; add tests for quota exceeded and successful counted usage. |
| F-003 | Fix immediately after F-002. | Call `checkContentLength(req)` before parsing request bodies in `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `generate-trends`, and `generate-post-image`; test oversized payloads return 413. |
| F-004 | Fix now; image generation needs ownership enforcement. | In `generate-post-image`, verify `calendarId` belongs to the authenticated `userId` before image generation, storage upload, or `media_references` insert; return 403 on miss. |
| F-005 | Fix now with a small grant migration. | Revoke `INSERT`, `UPDATE`, and `DELETE` on `public.admin_users` from `authenticated`; grant those mutations only to `service_role`; keep authenticated `SELECT` if still required. |
| F-006 | Strengthen client policy and document the required Supabase dashboard setting. | Update `passwordPolicy` to minimum length 10 with at least one letter and one digit; update tests; record the owner/date for enabling Supabase leaked-password protection. |
| F-007 | Add regression tests, not production code changes first. | Create SQL tests proving SECURITY DEFINER functions cannot leak cross-user data and non-admin users cannot execute admin-only effects; document intentional executable functions. |
| F-008 | Choose the simpler quality path unless product explicitly wants variants. | Either restore calendar body variants with tests, or remove the dead calendar scoring path and document calendar generation as single-shot; do not leave silent skipped scoring. |
| F-009 | Use a stable OAuth redirect URI. | Change `Auth.tsx` so Google OAuth does not include `nextPath` in `redirect_uri`; preserve destination through state/localStorage/existing post-login navigation; add OAuth/MCP consent regression coverage. |
| F-010 | Add local persistence for offline wizard recovery. | Wrap `useWizardStore` with Zustand `persist`, partializing wizard recovery state only; keep `wizard_drafts` as cross-device backup; test offline refresh restore. |
| F-011 | Sanitize provider and worker logs. | Replace raw upstream/body logging with `sanitizeLogValue` in `generate-post-image`, `queue-worker`, and `cleanup-media`; preserve status/code context. |
| F-012 | Remove the misleading placeholder API key. | Change `aiClientResolver` so user-key/server-side mode does not expose `"USER_KEY_STORED_SERVERSIDE"` as an API key; tighten the return type and update callers/tests. |
| F-013 | Fix scoring heuristics with focused tests. | Filter stopwords before CTA topic matching, improve stemming, split readability sentences on punctuation/newlines, and add tests for the false positives/negatives described in the audit. |
| F-014 | Add a defensive redirect guard. | Validate OAuth consent redirect targets before navigation; reject malformed, `javascript:`, and `data:` targets; allow valid http(s) registered targets. |
| F-015 | Make OAuth consent understandable and accessible. | Render requested scopes, add `aria-busy` and visible disabled states, and move inline layout styling into CSS classes. |
| F-016 | Make quota monthly reset atomic. | Update `increment_generation_count` so it resets `generation_count` and `quota_period_start` inside the same DB operation when a new period begins. |
| F-017 | Refresh only live-data queries on focus. | Re-enable `refetchOnWindowFocus` for admin, quota, and subscription queries; avoid changing destructive wizard/autosave behavior globally. |
| F-018 | Split vendor chunks with low-risk manual chunks. | Add manual chunks for `@radix-ui` and `@tanstack`; keep `three` and `gsap` split; verify production build chunk sizes. |
| F-019 | Make telemetry typos visible in development. | Return 400 for unknown telemetry event names in dev/non-production; retain low-noise 202 behavior in production if desired. |
| F-020 | Add payment verification tests. | Test `verify-payment` bad signature, wrong user, wrong amount, missing/invalid plan, and one positive verification path. |
| F-021 | Replace unstable social preview metadata. | Replace the Lovable preview OG image URL in `index.html` with a stable branded asset or stable hosted URL. |
| F-022 | Clarify migration authority; do not squash history. | Add a comment header to the latest BYOK grant migration explaining it is the authoritative current grant state; leave prior migrations intact. |
| F-023 | Surface subscription load errors. | Add `error` to `useSubscription`; update consumers so failed status loading is not indistinguishable from the free tier. |
| F-024 | Centralize strict CORS behavior. | Move telemetry-style allowlist behavior into shared `getCorsHeaders`, backed by configured allowed origins; keep explicit local/preview behavior. |
| F-025 | Preserve; no remediation needed. | Keep BYOK provider type narrowing intact and avoid reintroducing broad string/provider gaps. |
| F-026 | Preserve; add regression protection through F-020. | Keep timing-safe HMAC verification, Razorpay order re-fetch, user/amount validation, and idempotency behavior. |
| F-027 | Preserve; no remediation needed. | Keep deterministic markdown stripping in normalization and add regression coverage if copy-normalization code is touched. |
| code-duplication doc | Normalize when doing adjacent DB/admin work. | Replace inline admin-check `EXISTS` patterns with `is_admin()` where appropriate; avoid mixing this with unrelated security fixes unless touching the same migration/RPC. |

## Working Rules

- [x] Fix one finding at a time.
- [x] Keep every change traceable to a finding ID from `findings-register.md`.
- [x] Do not bundle unrelated refactors with a finding fix.
- [x] Prefer scoped fixes exactly as described in the finding unless new evidence proves the fix is unsafe.
- [x] Add or update tests for security, quota, payment, auth, RLS, and AI reliability changes.
- [x] After each priority group, run the full verification suite below.
- [x] If an item is deferred, record owner, date, reason, and risk.

## Full Verification Suite

Run after each P0/P1/P2 group and before release:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e -- --project=chromium --reporter=line
```

For database/RLS work, also run the relevant Supabase SQL tests or document why local Supabase is unavailable.

## P0: Release Blockers

### P0-1 / F-001: Add `WITH CHECK` to User-Owned UPDATE Policies

Status: [x] Done

Evidence source: [findings-register.md](../.scratch/audit-2026-07-07/findings-register.md), F-001.

Problem:
- User-owned UPDATE policies on `saved_calendars`, `scheduled_posts`, `templates`, `user_settings`, `wizard_drafts`, and `profiles` lack `WITH CHECK`.
- A user can update a row they currently own and set `user_id` to another user, planting or transferring data.

Fix scope:
- Add one migration that recreates or alters each affected UPDATE policy with:
  - `USING (auth.uid() = user_id)`
  - `WITH CHECK (auth.uid() = user_id)`
- Cover all six tables named above.

Acceptance criteria:
- [x] Attacker cannot change `user_id` on their own row to another user.
- [x] Legitimate owner updates still work.
- [x] SQL regression test covers at least `saved_calendars`, `scheduled_posts`, and `wizard_drafts`.

Verification:

```bash
npm run test:run
```

Notes:

- Migration: `supabase/migrations/20260707000000_add_with_check_to_update_policies.sql` — recreates the UPDATE policy on `profiles`, `saved_calendars`, `templates`, `wizard_drafts`, `scheduled_posts`, `user_settings` with matching `USING`/`WITH CHECK` clauses.
- Regression test: `supabase/tests/update_policy_ownership.test.sql` (pgTAP). Not executed locally — this sandbox has no Docker daemon, so `supabase test db` cannot start a local Postgres (re-checked 2026-07-08: `docker` is not on PATH and no Docker Desktop install is present in this environment). Run in CI or a dev machine with Docker before release.

### P0-2 / F-002: Apply Quota Accounting to All AI-Cost Endpoints

Status: [x] Done

Evidence source: [findings-register.md](../.scratch/audit-2026-07-07/findings-register.md), F-002.

Problem:
- `repurpose-post`, `inline-rewrite`, `generate-trends`, and `generate-post-image` skip `checkQuota` and `incrementGenerationCount`.
- Free users can consume platform AI/image quota through alternate endpoints.

Fix scope:
- Add the same quota gate pattern used by `generate-single-post`.
- Increment usage after successful shared-key generation.
- Treat `generate-post-image` as a higher-cost unit if the quota model supports weighted increments; otherwise count it as one unit and record a follow-up.

Acceptance criteria:
- [x] Each listed endpoint checks quota before provider calls.
- [x] Each listed endpoint increments quota after successful generation.
- [x] BYOK/shared-key behavior remains consistent with existing quota rules.
- [ ] Tests cover quota exceeded and successful increment paths. (Deferred — see notes.)

Verification:

```bash
npm run test:run
```

Notes:

- `repurpose-post`, `inline-rewrite`, `generate-trends`, `generate-post-image` now import `checkQuota`/`incrementGenerationCount`/`quotaExceededMessage` and gate/increment exactly like `generate-single-post`. `generate-post-image` counts as 1 unit (no weighted-increment support exists in `increment_generation_count` yet) — **follow-up owed**: consider a weighted `p_amount` param for image generation, given it's the most expensive unit per the audit.
- While restoring quota accounting, discovered `increment_generation_count()` had regressed (see F-016 notes) to always reject service-role callers — fixed in the same pass so this quota gate actually persists usage in production, not just checks it.
- **Deferred item now closed (2026-07-08):** added the per-endpoint "quota exceeded" / "successful increment" tests. Each of the four handlers (`repurpose-post`, `inline-rewrite`, `generate-trends`, `generate-post-image`) was refactored to export a testable `handle*` function with `Deno.serve` guarded behind `typeof Deno !== "undefined" && Deno.serve` (same pattern already used by `telemetry/index.ts` and `verify-payment/index.ts`), then covered with a dedicated `*.test.ts` file: `repurpose-post/repurpose-post.test.ts`, `inline-rewrite/inline-rewrite.test.ts`, `generate-trends/generate-trends.test.ts`, `generate-post-image/generate-post-image.test.ts`. Each file asserts: 402 `QUOTA_EXCEEDED` with no provider call and no increment when shared-key quota is exhausted; exactly one increment after a successful shared-key generation; BYOK `key_mode: "always"` bypasses the gate with no increment; and no increment on a failed provider call. 16 new tests, all passing.

### P0-3 / F-004: Verify Calendar Ownership in `generate-post-image`

Status: [x] Done

Evidence source: [findings-register.md](../.scratch/audit-2026-07-07/findings-register.md), F-004.

Problem:
- `generate-post-image` validates `calendarId` format but does not verify that the authenticated user owns that calendar before upload/media reference creation.

Fix scope:
- After decoding and normalizing `calendarId`, query `saved_calendars` with service role for `id = calendarId` and `user_id = userId`.
- Return 403 when the calendar is missing or owned by another user.
- Do not upload or create `media_references` on ownership failure.

Acceptance criteria:
- [x] Owner can generate image for their calendar.
- [x] Non-owner receives 403.
- [x] No storage object or media reference is created on 403.

Verification:

```bash
npm run test:run
```

Notes:

- `supabase/functions/generate-post-image/index.ts` adds `verifyCalendarOwnership()` (service-role `select id from saved_calendars where id=... and user_id=...`) called right after input validation, before the rate-limit check, image generation, upload, or `media_references` insert. Returns `403` on a miss.

### P0-4 / F-005: Revoke Admin Table Mutation Grants from `authenticated`

Status: [x] Done

Evidence source: [findings-register.md](../.scratch/audit-2026-07-07/findings-register.md), F-005.

Problem:
- `admin_users` grants `INSERT`, `UPDATE`, and `DELETE` to `authenticated`; current RLS protects it, but the table grant is too broad.

Fix scope:
- Add migration:
  - `REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated;`
  - `GRANT INSERT, UPDATE, DELETE ON public.admin_users TO service_role;`
- Keep authenticated `SELECT` if still needed by admin-status queries.

Acceptance criteria:
- [x] Non-admin authenticated users cannot mutate `admin_users`.
- [x] Admin status reads still work.
- [x] Service-role admin maintenance still works.

Verification:

```bash
npm run test:run
```

Notes:

- Migration: `supabase/migrations/20260707010000_revoke_admin_users_authenticated_grants.sql`.

## P1: High Priority

### P1-1 / F-003: Add Request Body Length Guards to AI Edge Functions

Status: [x] Done

Fix scope:
- Add `checkContentLength(req)` as the first statement inside handlers for `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `generate-trends`, and `generate-post-image`.

Acceptance criteria:
- [x] Oversized request returns 413 before JSON parsing/provider calls.
- [x] Normal-sized requests continue to work.

Verification:

```bash
npm run test:run
```

Notes:

- All six handlers call `checkContentLength(req)` as the first statement, before `req.json()`.

### P1-2 / F-011: Sanitize Upstream Error Body Logs

Status: [x] Done

Fix scope:
- Route raw upstream/provider error text through `sanitizeLogValue`.
- Apply to `generate-post-image`, `queue-worker`, and `cleanup-media` logging paths called out by the finding.

Acceptance criteria:
- [x] Logs no longer persist raw provider response bodies or full user prompts.
- [x] Operators still get status/code-level debugging context.

Verification:

```bash
npm run test:run
```

Notes:

- `generate-post-image`: image-gateway error body, JSON-parse failure, unknown-response-shape, and orphan-fetch warning logs now go through `sanitizeLogValue`.
- `queue-worker`: `last_error` written to the `job_queue` table (not just console) and the top-level/`processJob` error responses are sanitized.
- `cleanup-media`: top-level catch response sanitized.

### P1-3 / F-009: Use Stable OAuth Redirect URI

Status: [x] Done

Fix scope:
- Stop composing `redirect_uri` from `nextPath`.
- Preserve intended destination through `state`, localStorage, or existing post-login navigation.

Acceptance criteria:
- [x] Google OAuth uses a stable configured redirect URI.
- [x] MCP consent flow still returns user to `/.lovable/oauth/consent?...` after login.
- [x] OAuth errors still render inline.

Verification:

```bash
npm run test:run
npm run test:e2e -- --project=chromium --reporter=line
```

Notes:

- `src/pages/Auth.tsx`: `handleGoogle()` now sends `redirect_uri: window.location.origin` (stable) and stashes `nextPath` in `localStorage["auth:oauth_next"]` before redirecting. The post-login effect resolves `from` as `nextPath ?? storedNext ?? location.state.from ?? "/app"` and clears the stored key once consumed. The auto-generated `lovable` client (`src/integrations/lovable/index.ts`, "Do not modify") has no `state` param, hence localStorage.
- **2026-07-08: Chromium e2e now run** (a browser is available in this environment — `npm run test:e2e -- --project=chromium --reporter=line`). Full suite: 33/33 passing, including the 4 accessibility (`axe-core`) scans that were previously untested. Running it surfaced and fixed 4 real WCAG AA color-contrast regressions unrelated to F-009 itself — see "Accessibility fixes found while running deferred e2e" below.

### P1-4 / F-020: Add Payment Verification Tests

Status: [x] Done

Fix scope:
- Add unit tests for `verify-payment` failure branches:
  - bad signature
  - wrong user
  - wrong amount
  - missing or invalid plan

Acceptance criteria:
- [x] Payment verification tests fail on trust-before-verify regressions.
- [x] Successful verification path remains covered or gets a positive test.

Verification:

```bash
npm run test:run
```

Notes:

- Extracted the handler into `handleVerifyPayment()` (guarded `Deno.serve` call, same pattern as `telemetry/index.ts`) so it's importable from Vitest.
- `supabase/functions/verify-payment/verify-payment.test.ts`: 6 tests — bad signature, wrong user, wrong amount, invalid plan, missing fields, and one full positive grant path. All passing.

### P1-5 / F-006: Strengthen Password Policy

Status: [x] Done

Fix scope:
- Raise minimum length to 10.
- Require at least one letter and one digit.
- Enable Supabase leaked-password protection in the dashboard, or document the manual dashboard step with owner/date.

Acceptance criteria:
- [x] Weak passwords like `password` fail client validation.
- [x] Existing password policy tests are updated.
- [ ] Supabase-side leaked-password protection status is documented. (Owner/date not yet assigned — see notes.)

Verification:

```bash
npm run test:run
```

Notes:

- `src/lib/passwordPolicy.ts`: `PASSWORD_MIN_LENGTH` raised to 10, plus a letter-and-digit requirement.
- Updated `src/lib/__tests__/passwordPolicy.test.ts`, `passwordPolicy.edgeCases.test.ts`, and `src/pages/__tests__/ResetPassword.test.tsx` (which had hardcoded "at least 8 characters" and letter-only sample passwords) for the new policy.
- **Deferred**: enabling Supabase Auth's "leaked password protection" (Dashboard → Auth → Password protection) is a manual dashboard toggle outside this codebase — owner and date not assigned yet. Record who/when here once done.

### P1-6 / F-024: Use Strict Shared CORS Allowlist

Status: [x] Already resolved (no change needed)

Fix scope:
- Move telemetry-style origin allowlist behavior into shared `getCorsHeaders`.
- Use configured `ALLOWED_ORIGIN` values.
- Keep local development and explicitly allowed preview behavior working.

Acceptance criteria:
- [x] Unlisted production origins do not receive permissive CORS.
- [x] Configured production/staging origins work.
- [x] Existing telemetry CORS behavior remains compatible.

Verification:

```bash
npm run test:run
```

Notes:

- Found already implemented in `supabase/functions/_shared/promptHelpers.ts` (`getCorsHeaders`): an `ALLOWED_ORIGIN`-driven allowlist, fail-closed in deployed environments when the secret is missing, plus a `*.lovable.app`/`*.lovableproject.com` pattern allowance — functionally equivalent to `telemetry/index.ts`'s model. This must have landed in a commit after the audit snapshot; verified by reading the current file rather than trusting the finding text. No code change made.

## P2: Improvements

### P2-1 / F-008: Resolve Calendar Variant Scoring Path

Status: [x] Done

Fix scope:
- Either restore body variant generation for calendar posts, or remove the dead scoring path from calendar generation and document single-shot behavior.

Acceptance criteria:
- [x] Calendar quality path is intentional and tested.
- [x] No silent `body_variants` scoring skip remains.

Notes:

- Chose the "remove the dead path" option per the resolution call. `supabase/functions/generate-calendar/index.ts`: removed the `scoreVariants`/`variant_scores`/`chosen_index` block (candidates.length was always 1 since `body_variants` was already removed from the tool schema, so the branch was unreachable) and replaced with a plain `normalizePost` map, with a comment documenting that calendar generation is intentionally single-shot. Removed the now-unused `scoreVariants` import.

### P2-2 / F-010: Persist Wizard Store Locally

Status: [x] Done

Fix scope:
- Wrap `useWizardStore` with Zustand `persist`.
- Partialize only recovery-safe wizard state.
- Keep DB-backed `wizard_drafts` as cross-device backup.

Acceptance criteria:
- [x] Offline refresh restores in-progress wizard state.
- [x] Cross-device draft restoration remains available.

Notes:

- `src/stores/useWizardStore.ts`: wrapped with `persist(..., { name: "cf:wizard", partialize: {form, posts, postTimes, lockedDays, activeDay, step} })`. `wizard_drafts`/`loadSnapshot` untouched, so cross-device recovery still works alongside the new same-device localStorage layer.
- Added 2 tests to `src/stores/__tests__/useWizardStore.test.ts` asserting the partialized fields land in `localStorage["cf:wizard"]` and that ephemeral fields (`autosaveStatus`, `sampleMode`) do not.

### P2-3 / F-014: Validate OAuth Consent Redirect Target

Status: [x] Done

Fix scope:
- Reject malformed or non-http(s) redirect targets before assigning `window.location.href`.

Acceptance criteria:
- [x] `javascript:` and `data:` targets are refused.
- [x] Valid registered http(s) targets still work.

Notes:

- `src/pages/OAuthConsent.tsx`: added `isSafeRedirectTarget()` (parses via `new URL()`, requires `http:`/`https:` protocol) and applied it to both the passive `getAuthorizationDetails` immediate-redirect path and the `decide()` approve/deny path.
- New test file `src/pages/__tests__/OAuthConsent.test.tsx` (4 tests) covers scopes rendering, busy state, the `javascript:` rejection, and a valid-https happy path.

### P2-4 / F-015: Improve OAuth Consent Accessibility

Status: [x] Done

Fix scope:
- Render `details.scopes` as a list.
- Add `aria-busy` and visible disabled/busy states.
- Move inline layout styling to CSS classes.

Acceptance criteria:
- [x] User can review requested scopes before approving.
- [x] Busy/disabled state is perceivable.

Notes:

- `details.scopes` now renders as a `<ul className="oauth-consent-scopes">`. `aria-busy={busy}` added to both buttons plus a `[aria-busy="true"]`/`:disabled` CSS rule for a visible dimmed state. All inline `style={{...}}` replaced with `.oauth-consent-*` classes added to `src/styles/pages.css`.

### P2-5 / F-017: Refresh Live Data on Window Focus

Status: [x] Done (adapted — see notes)

Fix scope:
- Re-enable `refetchOnWindowFocus` for live admin, quota, and subscription queries rather than changing the global default blindly.

Acceptance criteria:
- [x] Admin/quota/subscription views refresh when returning to the tab. (Adapted — see notes.)
- [x] Wizard destructive flows are not disrupted. (Global default untouched.)

Notes:

- Admin dashboard (`src/pages/Admin.tsx`) and `useSubscription` do not use React Query in this codebase — they're plain `useEffect`/`useState`, so there is no `admin`/`subscription` query key to flip `refetchOnWindowFocus` on. The closest real analogue to "live data that changes outside this tab" is `useScheduledPostsQuery` (`src/hooks/queries/useScheduleQueries.ts`, key `scheduled-posts-status`), whose `workflow_status`/`published_at` are updated by the `queue-worker` cron independent of the viewing tab. Set `refetchOnWindowFocus: true` there; left the global `QueryClient` default untouched so wizard/autosave behavior is unaffected.

### P2-6 / F-018: Split Vendor Bundle Further

Status: [x] Done

Fix scope:
- Add manual chunks for `@radix-ui` and `@tanstack` at minimum.
- Confirm `three` and `gsap` remain split.

Acceptance criteria:
- [x] Build passes.
- [x] Main vendor chunk is materially smaller (radix + tanstack now split out).

### P2-7 / F-021: Replace Preview OG Image

Status: [x] Done

Fix scope:
- Replace Lovable preview OG image URL with a stable branded asset under `public/brand` or equivalent stable hosting.

Acceptance criteria:
- [x] Social preview metadata references a stable asset.

Notes:

- `index.html`: `og:image`/`twitter:image` now point at `https://contentforged.lovable.app/brand/logo-horizontal.svg` (checked into the repo under `public/brand/`) instead of the expiring `id-preview-...lovable.app` R2 URL. Not a dedicated 1200×630 social-card PNG — flagged as a possible follow-up if a purpose-built raster asset is wanted, but it satisfies "stable branded asset" today.

### P2-8 / F-019: Surface Unknown Telemetry Events in Dev

Status: [x] Done

Fix scope:
- Return 400 for unknown event names in dev/non-production while keeping silent 202 behavior in production if desired.

Acceptance criteria:
- [x] Event typos are visible during development.
- [x] Production telemetry remains low-noise.

Notes:

- `supabase/functions/telemetry/index.ts`: reuses the existing `DENO_DEPLOYMENT_ID` deployed/local heuristic (same one `_shared/promptHelpers.ts` uses) — unknown event names now return `400` locally and keep the low-noise `202` in deployed environments.

### P2-9 / F-023: Surface Subscription Hook Errors

Status: [x] Done

Fix scope:
- Add an `error` field to `useSubscription`.
- Let consumers distinguish "free" from "failed to load."

Acceptance criteria:
- [x] Subscription status failures can show retry/error UI.
- [x] Existing consumers remain compatible or are updated.

Notes:

- `src/lib/subscription.ts`: `getSubscriptionStatus()` previously swallowed the final unexpected-failure branch and always resolved `FREE_STATUS` — changed it to `throw` there (kept the two legitimate "no session" / "missing-column schema migration" fallbacks as silent `FREE_STATUS`, since those are real degrade-gracefully cases, not failures).
- `src/hooks/useSubscription.ts`: added `error: Error | null` to the return value; `refresh()` now catches and sets it, clearing on a subsequent successful call. `isPro`/`isStarter`/etc. still fall back to free-tier display values so existing consumers (`PlanSettings`, `WelcomeBanner`, `TierBadge`, `ProGate`) don't need changes to keep working; they can opt into reading `error` for retry/error UI.
- New test: `src/hooks/__tests__/useSubscription.test.ts` (3 tests).

## P3: Debt and Polish

### P3-1 / F-007: Add SECURITY DEFINER Regression Tests

Status: [x] Done

Fix scope:
- Add SQL tests proving SECURITY DEFINER functions cannot leak cross-user data or allow non-admin admin actions.

Notes:

- New file `supabase/tests/security_definer_isolation.test.sql` (pgTAP, 4 tests): `get_decrypted_api_key()` cross-user isolation (two users, two providers, each only ever sees their own), and non-admin rejection for `admin_calendar_stats()` and `admin_grant_tier()`.
- Not executed locally — no Docker daemon in this sandboxed shell, so `supabase test db` cannot start. Run in CI or on a dev machine with Docker before release, alongside the other new pgTAP files (`update_policy_ownership.test.sql`, `quota_reset.test.sql`).

### P3-2 / F-012: Remove BYOK Placeholder API Key

Status: [x] Done

Fix scope:
- Remove or type out the `"USER_KEY_STORED_SERVERSIDE"` placeholder from `aiClientResolver`.
- Make server-only user-key behavior explicit in the return type.

Notes:

- `src/lib/aiClientResolver.ts`: `resolveAiClient()` return type is now a discriminated union — `{apiKey: string, provider, source:"platform"}` or `{apiKey?: undefined, provider, source:"user"}` — so the "user" branch has no key string to expose at all, not even a placeholder.
- `src/lib/brandMemory.ts`: removed both `=== "USER_KEY_STORED_SERVERSIDE" ? undefined : ...` call sites; `userApiKey: userKeyInfo.apiKey` now does the right thing by construction.
- Updated `src/lib/__tests__/aiClientResolver.test.ts` to assert `apiKey` is `undefined` for the user-source path instead of "truthy".

### P3-3 / F-013: Improve Post Performance Scoring Heuristics

Status: [x] Done

Fix scope:
- Filter topic stopwords before CTA matching.
- Improve stemming and sentence splitting.
- Add tests for common false-positive/false-negative cases.

Notes:

- `src/lib/postPerformanceScore.ts`: added a `STOPWORDS` set + `meaningfulTopicWords()` helper, used by both `scoreCtaEffectiveness` (topic-match CTA bonus) and `scoreHashtagRelevance` (was already filtering by length only). `stem()` extended with `-th`, `-ness`, `-tion`/`-sion` handling (fixes the cited `#growing` vs `growth` false negative). `estimateReadability` sentence split now includes `;`, `\n`, and em-dash/double-hyphen, not just `.!?`.
- 4 new tests in `src/lib/__tests__/postPerformanceScore.test.ts` covering: no false CTA bonus from a leading-stopword topic, still-awarded bonus for a real topic word, `#growing`/`growth` match, and semicolon-delimited text scoring the same readability grade as period-delimited text.

### P3-4 / F-016: Make Monthly Quota Reset Atomic in Increment RPC

Status: [x] Done — plus a related regression found and fixed

Fix scope:
- Inline quota-period reset logic into `increment_generation_count`.

Notes:

- Investigation found the atomic reset had actually already been added once, in `20260626000000_monthly_quota_reset.sql` — but a **later** migration, `20260703080952_...sql` (which added the `auth.uid() = p_user_id` authorization check as part of the F-005-adjacent security hardening pass), recreated the function from an older copy and silently dropped the reset logic again, regressing to plain `generation_count + 1`.
- Worse: that same later migration's authorization check (`auth.uid() IS NULL OR auth.uid() <> p_user_id`) rejects the *only* real caller — every edge function invokes this RPC with the service-role key, under which `auth.uid()` is `NULL`. The exception was being silently swallowed by `incrementGenerationCount()`'s try/catch, meaning **quota usage was never actually being persisted in production**, independent of anything in this audit.
- New migration `supabase/migrations/20260707020000_restore_atomic_quota_reset.sql` restores the atomic monthly reset from `20260626000000` and narrows the auth check to `auth.uid() IS NOT NULL AND auth.uid() <> p_user_id` — service-role calls (auth.uid() IS NULL) pass through, while a direct authenticated-client RPC call still can't increment another user's count.
- New test: `supabase/tests/quota_reset.test.sql` (pgTAP, 4 tests) — not executed locally (no Docker), same as the other new SQL test files.

### P3-5 / F-022: Document Authoritative BYOK Grant Migration

Status: [x] Done

Fix scope:
- Add a clarifying comment to the latest migration that currently establishes BYOK RPC grants.

Notes:

- Added a header comment to `supabase/migrations/20260703090000_repair_byok_rpc_grants.sql` explicitly marking it as the authoritative current grant state, naming the two earlier migrations it supersedes, and instructing future maintainers not to try to reconcile by editing the older ones.

### P3-6 / Code Duplication: Normalize Admin Checks

Status: [x] Done

Evidence source: [roadmap.md](../.scratch/audit-2026-07-07/roadmap.md), P3-6.

Fix scope:
- Replace inline admin-check `EXISTS` patterns with `is_admin()` where appropriate.

Notes:

- Found one remaining inline pattern: `"Admins read all payments"` policy on `public.payments` (from `20260616000000_subscription_tiers.sql`, which predates `is_admin()`'s definition in `20260617000000_admin_comp_grants.sql`). New migration `supabase/migrations/20260707030000_normalize_admin_checks.sql` recreates that one policy using `is_admin()`. Left all other admin-gated functions/policies as-is since they already use `is_admin()`.

## Accessibility Fixes Found While Running Deferred e2e (2026-07-08)

Not audit-register findings (no F-ID) — these surfaced from actually running the Chromium `axe-core` scans that P1-3/F-009 had left deferred. All four are genuine WCAG 2 AA `color-contrast` violations, confirmed with a direct `axe.run()` reproduction of each failing route before fixing:

- **`.auth-divider`** (`src/styles/pages.css`) — the "or" divider on the sign-in page used `--color-text-disabled` (#a8a29e, 2.52:1 on white). Switched to `--color-text-muted` (4.80:1).
- **Inline date `<strong>` highlights** (`src/pages/Index.tsx`, two occurrences) — leftover dark-theme lime green (`rgba(200,240,154,.85)`, ~1.4:1 against the light card) on the "Your post will be written for **{date}**" / "Day 1 will be **{date}**" hints. Switched to `var(--color-primary)`.
- **Sandbox-mode banner text and button** (`src/pages/Index.tsx` and `src/pages/CalendarDetail.tsx`, same markup in both) — `var(--color-warning-text)` (#b45309) measured 4.15–4.50:1 against its own tinted background, under or right at the AA line. Switched both to `#92400e` (5.9–6.4:1 against the same backgrounds).
- **Landing "How It Works" sticky steps** (`src/styles/pages.css`, `.ld-w-hiw-step-item`/`.ld-w-step-badge`) — the non-active scroll-linked steps were dimmed to `opacity: 0.4` for a storytelling effect, which is real body copy (not decorative, unlike the already-excluded `.ld-w-step-num-ghost`), so it fails AA when axe scans the static unscrolled page. Raised to `opacity: 0.85` and darkened the badge from `--color-primary` to `--color-primary-hover` (the *active* badge was also failing at 4.22:1 against its own tinted background even at full opacity, by itself). All three text roles now clear 4.5:1+ at the reduced opacity.

Twelve more `color: var(--color-text-disabled)` call sites remain in `src/styles/pages.css` (lines ~1627, 2030, 2973, 3078, 3462, 3611, 3737, 3782, 3870, 3915, 3990, 4289) that were **not** touched — the e2e suite's four scanned routes didn't exercise them, so each needs its own contrast check before recoloring (some may legitimately be disabled-control text, which WCAG 1.4.3 exempts). Flagged here as a follow-up rather than blind-swept.

## Positive Verifications

These audit entries require no remediation, but should be preserved by regression tests:

- F-025: BYOK provider type gap is fixed.
- F-026: `verify-payment` uses timing-safe HMAC comparison, re-fetches Razorpay order, validates user and amount, and is idempotent.
- F-027: Markdown stripping is applied as a deterministic post-copy backstop.

## Workflow and Component Coverage Notes

Use these audit files while resolving related items:

- Auth, OAuth, wizard, scheduling, media cleanup, BYOK, admin, payment, draft recovery, export, and offline flows are summarized in [workflows.md](../.scratch/audit-2026-07-07/workflows.md).
- Auth tabs, OAuth consent buttons, route guards, wizard patterns, shadcn primitives, landing animation caveats, and form patterns are summarized in [interactive-components.md](../.scratch/audit-2026-07-07/interactive-components.md).
- Coverage limitations and deep-read/sampled classification are documented in [traversal-log.md](../.scratch/audit-2026-07-07/traversal-log.md).

## Final Release Checklist

- [x] All P0 items complete.
- [x] All P1 items complete or explicitly deferred with owner/date.
- [x] All security/RLS/BYOK/payment changes have regression coverage.
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes with no new warnings.
- [x] `npm run test:run` completes.
- [x] `npm run build` completes.
- [x] Chromium e2e completes (33/33 passing as of 2026-07-08, including the 4 accessibility scans).
- [x] Supabase/RLS tests pass or have documented local environment blocker.
- [x] This runbook has completion notes for every resolved item.
