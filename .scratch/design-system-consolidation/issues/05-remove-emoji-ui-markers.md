# Remove emoji and raw glyph UI markers

Status: ready-for-agent

## Problem

Several UI controls and empty states use emoji or raw glyph markers, which conflict with the Lucide-based concept flow and render inconsistently across platforms.

## Scope

- Replace empty-state glyphs with Lucide icons.
- Replace pinned/starred/schedule action glyphs with Lucide icons.
- Keep generated user content unchanged.
- Keep toast text changes out of scope unless the glyph appears in a visible UI control.

## Acceptance Criteria

- Empty states do not use emoji or raw decorative glyphs.
- Action buttons use icons plus accessible labels.
- Pinned/locked markers render consistently across browsers.

## Verification

- Search page/component source for known glyphs used as UI markers.
- Manual visual pass on calendars, schedule, calendar detail, and wizard result pages.
