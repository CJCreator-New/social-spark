UX Polish & Runbook
===================

This runbook lists small, high-impact UX polish tasks performed and how to roll them out.

1. Autosave UX
  - Add subtle status in header (Saving / Saved / Error).
  - Persist drafts to `storageService` with TTL.

2. Skeleton during generation
  - `GenerateSkeleton` provides expected layout while AI runs.

3. Mobile tweaks
  - Minor responsive CSS applied to `src/styles/contentforge.css`.

Deployment notes:
- Run unit tests: `pnpm test`
- Smoke test generator: `pnpm dev` and generate a calendar
