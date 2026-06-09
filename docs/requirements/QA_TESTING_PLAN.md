# QA & Testing Plan — Social Spark

Test types
- **Unit Testing**: Vitest test runner executes unit tests for core logical hooks and helpers.
- **Integration Testing**: Local or remote integration runs verifying Edge Function responses and database RLS triggers.
- **End-to-End (E2E) Testing**: Playwright test runner drives critical workflows (login, calendar configuration, generation wizard, and content publishing).
- **Accessibility (a11y) Testing**: Automated accessibility audits run using Playwright and Axe (`e2e/accessibility.spec.ts`) to ensure compliance with WCAG AA guidelines.

Unit Test Directory Structure (`src/lib/__tests__/`)
1. **`brandMemory.test.ts`**: Verifies that custom brand voice rules, target audience profiles, tone variables, and forbidden words are parsed correctly and properly injected into AI prompts.
2. **`postPerformanceScore.test.ts`**: Tests the metric scoring logic. Validates that hooks are evaluated, CTA relevance is scored, and readability metrics are calculated accurately.
3. **`seedFromPost.test.ts`**: Validates the content parsing code that seeds a new content wizard flow using copy extracted from an existing post.
4. **`calendarSchedule.test.ts`**: Verifies date math, ICS calendar exports, timezone-aware post timings, and daily schedules.
5. **`errors.test.ts`**: Checks that network, database, and auth errors are cleanly parsed and mapped to user-friendly messages.

E2E Testing Critical Paths
- **User Authentication**: Sign-up, Sign-in, and Password Reset flow validation.
- **Wizard Calendar Generation**: Setting up topic briefs, selecting social networks, and generating weekly posts.
- **Content Editing & Customization**: Modifying post copy, executing inline rewrites, calling the cover image generator, and selecting aspect ratios.
- **Calendar & Publish View**: Scheduling posts, shifting dates, and moving posts through weekly strips.
- **Accessibility Audit**: axe-core scans executed programmatically across all core pages (`Landing`, `Auth`, `Index`, `CalendarDetail`, `Profile`, `Schedule`, `Admin`).

Test Automation & CI/CD
- GitHub Actions CI runner (`.github/workflows/ci-cd.yml`) executes:
  - Linting checks (`npm run lint`).
  - Unit tests (`npm run test`).
  - Playwright E2E tests and accessibility checks on pull requests.

Reporting & Defect Resolution
- CI fails fast on compilation, lint, or test failures.
- Playwright trace files, video recordings, and screenshots are captured and saved as build artifacts upon test failure.
