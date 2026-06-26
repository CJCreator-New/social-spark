# Visual regression pass

Status: ready-for-agent

## Problem

After migration, the app needs a screenshot-based pass to catch spacing, mobile wrapping, dark-theme remnants, and inline-style overrides.

## Scope

- Start the dev server.
- Recapture screenshots for the main routes.
- Compare against the updated Design C direction already documented in the PRD, tokens, shared primitives, and newly captured wizard/results baselines.
- Patch obvious visual regressions.
- Document remaining follow-up issues if needed.

## Out Of Scope

- Restoring `concepts.html`.
- Waiting for historical screenshot assets before running visual QA.
- Broad redesign beyond obvious regression fixes; create follow-up issues for larger changes.

## Acceptance Criteria

- Fresh screenshots exist for all key routes.
- Desktop and mobile layouts are free of obvious overlap.
- No authenticated page visually falls back to the old dark/lime app theme.
- Any intentional exceptions are documented.
- Wizard/results screenshots can be used as the initial authenticated flow baseline after issues `07` and `08`.

## Verification

- `npm run build`
- Relevant Playwright screenshot capture command, or documented manual capture if automated screenshots are unavailable.
- Manual comparison against PRD acceptance criteria and the available updated Design C references.
