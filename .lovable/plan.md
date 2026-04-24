
# ContentForge — Round 7 Enhancement Plan

Building on what's shipped (per-platform copy, budget badges, locks, sample walkthrough, recent strip, banned/required words). All ideas below are **additive** — no behavior change to existing flows, no schema migrations that break what we have.

## Theme J — Library management
The library grows fast; users need to find, group, and revisit work.

1. **Favorite / star calendars** — toggle ⭐ on My Calendars rows. `is_favorite` column already exists on `saved_calendars` (referenced in current code but unused). Add a "Favorites" filter chip at top of list.
2. **Search + sort on My Calendars** — search box already styled (`.mc-search`) but not wired. Filter by title/industry/core idea; sort by Newest, Oldest, Title A–Z, Favorites first.
3. **Calendar comparison view** — "Compare" toggle on My Calendars to pick 2 calendars and view them side-by-side (read-only) for picking a winner before publishing.

## Theme K — Insight & analytics
Help users understand what they're producing without adding tracking infra.

4. **Calendar analytics summary card** — at top of `CalendarDetail`, show: total chars, avg chars/post, hashtag count, % posts within platform limit, voice/structure mix. All client-computed from current posts. ~No backend.
5. **Best-day suggestion** — small note per post: "Tuesday 9–11am performs best on LinkedIn". Static lookup table by platform + day-of-week. No data collection, just expert defaults.

## Theme L — Generation depth
6. **Idea brainstorm mode (single-shot)** — new "Brainstorm 10 hooks" button on Step 2 that calls a lightweight new edge function `brainstorm-hooks`. Returns 10 one-line hook ideas the user can pick from before generating the full 7-day calendar. Drastically improves first-attempt quality.
7. **Per-post variations (A/B)** — on a post card, "Generate alternative" button creates a sibling variant stored alongside the original. User picks A or B before exporting. Uses existing `regenerate-post`; just stores both temporarily in component state.
8. **Hashtag suggester** — small "Suggest more" button beside hashtags input that calls AI for 8 niche-relevant tags. Tiny prompt, fast.

## Theme M — Safety & history
9. **Edit history (last 5 versions per post)** — every Tweak/Regenerate stores prior version in component state (and on save, into the calendar's JSON `posts` field as a `_history[]` array, capped at 5). "Undo" button on each card reverts to previous version. No schema change.
10. **Auto-save draft of in-flight wizard** — persist Step 1–3 form to `localStorage` on every change so a refresh mid-wizard doesn't wipe input. Cleared on successful generation. Pure client-side.

## Recommended bundles

- **Library polish (J1+J2+M10)** — favorites, search/sort, autosave draft. ~1.5h. Lowest risk, highest daily-use value.
- **Insight (K4+K5+L8)** — analytics card, best-day hint, hashtag suggester. ~2h. Adds intelligence without restructuring.
- **Generation depth (L6+L7+M9)** — brainstorm hooks, A/B variants, edit history. ~3h. Most impactful for power users; needs one new edge function.
- **Balanced (J1+J2+K4+M10)** — favorites, search/sort, analytics, autosave. ~2h. Recommended — all UI/client work, zero new edge functions.
- **Everything (J1+J2+K4+L6+L8+M9+M10)** — ~4–5h. Comprehensive.

## Out of scope (still deferred)
- Folders / nested tags
- Real social publishing / scheduling integrations
- Team collaboration & shared workspaces
- AI image generation per post
- Streaming generation
- Tailwind token refactor

## Decisions needed
1. Which bundle — Library polish, Insight, Generation depth, Balanced, Everything, or custom?
2. For M9 (edit history): persist history in `posts` JSON on save, or keep purely in-memory (lost on refresh)?
3. For L6 (brainstorm hooks): create the new `brainstorm-hooks` edge function, or reuse `generate-calendar` with a "hooks-only" flag?

Reply with the bundle and decisions and I'll switch to default mode and implement.
