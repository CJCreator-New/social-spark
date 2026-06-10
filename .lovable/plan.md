# Social Spark — Post-Update Issues & Remediation Plan

Synthesized from two parallel audits (code/data layer + UI/UX) using the `.claude/agents/` roles: `code-reviewer`, `state-flow-keeper`, `supabase-architect`, `react-ui-builder`, `saas-design-architect`.

Total: **8 P0**, **14 P1**, **15 P2** issues. The waves below are sized so each can ship as one focused PR.

---

## Wave 1 — Security & data correctness (P0, ship first)

These either leak data, silently break features for every user, or fail under normal use.

1. **Re-enable RLS on `rate_limit_counters`**
   `supabase/migrations/20260506_rate_limit_counters.sql` ends with `ALTER TABLE … DISABLE ROW LEVEL SECURITY`, so any signed-in user can read/forge other users' rate-limit rows. → New migration that drops the disable + re-asserts policies.

2. **Stop using `Map` in React Query cache** (`useScheduleInfiniteQuery` + `Schedule.tsx`)
   `Map` is not JSON-serializable; on cache rehydration it becomes `{}`, breaking timezone display and UTM links. → Return `Record<string, CalendarMeta>` and switch all `.get()` calls to object lookups.

3. **Merge calendar metadata across infinite-scroll pages** (`Schedule.tsx:101`)
   Currently only `pages[0].calendars` is used — page-2 posts whose calendar isn't on page 1 render with blank timezone/UTM. → Flatten `scheduleData.pages` into a single map on every change.

4. **Move `decrypt-api-key` / `encrypt-api-key` rate limit to DB**
   Module-level `Map` resets on every cold start; brute-force is trivial. → Call the existing `checkRateLimit()` (DB-backed) helper.

5. **Composite cursor for `useSavedCalendarsInfiniteQuery`**
   `created_at` alone is not unique → page boundaries can skip/duplicate rows. → Use `(created_at, id)` cursor.

6. **Reset `wizardDraftServerAvailable` on success** (`src/pages/Index.tsx`)
   One transient 404 permanently disables autosave for the session. → Use a `useRef`; reset to `true` after the next successful save.

7. **Persist `lockedDays` as `number[]`, not `Set`** (`useWizardStore.ts`)
   `Set` doesn't survive JSON.stringify → locked days never restored from drafts. → Store as array, wrap in `new Set()` only at point of use.

8. **Guard duplicate `CREATE POLICY` for `wizard_drafts`**
   Two migrations create the table; the newer policies lack `IF NOT EXISTS`, so a fresh DB halts. → Wrap each `CREATE POLICY` in `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$`.

---

## Wave 2 — UX-blocking UI fixes (P0/P1 visual)

User-visible problems that hurt conversion, trust, or accessibility.

9. **Delete dead `src/components/layout/Sidebar.tsx`** — unused "PostAI" stub causes contributor confusion.

10. **Focus trap + auto-focus on modals** (`components/ui/Modal.tsx`, used by `CalendarDetail`) — currently keyboard tab escapes; modals never focus on open.

11. **Mobile sidebar: backdrop, Escape-to-close, focus trap** (`AppShell.tsx`) — background remains interactive while menu is open.

12. **Landing loading flash** (`Landing.tsx:73`) — `if (loading) return null` flashes a blank page; render a centered spinner or shell skeleton.

13. **Migrate `IndexResults.tsx` action bar to shadcn `<Button>` tokens** — 11 raw CSS classes + inline `style={}`, no hover/focus, sub-44px touch targets on the core conversion surface.

14. **Align font system** — Tailwind `font-sans=Inter` but `body` CSS uses Manrope; `font-display` references unmapped `Fraunces`. → Pick one source of truth in `tailwind.config.ts` matching `index.css` tokens.

15. **`RouteFallback` uses hard-coded `bg-[#07080d]` and unmapped `font-serif`** — replace with `bg-background text-foreground font-display` so Suspense doesn't visually mismatch the shell.

16. **Auth password meter inline hex colors** (`Auth.tsx:73`) — swap to `text-primary` / `text-yellow-400` / `text-destructive`.

17. **Auth tab pattern missing `aria-controls` + `role="tabpanel"`** — broken ARIA tab semantics.

---

## Wave 3 — State, data & function hardening (P1/P2)

18. **Race-free draft version numbering** (`draftHistory.ts`) — move `getVersionCount()` inside the IndexedDB readwrite transaction.

19. **Source `profileTz` from `useProfileQuery`, not embedded in schedule payload** — avoids UTC fallback when first page has no rows.

20. **Replace local `Post` interface in `CalendarDetail.tsx` with the canonical type** from `@/components/wizard/constants` (kills the `[key: string]: any` escape hatch).

21. **Validate request size in edge functions** — `generate-calendar` parses unbounded JSON; reject `Content-Length > 256 KB` before `req.json()`.

22. **Lock down telemetry CORS** — `Access-Control-Allow-Origin: *` on a write endpoint lets any site beacon events; restrict to the app's domains.

23. **Validate `VITE_SUPABASE_PUBLISHABLE_KEY` at startup** (`brandMemory.ts`) — currently silently empty → opaque 401s.

---

## Wave 4 — Design system & polish (P2)

24. **Remove `pages.css` `:root` block** — duplicate token system drifting from `index.css`.
25. **Fix `border-white/8` → `border-white/[0.08]`** in `index.css` `.page-panel`.
26. **`ErrorBoundary` fallback to Tailwind classes** — currently all inline styles, ignores theme.
27. **Active nav state shouldn't rely only on color** (`AppShell.tsx:110`) — add background fill + weight (WCAG 1.4.1).
28. **`aria-hidden` on emoji nav icons** (`AppShell.tsx:114`) — silence the screen-reader noise.
29. **`GenerateSkeleton` should mirror the real two-column results layout** using shadcn `<Skeleton>` shimmer, not 7 flat boxes.
30. **`ScheduleSkeleton` mirrors real table columns** (platform badge, date, status chip), not generic `SkeletonList`.
31. **Regenerate-unlocked button needs spinner + count** ("Re-rolling 4 posts…") instead of silent disable.
32. **Profile.tsx empty templates state** → real `EmptyState` with icon + "Create your first calendar" CTA.
33. **Breadcrumb derivation from route params** — nested `/calendar/:id` currently shows the wrong label.
34. **Remove duplicate JSDoc on `scoreHookStrength`** (`postPerformanceScore.ts`).

---

## Execution order

| Wave | What | Why this order | Est. effort |
|---|---|---|---|
| 1 | Security + data correctness | Each item is silently broken right now; ships as one migration + one TS PR | 1–2 sessions |
| 2 | UX blockers | Visible regressions / a11y / conversion surface | 1 session |
| 3 | State & function hardening | Stops future correctness drift | 1 session |
| 4 | Design system polish | Long tail; can be batched once tokens converge | 1 session |

## Out of scope (intentionally)

- No new features, no schema redesign, no edge-function streaming work.
- No swap of UI library or design language — all fixes stay inside existing shadcn + Tailwind tokens.
- Wave 4 items 29–34 can each be skipped independently without breaking anything else.

## Verification per wave

- **Wave 1:** re-run `supabase--linter`, hit Schedule with 25+ scheduled posts across 2 calendars, confirm timezone + UTM populate; brute-force the encrypt endpoint locally to confirm DB rate-limit kicks in.
- **Wave 2:** keyboard-only walkthrough of Landing → Auth → Wizard → Results → Calendar; tab traps in modals; Lighthouse a11y ≥ 95 on /auth and /app.
- **Wave 3:** Vitest covers `draftHistory` race + `Post` import; manual edge-function 256 KB rejection check.
- **Wave 4:** visual diff against current preview; dark mode pass on every changed surface.
