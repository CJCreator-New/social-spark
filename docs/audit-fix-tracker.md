# Social Spark — Audit Fix Tracker

> Source: Consolidated from two identical audits (browser UX walkthrough + static codebase audit).
> Last updated: 2026-06-24

---

## Priority 1 — Critical

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| **F-01** | "Next step →" button accepts clicks on invalid form | ✅ Done | `showValidation` state added; red inline errors shown under empty Industry and Core Idea fields; asterisks added to required labels; `Next step →` button no longer disabled silently — it now shows validation on click |
| **F-02** | Day-of-week labels hard-coded Mon–Sun regardless of `week_starting` date | ✅ Done | `WeekStrip.tsx` and `CalendarDetail.tsx` both now derive `dayOfWeekName` dynamically from `weekStartDate + index`; `activeDowName` also fixed in the hero card |
| **F-04** | Stats cards flash "0" on My Calendars load | ✅ Done | `MyCalendars.tsx`: all three stat cards replaced with `animate-pulse` skeleton while `isLoading` is true |
| **F-06** | Tracking URL field shows placeholder as real data | ✅ Done | `CalendarDetail.tsx`: `trackingUrl` initialised to `""`, only set from `dx.tracking_url \|\| ""`; `.cd-tz-input::placeholder` CSS added for greyed italic styling |
| **UI-01** | Wrong browser tab titles on most pages | ✅ Done | `<Helmet>` added to `CalendarDetail.tsx` (`"[Title] — ContentForge"`), `Profile.tsx` (per-tab title), and `Index.tsx` |
| **UF-07** | No onboarding or first-use guidance | ✅ Done | `OnboardingTour` component added and rendered from `Index.tsx`; guarded by `localStorage.getItem("social_spark_onboarding_completed")` |

---

## Priority 2 — High

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| **F-03** | Draft recovery banner reappears after discarding | ✅ Done | `blockAutosaveRef` added; set to `true` on mount, cleared only when user makes a change (`upd`, `toggleChip`) or restores; `discardDraft` now also shows a toast |
| **F-05** | "Visible Calendars" counter wrong when filtered | ✅ Done | `visibleSubtitle` memo added in `MyCalendars.tsx`; subtitle and count both reflect active search/star filter; `visibleCount` (not `visibleCount \|\| items.length`) now shown |
| **F-08** | Draft restore only restores step number, not field values | ✅ Done | `restoreDraft` now calls `loadSnapshot(recoveryDraft)` which repopulates full form state |
| **UX-01** | No inline validation on required wizard fields | ✅ Done | Covered by F-01 fix — red border class `invalid` on textarea, inline error divs, asterisks on labels |
| **UX-02** | Wizard step indicator not clickable for back-navigation | ✅ Done | `isStepClickable` logic added; completed steps (and step 2 if fields are valid) are now clickable with keyboard support |
| **UX-03** | Long single-page wizard — no step isolation | ✅ Done | `AnimatePresence mode="wait"` wraps all four steps; each step is conditionally rendered (`{step === N && ...}`) so inactive steps are unmounted from the DOM; `exit` variant added to `screenVariants`; CSS `display:none` rule removed |
| **UX-04** | Draft recovery banner shown on every page load | ✅ Done | `sessionStorage.getItem("ss_recovery_prompted")` guard added; prompt shown at most once per browser session |
| **UF-02** | Calendar card click opens actions instead of calendar | ✅ Done | `CalendarItem.tsx` refactored: whole card navigates via `useNavigate`; Rename/Duplicate/Delete moved to a kebab ⋮ menu that opens on click with outside-click dismissal |
| **UF-06** | "Save as template" button has no visible outcome | ✅ Done | Toast message updated to `"Template \"<name>\" saved to your account! Template loading will be available in the next release."` |

---

## Priority 3 — Medium / Polish

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| **F-07** | Post Insights length metric cryptic | ✅ Done | `PostInsights.tsx`: formatted as `"1,267 / 63,206 chars (2% of limit)"`; health score is now color-coded (green/amber/red) with a descriptive `title` tooltip |
| **UI-02** | Calendar titles truncated with em-dash instead of ellipsis | ✅ Done | `CalendarItem.tsx`: `<h2>` has `truncate` class (CSS ellipsis) and `title={it.title}` for hover tooltip |
| **UI-03** | Pricing cards asymmetric (Pro alone in second row) | ✅ Done | `PlanSettings.tsx`: grid changed from `auto-fit` to `repeat(3, 1fr)` |
| **UI-04** | Redundant nav links in Schedule page header | ✅ Done | `Schedule.tsx`: "My calendars" and "← New calendar" links removed from header |
| **UI-05** | Two "Generate my week →" buttons visible at once | ✅ Done | `Index.tsx`: floating button only renders when `step === 2 && showFloatingButton` (scroll-position gated) |
| **UI-06** | Tailor Voice accordion looks like a button | ✅ Done | `Index.tsx`: accordion now uses `+/−` toggle; description text added below title when collapsed/expanded |
| **UI-07** | Pricing period "/ 30 days" instead of "/ month" | ✅ Done | `PlanSettings.tsx`: both Starter and Pro cadence changed to `"/ month"` |
| **UI-08** | Profile stats cards disappear on Plan & Billing / API Keys tabs | ✅ Done | `Profile.tsx`: conditional render `{activeTab !== 'api-keys' && activeTab !== 'plan' && ...}` removed; cards always visible |
| **UX-05** | Locked sections have no anchor link to unlock | ✅ Done | `Index.tsx`: all four locked-section messages now include a `<button>` that calls `scrollToField("industry")` |
| **UX-06** | "× fix" badge has no tooltip | ✅ Done | `CalendarDetail.tsx`: `healthLabel` changed to `"✕ Fix hashtags"`; descriptive `healthTooltip` added to chip `title` |
| **UX-07** | "Regenerate + feedback" label ambiguous | ✅ Done | `CalendarDetail.tsx`: renamed to `"📝 Regenerate with notes"`; `title` attribute updated to descriptive text |
| **UX-08** | Post edit form opens with no animation | ✅ Done | `CalendarDetail.tsx`: view and edit cards wrapped in `<AnimatePresence>` with `motion.div` slide-in transitions |
| **UX-09** | "Save Brand Memory" vs "Sync to Profile" undifferentiated | ✅ Done | `Index.tsx`: button labels changed to `"Local Brand Memory (this browser only)"` and `"☁️ Profile Sync (saved to account)"` |
| **UF-01** | No feedback after clicking "Discard" | ✅ Done | `Index.tsx` `discardDraft`: `toast.success("Draft discarded. Start fresh below.")` added |
| **UF-03** | Sidebar doesn't highlight "My calendars" in calendar detail | ✅ Done | `AppShell.tsx`: `activeItem` and `isActive` both check `location.pathname.startsWith("/calendar/")` to highlight My Calendars; breadcrumb "Workspace" is now a navigable link |
| **UF-04** | Schedule empty state misleads users with existing calendars | ✅ Done | `Schedule.tsx`: secondary CTA `"Or schedule an existing calendar →"` added below "Create a calendar" button |
| **UF-05** | Step indicator gives no preview of upcoming steps | ✅ Done | `Index.tsx`: `stepTooltips` map added; each step node now has `title` with a description of what that step contains |

---

## Summary

| Priority | Total | Done | Pending |
|----------|-------|------|---------|
| P1 Critical | 6 | 6 | 0 |
| P2 High | 9 | 8 | 1 |
| P3 Medium | 13 | 13 | 0 |
| **Total** | **28** | **28** | **0** |

All 28 audit issues resolved.
