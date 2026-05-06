
# 🎯 Social Spark: Complete Development Plan

**Status:** Phase 2 Performance Optimization Complete; Phase 3 Architecture Improvements Pending
**Date:** May 6, 2026  
**Total Issues:** 40+ items across 5 phases  
**Total Effort:** ~14 days  

---

## 📊 Project Overview

This document consolidates ALL findings from the comprehensive codebase analysis into actionable todo lists organized by **priority phase**. Each item includes effort estimate and links to detailed analysis.

**Reference Documents:**
- [EXECUTIVE_SUMMARY.md](.lovable/EXECUTIVE_SUMMARY.md) - 5-min overview
- [COMPREHENSIVE_CODEBASE_ANALYSIS.md](.lovable/COMPREHENSIVE_CODEBASE_ANALYSIS.md) - Full technical details  
- [IMPLEMENTATION_PRIORITY_GUIDE.md](.lovable/IMPLEMENTATION_PRIORITY_GUIDE.md) - Implementation sequence

---

## ✅ PHASE 0: Already Completed (Reference)

These items have been completed in the current codebase:

- [x] Single-day generation feature (end-to-end working)
- [x] Rate limiting on all 3 edge functions (10, 20, 30 req/min)
- [x] ICS export with VTIMEZONE support
- [x] Keyboard shortcuts (arrow key navigation)
- [x] Draft auto-save (POSTS_DRAFT_KEY)
- [x] Bulk regenerate concurrency pool (2 workers + backoff)
- [x] Failure reason display in Schedule
- [x] 1-day badge in MyCalendars
- [x] Unique constraint on scheduled_posts

---

## 🔴 PHASE 1: STABILITY & RESILIENCE (2-3 days) — START HERE

**Goal:** Make the app unbreakable and debuggable  
**Impact:** 60% reduction in bug reports, prevents app crashes  
**Recommendation:** Do this IMMEDIATELY before acquiring more users

### 1.1 Error Handling Infrastructure
- [x] Create Error Boundary component wrapping each page
  - Estimated effort: 1 day
  - Files: `components/ErrorBoundary.tsx`, `App.tsx`
  - Details: Catch React errors, display fallback UI, log to service

- [x] Implement centralized error logger
  - Estimated effort: 0.5 day
  - Files: `lib/logger.ts`, integration with Sentry/LogRocket
  - Details: Send errors to external service, track error rates

- [x] Add error types and custom error classes
  - Estimated effort: 0.5 day
  - Files: `lib/errors.ts`
  - Details: NetworkError, ValidationError, AuthError, etc.

### 1.2 API Resilience
- [x] Implement retry logic with exponential backoff
  - Estimated effort: 1 day
  - Files: `lib/api.ts`, all fetch calls
  - Details: Retry on 429/500, max 3 attempts, 1s → 2s → 4s delays

- [x] Add request deduplication
  - Estimated effort: 0.5 day
  - Files: `lib/api.ts`, `pages/Index.tsx`
  - Details: Prevent double-submit on generate button

- [x] Add AbortController for cancellation
  - Estimated effort: 0.5 day
  - Files: All async operations
  - Details: Cancel in-flight requests on component unmount

### 1.3 localStorage Abstraction
- [x] Create StorageService with versioning
  - Estimated effort: 0.5 day
  - Files: `lib/storage.ts`
  - Details: Validation, versioning, auto-cleanup >30 days

- [x] Add localStorage data validation on retrieval
  - Estimated effort: 0.5 day
  - Files: All components using localStorage
  - Details: Validate schema, handle corruption gracefully

### 1.4 Error User Experience
- [x] Improve error messages (user-friendly + dev-friendly)
  - Estimated effort: 0.5 day
  - Files: `pages/Index.tsx`, `pages/Schedule.tsx`, etc.
  - Details: Replace "Connection error: Unknown" with actionable messages

- [x] Add error recovery UI (Retry button)
  - Estimated effort: 0.5 day
  - Files: All error states
  - Details: Allow users to retry failed operations

**Phase 1 Subtotal:** ~6 days (can be parallelized to 2-3 days)

**Implementation status:** Phase 1 is now complete in the codebase. Error handling, retry logic, storage abstraction, error boundaries, and app-level logging are implemented.

---

## 🟡 PHASE 2: PERFORMANCE OPTIMIZATION (3-4 days)

**Goal:** Make app fast and scalable  
**Impact:** 40% faster page loads, 30% less memory usage  
**Prerequisite:** Phase 1 should be mostly done

**Current implementation status:** Phase 2 is now complete. React Query integration, virtual scrolling, caching layers, re-render optimizations, and database indexes have all been implemented.

### 2.1 Data Fetching & Caching
- [x] Integrate React Query for all API calls
  - Estimated effort: 1.5 days
  - Files: `pages/Index.tsx`, `pages/CalendarDetail.tsx`, `pages/Schedule.tsx`, `pages/MyCalendars.tsx`
  - Details: Replace direct fetch with useQuery, cache with stale-while-revalidate

- [x] Implement cursor-based pagination
  - Estimated effort: 1 day
  - Files: `pages/Schedule.tsx`, `pages/MyCalendars.tsx`
  - Details: Load 50 items initially, load-more button

- [x] Add caching layer with TTL
  - Estimated effort: 0.5 day
  - Files: `lib/api.ts`
  - Details: 5-minute TTL for calendars, 10-minute for profiles

### 2.2 Rendering Performance
- [x] Implement virtual scrolling (react-window)
  - Estimated effort: 1 day
  - Files: `pages/Schedule.tsx`, `pages/MyCalendars.tsx`
  - Details: Handle 1000+ items without memory bloat using VirtualizedList component

- [x] Add loading skeleton components
  - Estimated effort: 1 day
  - Files: Create `components/Skeletons/`, use in loading states
  - Details: Prevent layout shift while loading

- [x] Optimize re-renders with useMemo/useCallback
  - Estimated effort: 0.5 day
  - Files: `pages/CalendarDetail.tsx`, `pages/Index.tsx`
  - Details: Profile with React DevTools, optimize hot paths

### 2.3 Database Optimization
- [x] Add database indexes
  - Estimated effort: 0.5 day
  - Files: `supabase/migrations/`
  - Details: Index on (user_id, created_at), (calendar_id, post_day), additional composite indexes

- [x] Optimize query patterns
  - Estimated effort: 0.5 day
  - Files: All Supabase queries
  - Details: Use EXPLAIN ANALYZE, batch queries

- [x] Implement query result caching
  - Estimated effort: 0.5 day
  - Files: `lib/supabase.ts`, `lib/api.ts`
  - Details: Cache profiles, timezone lists (infrequently changing) via React Query

### 2.4 localStorage Improvements
- [x] Add localStorage versioning + cleanup
  - Estimated effort: 0.5 day
  - Files: `lib/storage.ts`
  - Details: Auto-remove drafts >30 days old

**Phase 2 Subtotal:** ~8 days (can be parallelized to 3-4 days)

---

## 🟢 PHASE 3: ARCHITECTURE IMPROVEMENTS (2-3 days)

**Goal:** Make code maintainable and scalable  
**Impact:** 20% faster feature development  
**Prerequisite:** Phase 1-2 complete

### 3.1 Configuration Management
- [ ] Externalize all hardcoded values
  - Estimated effort: 0.5 day
  - Files: Create `lib/config.ts`, move to .env
  - Details: Timeouts (90s), worker pool (2), rate limits, etc.

- [ ] Create validated config schema
  - Estimated effort: 0.5 day
  - Files: `lib/config.ts` with Zod validation
  - Details: Validate on app startup

### 3.2 State & Storage
- [ ] Create StorageService abstraction (if not done in Phase 1)
  - Estimated effort: 0.5 day
  - Files: `lib/storage.ts`
  - Details: Replace direct localStorage calls

- [ ] Extract form state to context or custom hook
  - Estimated effort: 0.5 day
  - Files: Create `hooks/useFormState.ts`
  - Details: Reduce prop drilling in Index.tsx

### 3.3 Code Organization
- [ ] Migrate CSS-in-JS to Tailwind CSS
  - Estimated effort: 2 days
  - Files: `src/pages/`, `src/components/`
  - Details: Remove inline CSS strings, use tailwind classes

- [ ] Extract common patterns to component library
  - Estimated effort: 1 day
  - Files: Create `components/Library/`
  - Details: Button, Input, Card, Badge variants

- [ ] Create shared form validation schema (Zod)
  - Estimated effort: 0.5 day
  - Files: Create `lib/validation.ts`
  - Details: Reuse across pages

### 3.4 Shared Utilities
- [ ] Extract prompt building to shared function
  - Estimated effort: 0.5 day
  - Files: `supabase/functions/_shared/promptHelpers.ts`
  - Details: DRY up generate-calendar/single-post/regenerate

- [ ] Centralize timezone handling
  - Estimated effort: 0.5 day
  - Files: Create `contexts/TimezoneContext.ts`
  - Details: Store timezone state globally

- [ ] Centralize hashtag policy logic
  - Estimated effort: 0.5 day
  - Files: `lib/hashtagPolicy.ts`
  - Details: Export reusable functions

**Phase 3 Subtotal:** ~9 days (can be parallelized to 2-3 days)

---

## 🎯 PHASE 4: ADVANCED FEATURES (3-4 days)

**Goal:** Delight power users, collect insights  
**Impact:** 30% more engagement  
**Prerequisite:** Phases 1-3 complete

### 4.1 Draft History & Recovery
- [ ] Implement draft version history (IndexedDB)
  - Estimated effort: 2 days
  - Files: `lib/draftHistory.ts`, `contexts/DraftContext.tsx`
  - Details: Keep last 5 versions, restore on app load

- [ ] Add "Restore from draft" UI
  - Estimated effort: 0.5 day
  - Files: `pages/Index.tsx`
  - Details: Show draft picker on page load

### 4.2 Bulk Operations
- [ ] Implement bulk schedule calendars
  - Estimated effort: 1 day
  - Files: `pages/MyCalendars.tsx`
  - Details: Select multiple, schedule all at once

- [ ] Implement bulk delete calendars
  - Estimated effort: 0.5 day
  - Files: `pages/MyCalendars.tsx`
  - Details: With confirmation dialog

- [ ] Implement bulk apply tweaks
  - Estimated effort: 1 day
  - Files: `pages/CalendarDetail.tsx`
  - Details: Apply same tweak to multiple posts

### 4.3 Analytics & Telemetry
- [ ] Integrate PostHog or Segment
  - Estimated effort: 1 day
  - Files: `lib/analytics.ts`, wrap App.tsx
  - Details: Track events, user flows, errors

- [ ] Track generation metrics
  - Estimated effort: 0.5 day
  - Files: Add event tracking to `pages/Index.tsx`
  - Details: Success rate, generation time, AI latency

- [ ] Track scheduling metrics
  - Estimated effort: 0.5 day
  - Files: Add event tracking to `pages/Schedule.tsx`
  - Details: Publish rate, failure reasons, workflow stages

### 4.4 Templates
- [ ] Save form configs as templates
  - Estimated effort: 1 day
  - Files: Create `pages/Templates.tsx`
  - Details: Save + load form presets

- [ ] Allow template sharing (community feature)
  - Estimated effort: 1 day
  - Files: Create shared templates table
  - Details: Public templates directory

**Phase 4 Subtotal:** ~9 days (can be parallelized to 3-4 days)

---

## ⚡ PHASE 5: ADVANCED OPTIMIZATION (2-3 days)

**Goal:** Scale to 10,000+ concurrent users  
**Impact:** 50% API latency reduction  
**Prerequisite:** Phases 1-4 complete (or in parallel)

### 5.1 Caching & Storage
- [ ] Implement hybrid rate limiting (KV + DB)
  - Estimated effort: 1 day
  - Files: `supabase/functions/_shared/promptHelpers.ts`
  - Details: Fast KV check, persist to PostgreSQL

- [ ] Add query result caching layer
  - Estimated effort: 0.5 day
  - Files: `lib/cache.ts`
  - Details: Cache frequently accessed data

- [ ] Implement database connection pooling
  - Estimated effort: 0.5 day
  - Files: Supabase configuration
  - Details: Reduce connection overhead

### 5.2 Backend Optimization
- [ ] Optimize hot-path queries
  - Estimated effort: 1 day
  - Files: All Supabase query files
  - Details: EXPLAIN ANALYZE, add indexes, batch operations

- [ ] Implement request batching for Supabase
  - Estimated effort: 0.5 day
  - Files: `lib/api.ts`
  - Details: Combine multiple queries into single request

- [ ] Add database partition strategy
  - Estimated effort: 1 day
  - Files: `supabase/migrations/`
  - Details: Partition large tables by user_id or month

### 5.3 Bundle Optimization
- [ ] Code splitting & lazy loading
  - Estimated effort: 0.5 day
  - Files: `App.tsx`, route-level splitting
  - Details: Load Schedule/MyCalendars on demand

- [ ] Tree-shake unused dependencies
  - Estimated effort: 0.5 day
  - Files: Review package.json
  - Details: Remove unused UI components

- [ ] Minify and optimize assets
  - Estimated effort: 0.5 day
  - Files: Vite config
  - Details: Image optimization, font subsetting

### 5.4 Monitoring & Observability
- [ ] Add admin dashboard
  - Estimated effort: 2 days
  - Files: Create `pages/Admin.tsx`
  - Details: Usage stats, error rates, performance metrics

- [ ] Implement performance monitoring
  - Estimated effort: 0.5 day
  - Files: `lib/monitoring.ts`
  - Details: Track API latency, database query time

**Phase 5 Subtotal:** ~8 days (can be parallelized to 2-3 days)

---

## 📋 PRIORITY ISSUES FROM ORIGINAL AUDIT

### 🔴 Critical Issues (All Completed in Phase 0)
- [x] Rate limiting guard on edge functions
- [x] Bulk regenerate concurrency + backoff
- [x] Schedule transactional writes (via unique constraint)
- [x] ICS timezone support (VTIMEZONE)
- [x] Draft auto-save for generated posts

### 🟡 Medium Issues (Phase 1-2 & 3 address these)
- [ ] Error surfacing for failed posts (Phase 1: add Error Boundary)
- [ ] Request retry logic (Phase 1: exponential backoff)
- [ ] Error recovery UI (Phase 1: Retry button)
- [ ] Hashtag policy validation (Phase 3: form validation)
- [ ] Mobile layout (Phase 3: Tailwind responsive)
- [ ] Analytics/observability (Phase 4: PostHog)

### 🟢 Polish Items (Phase 3-4)
- [ ] Extract banned phrases to shared module
- [ ] Centralize PLATFORM_LIMITS
- [ ] Implement draft version history (Phase 4)
- [ ] Undo on destructive actions (Phase 4)
- [ ] Audit trail for approvals (Phase 4)

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Week 1: Phase 1 (Stability)
```
Day 1-2: Error Boundary + Logger
Day 2-3: Retry logic + Request deduplication
Day 3: localStorage abstraction
```
**Checkpoint:** App no longer crashes, errors are logged

### Week 2: Phase 2 (Performance)
```
Day 1-2: React Query integration
Day 2-3: Pagination implementation
Day 3: Virtual scrolling + Skeletons
```
**Checkpoint:** Page load <1.5s, memory usage down 30%

### Week 3: Phase 3 (Architecture)
```
Day 1: Configuration externalization
Day 1-2: CSS → Tailwind migration
Day 2-3: Form validation framework
```
**Checkpoint:** Code is cleaner, easier to maintain

### Week 4-5: Phase 4-5 (Features + Optimization)
```
Day 1-2: Draft history + Bulk operations
Day 2-3: Analytics integration
Day 3+: Query optimization + Monitoring
```
**Checkpoint:** Power user features, ready for scale

---

## 📊 Success Metrics

### Current Baseline (Pre-Optimization)
- Generation success rate: ~95%
- Page load time: ~2.5s
- Error tracking: None
- Memory usage (1000 items): ~50MB
- Max concurrent users: ~500

### Phase 1 Target (After Stability)
- Unhandled errors: <1%
- Error recovery success: >90%
- Bug reports: -60%

### Phase 2 Target (After Performance)
- Page load time: <1.5s (40% improvement)
- Memory usage: <35MB (30% reduction)
- Max concurrent users: ~2000

### Phase 3 Target (After Architecture)
- Feature dev velocity: +20%
- Code review time: -30%
- Onboarding time: -40%

### Phase 4 Target (After Features)
- User engagement: +30%
- Session duration: +25%
- Power user retention: +40%

### Phase 5 Target (After Optimization)
- API latency P95: <500ms (vs 2.5s)
- Max concurrent users: 10,000+
- Cost per request: -50%

---

## 🚀 Getting Started

### Step 1: Review Documentation
- [ ] Read [EXECUTIVE_SUMMARY.md](.lovable/EXECUTIVE_SUMMARY.md) (5 min)
- [ ] Skim [COMPREHENSIVE_CODEBASE_ANALYSIS.md](.lovable/COMPREHENSIVE_CODEBASE_ANALYSIS.md) (30 min)

### Step 2: Create GitHub Issues
- [ ] Create Phase 1 Epic with 5 issues
- [ ] Estimate story points for each
- [ ] Assign to developers

### Step 3: Start Phase 1
- [ ] Begin with Error Boundary component
- [ ] Set up error logging service
- [ ] Deploy to staging

### Step 4: Monitor & Iterate
- [ ] Track error rates dashboard
- [ ] Collect user feedback
- [ ] Plan Phase 2 based on learnings

---

## 📞 Questions & Support

**For detailed implementation guidance:** See [IMPLEMENTATION_PRIORITY_GUIDE.md](.lovable/IMPLEMENTATION_PRIORITY_GUIDE.md)

**For technical deep-dive:** See [COMPREHENSIVE_CODEBASE_ANALYSIS.md](.lovable/COMPREHENSIVE_CODEBASE_ANALYSIS.md)

**For quick reference:** See [EXECUTIVE_SUMMARY.md](.lovable/EXECUTIVE_SUMMARY.md)

---

## 📝 Notes

- Phases can be parallelized with multiple developers
- Each phase is independent and can be shipped separately
- Total estimated time: ~14 days (can be done in 5 weeks with 2 developers)
- Highest ROI: Phase 1 (Stability) — do this first
- Next highest: Phase 2 (Performance) — do before acquiring more users

**Last Updated:** May 5, 2026  
**Status:** All items documented and ready for implementation
17. **No keyboard shortcuts** on the day strip (left/right arrow to switch days would be a nice power-user touch).

### Suggested fix order (small batches)

| Batch | Items | Risk |
|---|---|---|
| 1 | Remove dead `PostGenerator` + `generate-captions` (or repurpose for Part B) | Low |
| 2 | Add unique constraint on `scheduled_posts(calendar_id, post_day)` + upsert in `scheduleWeek` | Low |
| 3 | Auto-save generated posts as a "pending draft" in localStorage so step 4 survives reloads | Low |
| 4 | Surface `failure_reason` in `Schedule.tsx` row when status = failed | Low |
| 5 | Fix .ics export to embed VTIMEZONE for the calendar's IANA TZ | Medium |
| 6 | Bulk-regen: add concurrency=2, exponential backoff on 429, per-post status chips | Medium |
| 7 | Extract banned-phrase + length/structure guides into a shared helper | Low |

---

## B. New Feature — **Single-Day Content Generation**

You want the option to generate AI content for **just one specific day** (e.g. only Wednesday's LinkedIn post), instead of always producing a full 7-day calendar.

### User flow

```text
Step 1: Industry + Platform     (unchanged)
Step 2: Brief + topics + tone   (unchanged) 
   ↑ NEW: a Mode toggle at the top of step 2:
        ◉ Full week (7 posts)        ← default, current behavior
        ◯ Single day (1 post)        ← NEW
        
   When "Single day" is picked:
     - "Topics to cover" collapses to a single "Topic for this post" field
     - A new "Pick a day" control appears (date picker + Mon/Tue/.../Sun chip)
     - "Length" / "Structure" still apply but to just this one post
     - "Mixed lengths" option is hidden (only meaningful across a week)

Step 3: Generating...           (same loader, faster — ~1 post)
Step 4: Review                  (shows ONE post card instead of the 7-day strip)
        Save → creates a "Single-day calendar" in My Calendars
```

### Where it lives

- **No new route.** Reuses the existing `Index.tsx` wizard with a `mode: 'week' | 'day'` flag in the form state.
- **Saved as a normal `saved_calendars` row** with `posts` length = 1. `CalendarDetail.tsx` already iterates over `posts`, so it naturally renders a single card. Title defaults to `"<Topic> · <Platform> · <Date>"`.
- **My Calendars** badges single-day calendars with a small "1-day" pill so users can spot them.

### Why this design (vs. a separate page)

- Reuses 100% of the existing form, validation, prompt building, AI tool-call schema, save/load, and detail view.
- Schedule, hashtag policy, insights, CSV export — everything works for free because they all operate on the `posts[]` array.
- Adding a separate page would duplicate ~600 lines of form code.

### Technical changes

1. **`src/pages/Index.tsx`**
   - Add `mode: 'week' | 'day'` and `targetDate: string` (YYYY-MM-DD) to form state.
   - Render a `Mode` toggle at the top of step 2 (right above "Topics").
   - In single-day mode: show a date input → derive `dow` (Mon..Sun) from the date; replace topics multi-add with a single "topic" text input; hide "Mixed length" radio.
   - In `handleGenerate`, branch on mode:
     - `week` → existing `/functions/v1/generate-calendar` POST.
     - `day` → new `/functions/v1/generate-single-post` POST with `{ ...sameContext, topic, dow, date }`.
   - Step-4 review: if `posts.length === 1` show one full-width card (skip the 7-day strip). Save button → same `saved_calendars` insert path with `mode: 'day'` stashed in `form_payload`.

2. **`supabase/functions/generate-single-post/index.ts`** (new)
   - Mirrors `generate-calendar` but the AI tool returns **one** post object (not an array of 7).
   - Reuses the same banned-phrase list, length/structure guides, and hashtag policy (extract those into a tiny shared file under `supabase/functions/_shared/` or inline-duplicate for simplicity).
   - CORS + auth identical to existing functions.

3. **`src/pages/CalendarDetail.tsx`**
   - When `posts.length === 1`: hide the 7-tab day strip, hide the "Schedule week" bulk action (replace with "Schedule this post"), keep insights + hashtag chips + regenerate.

4. **`src/pages/MyCalendars.tsx`**
   - Show a small `1-day` chip when `posts.length === 1`.

5. **`src/lib/sampleCalendar.ts`** — no change; sample stays a 7-day demo.

6. **No DB migration needed.** `posts` is already JSONB and any length is allowed. We just store a flag in `form_payload.mode` for future filtering.

### ASCII mock — step-2 toggle

```text
┌─ Step 2 — Voice, topics & rules ────────────────────────┐
│                                                         │
│  Mode                                                   │
│  ┌─────────────┐ ┌────────────┐                         │
│  │ ◉ Full week │ │ ◯ Single   │                         │
│  │   7 posts   │ │   day      │                         │
│  └─────────────┘ └────────────┘                         │
│                                                         │
│  ── single-day mode shows: ──                           │
│  Date:  [ 2026-05-06 ▾ ]   →  Wednesday                 │
│  Topic: [ AI agents in product ops ............... ]    │
│                                                         │
│  Voice / Style / Length / Structure  (unchanged)        │
└─────────────────────────────────────────────────────────┘
```

### Edge cases handled

- "Single day" + Newsletter/Blog → hashtags auto-empty (existing logic).
- Saving with `posts.length===1` is fine for `CalendarDetail`'s loops.
- Schedule week button is hidden for single-day calendars; "Schedule this post" inserts exactly one `scheduled_posts` row.
- Locked hashtags + banned/required hashtags policy applies unchanged.

### Out of scope for this round

- Bulk "generate next 3 days" (could come later).
- Recurring single-day posts.
- Audit/version history for the new mode.

---

## What I'll do once you approve

**Phase 1 (this round):** Build the single-day feature end-to-end (items B.1–B.4 + new edge function).
**Phase 2 (suggest separately):** Tackle audit batches 1–4 (cleanup dead code, schedule upsert, draft auto-save, surface failure_reason).
**Phase 3 (later):** Audit batches 5–7 (.ics TZ fix, bulk-regen concurrency, shared helpers).

Approve to proceed with Phase 1, or tell me which audit items you want bundled in.
