Experiments scaffold
====================

This folder contains experiment definitions and tracking notes.

- `README.md` (this file)

How to run an experiment:
1. Define hypothesis and metric in a new markdown file.
2. Implement feature behind `featureFlags` toggle.
3. Run A/B test and collect telemetry events to `/api/telemetry`.
