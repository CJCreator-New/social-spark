# Prioritized Roadmap — 2026-07-07

Every item references a finding in `findings-register.md`. Within tiers, ordered by impact × (1/effort) × dependency depth.

## P0 — Release blockers

| # | ID | Item | Effort |
|---|---|---|---|
| P0-1 | F-001 | Add `WITH CHECK (auth.uid()=user_id)` to UPDATE policies on `saved_calendars`, `scheduled_posts`, `templates`, `user_settings`, `wizard_drafts`, `profiles`. Single migration. | S (1h) |
| P0-2 | F-002 | Add `checkQuota` + `incrementGenerationCount` (and `usingSharedKey` gate) to `repurpose-post`, `inline-rewrite`, `generate-trends`, `generate-post-image`. | M (2-3h) |
| P0-3 | F-004 | Add service-role `saved_calendars` ownership check in `generate-post-image` before upload. | S (30m) |
| P0-4 | F-005 | Revoke INSERT/UPDATE/DELETE on `admin_users` from `authenticated`; grant to `service_role`. | S (15m) |

## P1 — High priority

| # | ID | Item | Effort |
|---|---|---|---|
| P1-1 | F-003 | Add `checkContentLength` to remaining 6 AI edge functions. | S (30m) |
| P1-2 | F-011 | Route error-body logs through `sanitizeLogValue`. | S (30m) |
| P1-3 | F-009 | Send stable `redirect_uri` in `Auth.tsx:97`; preserve `nextPath` via `state`/localStorage. | S (1h) |
| P1-4 | F-020 | Add unit tests for `verify-payment`'s four failure branches. | M (3h) |
| P1-5 | F-006 | Strengthen password policy + enable HIBP. | S (30m) |
| P1-6 | F-024 | Adopt telemetry-style origin allowlist in shared `getCorsHeaders`. | S (1h) |

## P2 — Improvements

| # | ID | Item | Effort |
|---|---|---|---|
| P2-1 | F-008 | Restore or remove calendar `body_variants` scoring path. | M (2-4h) |
| P2-2 | F-010 | Wrap `useWizardStore` with `persist` + partialize. | S (1h) |
| P2-3 | F-014 | OAuth consent target URL validation. | S (30m) |
| P2-4 | F-015 | Render `details.scopes` in `OAuthConsent.tsx`; move layout to CSS. | S (1h) |
| P2-5 | F-017 | Re-enable `refetchOnWindowFocus` for live-data queries. | S (30m) |
| P2-6 | F-018 | Split `radix` and `tanstack` from `vendor` chunk. | S (30m) |
| P2-7 | F-021 | Replace preview OG image. | S (15m) |
| P2-8 | F-019 | Dev-mode 400 on unknown telemetry event. | S (15m) |
| P2-9 | F-023 | Surface error from `useSubscription`. | S (30m) |

## P3 — Debt & polish

| # | ID | Item | Effort |
|---|---|---|---|
| P3-1 | F-007 | SQL regression tests for SECURITY DEFINER functions. | M (3h) |
| P3-2 | F-012 | Remove `USER_KEY_STORED_SERVERSIDE` placeholder; tighten return type. | S (1h) |
| P3-3 | F-013 | Fix `postPerformanceScore` stopword/stem/sentence-split bugs. | S (1-2h) |
| P3-4 | F-016 | Inline monthly-reset into `increment_generation_count` RPC. | S (30m) |
| P3-5 | F-022 | Add authoritative-comment header to grant migrations. | XS (10m) |
| P3-6 | code-duplication doc | Replace inline admin-check EXISTS with `is_admin()`. | M (2h) |
