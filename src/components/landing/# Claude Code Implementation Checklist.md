# Claude Code Implementation Checklist

This checklist is designed for Claude Code to execute sequentially. Complete each phase fully before moving to the next. Do **not** introduce new features during implementation.

## Status as of 2026-07-06

Phases 1–4 are done. Phase 5 (Security) is done except the CORS wildcard item, which needs a product decision (see that section). Phase 6 (Cleanup) is partially done — dead code and reused shared components are handled, but a full design-token sweep across every page and CSS-dedup pass was out of scope for this bug-fix session. `npx tsc --noEmit` is clean and `npm run test:run` passes (22 files / 237 tests) as of this update.

**Outstanding before this can be called fully done:**
- Apply migration `supabase/migrations/20260706000000_admin_calendar_stats_rpc.sql` and `supabase/migrations/20260706010000_harden_metrics_rls.sql` via `supabase db push` — neither has been pushed to a live database yet.
- Decide on the CORS wildcard-subdomain question (Phase 5).
- Phases 7 (Testing) and 8 (Performance) were not run as dedicated passes — only the existing unit test suite was used as a regression gate after each change.

---

# Phase 0 — Repository Analysis

## Objective

Understand the existing architecture before making changes.

### Tasks

* [ ] Read the complete project structure
* [ ] Identify routing architecture
* [ ] Identify state management
* [ ] Identify Supabase integration
* [ ] Identify shared UI components
* [ ] Identify reusable dialogs
* [ ] Identify utility functions
* [ ] Identify design system
* [ ] Identify theme variables
* [ ] Identify existing loading/error state patterns

Deliverable

```
/docs/architecture-review.md
```

---

# Phase 1 — Critical Bugs (Must Fix First)

## Priority: P0

---

## Issue 1

### Wizard gets stuck after Cancel / Timeout

Severity

🔴 Critical — ✅ Fixed

Files

```
src/pages/Index.tsx
```

Tasks

* [x] Locate generation catch block
* [x] Detect AbortController cancellation
* [x] Return wizard to Step 2
* [x] Preserve entered form values
* [x] Preserve generated topics
* [x] Display retry message
* [x] Display error state
* [x] Ensure Retry button works
* [x] Remove infinite loading state
* [ ] Test timeout (manual QA — not automated)
* [ ] Test manual cancel (manual QA — not automated)
* [ ] Test browser offline (manual QA — not automated)

Acceptance Criteria

* User can always recover.
* No page refresh required.
* No data loss.

---

## Issue 2

### Drag & Drop schedules wrong dates — ✅ Fixed

Files

```
CalendarDetail.tsx
dragDrop.ts
```

Tasks

* [x] Replace array index usage
* [x] Use post.day consistently
* [x] Verify reordered posts
* [x] Verify schedule generation
* [ ] Verify exports (not touched by this fix; no regression expected)
* [ ] Verify ICS (not touched by this fix; no regression expected)

Acceptance

* Dragging posts never changes intended day.

---

## Issue 3

### Timezone bug — ✅ Fixed

Files

```
Schedule.tsx
```

Tasks

* [x] Identify timezone conversion
* [x] Remove dual timezone logic
* [x] Use single timezone source
* [ ] Test UTC (manual QA — not automated)
* [ ] Test IST (manual QA — not automated)
* [ ] Test PST (manual QA — not automated)
* [ ] Test Europe/London (manual QA — not automated)

Acceptance

Time remains identical after edit.

---

# Phase 2 — High Priority UX

---

## AI unavailable crashes application — ✅ Fixed

Tasks

* [x] Remove ErrorBoundary crash
* [x] Route through localFallback()
* [x] Show warning banner (existing error/toast path now reached)
* [x] Continue generation

---

## Admin navigation — ✅ Fixed

Tasks

* [x] Add Admin menu item
* [x] Show only for admins
* [x] Wrap Admin in AppShell
* [x] Add Back button

---

## Schedule conflicts — ✅ Fixed

Tasks

* [x] Check duplicate schedule
* [x] Warn user
* [x] Confirm overwrite
* [x] Cancel option

---

## Save Calendar flow — ✅ Fixed

Tasks

* [x] Add View Calendar button
* [ ] Add Schedule button (out of scope — "View saved calendar" link covers the flow; no separate Schedule shortcut was in the original audit)
* [ ] Add Continue editing button (out of scope — not flagged as broken in the audit; existing flow already allows returning to the wizard)

---

## Start Over — ✅ Fixed

Tasks

* [x] Add ConfirmDialog
* [x] Prevent accidental loss

---

# Phase 3 — UI Consistency

---

## Replace Native confirm() — ✅ Fixed

Tasks

* [x] Locate confirm() (Profile.tsx template delete)
* [x] Replace with ConfirmDialog
* [x] Maintain styling

---

## 404 Page — ✅ Fixed

Tasks

* [x] Remove custom colors
* [x] Use design tokens
* [x] Use AppShell styling

---

## Admin styling — ✅ Fixed

Tasks

* [x] Replace hardcoded colors (low-contrast lime-400/sky-400 badges → emerald-700/sky-700)
* [x] Use semantic tokens

---

## Navbar — ✅ Fixed

Tasks

* [x] Remove inline colors (AppShell.tsx)
* [x] Replace with CSS variables (var(--color-primary), var(--color-surface), var(--color-border), var(--color-text-secondary), var(--color-text), var(--color-primary-light))

---

## Loading States — ✅ Fixed

Tasks

* [x] Skeletons (Profile TemplatesList now uses SkeletonList; Admin Payments/API Keys panels)
* [x] Empty state (pre-existing EmptyState reused, verified in scope)
* [x] Error state (CalendarDetail inline ErrorState + retry; Admin panels)
* [x] Retry state

---

# Phase 4 — Functional Improvements

---

## Avatar upload — ✅ Fixed

Tasks

* [x] Wrap upload in try/finally
* [x] Reset loading state
* [x] Handle thrown exceptions

---

## Search — ⚠️ Partially addressed

Tasks

* [ ] Move search server-side (out of scope for this pass — deeper architecture change; see note below)
* [x] Paginate correctly (MyCalendars now eagerly loads all pages while a search/favorites filter is active, so results aren't silently incomplete; a true server-side search is still a larger follow-up)

---

## Banned words — ✅ Fixed

Tasks

* [x] Keep raw input (Index.tsx now tracks bannedWordsText/requiredWordsText local state)
* [x] Normalize on blur

---

## Password policy — ✅ Fixed

Tasks

* [x] Shared validator (src/lib/passwordPolicy.ts)
* [x] Increase minimum length (6 → 8)
* [x] Reuse in Auth
* [x] Reuse in ResetPassword

---

## Telemetry — ✅ Fixed

Tasks

* [x] Remove raw exception responses
* [x] Return generic error

---

# Phase 5 — Security

---

## Analytics tables — ✅ Fixed

Tasks

* [x] Restrict INSERT (dropped "authenticated can insert" RLS policy + grant on api_metrics/query_performance — see migration 20260706010000_harden_metrics_rls.sql)
* [x] Service role only

---

## Materialized Views — ✅ Fixed

Tasks

* [x] Remove authenticated SELECT (api_performance_summary — matviews don't support RLS, so the blanket grant was the actual exposure)
* [x] Service role access only

---

## Admin stats — ✅ Fixed

Tasks

* [x] Create SECURITY DEFINER RPC (admin_calendar_stats — migration 20260706000000_admin_calendar_stats_rpc.sql — **needs `supabase db push` to take effect on a live database**)
* [x] Remove client aggregation

---

## CORS — ⚠️ Needs a decision, not fixed

Tasks

* [ ] Restrict wildcard domains — needs confirmation on whether Lovable preview subdomains are attacker-assignable before narrowing the CORS allow-list; flagged to the user, not yet actioned
* [ ] Verify preview domains

---

# Phase 6 — Code Cleanup

---

## Dead code — ✅ Mostly fixed

Tasks

* [x] Remove sanitizeHtmlText() (and its now-orphaned test in promptHelpers.test.ts)
* [x] Fix unreachable dead code discovered in CalendarDetail load-error handling (`if (!calendarData) return` ran before the error check, so the error UI never rendered — reordered the guard)
* [ ] Remove dead CSS (not audited in this pass)
* [ ] Remove duplicate helpers (not audited in this pass)

---

## Shared Components — ✅ Already present, reused (not rebuilt)

Tasks

* [x] Shared ErrorState (src/components/ErrorState.tsx — reused for CalendarDetail, Admin panels)
* [x] Shared EmptyState (src/components/EmptyState.tsx — pre-existing, reused)
* [x] Shared LoadingState (SkeletonList — pre-existing, reused for Profile TemplatesList, Admin panels)
* [ ] Shared Spinner (ad hoc inline SVG spinners still exist in Auth.tsx/Index.tsx; not consolidated in this pass)
* [ ] Shared Banner (not consolidated in this pass)

---

## Design Tokens — ⚠️ Partially fixed

Tasks

* [x] Remove hex values (AppShell.tsx fully converted to var(--color-*) tokens)
* [ ] Replace with theme variables everywhere (CalendarDetail, IndexResults, and other pages still carry their own hardcoded hex/color vocabularies — full sweep not done in this pass; see remaining low-severity design-consistency items)

---

# Phase 7 — Testing

---

## Unit Tests

* [ ] Wizard cancel
* [ ] Wizard timeout
* [ ] Drag reorder
* [ ] Timezone conversion
* [ ] Conflict detection
* [ ] Avatar upload
* [ ] Password validator

---

## Integration Tests

* [ ] Generate → Save → Calendar
* [ ] Calendar → Schedule
* [ ] Schedule → Edit
* [ ] Admin dashboard
* [ ] Reset password
* [ ] OAuth login
* [ ] Offline generation
* [ ] AI unavailable

---

## Regression Tests

* [ ] Existing scheduling
* [ ] Draft restore
* [ ] Clipboard
* [ ] Export
* [ ] ICS export
* [ ] Batch regenerate
* [ ] Brand memory
* [ ] Profile update

---

# Phase 8 — Performance

Tasks

* [ ] Remove unnecessary rerenders
* [ ] Memoize expensive selectors
* [ ] Optimize infinite queries
* [ ] Optimize drag operations
* [ ] Reduce bundle size
* [ ] Remove duplicate CSS
* [ ] Lazy load large pages

---

# Final Verification

Before creating the PR:

* [ ] All TypeScript passes
* [ ] ESLint passes
* [ ] Prettier passes
* [ ] Build succeeds
* [ ] No console errors
* [ ] No React warnings
* [ ] No accessibility violations
* [ ] No hardcoded colors
* [ ] No native confirm()
* [ ] No duplicated loading UI
* [ ] No duplicated error UI
* [ ] No failing tests
* [ ] No uncovered critical issues
* [ ] All acceptance criteria satisfied

---

## Expected Deliverables

```
docs/
├── architecture-review.md
├── implementation-notes.md
├── testing-report.md
├── regression-report.md
└── release-notes.md
```

**Recommended execution order:**

1. **P0 Critical fixes** (wizard recovery, scheduling date bug, timezone bug)
2. **P1 UX fixes** (AI fallback, admin navigation, schedule conflicts)
3. **Security changes** (RLS, RPCs, telemetry, CORS)
4. **UI consistency** (dialogs, tokens, navigation)
5. **Refactoring and cleanup**
6. **Comprehensive testing and regression**
7. **Documentation and release notes**

This sequence minimizes merge conflicts and reduces the risk of introducing regressions while keeping the application in a releasable state after each phase.
