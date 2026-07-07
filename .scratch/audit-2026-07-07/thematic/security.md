# Thematic — Security & RLS

Findings promoted from `findings-register.md`. Severity retains the higher weighting for Security/RLS/BYOK.

- **F-001** *(HIGH)* — Every user-owned UPDATE policy on `saved_calendars`, `scheduled_posts`, `templates`, `user_settings`, `wizard_drafts`, `profiles` is missing `WITH CHECK`. Ownership hijack possible on the four tables where `user_id` is not `UNIQUE`. Verified against live `pg_policies`.
- **F-004** *(HIGH, medium confidence)* — `generate-post-image` does not verify `calendarId` ownership before uploading + inserting a `media_references` row (IDOR).
- **F-005** *(HIGH)* — `admin_users` grants `INSERT/UPDATE/DELETE` to `authenticated` (defense-in-depth failure — safe only while the current single RLS policy is intact).
- **F-006** *(MEDIUM)* — Password policy is length-only.
- **F-007** *(MEDIUM)* — 5 SECURITY DEFINER functions callable by `authenticated`; safe today, no regression tests.
- **F-011** *(MEDIUM)* — Raw upstream response bodies logged on failure (potential PII / prompt echo).
- **F-014** *(LOW)* — OAuth consent redirect target not client-side allowlisted.
- **F-024** *(LOW)* — Shared `getCorsHeaders` likely echoes any origin (only `telemetry` uses a strict allowlist).

## Positive verifications
- **F-025** — BYOK provider-type narrowing is correct.
- **F-026** — `verify-payment` is well-implemented (HMAC, timing-safe compare, server-derived plan/user, idempotent grant).
- **F-027** — `stripMarkdownFormatting` backstop is applied in `normalizePost`.
- RLS is enabled on all 10 public tables (verified via `pg_class.relrowsecurity`).
- BYOK plaintext never returned after storage (`decrypt-api-key/index.ts:70-79` returns only `hasKey`/`last4`).
- `create-order` derives price server-side from `plan` id; `verify-payment` re-fetches order to re-derive.
- No `dangerouslySetInnerHTML` observed in deep-read files.
