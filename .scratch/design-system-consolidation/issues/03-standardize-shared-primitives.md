# Standardize shared UI primitives

Status: ready-for-agent

## Problem

Core primitives like cards, buttons, fields, empty states, and status indicators are reimplemented across pages, causing visual drift.

## Scope

- Update shared `Card` primitive to match Design C.
- Add or standardize shared button classes/components.
- Add or standardize shared form control styles.
- Add a reusable `StatusBadge` component or shared CSS class.
- Ensure `EmptyState` matches the warm editorial system and supports Lucide icons.

## Acceptance Criteria

- Shared `Card` uses white surface, warm border/shadow, and Design C radius.
- Shared buttons support primary, secondary, danger, ghost, and icon-only states.
- Shared form controls have consistent orange focus states.
- Empty states use Lucide icons, not emoji/glyph markers.
- Status badge semantics are consistent for drafted, approved, published, and failed.

## Verification

- `npm run build`
- Component usage search confirms pages use shared primitives where practical.
