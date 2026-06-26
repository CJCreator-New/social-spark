# Restore design reference assets

Status: ready-for-agent

## Problem

`concepts.html` and the `screenshots/` audit assets were referenced by the design work but are currently missing from the filesystem view. Without them, visual QA cannot compare implementation against the intended Design C flow.

## Scope

- Locate or restore `concepts.html`.
- Locate or restore the `screenshots/` folder and `screenshots/DESIGN_AUDIT.md`, or recapture equivalent screenshots.
- Document the canonical design reference path in the PRD.

## Acceptance Criteria

- `concepts.html` exists at repo root or the PRD is updated with its new canonical path.
- Screenshot audit assets exist or a new screenshot capture process is documented.
- The restored files are not mixed with unrelated generated artifacts.

## Verification

- `Test-Path concepts.html`
- `Test-Path screenshots`
- Open the design reference and confirm it contains the warm editorial Design C flow.
