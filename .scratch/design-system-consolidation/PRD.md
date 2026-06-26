# PRD: Design System Consolidation

## Status

Draft

## Problem

The app has drifted across multiple visual systems. The intended direction is the warm editorial product flow from `concepts.html`, but several authenticated app pages and shared primitives still use older dark surfaces, lime accents, emoji/glyph markers, and one-off Tailwind styling. This creates visual jumps between core workflows like wizard, calendars, schedule, calendar detail, profile, and admin.

## Goal

Create one coherent authenticated product UI system based on the warm editorial Design C direction:

- Warm off-white app background
- White cards with soft warm shadows
- Orange primary accent
- Lora display headings and Inter body text
- Pill primary/secondary buttons
- Consistent form controls, status badges, empty states, and icon treatment

Public landing/legal pages can keep intentionally separate marketing/document themes if they are visually deliberate and scoped.

## Assumptions

- `concepts.html` is the source of truth for the target product flow, but it is currently missing from the filesystem view and must be restored or re-added before final visual QA.
- `screenshots/` and `screenshots/DESIGN_AUDIT.md` are also currently missing from the filesystem view, so screenshot-based verification must wait until those assets or a recapture flow is available.
- The repo uses local markdown issue tracking under `.scratch/`.
- Agent-ready implementation tickets use `Status: ready-for-agent`, per `docs/agents/triage-labels.md`.

## Functional Requirements

1. Authenticated app pages share a single warm editorial shell and visual language.
2. Shared primitives encode design decisions so individual pages stop hardcoding theme values.
3. Empty states use Lucide icons or shared icon slots, not emoji/glyph art.
4. Status badges have one reusable semantic mapping.
5. Admin dashboard uses the same product design system as other authenticated pages.
6. Calendar detail, schedule, my calendars, profile/settings, and wizard/result flows are visually consistent.
7. Public marketing/legal pages remain scoped and do not leak their theme tokens into authenticated app pages.

## Non-Functional Requirements

- Keep changes incremental and reviewable.
- Avoid large component rewrites unless the page is already structurally broken.
- Preserve current data flows, routes, and tests.
- Maintain keyboard-visible focus states and accessible labels.
- Build must pass after each implementation issue.
- Typecheck should be fixed or failures explicitly isolated before marking the full project complete.

## High-Level Design

```text
Design C source
  concepts.html
      |
      v
Global tokens
  src/styles/tokens.css
  src/index.css Tailwind variables
      |
      v
Shared primitives
  Card, Button, Input/Select, EmptyState, StatusBadge
      |
      v
Page layouts
  Wizard, Results, My Calendars, Schedule, Calendar Detail, Profile, Admin
```

## Component Boundaries

Global tokens:
- Define color, typography, radius, shadow, spacing, and focus-ring decisions.
- No page-specific selectors.

Shared primitives:
- `Card`: white surface, warm shadow, 16px radius.
- Button variants: primary orange pill, secondary white pill, danger, icon-only.
- Form controls: white fields, stone border, orange focus.
- `EmptyState`: icon slot, title, description, CTA.
- `StatusBadge`: drafted, approved, published, failed, warning, success, error.

Page CSS:
- Owns layout only: grids, responsive columns, page-specific spacing.
- Should not introduce new brand colors, shadows, or button systems.

## Data Flow

No backend or API changes are required. This is a frontend architecture consolidation. Existing data flows through current hooks and page components unchanged.

## Risks

- Broad CSS overrides may hide page-specific regressions until visual QA.
- Existing inline styles can beat tokenized CSS and preserve inconsistencies.
- Shared primitive changes can affect many pages at once.
- Missing `concepts.html` and screenshot assets limit exact visual comparison.

## Verification Plan

- `npm run build`
- `npm run typecheck`
- E2E screenshot recapture for:
  - Wizard first step
  - Results/calendar detail
  - My Calendars
  - Schedule
  - Profile/settings tabs
  - Admin dashboard
- Manual responsive pass at desktop, tablet, and 375px mobile widths.
- Visual audit for:
  - No dark authenticated pages
  - No lime primary CTAs in authenticated pages
  - No emoji/glyph UI markers in empty states or action buttons
  - Consistent card radius/shadow
  - Consistent form focus states

## What To Revisit Later

- Whether public docs/privacy/terms should also move into the warm editorial system.
- Whether the app should adopt a formal design token package or stay CSS-only.
- Whether to replace page-level CSS files with component-scoped modules once the design stabilizes.
