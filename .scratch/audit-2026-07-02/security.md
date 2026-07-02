# Security & Privacy Audit — 2026-07-02 (continued pass)

**Method note:** Conducted directly (not via delegated subagents — the project's specialized subagent types were found to be non-functional in this session, silently hallucinating tool output instead of executing real reads/greps; see `functional.md`/`uiux.md` for the same caveat). This continues the same-day pass in this file. The original pass prioritized BYOK/payment surfaces and explicitly deferred the full RLS sweep and `create-order` verification — both are now closed out below. Every claim cites a real file:line read in this or the original session.

## BYOK & secret handling

| Item | Status | Evidence |
|---|---|---|
| Auth required (Bearer) on encrypt/decrypt/delete/verify-payment | Pass | `supabase/functions/encrypt-api-key/index.ts:26-30`, `decrypt-api-key/index.ts:26-30`, `delete-api-key/index.ts:23-27`, `verify-payment/index.ts:55-59` |
| Per-user rate limiting on key endpoints | Pass | `encrypt-api-key/index.ts:53-60` (5/min), `decrypt-api-key/index.ts:52-59` (5/min), `delete-api-key/index.ts:50-57` (5/min), `verify-payment/index.ts:80-87` (10/min) |
| Key encryption happens server-side via DB RPC, not client-supplied secret | Pass | `encrypt-api-key/index.ts:181-184` calls `supabase.rpc("upsert_encrypted_api_key", ...)` through the user-scoped client (preserves `auth.uid()` context per code comment on line 180), not a client-passed secret |
| Plaintext key never echoed back to client | Pass | `encrypt-api-key/index.ts` save path returns only `{ success: true }` (line 214); `decrypt-api-key/index.ts` returns only `hasKey`/`provider`/`last4` (lines 83-87), never the full decrypted value |
| Plaintext key not logged | Pass | `decrypt-api-key/index.ts:75-81` explicitly logs only `user_id`/`provider`/`action`/`timestamp`, with an inline comment "Never log raw key in console/server logs" |
| "Validate" (test-ping) path never persists the candidate key | Pass | `encrypt-api-key/index.ts:67-119` — comment at line 68-70 states the key is used only for a live provider ping and never persisted or returned |
| Upstream provider error bodies not forwarded raw to client | Pass | `encrypt-api-key/index.ts:103-116` maps provider HTTP status codes to canned, sanitized reason strings rather than passing through the raw response body |
| Key deletion | **Partial** | `delete-api-key/index.ts:61-70` performs an `UPDATE user_settings SET api_key_enc = null, use_own_key = false ...` — this nulls the encrypted key column rather than deleting a row from a dedicated `api_keys` table (no such table was found; storage is a column on `user_settings`). Functionally the ciphertext is purged, but confirm no other table/cache retains a copy (not checked in this pass — a full grep for `api_key_enc` writes elsewhere is recommended before closing this out) |
| Audit trail on key lifecycle events | Pass | All three functions insert into `api_key_audit_log` with `user_id`, `action`, `ip_address` (`encrypt-api-key/index.ts:143-157,191-205`, `delete-api-key/index.ts:77-91`) |
| `api_key_audit_log` RLS | Pass | `supabase/migrations/20260609124000_api_key_security_hardening.sql:17,23-49` — RLS enabled; policies "Users read own audit log", "Admins read all audit logs", "Service role inserts only"; `GRANT SELECT ... TO authenticated` only (line 49), no `anon` grant found |

## Payments (Razorpay)

| Item | Status | Evidence |
|---|---|---|
| Signature verified server-side before any grant | Pass | `verify-payment/index.ts:99-105` — recomputes `HMAC-SHA256(order_id\|payment_id, key_secret)` and compares via `timingSafeEqual` (constant-time, lines 26-33) before proceeding |
| Plan/tier is derived from the server-persisted order, not the client request | Pass | `verify-payment/index.ts:113-135` — fetches the order directly from Razorpay's API by `orderId` and reads `order.notes.plan`; comment at line 114 states "We trust the ORDER ... never the client" |
| Order ownership checked | Pass | `verify-payment/index.ts:139-142` rejects if `order.notes.user_id !== user.id` |
| Charged amount cross-checked against server-side price table | Pass | `verify-payment/index.ts:143-148` rejects if `order.amount !== plan.amount` |
| Tier grant is idempotent per order | Pass | `verify-payment/index.ts:150-167` — RPC `grant_tier_from_payment` keyed by `p_order_id` |
| No card data stored | Pass (consistent with Privacy claim) | No `card`/`pan`/`cvv` fields encountered in any file read this session; `src/pages/Privacy.tsx:30` states "we do not store your full card details" |

This function is well-built — no tamper vector found in the reviewed logic. **Follow-up check completed this pass:** `create-order/index.ts:63-71` derives the order amount server-side from `getPlan(planId)` and rejects any plan the client didn't ask for validly — the client never supplies a price. Full create→verify path is tamper-resistant.

## CORS

| Item | Status | Evidence |
|---|---|---|
| CORS restricted to app domain in prod | **Fail (Major)** | `supabase/functions/_shared/promptHelpers.ts:5-8` — `allowedOrigin` reads `Deno.env.get("ALLOWED_ORIGIN")` but **falls back to `"*"` when unset** (line 8, comment confirms this is intentional for local/preview convenience). This is shared by every function importing `corsHeaders` (confirmed used in `encrypt-api-key`, `decrypt-api-key`, `delete-api-key`, `verify-payment`, and by extension likely all others). **Risk:** if `ALLOWED_ORIGIN` is not set in the production Supabase project config, every edge function accepts cross-origin requests from any site. This is a config-dependent finding — cannot confirm from code alone whether the production env var is actually set; needs verification against the deployed project's function secrets. |

## RLS sweep — completed this pass

All 36 files under `supabase/migrations/` were grepped for `CREATE TABLE`, `ENABLE/DISABLE ROW LEVEL SECURITY`, and `GRANT ... TO anon`, with the two suspicious hits read in full. Table inventory (actual schema names differ from the generic checklist in the audit plan — no `posts`/`schedules`/`trending_topics` tables exist; content lives in JSONB columns on `saved_calendars`/`scheduled_posts` instead, and no trending-topics feature has backing storage in this codebase):

| Table | RLS enabled | Policy scope | Notes |
|---|---|---|---|
| `profiles` | Yes (`20260419114153...`:12) | `auth.uid()` | — |
| `user_roles` | Yes (`:25`) | via `has_role()` security-definer fn (`:27`) | Correct pattern — avoids recursive RLS on the roles table itself |
| `saved_calendars` | Yes (`:49`) | `auth.uid()` | Holds calendar + post JSONB — this is the `posts`/`calendars` checklist item |
| `scheduled_posts` | Yes (`20260424083236...`:21) | not re-verified in detail this pass | Covers the `schedules` checklist item |
| `templates` | Yes, twice (`20260506_templates_table.sql`, `20260507053815...`) | `auth.uid()` + `is_shared` public-read flag | Two migrations create a `templates` table with the same name and both include RLS; likely one superseded the other via a drop not shown in the diffed files — not a security gap either way since both versions are correctly scoped, but worth a cleanup follow-up to confirm which is authoritative |
| `wizard_drafts` | Yes, twice (`20260508173000...`, `20260610072906...`) | `auth.uid()` | Same pattern as `templates` — re-created, both scoped correctly |
| `api_metrics`, `query_performance` | Yes (`20260604052346...`:4-5) | not re-verified in detail | Created earlier (`20260506_query_optimization.sql`) without RLS, hardened in a later migration — historical gap, now closed |
| `user_settings` | Yes (`20260609123000...`:13) | `auth.uid()` | Holds BYOK ciphertext column — see BYOK section above |
| `api_key_audit_log` | Yes (`20260609124000...`:17) | `auth.uid()` / admin / service-role | Already verified above |
| `payments` | Yes (`20260616000000...`:30) | not re-verified in detail | — |
| `admin_users` | Yes (`20260506_admin_users.sql`) | not re-verified in detail | — |
| `job_queue` | Yes (`20260515190000...`) | service-role only | Correct — this is an internal work queue, not user-facing |
| `telemetry_events` | Yes (same file) | service-role only | Correct |
| `media_references` | Yes (same file) | `auth.uid()` | Correct |
| `regenerate_feedback` | Yes (`20260521120000...`) | service-role only | Correct |
| `rate_limit_counters` | **Enabled then immediately disabled in the same original migration** (`20260506_rate_limit_counters.sql:63,66`), leaving it fully exposed to anyone with the `authenticated` grant issued two lines later (`:76-77`) | — | **Fixed in a later migration**, `20260610080000_reenable_rate_limit_counters_rls.sql`, whose own header comment confirms the bug: *"The previous migration ... disabled RLS immediately after enabling it, leaving the table fully exposed."* Re-enables RLS and adds `auth.uid() = user_id` scoped SELECT/INSERT plus a service-role catch-all. **Historical bug, now resolved — no action needed**, but flagging since it's a good example of exactly the kind of drift this audit exists to catch. |
| `rate_limit_stats` (materialized view over `rate_limit_counters`) | **N/A — Postgres does not support RLS on materialized views** | — | **Still live, Major finding.** `20260506_rate_limit_counters.sql:76` grants `SELECT ... TO authenticated` on this view and it is **never revoked** in any later migration (only `refresh_rate_limit_stats()`'s *execute* permission was revoked, in `20260506123000_security_linter_fixes.sql:21` — the view's SELECT grant was not touched). Since RLS cannot apply to a materialized view, every authenticated user can currently query `rate_limit_stats` and see per-`user_id` aggregated request counts, success/failure rates, and average durations for **every other user in the system** — a real, currently-live cross-tenant data exposure, even though the underlying base table (`rate_limit_counters`) is itself now correctly scoped. |

No `GRANT ... TO anon` was found anywhere in the 36 migrations — anonymous access is not a concern.

`has_role(_user_id, _role)` (`20260419114153...:27`) is implemented as `SECURITY DEFINER`, the correct pattern for avoiding self-referential RLS recursion on `user_roles` — matches what the audit plan expected for admin gating.

## Privacy page vs practice

Read `src/pages/Privacy.tsx` (grep excerpt, lines 27-61):

| Claim | Status | Evidence |
|---|---|---|
| "We do not store your full card details" (payments via Razorpay) | Verified | `Privacy.tsx:30`; consistent with no card fields found in code reviewed |
| "If you choose to add your own AI provider API key, it is encrypted at rest" | Verified | `Privacy.tsx:46`; matches `encrypt-api-key` RPC-based encryption path above |
| Subprocessors listed: Razorpay, Google (OAuth), AI providers via Lovable AI Gateway | Verified as consistent with code | `Privacy.tsx:37-38,54-56`; matches provider list in `encrypt-api-key/index.ts:77` (`openai`, `anthropic`, `openrouter`) — note the Privacy page doesn't name OpenAI/Anthropic/OpenRouter individually, only generically "AI providers" and "Lovable AI Gateway" — **Minor**: consider whether BYOK provider names should be disclosed explicitly since user keys are sent directly to those providers, not just the gateway |
| "You can edit or delete your generated calendars and posts at any time" | Not verified this pass | Did not trace a full account/content deletion path in this session |

## Remediation (ranked)

1. **Major (confirmed, still live) — `rate_limit_stats` materialized view leaks cross-tenant data.** `supabase/migrations/20260506_rate_limit_counters.sql:76`. Every `authenticated` user can currently `SELECT` per-user request counts/success-rates/durations for all users, because Postgres RLS doesn't apply to materialized views and the `GRANT SELECT ... TO authenticated` on this view was never revoked (only the refresh function's execute grant was). Fix: `REVOKE SELECT ON public.rate_limit_stats FROM authenticated;` and grant only to `service_role` (or an admin-checked RPC wrapper) in a new migration.
2. **Major — CORS wildcard fallback.** `supabase/functions/_shared/promptHelpers.ts:8`. Confirm `ALLOWED_ORIGIN` is set in the production Supabase project's function secrets; consider making the fallback fail-closed to a known production origin instead of `"*"` so a missing env var can't silently reopen CORS.
3. **Minor — key-deletion mechanism.** `delete-api-key` nulls a column rather than deleting a row; confirm no other cache/table retains the ciphertext after this call.
4. **Minor — Privacy page provider disclosure.** Consider explicitly naming BYOK providers (OpenAI/Anthropic/OpenRouter) since user-supplied keys are sent directly to them.
5. **Cleanup, not a security issue — duplicate `templates`/`wizard_drafts` table-creation migrations.** Two separate migrations each create a `templates` table and a `wizard_drafts` table under the same names; both versions are correctly RLS-scoped so there's no exposure, but worth confirming which migration is authoritative in the deployed schema to avoid confusion in future changes.

## RLS audit status: now complete

The full-sweep gap flagged in the original pass is closed — every table across all 36 migration files was inventoried for RLS coverage (see table above). One historical gap (`rate_limit_counters` RLS toggled off then back on) was already self-corrected in-repo; one live gap (`rate_limit_stats` matview grant) was found and is listed as remediation #1 above. No `anon` grants exist anywhere in the schema.
