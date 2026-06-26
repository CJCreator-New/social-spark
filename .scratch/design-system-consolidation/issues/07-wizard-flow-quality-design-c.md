# Wizard flow quality and Design C alignment

Status: ready-for-agent

## Problem

The `/app` wizard is the first authenticated product experience, but supporting surfaces and wizard-adjacent UI still contain visual drift, unclear action hierarchy, and legacy dark/lime styling. This weakens the core promise: users should feel they can turn a rough content idea into a polished scheduled calendar without losing control.

## Scope

- Align `/app` wizard entry/setup states with the warm editorial Design C system.
- Improve flow clarity for step/progress, form grouping, helper text, and primary/secondary actions.
- Update visible wizard-adjacent surfaces if they appear during the wizard journey:
  - `DraftRecoveryDialog`
  - `OnboardingTour`
  - `WelcomeBanner`
  - wizard helper panels
  - loading/error/empty states
- Use selective shared primitive extraction only where it reduces drift:
  - buttons
  - cards
  - form controls
  - empty states
- Remove dark/lime authenticated styling from this journey unless intentionally documented.

## Out Of Scope

- Full results screen redesign.
- Calendar detail, schedule, profile, admin, and my calendars pages.
- Backend/data-flow changes.
- Restoring `concepts.html`.

## Acceptance Criteria

- `/app` entry/setup feels like one coherent warm editorial product surface.
- Step/progress state is easy to understand.
- Primary action is visually dominant and secondary actions are quiet.
- Form controls use tokenized/shared styling and accessible focus states.
- Wizard-adjacent modals/panels no longer interrupt the flow with legacy dark/lime styling.
- Mobile layout remains readable, tappable, and uncluttered.

## Verification

- `npm run build`
- `npm run typecheck`
- Search for legacy lime/dark styling in wizard-visible components and list any intentional exceptions.
- Manual responsive pass for `/app` wizard at desktop and 375px mobile.
