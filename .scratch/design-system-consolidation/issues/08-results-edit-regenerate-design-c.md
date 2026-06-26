# Results edit and regenerate flow quality

Status: ready-for-agent

## Problem

Generated results are the payoff for the `/app` wizard, but result cards and supporting edit/regenerate surfaces still mix one-off styling, legacy accents, and uneven action hierarchy. Users need to quickly understand what was generated, refine weak posts, and save a calendar without losing confidence or control.

## Scope

- Align generated results states with the warm editorial Design C system.
- Improve result card hierarchy for platform, date, content, status, and edit actions.
- Standardize feedback/regenerate UI, including `FeedbackModal` if it appears in this journey.
- Align visible scoring and quality helpers with semantic status colors instead of legacy primary lime styling:
  - `PerformanceScoreCard`
  - `WeekBalanceScore`
  - result-level insight badges or warnings
- Clarify primary/secondary action hierarchy for save calendar, edit, regenerate, and navigation actions.
- Use selective shared primitive extraction only where it reduces drift:
  - cards
  - buttons
  - form controls
  - status badges
  - empty/error/loading states

## Out Of Scope

- `/app` wizard entry/setup flow quality; use `07-wizard-flow-quality-design-c.md`.
- Calendar detail, schedule, profile, admin, and my calendars pages.
- Backend generation, scoring, or scheduling logic changes.
- Restoring `concepts.html`.

## Acceptance Criteria

- Generated results feel like the natural continuation of the wizard flow.
- Result cards are scannable and preserve a clear hierarchy across desktop and mobile.
- Edit/regenerate/feedback surfaces use the same warm editorial primitives as the rest of the authenticated flow.
- Save calendar remains the dominant completion action when results are ready.
- Legacy dark/lime styling is removed from results-visible components unless intentionally documented.
- Empty, loading, and error states remain accessible and do not visually break the flow.

## Verification

- `npm run build`
- `npm run typecheck`
- Search for legacy lime/dark styling in results-visible components and list any intentional exceptions.
- Manual responsive pass for generated results at desktop and 375px mobile.
