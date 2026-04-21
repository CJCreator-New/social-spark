

## Add "Copy for [Platform]" — platform-ready text

Replace the current generic copy action with platform-tailored output, so users paste text that already matches each network's conventions instead of raw markdown.

## What changes

A new **Copy for [Platform]** button on every post card (Step 4 in `Index.tsx` and `CalendarDetail.tsx`). It copies the post formatted for the calendar's selected platform — no markdown, no asterisks, no leftover hashes.

### Per-platform formatting rules

| Platform | Formatting |
|---|---|
| **LinkedIn** | Hook on its own line · blank line · body broken every 1–2 sentences · blank line · CTA · blank line · hashtags (max 5, space-separated, end of post) |
| **Instagram** | Hook + body as one block (line breaks preserved) · blank line · CTA · blank line · `⠀⠀⠀.⠀.⠀.` separator · hashtag block (up to 15, space-separated) |
| **X / Twitter** | Single block: hook + body + CTA condensed · 1–2 hashtags inline at end · **hard 280-char limit** (truncate with `…` and show a red warning toast if trimmed) |
| **Facebook** | Hook · blank line · body (preserved) · blank line · CTA · blank line · max 3 hashtags |

All variants:
- Strip markdown (`**bold**` → `bold`, `_italic_` → `italic`, `#`/`>` line prefixes removed)
- Collapse 3+ blank lines to 2
- Trim trailing whitespace
- Hashtags normalized: ensure leading `#`, dedupe, drop empties

### UX details

- Button label adapts: "Copy for LinkedIn", "Copy for X", etc. (uses calendar's `platform`).
- On click: copy to clipboard → toast "Copied for LinkedIn ✓" (lime accent).
- For X only: if the assembled text exceeds 280 chars, show toast "Trimmed to fit X's 280-char limit" in destructive color, and the copied text ends with `…`.
- Small char-count hint under the button on hover/focus (e.g. "412 / 3000" for LinkedIn) — uses muted foreground, no extra layout shift.
- Replaces the existing generic "Copy" icon button on the post cards. The markdown export buttons in the footer stay (file export is a separate flow).

## Technical plan

### New file: `src/lib/platformCopy.ts`
Pure functions, no React:
- `stripMarkdown(s: string): string`
- `normalizeHashtags(input: string | string[], max: number): string[]`
- `formatForPlatform(post, platform): { text: string, charCount: number, truncated: boolean }`
- `PLATFORM_LIMITS = { facebook: 63206, instagram: 2200, linkedin: 3000, twitter: 280 }`

Input shape matches the existing post object: `{ title, hook, body, cta, hashtags }`.

### Edits

**`src/pages/Index.tsx`** (Step 4 post cards)
- Import `formatForPlatform` and `PLATFORM_LIMITS`.
- Add `<Button>` next to existing Tweak/Regenerate actions: `Copy for {platformLabel}`.
- On click: call formatter with current post + wizard's selected platform, write to clipboard, toast result.
- If `truncated`, use destructive toast variant.

**`src/pages/CalendarDetail.tsx`** (saved-calendar post cards)
- Same button + handler, using `calendar.platform` from the loaded record.

**`src/components/post/CaptionVariation.tsx`** (if still rendered anywhere)
- Swap its current `handleCopy` (which appends raw hashtags) to use `formatForPlatform`. Keeps behavior consistent if this card is reused.

### Not changed
- Markdown export (`src/lib/exportCalendar.ts`) — unaffected, still produces `.md` files.
- PDF export — unaffected.
- `.ics` export — unaffected (description stays multi-section).
- DB schema — no migration needed.
- Edge functions — no change.

## Out of scope
- "Copy with formatting" (rich-text clipboard) — plain text only, per request.
- Per-platform regeneration ("Reformat this calendar for X") — separate Theme D item, not in this round.
- Live char-budget badge on every card at all times (we show it on the button hint only, to avoid clutter).

## Files touched
- **New:** `src/lib/platformCopy.ts`
- **Edited:** `src/pages/Index.tsx`, `src/pages/CalendarDetail.tsx`, `src/components/post/CaptionVariation.tsx`

