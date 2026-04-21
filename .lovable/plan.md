

# ContentForge — Round 6 Enhancement Plan

Round 5 just shipped per-platform copy. Here's what to tackle next, grouped by user impact.

## Theme G — Live platform awareness
The "Copy for [Platform]" formatter exists but users only see results after clicking. Surface it earlier.

1. **Live char-budget badge on every post card** — small chip showing `412 / 3000` (LinkedIn), turning amber at 90% and red over limit. Uses `formatForPlatform` to compute the *post-format* length, not raw text.
2. **Reformat calendar for another platform** — dropdown on saved calendar header: "Reformat for X / Instagram / LinkedIn / Facebook". Re-runs `regenerate-post` for all 7 days with new platform context, then updates `platform` on save.
3. **Per-card "Copy as plain" vs "Copy as markdown"** — split button: primary = platform-formatted, secondary in dropdown = raw markdown (current behavior, for users who want to paste into Notion / Buffer).

## Theme H — Power-user generation control
Round 4 plan flagged these; still high-leverage.

4. **Voice + style preview on Step 1** — 2-line static sample rendered live as the user picks tone × structure. No API call, just a lookup table. Prevents wasted generations.
5. **Banned / required words on Step 2** — two optional inputs ("never say:", "must mention:"). Fed into both `generate-calendar` and `regenerate-post` prompts as hard constraints. Persisted on the saved calendar so regenerates honor them too.
6. **Lock + regenerate-unlocked** — pin icon on each post card. "Regenerate unlocked" button re-rolls only unpinned posts. Pairs well with banned/required words.

## Theme I — Onboarding & retention
First-run is bare; returning users start from scratch each time.

7. **Sample calendar walkthrough** — "See an example" button on Step 1 loads a pre-baked Newsletter calendar into Step 4 (read-only banner, "Start your own" CTA). No auth, no API call.
8. **Recent calendars strip on Index** — 3 most recent saved calendars above Step 1 with Open / Duplicate. Returning users skip the wizard.
9. **Empty state on My Calendars** — illustrated empty card + "Generate your first calendar" CTA when list is empty.

## Recommended bundles

- **Quick polish (G1+I9)** — live budget badges + empty state. ~1h. Smallest scope.
- **Power user (H4+H5+H6)** — voice preview, banned/required words, lock-and-regenerate. ~2.5h.
- **Onboarding focus (I7+I8+I9)** — sample calendar, recent strip, empty state. ~2h. Best for new-user activation.
- **Balanced (G1+H5+I8+I9)** — live budgets, banned/required words, recent strip, empty state. ~2–3h. Recommended.
- **Per-platform deep dive (G1+G2+G3)** — live budgets, reformat, copy split-button. ~2h. Best if platform polish is the priority.

## Out of scope (still deferred)
- Folders / tags on My Calendars
- Streaming generation, team collab, direct social publishing
- AI image generation per post
- Tailwind token refactor

## Decisions needed
1. Which bundle — Quick polish, Power user, Onboarding, Balanced, Per-platform, or custom mix?
2. For H5 (banned/required words): persist on the saved calendar so all future regenerates enforce them, or apply per-generation only?
3. For G2 (reformat for another platform): regenerate in place (overwrite current calendar) or save as a new calendar so the original is preserved?

Reply with the bundle and decisions and I'll switch to default mode and implement.

