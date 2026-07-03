
# ContentForge Audit — Prioritized Findings

Grouped by severity. Each entry: file:line — defect — failure scenario.

## P0 — Critical (BYOK broken / auth bypass / silent data loss)

1. **`supabase/functions/encrypt-api-key/index.ts:196` + `supabase/functions/decrypt-api-key/index.ts:74`** — Edge functions call the BYOK RPCs with a 3rd `p_api_model` arg and read `resultRow.api_model`, but the live DB (per `<db-functions>` introspection) defines `upsert_encrypted_api_key(text, text)` and `get_decrypted_api_key()` returning only `(decrypted_key, api_provider)`. Migration `20260702010000_byok_providers_and_model.sql` (which adds the 3-arg + `api_model` column) never applied, and `20260703080952` still REVOKEs on the 2-arg signature. **Failure:** every "Save API key" click 500s with `PGRST202 no function matches`, and `apiModel` returned to the client is always `null`, so the UI's model selector cannot round-trip. BYOK is effectively broken in production.

2. **`supabase/functions/telemetry/index.ts:44-84`** — Endpoint accepts any POST with no `Authorization` check, no rate limit, and inserts arbitrary `event_name` + `props` into `telemetry_events` using the service role key. **Failure:** any anonymous internet client (CORS is `*`-style permissive) can flood the table with millions of forged rows, poison analytics, and burn quota. Same shape in `dashboard-deploy/telemetry.ts`.

3. **`supabase/functions/_shared/promptHelpers.ts:598-635` (`checkRateLimit`)** — Uses `Deno.openKv()` with non-atomic read-modify-write (`kv.get` → filter → `kv.set`) and no `atomic().check()` versioning; the catch block returns `allowed: true` on any KV error. **Failure:** N concurrent requests each read the same pre-increment count and all pass the `>=` check, letting a user exceed the cap by a factor of concurrency (trivial for encrypt-api-key, generate-calendar, verify-payment). If Deno KV is unavailable in the deployment target, every call short-circuits to unlimited.

4. **`supabase/functions/queue-worker/index.ts` and `supabase/functions/cleanup-media/index.ts`** — Both authorize callers by comparing a client-supplied header against `SUPABASE_SERVICE_ROLE_KEY` (`expectedServiceKey` check), then run destructive service-role work. There is no JWT or `has_role` gate. **Failure:** if the shared secret ever leaks (logs, CI, browser devtools of an admin), any anonymous caller can drain the job queue or delete media rows. A short-lived signed cron token or `has_role('admin')` check would be safer.

5. **`supabase/functions/telemetry/index.ts`** — `event_name`, `props`, and `ts` are written straight from the request body with no schema validation, size cap, or allow-list. Combined with (2), a single POST with a giant `props` blob can bloat the DB.

## P1 — High (security posture / AI reliability)

6. **`src/lib/aiClientResolver.ts:7-16`** — When `platformAvailable` is true, resolver hardcodes `provider: "openai"` even though the platform key is the Lovable AI Gateway (Gemini-family). Downstream `callAI` picks OpenAI-shaped endpoints/models. **Failure:** any code path that inspects `resolvedClient.provider` (telemetry, model selection, error mapping) reports the wrong provider; if the platform key ever gets swapped, this masks real breakage. Also: `VITE_PLATFORM_AI_KEY` is a `VITE_` env var — if ever populated, it is baked into the client bundle and world-readable.

7. **`supabase/functions/verify-payment/index.ts:142-146`** — `order.notes?.user_id && order.notes.user_id !== user.id` short-circuits when `user_id` is absent from Razorpay notes, so an order missing that note is auto-accepted. **Failure:** if `create-order` ever omits `notes.user_id` (or a tampered order is created via a leaked Razorpay key), one user can claim another's payment. Require `user_id` to be present *and* equal.

8. **`supabase/migrations/20260506_rate_limit_counters.sql:71-83`** — Table is created, RLS toggled on/off/on across migrations, `grant insert` given to `authenticated`, but no live code actually writes here — the real limiter is Deno KV (see #3). **Failure:** dead attack surface. Any authenticated user can `insert` arbitrary counter rows (or later gain SELECT on `rate_limit_stats`), yet the data is not trusted by any enforcement path — so admins reading the "rate limit dashboard" see forgeable numbers.

9. **`supabase/functions/_shared/promptHelpers.ts:849,1102` + `src/lib/postInsights.ts`** — The "no markdown in post copy" rule exists only as a prompt instruction. No post-processing regex strips `**bold**`, `*italic*`, headings, or backticks from model output before scoring or display. **Failure:** any model that ignores the rule (common with cheaper providers or long-context prompts) ships raw markdown into `Post.text`, breaks LinkedIn/Instagram rendering, and pollutes scoring signals (readability count changes).

10. **`supabase/functions/generate-calendar/index.ts`, `generate-single-post/index.ts`, `regenerate-post/index.ts`, `repurpose-post/index.ts`, `inline-rewrite/index.ts`** — All parse `await res.json()` from the LLM assuming a well-formed shape. If the model returns non-JSON, a truncated payload, or a schema mismatch, the function throws and the client sees a generic 500. Per CLAUDE.md "AI Graceful Fallback" this must degrade to a partial result or a typed error the wizard can render. Verify each has a `try { JSON.parse } catch { return typed fallback }` — currently at least `generate-calendar` and `regenerate-post` do not.

11. **`src/stores/useWizardStore.ts`** — Store has `autosaveStatus` state but no `persist` middleware and no `subscribe` to write drafts to `wizard_drafts` / localStorage. Autosave is expected to be wired by the wizard components; grep shows only the constant `WIZARD_SERVER_DRAFT_TABLE` and no actual write path is loaded through the store. **Failure:** page reload mid-wizard loses `form`, `extraTopics`, `posts`, `postTimes` unless the wizard component happens to have saved them — needs verification that the recovery dialog re-hydrates from the DB, not from a store that was never populated.

## P2 — Medium (correctness / hygiene)

12. **`supabase/migrations/20260506_rate_limit_counters.sql:88-108`** — `cleanup_old_rate_limits()` and `refresh_rate_limit_stats()` lack `SET search_path` and `SECURITY DEFINER` semantics — flagged by the Supabase linter earlier and still unfixed. Low exploit value but noisy.

13. **`supabase/functions/trends_ingest/index.ts:11` and `supabase/functions/trends_admin/delete.ts:4`** — Use `process.env` (Node) inside Deno runtime. **Failure:** `process` is undefined in Supabase Edge Runtime → these functions crash on boot; they may be dead code but should be removed or ported to `Deno.env.get`.

14. **`src/lib/apiKeyManager.ts:63-70`** — On "mock Supabase URL" the code writes the raw API key to `localStorage` under `social_spark_user_api_key`. This is dev-only, but `!SUPABASE_URL || includes("mock")` also triggers when `VITE_SUPABASE_URL` is accidentally empty in a prod build. **Failure:** a misconfigured production deploy silently persists user keys in plaintext localStorage.

15. **`src/lib/postPerformanceScore.ts`** — Verify scoring is not purely length-based. Sub-scores (hook, CTA, hashtags, readability) should each have an independent test with a "good" and "bad" fixture; `src/lib/__tests__/postPerformanceScore.test.ts` exists but coverage of edge cases (empty hashtags, CTA missing verb, non-English text) is thin. Flag: add discriminating fixtures.

16. **Test coverage gaps vs. risk:**
    - No test asserts `verify-payment` rejects mismatched amount / wrong user / replayed order_id.
    - No test asserts `useIsAdmin` denies a user whose JWT claims `role: admin` but has no `user_roles` row (regression guard for the fix in `20260703000000`).
    - No test round-trips BYOK save → decrypt → generate; would have caught #1 immediately.
    - `e2e/api-key-settings.spec.ts` covers UI only, not the RPC signature.

## P3 — Low (cleanup)

17. **`src/lib/aiClientResolver.ts`** — pre-existing known `ApiProvider` typecheck gap (explicitly called out in the audit brief): `provider: "openai"` cast on the platform path is not validated against `ApiProvider` union at the boundary.

18. **Bundle size** — Prior build warns >500kB. `src/pages/Index.tsx`, `CalendarDetail.tsx`, and the wizard modals are the likely culprits; `lazyWithRetry` is already imported but not applied to `BatchEditModal`, `FeedbackModal`, `DraftRecoveryDialog`, `OnboardingTour`. Low risk, real UX win on 3G.

19. **Dead migrations** — `RUN_ME_combined_catchup.sql` and the two `20260506_*` un-timestamped files bypass the normal ordering; keep only if intentionally out-of-band, else move to `.scratch/`.

## Verification suggestions (before fixing)

- Run `supabase--read_query` on `pg_proc` for `upsert_encrypted_api_key` / `get_decrypted_api_key` to confirm the live signatures — this decides whether #1 is a code bug or a missing migration.
- Curl `telemetry` from an unauth origin to confirm #2.
- Fire 20 concurrent `encrypt-api-key` calls with a valid session and count 200s to confirm #3.
