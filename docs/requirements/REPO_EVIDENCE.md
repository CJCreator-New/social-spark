# Repository Evidence — Feature Mapping

This document maps key product features to concrete files and code excerpts found in the repository.

Calendar & Scheduling
- `src/pages/CalendarDetail.tsx`: Loads `saved_calendars` from Supabase, builds posts, and provides bulk `scheduleWeek()` logic that upserts into `scheduled_posts` (idempotent upsert). Evidence: uses `supabase.from("saved_calendars")` and `supabase.from("scheduled_posts").upsert(...)`.
- `src/pages/Schedule.tsx`: Infinite-query of `scheduled_posts`, pagination support, and status update functions that call `supabase.from("scheduled_posts").update(...)`.
- `src/lib/calendarSchedule.ts`: Helpers for date math, ICS export, and `dateForDow()`/`downloadIcs()` implementations.
- `src/lib/exportCalendar.ts`: Markdown/PDF export helpers for calendars and posts.
- `src/lib/sampleCalendar.ts`: Sample 7-day calendars used for walkthroughs and demos.

Composer & Drafting
- `src/pages/CalendarDetail.tsx`: Post editor UI, autosave/draft state, `DraftRecoveryDialog` component used.
- `src/lib/platformCopy.ts` (referenced): platform formatting helpers used when building `copy_text` for posts.

AI Generation / Edge Functions
- `supabase/functions/generate-calendar/index.ts`: Serverless function that builds a 7-day calendar via the Lovable AI gateway; rate limits (10 req/min) and JSON tool response parsing are implemented.
- `supabase/functions/generate-single-post/index.ts`: Single-post generation with validation and rate limits.
- `supabase/functions/regenerate-post/index.ts`: Tweak/regenerate endpoint with per-user rate limits and AI prompt helpers.
- `supabase/functions/_shared/promptHelpers.ts`: Shared prompt assembly, length/structure guides, hashtag policy, and rate-limit helper (`checkRateLimit`).

Trending Topics & Content Intelligence
- `src/lib/trendingTopics.ts`: Mock trending topics dataset and `getTrendingTopicsForIndustry()` helper used by UI for suggestions.

Auth & Supabase Integration
- `src/integrations/supabase/client.ts`: Supabase client creation using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `src/contexts/AuthContext.tsx`: `AuthProvider` handling `supabase.auth.onAuthStateChange`, `getSession()`, and `signOut()`.
- `src/hooks/useIsAdmin.ts`: RPC call to `has_role` to determine admin privileges.

Scheduling Delivery & Reliability
- `supabase/functions/*` (generate/regenerate): implement rate limiting, retries, and clear error responses; generate-calendar enforces structured tool outputs.

Utilities & UX
- `src/lib/postingTimes.ts`: `suggestedTimeForDay()` referenced by scheduling UI.
- `src/components/VirtualizedList.tsx` and `src/components/SkeletonList.tsx`: used for large lists and loading states.

Exporting & Share
- `src/lib/exportCalendar.ts`: `downloadMd()` and `downloadPdf()` to export calendar content.

Tests & E2E
- `e2e/critical-paths.spec.ts`: Playwright E2E spec for core flows.
- `docs/phases/E2E_TESTING_STRATEGY.md` and related `docs/phases/*` contain test data and CI/test guidance.

Audit & Analysis
- `.lovable/COMPREHENSIVE_CODEBASE_ANALYSIS.md` and `Full audit.md` provide an audit, findings, and recommended remediations.

Notes & Next Steps
- Use this file to populate "Evidence" sections in the requirements docs. I can: 1) append short evidence snippets into each requirements file, or 2) keep this central mapping and link from requirement docs — which do you prefer?
