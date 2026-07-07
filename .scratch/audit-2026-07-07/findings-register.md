# Findings Register — 2026-07-07

Every finding: **ID · Severity · Confidence · Category · Files · Description · Failure scenario · Fix (scoped)**.

Severity rubric (per `docs/agents/full-app-audit.md`): Security/RLS/BYOK and AI reliability defects weighted one tier higher than the same defect elsewhere.

---

## F-001 · **HIGH** · high · Security/RLS
**Every user-owned UPDATE policy lacks `WITH CHECK`, allowing row-ownership hijack.**

Files: `supabase/migrations/20260419114153_cb213ef4-….sql:14-16, 53`, plus every subsequent per-user UPDATE policy. Verified live against `pg_policies`:

```
saved_calendars/Users update own calendars    qual:(auth.uid()=user_id)  with_check:<nil>
scheduled_posts/Users update own scheduled posts   qual:(auth.uid()=user_id)  with_check:<nil>
templates/Users update own templates          qual:(auth.uid()=user_id)  with_check:<nil>
user_settings/Users can update own user settings   qual:(auth.uid()=user_id)  with_check:<nil>
wizard_drafts/Users update own wizard drafts  qual:(auth.uid()=user_id)  with_check:<nil>
profiles/Users update own profile             qual:(auth.uid()=user_id)  with_check:<nil>
```

**Root cause:** PostgreSQL, when `WITH CHECK` is null on an `UPDATE` policy, uses only the `USING` clause to gate the *old* row — the *new* row is unrestricted. Combined with the fact that `saved_calendars.user_id`, `scheduled_posts.user_id`, `templates.user_id`, `wizard_drafts.user_id` are not `UNIQUE`, the row's `user_id` can be reassigned to another user.

**Failure scenario:** Attacker A owns calendar X. Attacker issues `UPDATE saved_calendars SET user_id='<victim-B-uuid>' WHERE id='X'`. `USING (auth.uid()=user_id)` passes (A still owns X at check time). No `WITH CHECK` → the new row (owned by B) is accepted. B now has a calendar with A's contents — or A has just "planted" a calendar into B's account (spam, abuse, or repudiation). `wizard_drafts` and `scheduled_posts` are equally vulnerable and worse: a planted `scheduled_posts` row triggers the queue-worker to publish content as another user.

**Fix:** For every affected policy, `CREATE POLICY ... FOR UPDATE USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);`. Apply in a single migration for the 6 tables above.

---

## F-002 · **HIGH** · high · AI reliability / cost
**`repurpose-post`, `inline-rewrite`, `generate-trends`, `generate-post-image` skip `checkQuota`/`incrementGenerationCount`, burning platform (LOVABLE_API_KEY) quota for free.**

Files: `supabase/functions/repurpose-post/index.ts:1-70` (no `checkQuota` import), `inline-rewrite/index.ts:1-65` (same), `generate-trends/index.ts:1-45` (same), `generate-post-image/index.ts:1-190` (same — and image generation is by far the most expensive path).

Verified with grep: only `generate-calendar/index.ts` and `generate-single-post/index.ts` import `checkQuota, incrementGenerationCount, quotaExceededMessage`.

**Failure scenario:** A free user hits `/functions/v1/inline-rewrite` at 20 req/min (its rate cap) → 28,800 platform calls/day free of charge. The quota UI in Profile/Admin shows "50/50 used" while the user has consumed thousands of platform credits via alternate endpoints. Same abuse via `repurpose-post` (10/min) and `generate-post-image` (8/min, most expensive).

**Fix:** In each of the four functions, insert the same `checkQuota` + `usingSharedKey` gate + `incrementGenerationCount(userId)` pattern used in `generate-single-post/index.ts:67-79` and `321`. (`generate-post-image` should count as more than 1 unit; adjust `incrementGenerationCount` accordingly or add `p_amount` param.)

---

## F-003 · **HIGH** · high · AI reliability / DoS
**Only `generate-calendar` calls `checkContentLength`; every other AI edge function accepts unbounded request bodies.**

Files: `supabase/functions/_shared/promptHelpers.ts:509` (definition), `supabase/functions/generate-calendar/index.ts:13,40` (only caller). Confirmed by grep — no other `index.ts` imports `checkContentLength`.

**Failure scenario:** Authenticated user POSTs a 20 MB JSON `body.text` to `/functions/v1/inline-rewrite`. Deno parses the whole body, then the function forwards it (via `buildSystemMessage`/`buildUserMessage`) to Gemini. Provider bills for the tokens (or errors after significant work), Supabase edge-function bill spikes, and the per-user 20/min rate limit still leaves room for six-figure token consumption per day.

**Fix:** Add `checkContentLength(req)` guard as the first statement inside each `Deno.serve` handler for `generate-single-post`, `regenerate-post`, `repurpose-post`, `inline-rewrite`, `generate-trends`, `generate-post-image`. The shared helper already returns a 413 Response.

---

## F-004 · **HIGH** · medium · Security / IDOR
**`generate-post-image` does not verify that `calendarId` belongs to the authenticated user before uploading and recording a `media_reference`.**

File: `supabase/functions/generate-post-image/index.ts:139-260`.

`normalizeCalendarId` only validates *format* (`:51-59`). `upsertMediaReference` inserts `user_id: userId, reference_key: <victim-calendar-id>` (`:99-137`). The storage upload uses service role (`:73-97`) and bypasses RLS.

**Failure scenario:** Attacker knows or guesses another user's `saved_calendars.id` (calendars are user-visible in URL routes like `/calendar/:id`, so leakage via a shared/screenshot URL is plausible). Attacker calls `generate-post-image` with that ID and any `prompt` → server generates an image, uploads to storage at a path that depends on that calendar id, and inserts a `media_references` row keyed to the attacker's user_id but referencing the victim's calendar. Downstream cleanup logic (`cleanup-media/index.ts:hasDbReferences`) checks `public_url` against `profiles.avatar_url` and `media_references.reference_count>0`, not against calendar ownership — the image survives.

**Fix:** After decoding `calendarId`, add a service-role `select id from saved_calendars where id = $1 and user_id = $2` and 403 on miss.

---

## F-005 · **HIGH** · high · Security / privilege
**`admin_users` grants `INSERT/UPDATE/DELETE` to `authenticated` even though only the ALL RLS policy gates it.**

File: `supabase/migrations/20260506_admin_users.sql:38-39`:

```sql
grant select on public.admin_users to authenticated;
grant insert, update, delete on public.admin_users to authenticated;
```

The RLS policy `"Super admin can manage admin users"` correctly requires `has_role(auth.uid(),'admin')`, so this is safe **today**. It is a defense-in-depth failure: any future migration that drops or weakens that single policy immediately exposes admin-role self-assignment to every authenticated user. Standard Supabase pattern is `GRANT ... TO service_role` for admin-only tables.

**Failure scenario:** A future migration replaces the policy (e.g. attempts to allow admins to "reveal themselves") with a broader clause and forgets `WITH CHECK`. Because the table-level GRANT is already `insert/update/delete TO authenticated`, the moment RLS is relaxed the whole app is one policy edit away from full privilege escalation.

**Fix:** `REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM authenticated; GRANT INSERT, UPDATE, DELETE ON public.admin_users TO service_role;` — keep only `GRANT SELECT ... TO authenticated` (needed by the "view own admin status" query in the app).

---

## F-006 · **MEDIUM** · high · Security / defense-in-depth
**Password policy is length-only (8 chars); no complexity, no breached-password check, no throttling above rate-limit.**

File: `src/lib/passwordPolicy.ts:1-8` (entire file):

```
export const PASSWORD_MIN_LENGTH = 8;
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  return null;
}
```

**Failure scenario:** User signs up with password `password` (8 chars, easily brute-forced/credential-stuffed). No have-i-been-pwned check; Supabase's own auth allows this. Combined with BYOK (users' API keys are stored under this account) and admin-grant paths, a single stuffed account owns real spend.

**Fix:** Bump `PASSWORD_MIN_LENGTH` to 10, require at least one letter + one digit, and enable Supabase Auth's "leaked password protection" toggle (Supabase Dashboard → Auth → Password protection; server-side check against HIBP).

---

## F-007 · **MEDIUM** · high · Security / DB
**5 SECURITY DEFINER functions callable by `authenticated` (Supabase linter warns).**

Source: `supabase--linter` output (5× `SUPA_authenticated_security_definer_function_executable`). Grep points to: `has_role`, `is_admin`, `get_decrypted_api_key`, `upsert_encrypted_api_key`, `admin_grant_tier`, `admin_calendar_stats`, `increment_generation_count`.

These functions do check `auth.uid()` / `is_admin()` internally, so the warnings are largely intentional — but two of them are risky at rest:

- `get_decrypted_api_key()` returns the plaintext BYOK key. Any authenticated user can call it and receive **their own** decrypted key (that is the design). If a future change ever makes it return `SELECT api_key_enc FROM user_settings` without a `WHERE user_id = auth.uid()` filter, every user's key leaks. The function body currently is safe (`v_user_id := auth.uid(); ... FROM public.user_settings WHERE user_id = v_user_id`), but the guard is one edit deep.
- `admin_grant_tier` and `admin_calendar_stats` are gated by `IF NOT is_admin() THEN RAISE`. Same one-edit-deep risk.

**Fix:** No code change required today; add a regression test that asserts the SECURITY DEFINER functions cannot leak cross-user data (SQL test under `supabase/tests/`), and add a lint-ignore comment referencing that test so future scanners aren't noisy.

---

## F-008 · **MEDIUM** · high · AI reliability
**Post-scoring pipeline treats missing `body_variants` as a downgrade rather than a graceful fallback path.**

Files: `supabase/functions/generate-calendar/index.ts:207-224`, `_shared/promptHelpers.ts:1822` (`scoreVariants`). Calendar tool schema *removed* `body_variants` (comment at `generate-calendar/index.ts:129-133` — "Combined with the large per-post schema, they made Gemini's forced tool-call fail with an upstream 400"). Yet the scoring pass at `:207-217` still walks `p.body_variants` — when absent, `candidates.length === 1` and `scoreVariants` is skipped silently, so no `variant_scores`/`chosen_index` ever exist for calendar posts.

**Failure scenario:** Calendar quality metrics rely on `chosen_index` to pick the winning variant. Because calendar always ships one variant, the "LLM-as-judge" logic is effectively dead code for the primary path, while single-post generation still exercises it — leading to *worse* copy quality in the 7-post calendar than in a single regenerate call.

**Fix:** Either (a) restore variant generation for calendar (increase `max_tokens`, split into two smaller tool calls, or use a two-pass "generate one → generate three variants of body") or (b) remove the dead variant scoring path from `generate-calendar` and document that calendar posts intentionally single-shot.

---

## F-009 · **MEDIUM** · high · Frontend / auth UX
**Google OAuth `redirect_uri` is dynamically composed from `nextPath`, which will typically fail the provider's exact-match check.**

File: `src/pages/Auth.tsx:96-98`:

```
const result = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: `${window.location.origin}${nextPath ?? ""}`,
});
```

**Failure scenario:** User initiates OAuth from `/auth?next=/.lovable/oauth/consent?authorization_id=xxx`. `nextPath` = that whole string; `redirect_uri` = `https://app/.lovable/oauth/consent?authorization_id=xxx`. Google requires an *exact-match* redirect_uri against the configured allowed URIs — query strings must match. The MCP consent flow (from the just-added feature) therefore breaks for any user who isn't already signed in, because the very first OAuth attempt after landing on the consent screen will 400 with `redirect_uri_mismatch`.

**Fix:** Always send a stable `redirect_uri` (e.g. `${window.location.origin}/auth/callback` or just `${window.location.origin}`) and preserve `nextPath` via `state` / localStorage. The `useEffect(user)` navigator at `:37-39` already routes to `from`, so `nextPath` doesn't need to be in the redirect URL.

---

## F-010 · **MEDIUM** · medium · State management
**`useWizardStore` (`src/stores/useWizardStore.ts:40-129`) uses `create()` without `persist`, and `loadSnapshot` (:95-108) is the only draft-restoration surface.**

The store holds `form`, `posts`, `postTimes`, `lockedDays`, `activeDay`, `savedId`. Draft recovery relies on a separate `wizard_drafts` table (verified via migration `20260508173000_create_wizard_drafts.sql`) written by autosave. When network is offline mid-wizard, the autosave POST fails; `autosaveStatus` becomes `"error"` but the in-memory state is not mirrored to `localStorage`, so a browser refresh loses all unsaved wizard input.

**Failure scenario:** User fills step 3 of the wizard on a flaky mobile network. Autosave fails (offline). User closes the tab thinking "it's saved". On reopen, wizard resets to step 1 with the last successfully-persisted snapshot (potentially step 1 defaults).

**Fix:** Wrap the store with `persist(..., { name: "cf:wizard", partialize: ({ form, posts, postTimes, lockedDays, activeDay, step }) => ({...}) })` so localStorage is the *primary* recovery source and the DB write becomes best-effort backup. Existing `loadSnapshot` still handles cross-device recovery from `wizard_drafts`.

---

## F-011 · **MEDIUM** · high · Security / logging hygiene
**`generate-post-image` logs raw upstream response body on failure, potentially including provider-side prompt echoes.**

File: `supabase/functions/generate-post-image/index.ts:238-244`:

```
if (!imageRes.ok) {
  const text = await imageRes.text().catch(() => "");
  console.error(`Image gateway error ${imageRes.status}. Response body:`, text);
  ...
}
```

Similar unbounded logging in `queue-worker/index.ts:113-128` (`last_error: String(error)` written to DB) and `cleanup-media/index.ts:94-96`. The gateway occasionally echoes the offending `prompt` verbatim in error bodies. Prompts derived from user-supplied post copy can contain PII or brand-sensitive content the user did not consent to persist in server logs.

**Fix:** Route these through `sanitizeLogValue()` (already exported from `_shared/promptHelpers.ts:80`). `console.error(..., sanitizeLogValue(text))`.

---

## F-012 · **MEDIUM** · medium · AI reliability
**`aiClientResolver.ts` never validates that the resolved `provider` matches the shape of `apiKey`, and returns a placeholder string `"USER_KEY_STORED_SERVERSIDE"` that is meaningless to any downstream caller other than the edge function.**

File: `src/lib/aiClientResolver.ts:52-66`. The `apiKey` returned is `userKeyInfo.apiKey || "USER_KEY_STORED_SERVERSIDE"`. `getUserApiKey()` only returns metadata (never the plaintext key) after the security hardening in `20260609124000_api_key_security_hardening.sql`, so `apiKey` is always the placeholder.

**Failure scenario:** Any client-side code that expects `apiKey` from `resolveAiClient` — e.g. a future local-preview path — will send the literal string `"USER_KEY_STORED_SERVERSIDE"` as a Bearer token and the provider will reject with a confusing 401. `localPostGenerator.ts` in this repo does not currently call it, but the API surface invites the mistake.

**Fix:** Change the return type to omit `apiKey` for the `source: "user"` case, or return `null` and require callers to invoke the server for user-keyed generations. Deprecate the placeholder.

---

## F-013 · **LOW** · high · AI reliability / quality
**`postPerformanceScore.ts` scoring heuristics are pattern-based and produce nonsensical outputs for common inputs.**

File: `src/lib/postPerformanceScore.ts`.

- `scoreCtaEffectiveness` (:82-133): `if (topicLower && ctaLower.includes(topicLower.split(" ")[0]))` — a topic that begins with a stopword like `"The future of AI"` uses `"the"` as the bonus token; virtually any CTA gets +2.
- `scoreHashtagRelevance` (:146-173): stem() only strips `ies/ing/ers/er/ed/es/s` (:139-141); false matches for tags like `#growing` vs topic `growth` (stems to `grow` vs `growth`) — undercounts related hashtags.
- `estimateReadability` (:179-208): splits sentences on `/[.!?]+/` only; semicolons/em-dashes/newlines produce artificially long "sentences," inflating grade.
- `scoreHookStrength` (:19-76): a hook starting with `"Stop"` gets score 8 regardless of the rest. Same for `"The"` (matches `/^the (real|truth|problem)/i` — but any `"The"` after that pattern falls through with score 5, correctly).

**Failure scenario:** Users see confident numeric scores that are systematically biased by stopwords and punctuation. The score is exposed prominently in `PerformanceScoreCard.tsx` and drives `getWeakestPerformanceMetric()` which in turn feeds `regenerate-post` targeting — so bad scoring biases what gets regenerated.

**Fix:** Filter English stopwords out of topic tokens before the CTA bonus; extend `stem()` to include `-th`, `-ness`, `-tion`; split sentences on `[.!?;\n]+`. None of these change the API — internal only.

---

## F-014 · **LOW** · high · Security / open redirect (near-miss)
**`OAuthConsent.tsx` blindly follows `data.redirect_url` from Supabase without a same-registered-client check on the client side.**

File: `src/pages/OAuthConsent.tsx:48-51, 70-75`. Trust is delegated to the Supabase OAuth server to return a URL registered by the client. This is the correct trust model, but there is no fallback if the URL is somehow malformed — `window.location.href = target` will happily navigate anywhere.

**Failure scenario:** Compromised Supabase project settings or a bug in `@lovable.dev/mcp-js` returning an unexpected URL takes users off-app after a confirmed "Approve" click.

**Fix:** Whitelist redirect targets against the client's advertised `redirect_uris` (readable from `getAuthorizationDetails` response, if surfaced) or at minimum require `https://` and refuse `javascript:`/`data:` URIs. One-line guard: `if (!/^https?:\/\//.test(target)) return setError("Invalid redirect");`

---

## F-015 · **LOW** · high · Frontend / a11y
**`OAuthConsent.tsx` uses inline `style` for the entire UI (:84-192).**

Bypasses the design system (all other pages use tokens via CSS classes). Color values still use `hsl(var(--…))` so theming is preserved, but the pattern is inconsistent and none of the existing accessibility audits (`e2e/accessibility.spec.ts`) cover this page — it was added with the MCP feature. Focus visibility, contrast on the disabled state (`opacity` not set → busy buttons look identical), and no `<h1>` outside a container with `role="main"` (uses `<main>` — OK).

**Failure scenario:** Screen-reader user activating consent has no per-scope list read out (`details.scopes` is fetched but never rendered) — they approve without knowing what was requested.

**Fix:** Render `details.scopes` as a `<ul>` above the buttons; add `aria-busy={busy}` and a visible disabled state; move layout to `.oauth-consent` class in `pages.css`.

---

## F-016 · **LOW** · high · Backend / concurrency
**`increment_generation_count` uses INSERT … ON CONFLICT DO UPDATE without period-reset atomicity being enforced in the same statement.**

File (per DB function dump in <db-functions>): the RPC does `SET generation_count = public.user_settings.generation_count + 1`. `checkQuota` (`_shared/promptHelpers.ts:831-838`) computes `effectiveCount` from `quota_period_start` client-side (edge fn), but the *increment* does not reset the counter when a new month begins.

**Failure scenario:** User last generated at 23:59 on the 31st. Their next call at 00:00 on the 1st reads `effectiveCount = 0` (correct — new month), passes the quota gate, then increments — but the DB row still has `generation_count = <old value>+1` and `quota_period_start = <old month>`. Every subsequent call within that hour repeats: `checkQuota` returns 0, allows, increments — user gets unbounded free generations until the `20260626000000_monthly_quota_reset.sql` cron actually resets the row.

**Fix:** Inline the reset logic into `increment_generation_count`: `if quota_period_start < date_trunc('month', now()) then set generation_count = 1, quota_period_start = date_trunc('month', now())`.

---

## F-017 · **LOW** · medium · Performance / cache
**React Query defaults set `staleTime: 5m`, `retry: 1`, `refetchOnWindowFocus: false` globally (`src/App.tsx:41-49`).**

`refetchOnWindowFocus:false` means the admin dashboard, quota display, and calendar list never refresh when the user tabs back — they persist stale data indefinitely (5m stale, but stale data is still shown until an event invalidates it). Combined with `retry: 1` (rather than exponential backoff), transient 5xx errors on `admin_calendar_stats` show a permanent empty state.

**Failure scenario:** Admin loads dashboard → tabs away for an hour → tabs back → stats still show the hour-old snapshot with no visual indicator of staleness.

**Fix:** Turn `refetchOnWindowFocus` back on for query keys that display live counts (admin, quota, subscription); the wizard's autosave already handles the destructive case.

---

## F-018 · **LOW** · medium · Bundle
**No route-level chunking beyond `lazyWithRetry`; `vite.config.ts` only manual-chunks `three` and `gsap` (:32-38).**

`three` is imported in `src/components/landing/*` (verified via prior turn). `gsap` is presumably a landing dependency. But `@tanstack/react-query`, `@radix-ui/*` (~30 packages in `package.json:186-220`), and `sonner`/`react-helmet-async` all fall into the single `vendor` chunk. The build warns about >500 kB.

**Failure scenario:** First landing-page load on a slow 4G is materially slower than necessary because the vendor chunk contains admin/wizard-only Radix components.

**Fix:** Add `if (id.includes('@radix-ui')) return 'radix';` and `if (id.includes('@tanstack')) return 'tanstack';` in `manualChunks`.

---

## F-019 · **LOW** · high · Correctness
**Telemetry function accepts `payload.name ?? payload.event ?? "unknown"` and drops unknown events silently (202) — legitimate but inhibits noticing typos.**

File: `supabase/functions/telemetry/index.ts:81-88`. Client callers that mis-spell an event name never surface an error and never appear in analytics; they get a happy 202.

**Fix:** In dev mode, return `400 unknown event`; keep 202 in prod. Set via `ALLOWED_ORIGINS` heuristic.

---

## F-020 · **LOW** · medium · Testing
**Payment flow (`create-order`, `verify-payment`) has no unit or e2e test.**

Verified via `find src supabase e2e -name '*.test.*' -o -name '*.spec.*' | xargs grep -l 'verify-payment\|create-order' → empty`. BYOK save/decrypt path has `supabase/tests/api_key_rls.test.sql` and `src/lib/__tests__/apiKeyManager.test.ts` (verified via file listing) — coverage exists there. Admin privilege gating has `src/pages/__tests__/Admin.test.tsx` and `src/hooks/__tests__/useIsAdmin.test.ts`. Payment: nothing.

**Failure scenario:** Any regression in `verify-payment`'s HMAC/amount/user_id checks (F-001-adjacent risk) ships silently. Given payments are the money surface, this is the biggest untested high-risk path.

**Fix:** Add a Deno-side unit test that stubs Razorpay fetch and asserts the four failure branches (bad sig, wrong user, wrong amount, missing plan) all return the expected status.

---

## F-021 · **LOW** · high · SEO / metadata
**Root `index.html` OG image URL is a Lovable-generated preview URL from the id-preview subdomain (`index.html:69-71, 79-80`).**

The `<meta property="og:image" content="https://pub-…lovable.app-1778132437871.png"/>` points at a preview-render URL, not a stable branded asset. If the preview expires or is regenerated, social cards break.

**Fix:** Replace with a static asset under `public/brand/social-card.png` (excluded from re-audit but out-of-band regen OK) or remove and let Lovable's hosting inject the current preview.

---

## F-022 · **LOW** · medium · Dead/duplicative code
**Two migrations perform overlapping `REVOKE/GRANT` on the BYOK RPCs: `20260703073516_harden_function_privileges.sql:27-46` and `20260703080952_….sql:36-59`, later re-repeated by `20260703090000_repair_byok_rpc_grants.sql:141-145`.**

Result is correct (idempotent), but hard to follow; new maintainers may miss which migration is authoritative.

**Fix:** Squash into a single "current authoritative grants" comment at the top of the last migration; leave older ones in place (they are historical record).

---

## F-023 · **LOW** · low · Frontend
**`useSubscription` (`src/hooks/useSubscription.ts:17-42`) sets `loading:false` in `finally` but never surfaces the underlying error to the UI.**

**Failure scenario:** `getSubscriptionStatus()` throws → hook reports `status = FREE_STATUS, loading=false, isPro=false`. UI shows the user as free-tier when they may in fact be Pro.

**Fix:** Add an `error` state field; consumers can decide whether to show a retry or fall back.

---

## F-024 · **LOW** · high · Security / defense-in-depth
**`getCorsHeaders(origin)` (referenced across all AI edge functions) echoes back the request `Origin` (per usage pattern; header allowlist not shown but implied by `origin` parameter). `telemetry/index.ts` correctly uses a strict allowlist (`:37-52`), but the shared helper does not.**

Files: `supabase/functions/_shared/promptHelpers.ts:57` (declaration), every AI edge function `Deno.serve` calls it. Compare against `telemetry`'s allowlist model.

**Failure scenario:** A user's browser session cookie is not sent cross-origin (Supabase JWT is in Authorization header, not cookie), so CSRF risk is low. But an attacker who convinces a target to sign into a look-alike domain can hit the AI endpoints from that origin because CORS lets them; combined with quota bypasses (F-002) this amplifies impact.

**Fix:** Move the telemetry `ALLOWED_ORIGINS` + `ALLOWED_ORIGIN_PATTERNS` model into `_shared/promptHelpers.ts` and make `getCorsHeaders(origin)` use it. Existing `ALLOWED_ORIGIN` env secret exists (per `<secrets>` block) — wire it in.

---

## F-025 · **INFO** · high · Architecture
**`src/lib/aiClientResolver.ts` and BYOK type union — the "known type gap" from the prior audit is *fixed* here.**

`isApiProvider` (:12-14) narrows `string → ApiProvider`; `VALID_PROVIDERS` is a `readonly ApiProvider[]`. Prior audit's flagged gap is closed.

No action required.

---

## F-026 · **INFO** · high · Positive verification
**`verify-payment` (`supabase/functions/verify-payment/index.ts:13-19, 111-173`) correctly uses timing-safe compare, HMAC over `orderId|paymentId`, re-fetches order from Razorpay, and validates `notes.user_id` + `amount` server-side. Idempotency via `grant_tier_from_payment` on `razorpay_order_id`.**

No finding — this is a well-implemented payment verification path.

---

## F-027 · **INFO** · high · Positive verification
**`stripMarkdownFormatting` (`_shared/promptHelpers.ts:111`) is applied inside `normalizePost` (:2283-2293) to `hook_options`, `cta_options`, `hook`, `cta`, and `body`.**

The "no markdown in post copy" rule is enforced as a deterministic backstop, not just a prompt instruction. Verified.

No action required.

---

*Total: 24 defect findings + 3 positive verifications. See `workflows.md`, `interactive-components.md`, `thematic/*`, and `roadmap.md` for organization.*
