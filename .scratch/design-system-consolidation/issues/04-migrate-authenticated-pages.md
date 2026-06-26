# Roll out warm editorial flow across authenticated pages

Status: ready-for-agent

## Problem

Authenticated pages currently mix warm editorial and older dark app styling. This makes navigation feel inconsistent and undermines the product identity.

## Dependencies

- Complete or coordinate with `02-tokenize-design-c.md`.
- Complete or coordinate with `03-standardize-shared-primitives.md`.
- Complete `07-wizard-flow-quality-design-c.md` before treating `/app` wizard entry/setup as done.
- Add a dedicated results/edit/regenerate flow ticket before treating generated results as done.

## Scope

After the narrower wizard/results flow tickets are complete, roll the warm editorial Design C system through the remaining authenticated pages:

- My Calendars
- Schedule
- Calendar Detail
- Profile/settings
- Admin dashboard

This ticket may include small consistency patches to wizard/results only when they come from shared primitive changes or navigation-level alignment.

## Out Of Scope

- Reworking `/app` wizard entry/setup flow quality; use `07-wizard-flow-quality-design-c.md`.
- Full generated results/edit/regenerate redesign until a dedicated results flow ticket exists.
- Public landing, docs, privacy, terms, and not-found pages unless they leak styles into authenticated routes.
- Backend/data-flow changes.
- Restoring `concepts.html`.

## Acceptance Criteria

- Remaining authenticated pages use warm background and card surfaces.
- Primary CTAs use orange Design C styling.
- Page titles use the same display typography pattern.
- Card spacing, radius, and shadows feel consistent.
- No authenticated page has an unexplained dark full-page background.
- Any intentional status colors, platform colors, or destructive states are documented as semantic exceptions rather than primary accent drift.

## Verification

- `npm run build`
- `npm run typecheck`
- Manual route pass through each authenticated page.
- Screenshot comparison against the available updated Design C references and newly captured authenticated route baselines.
