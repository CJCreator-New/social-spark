# Deep Scan Report — bug-finder
Date: 2026-05-25

## Summary

- Semgrep: not available in this environment (could not run via `npx`).
- `npm audit --json`: no vulnerable packages found (0 total vulnerabilities).
- ESLint: 3 errors found (see details).
- Pattern scan (grep): no high-confidence matches for `eval`, `innerHTML`, `child_process.exec`, obvious secret keys, or raw SQL concatenation patterns.

## Quick Scan Report

- Type check: passed (`npm run typecheck`).
- Tests: passed (5 files, 10 tests; `npm run test:run`).
- Lint: 3 ESLint errors in `src/pages/Index.tsx` (React hooks naming/usage issue — see Findings).
- TODO/FIXME/XXX scan: none found.

## Tasks (from quick & deep scans)

These are suggested actionable tasks you can run through one-by-one. Mark as done when complete.

- [ ] Rename `useLocalFallback` → `localFallback` in `src/pages/Index.tsx` and update call sites (resolves ESLint `react-hooks/rules-of-hooks`).
- [ ] Run eslint again to confirm no hook-rule errors: `npx eslint src/pages/Index.tsx`.
- [ ] Install and run `semgrep` locally (or via Docker) and collect findings: `semgrep --config=auto ./`.
- [ ] Add a nightly CI job to run the bug-finder deep mode (semgrep + npm audit) and publish results (.reports/deep-scan-report.json).
- [ ] Optionally open a PR with the rename fix and include the lint/test run artifacts.
- [ ] If semgrep finds security issues, triage them by severity and assign owners (use CODEOWNERS if available).


## Findings — High / Actionable

1) ESLint: React hooks rule violation (High)
   - File: `src/pages/Index.tsx`
   - Errors (3):
     - `React Hook "useLocalFallback" is called in function "generate" that is neither a React function component nor a custom React Hook function.`
     - Locations (approx): around lines 1683, 1692, 1712 in `src/pages/Index.tsx`.
   - Why: `useLocalFallback` is named like a hook (`use*`) but it's defined and used as a plain inner function. ESLint's `react-hooks/rules-of-hooks` flags this because calling hooks conditionally or from non-hook functions breaks hook invariants.
   - Remediation (quick): rename `useLocalFallback` to `localFallback` or `handleLocalFallback` (and update call sites). Alternatively, convert it to a real custom hook that follows the rules (top-level call, proper hook semantics) — but for this use-case a rename is lowest-risk.
   - Suggested patch (safe): rename definition at the top of the file and replace the three call sites. Example rename: `const localFallback = (message: string) => { ... }` and call `localFallback(...)`.

## Findings — Medium / Informational

- `npm audit` returned zero vulnerabilities — dependencies appear up-to-date from `npm audit`'s perspective.
- Grep-based pattern checks found no obvious uses of `eval`, `dangerouslySetInnerHTML`, or direct exec-based child process calls in `src/` (fast scan). This is not a replacement for semgrep; semgrep would provide richer rules.

## Blockers / Notes

- Semgrep could not be run via `npx` in this environment. Two options:
  - Install semgrep locally (recommended for full rule coverage):

    ```bash
    # using pip
    python -m pip install --user semgrep
    semgrep --version

    # or using Docker (no install required)
    docker run --rm -v "$PWD":/src returntocorp/semgrep semgrep --config=auto /src
    ```

  - If you prefer npm-based tooling, run semgrep in CI or use a dedicated security scanner that integrates with npm.

## Recommended next steps (priority order)

1. Apply the ESLint fix (rename `useLocalFallback`) — low-risk, unblock CI lint.
   - Command example to test locally:

    ```bash
    # run lint only for the file to validate
    npx eslint src/pages/Index.tsx
    ```

2. Install and run semgrep (deep mode) locally or in CI using the commands above. Use `--config=auto` to get a baseline, then adopt curated rulepacks for JavaScript/TypeScript and security rules.

3. (Optional) Add a nightly CI job that runs the bug-finder deep mode and uploads `.reports/deep-scan-report.json`.

4. Consider enabling `semgrep` via a GitHub Action or GitLab CI to catch security/sources issues before merge.

## Artifacts produced

- This Markdown report: `.reports/deep-scan-report.md` (you are viewing it now).
- If you want, I can open a branch and produce a small PR that renames `useLocalFallback` to `localFallback` and updates call sites — apply change + run lint/tests locally before pushing.

---
If you'd like, I will (choose one):
- Create the PR that renames `useLocalFallback` → `localFallback` now (safe change).
- Install semgrep here and run a full rule scan (may need pip or Docker on your machine).
