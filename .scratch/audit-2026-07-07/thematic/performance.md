# Thematic — Performance

- **F-017** — `refetchOnWindowFocus:false` global default suppresses live refresh in admin/dashboard.
- **F-018** — `vendor` chunk not split by category; Radix + TanStack all pulled in on landing page.
- `three` and `gsap` are correctly manual-chunked (`vite.config.ts:32-38`).
- `lazyWithRetry` wraps every route (`App.tsx:18-39`) — good.
- **Edge functions**: `callAIGateway` retries 2× with exponential backoff. `max_tokens: 8000-8192` on generate paths — expensive but bounded.
- **N+1 risk**: `admin_calendar_stats` aggregates in a single JSON query — good. Client-side calendar list uses `useCalendarQueries.ts` — `[UNVERIFIED — requires manual check]` whether it triggers per-item queries.
- **Storage upload**: `generate-post-image` uses `x-upsert: true`. Repeated calls for the same `(calendarId, postDay)` overwrite — correct.
- **`postPerformanceScore.calculatePerformanceScore`** runs on every post render; not memoized. For a 7-post calendar this is 7 O(n) string passes per re-render. Acceptable but could `useMemo`.
