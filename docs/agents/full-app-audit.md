# Full-App Audit Prompt

A standing, reusable prompt for a comprehensive end-to-end audit of ContentForge (Social Spark). Paste the block below as-is into a new Claude Code conversation whenever a full audit is needed — after a large feature merge, before a release, or periodically as a health check.

---

## Prompt

```
Audit this app end to end: ContentForge, a React + TypeScript + Vite + Supabase +
Zustand app for AI-powered social media content generation, planning, scheduling,
and admin analytics. Read CLAUDE.md first for the architecture and critical rules.

Cover every dimension below. Weight Security/RLS/BYOK and AI reliability highest —
treat findings there as higher severity by default. For each dimension, verify
claims by reading the actual file before reporting a finding; do not report
something as broken without having read the code that proves it.

## 1. Security, RLS & BYOK (highest priority)
- Confirm every table under `supabase/migrations/` has RLS enabled and policies
  that actually scope rows to `auth.uid()` (or the correct role) — not just
  "RLS enabled" with a permissive `USING (true)` policy that defeats the point.
- Trace the BYOK (bring-your-own-key) round trip: `encrypt-api-key`,
  `decrypt-api-key`, `delete-api-key` Edge Functions and `src/lib/aiClientResolver.ts`.
  Confirm keys are never logged, never returned to the client in plaintext after
  storage, and that platform-key vs user-key resolution can't be confused or
  spoofed (e.g. a user forcing platform-key usage to burn someone else's quota).
- Check rate-limit enforcement (`rate_limit_counters` table + whichever Edge
  Functions read/write it) can't be bypassed via concurrent requests or client-
  side tampering.
- Check admin authorization: `useIsAdmin.ts`, `AdminRoute.tsx`, the `has_role()`
  RPC, and `admin_users` table — confirm privilege checks happen server-side
  (RPC/RLS), not just hidden client-side routes.
- Check `create-order` and `verify-payment` Edge Functions validate
  subscription/payment state server-side and can't be forged from the client.
- Scan all 18 Edge Functions under `supabase/functions/` for missing input
  validation/sanitization on user-supplied data (per the "verified user identity
  and input sanitization" work already done — confirm it's actually applied
  everywhere, not just the functions it originally targeted).

## 2. AI reliability & the content-generation flow
- Trace the forward path: wizard input (`src/stores/useWizardStore.ts`) →
  `generate-calendar` / `generate-single-post` Edge Functions → client-side
  scoring (`src/lib/postPerformanceScore.ts`, `src/lib/postInsights.ts`) → display.
- Trace the backward/revision path: `regenerate-post`, `repurpose-post`,
  `inline-rewrite` Edge Functions, and draft autosave/recovery in
  `useWizardStore.ts` (does a page reload mid-wizard actually restore state?).
- At every hop, confirm graceful handling of failed requests, timeouts, and
  malformed model output — per CLAUDE.md's explicit "AI Graceful Fallback" rule.
  A silent failure or an unhandled exception on a malformed LLM response is a
  high-severity finding.
- Confirm the "no bold/italic markdown in post copy" rule (CLAUDE.md) is actually
  enforced somewhere in the generation/sanitization pipeline, not just assumed.
- Assess actual output quality signals: does `postPerformanceScore.ts`'s scoring
  logic (hook, CTA, hashtags, readability) produce sane scores for good vs bad
  sample posts, or is it superficial (e.g. just checking string length)?

## 3. Code quality & architecture
- Zustand store design (`src/stores/`) — state shape, unnecessary re-renders,
  serialization correctness for autosave/localStorage.
- Component structure and prop patterns for duplication or inconsistency with
  established patterns elsewhere in the codebase.
- Type safety — flag `aiClientResolver.ts`'s known `ApiProvider` typecheck gap
  (pre-existing) explicitly rather than silently re-discovering it as new; note
  any other type-safety holes found.
- Dead code / unused exports.

## 4. UX states, accessibility & performance
- Loading, empty, error, and recovery states across major pages/flows
  (CLAUDE.md rule) — spot missing or inconsistent handling.
- Accessibility: use `e2e/accessibility.spec.ts` as a baseline of what's already
  covered, then look for gaps it doesn't catch (focus management, aria-live
  regions for async content, color contrast on new UI).
- Responsive behavior beyond what `e2e/responsive.spec.ts` covers.
- Bundle size / performance: the production build already warns about a
  >500kB chunk — assess whether code-splitting is warranted, and check for
  obvious N+1 query patterns in Supabase calls.

## 5. Test coverage & CI reliability
- Baseline: 26 unit/integration test files under `src/**/__tests__/`, plus 4
  Playwright specs under `e2e/` (critical-paths, accessibility, responsive,
  api-key-settings).
- Identify coverage gaps relative to what's actually risky: is BYOK key
  handling tested? Is admin privilege escalation tested? Is the payment flow
  tested at all? Flag untested high-risk paths as high severity even if
  "everything passes" — passing tests don't mean the risky path is covered.
- Flag any skipped/flaky tests or tests that assert on implementation details
  rather than behavior.

## Output format
Produce a single prioritized findings list, most severe first. For each finding:
- File path and line number.
- One-sentence description of the actual defect (not a vague "could be improved").
- A concrete failure scenario: what input/state causes what wrong behavior.
Do not write prose essays per section. Do not propose speculative rewrites or
refactors beyond what a specific finding justifies — no redesigns "while we're
at it." Do not re-audit the branding/logo work (`src/components/brand/`,
`src/constants/branding.ts`, `public/brand/`) — that was already reviewed and
verified separately.
```

---

## Usage notes

- This prompt is meant to be pasted verbatim into a fresh conversation (or a `general-purpose`/`code-reviewer` agent dispatch) so the audit isn't biased by prior conversation context.
- Update the concrete file/function names in this document if the app's structure changes significantly (new Edge Functions, renamed stores, etc.) — the value of this prompt comes from naming real targets, not generic categories.
- For a lighter-weight, single-PR review instead of a full-app audit, use `/code-review` or `/code-review ultra` instead.
