# ContentForge — Full-App Audit · 2026-07-07

Evidence-grounded audit per the standing prompt in `docs/agents/full-app-audit.md`. Read-only pass; **no code changes made**.

## Executive Summary

Overall score: **6.4 / 10** — solid engineering with correctly-implemented payment verification, BYOK encryption, admin gating, and RLS enablement across the schema, but four HIGH-severity findings that must ship before the next release (F-001, F-002, F-003, F-004) and one HIGH defense-in-depth item (F-005).

### Per-dimension scores

| Dimension | Score | Top influences |
|---|---:|---|
| Architecture | 7 / 10 | Clean React/Zustand/Query split; god-module in `_shared/promptHelpers.ts`; migration churn (F-022) |
| Code Quality | 7 / 10 | TS strict, hooks & guards consistent; `aiClientResolver` placeholder debt (F-012); regex-heavy scoring (F-013) |
| **Security** | **5 / 10** | RLS enabled everywhere & BYOK/payment paths well-implemented (F-026, F-027); but F-001 (UPDATE hijack), F-004 (image IDOR), F-005 (grant over-permission) |
| Performance | 7 / 10 | Route lazy-load + chunked `three`/`gsap`; vendor chunk unsplit (F-018); staleness in dashboards (F-017) |
| UX | 7 / 10 | Loading/empty/error state components exist; wizard offline recovery gap (F-010); OAuth redirect edge case (F-009) |
| Accessibility | 6 / 10 | `e2e/accessibility.spec.ts` baseline; OAuthConsent inline-styled & missing scopes (F-015) |
| Maintainability | 6 / 10 | Migration churn + dashboard-deploy duplication; two admin identity systems |
| Production Readiness | 6 / 10 | Payments, monitoring, telemetry, feature flags all present; P0 items above must land first |

**Weight note:** Security/RLS/BYOK and AI reliability findings are weighted one severity tier higher per the standing audit rubric. That is why F-002/F-003 (quota bypass, unbounded payloads) count as HIGH rather than MEDIUM.

## Index of deliverables

- `findings-register.md` — full structured findings (27 entries: 24 defects + 3 positive verifications), each with severity, confidence, file citations, failure scenario, and scoped fix
- `workflows.md` — 26 user workflows: happy / failure / recovery / edges / missing validations / UX gaps
- `interactive-components.md` — element-level correctness × a11y × keyboard × loading × error × success matrix (deep-read pages fully covered; sampled pages tagged)
- `thematic/security.md` — Security & RLS
- `thematic/architecture.md` — Architecture
- `thematic/performance.md` — Performance
- `thematic/accessibility.md` — Accessibility
- `thematic/technical-debt.md` — Technical debt
- `thematic/missing-tests.md` — Missing tests
- `thematic/code-duplication.md` — Code duplication
- `thematic/dead-code.md` — Dead code
- `thematic/quick-wins.md` — Quick wins (all cite findings)
- `roadmap.md` — P0 → P3 with effort estimates, every item traceable to a finding ID
- `traversal-log.md` — Coverage disclosure, unreadable-files log, deep-read vs sampled classification

## Top P0 findings (fix first)

1. **F-001** — Missing `WITH CHECK` on 6 UPDATE policies allows a user to reassign their own `saved_calendars` / `scheduled_posts` / `templates` / `wizard_drafts` row to another user's `user_id`. Impacts scheduled-post publishing under the wrong account.
2. **F-002** — Four AI edge functions skip `checkQuota`; a free user can burn platform quota indefinitely via `inline-rewrite`, `repurpose-post`, `generate-trends`, `generate-post-image`.
3. **F-003** — Only `generate-calendar` enforces `checkContentLength`; every other AI edge function accepts unbounded bodies (bill / DoS risk).
4. **F-004** — `generate-post-image` never verifies `calendarId` ownership; IDOR into another user's storage / media_references.
5. **F-005** — `admin_users` grants `INSERT/UPDATE/DELETE` to `authenticated`; safe only while the current RLS policy is intact.

Everything above has a scoped fix in the corresponding finding entry — no speculative rewrites proposed.
