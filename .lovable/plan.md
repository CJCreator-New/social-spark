

Looking at what's been shipped and what's left in the backlog, plus what I can observe about the app, here's a focused enhancement plan.

## Already shipped (rounds 1–3)
Auth polish, wizard persistence, save/edit/duplicate/rename calendars, regenerate-single-day, PDF/MD export, brand defaults, a11y pass, indeterminate progress, abort/timeout, tone-conditional hashtags, prompt anti-patterns.

## Proposed enhancement plan — 3 themes

### Theme A — Make the deliverable real (scheduling)
The calendar is currently abstract ("Day 1, Mon"). Turning it into a real, dated, exportable schedule is the single biggest jump in perceived value.

1. **Per-day calendar dates** — add a "Week starting" date picker on Step 2. Render real dates on each card (e.g. "Mon · Apr 22").
2. **`.ics` export** — one VEVENT per post, time defaults to 9:00 local, body = hook + body + cta + hashtags. Drops straight into Google Cal / Outlook / Apple Cal.
3. **"Copy for [Platform]" per card** — formatted for the chosen platform (e.g. line breaks for LinkedIn, hashtag block for IG, ≤280 char check for X).

### Theme B — Quality & control loop
Users currently get 7 posts and either accept or re-roll. Give them more steering.

4. **Tone/voice preview on Step 1** — show a 2-line sample for the selected voice + style combo before generating, so users don't waste a generation discovering "Contrarian + Storytelling" isn't what they wanted.
5. **Inline post tweaks** — small actions on each post card: "Make shorter", "Make punchier", "Add a stat", "Remove emoji". Each calls `regenerate-post` with a tweak directive, preserving the rest.
6. **Banned-words / required-words per generation** — optional inputs on Step 2 ("never say:", "must mention:") fed into the prompt. Power users repeatedly ask for this.

### Theme C — Retention & organization
Users will accumulate calendars; current My Calendars is a flat list.

7. **Favorites + filter** — star toggle on each calendar card, filter chip for "Starred only".
8. **Search + sort** — search by title/topic, sort by date/title/platform.
9. **Tags or folders** (pick one — folders is simpler) — assign a calendar to a folder ("Q2 Launch", "Newsletter series"), filter by folder in the sidebar.

## What I'd recommend prioritizing

If you want one focused round: **Theme A (1+2+3)** — it transforms output from "draft text" to "drop-in schedule" and is the most differentiated vs. ChatGPT.

If you want one quick-win round: **Theme B item 5 (inline tweaks)** — biggest UX delight per hour of work, builds on the existing regenerate-post function.

If you want a balanced round: **A1 + A2 + B5 + C7** — adds dates, .ics export, inline tweaks, and favorites. ~2–3 hours of work, touches Index.tsx, CalendarDetail.tsx, MyCalendars.tsx, regenerate-post edge function, plus a tiny migration for `is_favorite` and `week_start_date` columns.

## Out of scope (intentionally deferred)
- Streaming generation (needs SSE infra rework)
- Teams / multi-user collab
- Direct publishing to social APIs (OAuth per platform — large)
- AI image generation per post (cost + UX scope)
- Tailwind token refactor (large, low user-visible value)

## Questions before implementing
1. Which theme(s) to ship — A, B, C, all of A, or the balanced bundle (A1+A2+B5+C7)?
2. For scheduling: default post time (9am local? user-configurable?) and default timezone (browser local OK?).
3. For folders vs tags in C9 — skip entirely for now, or pick one?

Reply with which bundle to ship and I'll switch to default mode and implement.

