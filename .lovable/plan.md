
# Codebase Audit + Single-Day Generation Plan

This plan has two parts: **(A)** an audit of gaps/risks in the current app with prioritized fixes, and **(B)** the new feature you asked for — generating content for **a single chosen day** instead of a full week.

---

## A. Codebase Audit — Gaps, Risks & Improvements

I walked through the wizard (`Index.tsx`), calendar detail (`CalendarDetail.tsx`), schedule (`Schedule.tsx`), edge functions (`generate-calendar`, `regenerate-post`, `generate-captions`), and supporting libs. Here is what I found, grouped by severity.

### 🔴 High-priority issues (functional / data)

1. **Two parallel, inconsistent generation systems exist.**
   - `PostGenerator.tsx` + `generate-captions` edge function uses lowercase platform IDs (`facebook`, `instagram`, `linkedin`, `twitter`), JSON-mode parsing, and is **not wired into the main wizard or saved calendars**. It looks like dead/legacy code.
   - The active flow is `Index.tsx` → `generate-calendar` (tool calling, capitalized platforms like `LinkedIn`, `Twitter/X`).
   - **Risk:** confusion, duplicate maintenance, dead code shipped to users.
   - **Fix:** either remove `PostGenerator.tsx` + `generate-captions` or repurpose `PostGenerator` as the new single-day UI (see Part B).

2. **`generate-captions` parses raw JSON instead of using tool calling.** It strips ```json fences manually and falls back to a hardcoded caption on parse failure — fragile compared to the strict tool-call schema used by `generate-calendar`.

3. **Bulk regenerate calls the edge function in a tight loop with no concurrency cap or backoff.** In `CalendarDetail.tsx` `regenerateAllUnlocked` will fire up to 7 sequential requests, but on a partial 429 it just stops and surfaces a generic error — there is no retry, no per-post status feedback beyond the progress counter.

4. **Schedule writes are not transactional.** `scheduleWeek` deletes existing `scheduled_posts` for the calendar then inserts new ones from the client. If the insert fails the user loses their previous schedule. Should be wrapped in an RPC or use upserts keyed on `(calendar_id, post_day)`.

5. **`scheduled_posts` has no unique constraint** on `(calendar_id, post_day)` even though the UI assumes one row per slot. Re-running "Schedule week" without the cleanup step would silently duplicate rows.

6. **Time/timezone inconsistency in ICS export.** `calendarSchedule.ts → downloadIcs` writes "floating" local times (no TZ), but the calendar now has a per-calendar IANA timezone. Importing the .ics into Google Calendar will use the importer's local time, not the calendar's intended TZ.

### 🟡 Medium-priority issues (UX / correctness)

7. **No "draft auto-save" for generated posts.** If the user closes the tab between step 4 (review) and "Save calendar", the generated week is lost. Only the form (steps 1–2) is persisted to localStorage.

8. **No undo on destructive actions.** Bulk regenerate, "Schedule week", and "Reformat for another platform" all overwrite without an undo / version history.

9. **Hashtag policy edge case.** `applyPolicy` enforces required hashtags but does not warn the user when a required hashtag was injected into a long-form (Newsletter/Blog) post where hashtags should be empty.

10. **Workflow status has no audit trail.** `workflow_status` flips from drafted → approved → published with no `approved_by`, `approved_at`, or history table — so for a real team workflow you can't see who approved what.

11. **No empty/error states in `Schedule.tsx` for failed status.** A row with `workflow_status = 'failed'` shows the badge but never surfaces `failure_reason` to the user.

12. **Mobile layout.** `CalendarDetail.tsx` uses a 7-column day strip and inline bulk bar that overflow on narrow viewports (current viewport is 1036px so it's fine, but <600px breaks).

13. **No analytics / observability.** No tracking of generation success rate, average AI latency, or which platforms/topics are most used. Hard to improve the prompts without data.

### 🟢 Low-priority polish

14. **Banned-phrase list is duplicated** in both `generate-calendar/index.ts` and `regenerate-post/index.ts`. Should live in a shared module (or a single edge function helper).
15. **`PLATFORM_LIMITS` from `platformCopy.ts`** is duplicated by per-platform char limits in `generate-captions`. Centralize.
16. **No rate-limit guard on edge functions.** A user could spam "Regenerate" and burn credits.
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
