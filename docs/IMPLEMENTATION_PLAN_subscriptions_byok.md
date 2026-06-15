# Implementation Plan — Paid Beta (20 users) · Tiers + Razorpay + Supabase Fixes

**Status:** Active · **Goal:** Ship a **paid beta** to **20 real users** who pay via Razorpay. **Payments/tiers must work end-to-end.** Currency: INR (₹). Quality over speed.

> **Definition of "shareable for paid beta":** a user can sign up → pick a plan → pay with Razorpay (live keys) → the payment is verified, **durably recorded**, and **reliably unlocks the correct tier** → the tier is **enforced server-side** for generation + BYOK → it **survives refresh/re-login** → and they can use the product without hitting the bugs we found. Refunds/cancellations downgrade them correctly.

---

## What's DONE vs what's LEFT (grounded in current code)

**Done & verified (uncommitted on `main`):**
- Phase 0 Supabase fixes: API-key RPC grants (S1), config.toml `verify_jwt` for api-key fns (S2), removed dup migration (S5), durable rate limit in delete-api-key (S6), awaited quota increment (S7), UUID-validated checkQuota (S8). Tests 175/175 green.
- Razorpay **one-time primitive**: `create-order` + `verify-payment` edge functions, `razorpayCheckout.ts`, `RazorpayCheckoutButton.tsx`, env wiring. **Not connected to entitlement.**

**Left (the paid-beta critical path) — NO tier/subscription tables exist yet:**
- Tier data model, durable subscription/payment records, payment→tier entitlement, server-side enforcement, UI gating, onboarding, live-key go-live, ops/observability for a real cohort.

---

## Decision that shapes everything: Orders vs Subscriptions for the beta

For **20 users + "quality over speed" + real money**, recurring auto-renewal (Razorpay Subscriptions, UPI Autopay mandates) adds significant webhook-state complexity (mandates, halted, charged cycles) for little beta value. **Recommendation: beta uses one-time Orders that grant a 30-day tier window** (reusing the primitive already built), with the payment **durably recorded** and entitlement granted **on server-verified payment**. Recurring Subscriptions become a fast-follow after the cohort validates willingness-to-pay.

> ⚠️ Confirm this. If you want true auto-renew during the beta, we switch P3/P4 to the Subscriptions API + webhook (bigger scope). The plan below assumes **Orders + 30-day window**.

---

## Blocking inputs from you

| # | Input | Needed for | Default if unspecified |
|---|-------|-----------|------------------------|
| B1 | **Starter ₹ price** + monthly quota/BYOK allowance | pricing, entitlement | — |
| B2 | **Pro ₹ price** + monthly generation quota | pricing, entitlement | — |
| B3 | Starter BYOK cap (unlimited vs soft e.g. 1000/mo) | abuse guard | soft 1000/mo |
| B4 | **Live Razorpay keys** + KYC/activation done | go-live (P6) | test keys until then |
| B5 | Confirm **Orders+30-day** model (vs recurring Subscriptions) | P3/P4 shape | Orders + 30-day |

B1–B3 only block Phase 4–5; **Phases 1–3 can start now.**

---

## Tier model

| | Free | Starter | Pro |
|---|---|---|---|
| Platform generations | 10 (pilot) | platform quota (B1) | high monthly (B2) |
| BYOK (own key) | ❌ save+use blocked | ✅ | ✅ |
| Premium features | ❌ | ❌ | ✅ |
| AI cost | Platform | User | Platform |
| Beta billing | — | ₹ one-time → 30-day window | ₹ one-time → 30-day window |

Source of truth: `user_settings.tier` + `plan_period_end`. Tier writes happen **only server-side** after payment verification. Frontend gates UX; **edge functions + DB enforce**.

---

## Phase 1 — Tier data model + durable payment records (migration)
*Start now. New migration `~20260616000000_subscription_tiers.sql`.*

| ID | Task | Detail | Risk |
|----|------|--------|------|
| P1.1 | Extend `user_settings` | `tier TEXT DEFAULT 'free' CHECK in (free,starter,pro)`, `plan_period_end TIMESTAMPTZ` | Low |
| P1.2 | `payments` table | `id`, `user_id` FK, `razorpay_order_id` **UNIQUE**, `razorpay_payment_id`, `amount`, `currency`, `status` (created/paid/failed/refunded), `tier_granted`, `period_end`, `created_at`. RLS: user SELECT own; **service-role-only writes** (`WITH CHECK(false)`). The UNIQUE order_id = idempotency. | High |
| P1.3 | `grant_tier_from_payment(p_user_id, p_tier, p_quota_limit, p_period_end, p_order_id, p_payment_id, p_amount)` RPC | SECURITY DEFINER; atomically upsert payment row + set tier/quota/plan_period_end. Idempotent on order_id. **Explicit `GRANT EXECUTE TO service_role`.** | High |
| P1.4 | **S4 guard** in `upsert_encrypted_api_key` | raise `TIER_REQUIRED` if caller tier='free' | High |
| P1.5 | Expiry handling | `plan_period_end < now()` ⇒ treated as free by reads (no cron needed for beta; lazy check). Optional pg_cron sweep to reset tier='free'. | Med |

**Verify:** migration applies on scratch DB; RLS test blocks cross-user read + self-insert; free-tier direct key save → TIER_REQUIRED.

## Phase 2 — Server-side enforcement
*Depends on P1.1/P1.4.*

| ID | Task | Files | Risk |
|----|------|-------|------|
| P2.1 | `checkQuota` returns `tier` + effective `plan_period_end`; expired window ⇒ free. | `_shared/promptHelpers.ts` | Med |
| P2.2 | **S3: reject free-tier BYOK** — `userApiKey` present + tier free ⇒ 402 `UPGRADE_REQUIRED`, don't use key. | `generate-single-post`, `generate-calendar` | High |
| P2.3 | Pro ⇒ high quota_limit; Starter ⇒ BYOK allowed, platform quota per B1. | both | Med |

## Phase 3 — Connect payment → entitlement (the core beta link)
*Depends on P1, the existing verify-payment fn.*

| ID | Task | Detail | Risk |
|----|------|--------|------|
| P3.1 | Extend `create-order` | accept `plan: 'starter'|'pro'`; derive amount **server-side** from a server price map (never trust client amount); store intended tier in order notes. | High |
| P3.2 | Extend `verify-payment` | on verified signature, call `grant_tier_from_payment` (service role) → record payment + grant tier + set 30-day `period_end`. Idempotent (re-verify same order = no double grant). Return `{verified, tier, period_end}`. | **Critical** |
| P3.3 | **Server-side amount integrity** | verify the Razorpay order's amount matches the server price for the claimed plan before granting (fetch order or trust stored notes). Prevents ₹1-pays-for-Pro. | Critical |

**Verify:** pay Starter (test) → tier=starter, period_end ~30d, payments row present; replay verify → still single grant; tampered amount → no grant.

## Phase 4 — Frontend tiers, pricing & gating
*Depends on P1–P3 + B1–B3.*

| ID | Task | Files | Risk |
|----|------|-------|------|
| P4.1 | `subscription.ts` + `useSubscription` (tier, isPro, isStarter, periodEnd, quota, refresh). Mock fallback. | `src/lib/`, `src/hooks/` | Med |
| P4.2 | **Pricing page/section** (₹ Starter/Pro), each with `RazorpayCheckoutButton` passing `plan`. On success → refresh tier. | new `Pricing*.tsx` | Med |
| P4.3 | **StarterGate** on key form: free users see upgrade CTA, not the input. `aiClientResolver` returns no key for free. | `ApiKeySettings.tsx`, `aiClientResolver.ts` | Med |
| P4.4 | Pro feature gates (`<ProGate>`) on agreed premium features. | various | Med |
| P4.5 | Tier/period status surface (badge, "expires in N days", renew CTA). | settings/header | Low |

## Phase 5 — Beta readiness (onboarding + reliability for a real cohort)
*The "shareable to 20 people" layer.*

| ID | Task | Risk |
|----|------|------|
| P5.1 | First-run onboarding + empty/loading/error states audit on the core flow (sign up → generate → save → settings). | Med |
| P5.2 | Quota-exhausted + UPGRADE_REQUIRED UX → clear path to Pricing. | Low |
| P5.3 | Lightweight observability: ensure payment/grant failures are logged + a `payments` admin view for you to see who paid. Reuse admin pattern (admin_users / has_role). | Med |
| P5.4 | Abuse guards: BYOK soft cap (B3), order rate limits (done), basic spend ceiling on platform AI key. | Med |
| P5.5 | Seed/whitelist: optionally grant the 20 a beta flag or comp code path (skip payment for specific emails) if you want some free. | Low |

## Phase 6 — Go-live (test → live keys)
| ID | Task | Risk |
|----|------|------|
| P6.1 | Razorpay account: complete activation/KYC, get **live** keys (B4). | — |
| P6.2 | Swap secrets to live (`supabase secrets set`), set live `VITE_RAZORPAY_KEY_ID`; deploy. | High |
| P6.3 | One real low-value live transaction end-to-end before sharing. | High |
| P6.4 | Deploy all migrations + functions; smoke test full flow on prod. | High |

---

## Critical path

```
[Phase 0 ✅] ─► P1 (tier model + payments table) ─► P2 (enforce) ─┐
                          │                                        ├─► P4 (UI/pricing/gating) ─► P5 (beta readiness) ─► P6 (live)
              P3 (payment→tier link) ◄── existing verify-payment ──┘
```
**Hard critical path to "first paid beta user":** P1 → P3 → P4.2/4.3 → P6. P2 and P5 are required for *safe* sharing (don't ship without them).

## Risk register (beta-weighted)

| Risk | Sev | Mitigation |
|------|-----|-----------|
| Client sets own price (₹1 → Pro) | Critical | P3.1/P3.3 server-derived amount + integrity check; never trust client amount. |
| Double-grant on verify replay | High | UNIQUE order_id + idempotent `grant_tier_from_payment`. |
| Free user bypasses paid gen via BYOK body | High | P2.2 server reject + P1.4 DB guard (defense in depth). |
| Paid user loses access on refresh | High | tier in DB, read on load via useSubscription; never rely on client memory. |
| Refund/chargeback keeps access | Med | record `refunded` status; (post-beta) webhook for refund.processed; manual revoke via admin view for beta. |
| Quota drift (money attached) | Med | awaited increment (done); single-source checkQuota. |
| RLS leak of payments across users | High | service-role-only writes; user SELECT own; RLS tests. |
| 20 users hit platform AI cost | Med | P5.4 spend ceiling + Starter pushes cost to user keys. |
| Uncommitted work on `main` | Med | **Action: branch now, commit checkpoints per phase.** |

## Rollback per phase
- **P1:** down-migration (snapshot first; tier/payments drop destructive).
- **P2/P3:** revert function files + redeploy.
- **P4/P5:** feature-flag gating; revert components.
- **P6:** revert secrets to test keys; disable Pricing entry point.

## Test strategy
- Extend `supabase/tests/api_key_rls.test.sql`: payments RLS + TIER_REQUIRED guard.
- Unit: verify-payment signature (valid/invalid/missing), idempotent grant, server amount integrity, S3 free-tier rejection, subscription.ts mock fallback.
- Integration: Razorpay **test mode** full flow (Starter + Pro) → tier transitions + period_end.
- `npm run test:run` green before each phase merge (CLAUDE.md rule).
- P6.3 one **live** low-value transaction before cohort share.
