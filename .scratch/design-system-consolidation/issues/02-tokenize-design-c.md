# Tokenize Design C

Status: ready-for-agent

## Problem

The warm editorial direction exists in scattered CSS and concept markup, but the app still has page-level hardcoded colors, radii, shadows, and focus rings.

## Scope

- Consolidate Design C values into `src/styles/tokens.css` and `src/index.css`.
- Ensure Tailwind variables match the CSS token intent.
- Add or confirm tokens for:
  - background
  - surface
  - surface-muted
  - primary
  - primary-hover
  - text tiers
  - borders
  - radius scale
  - card and button shadows
  - focus ring

## Acceptance Criteria

- Authenticated product tokens resolve to warm editorial values.
- No authenticated page needs lime/green as a primary CTA accent.
- Token names are stable and documented through comments or obvious naming.

## Verification

- `npm run build`
- Search for old primary app accent usage in authenticated CSS and list remaining intentional exceptions.
