# QA & Testing Plan — Social Spark

Test types
- Unit tests: Vitest for components, hooks, and utility functions.
- Integration tests: API endpoints and Supabase function behaviors.
- E2E tests: Playwright for critical paths (see `e2e/critical-paths.spec.ts`).
- Performance tests: Lighthouse and synthetic load tests for APIs.
- Accessibility tests: axe or Playwright accessibility checks.

Coverage targets
- Unit coverage: 80% on core modules.
- E2E: cover signup, calendar create/schedule, publish, and analytics view.

Test automation
- CI runs: lint, unit tests, and E2E smoke on PRs; full E2E on release branches.

Regression & release
- Maintain a regression suite for critical business flows.
- Run performance regression tests on major releases.

Test data & environments
- Provide sanitized production-like test dataset for E2E and performance runs.
- Separate staging environment for releases.

Reporting
- Fail-fast on CI; attach artifacts and Playwright trace on failures.
