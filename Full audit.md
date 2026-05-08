# Social Spark Audit Report

## Executive Summary

Overall readiness: needs work.

The application now passes the core local delivery gates that were blocking handover during the audit: lint is clean, the production build succeeds, and unit tests run successfully after the test boundary fix. The remaining audit issues are concentrated in security and handover hygiene, not in runtime correctness.

The most important open risks are a tracked root `.env` file containing Supabase configuration, unresolved dependency vulnerabilities reported by `npm audit`, and documentation that does not yet describe the current setup, env requirements, and verification workflow clearly enough for a clean handover.

## Scope And Method

This report covers the current repository state and the following checks:

- Repository structure and code organization
- Lint and build validation
- Unit and E2E test boundaries
- CI workflow alignment
- Dependency security audit
- Environment and documentation hygiene

Evidence came from direct file inspection and command output, including:

- `npm run lint`
- `npm run test:run`
- `npm run build`
- `npm audit --audit-level=moderate`
- source and workflow file review

## Findings

### 1. Tracked environment file exposes deployment configuration

Severity: high

Evidence:

- [`.env`](.env) is tracked in git.
- The file contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values.
- [`.gitignore`](.gitignore) does not ignore `.env`.

Impact:

- Environment configuration is easier to leak or overwrite.
- Handover is riskier because new maintainers may accidentally commit local environment data.

Recommendation:

- Remove `.env` from version control if this is not intentional.
- Add `.env` and related local env variants to `.gitignore`.
- Document required env vars in README or a dedicated setup guide.

### 2. Dependency audit reports unresolved vulnerabilities

Severity: high

Evidence:

- `npm audit --audit-level=moderate` reports 14 vulnerabilities.
- Reported packages include `react-router` / `@remix-run/router`, `rollup`, `glob`, `minimatch`, `picomatch`, `flatted`, `ajv`, `yaml`, and `esbuild`.

Impact:

- The repo is not yet in a clean dependency state for handover.
- Some findings are transitive, but they still represent real supply-chain risk until addressed or explicitly accepted.

Recommendation:

- Run `npm audit fix` and review the resulting lockfile changes.
- Validate any major upgrades against the app and CI pipeline before merging.
- Re-run the audit after dependency updates and record the result.

### 3. Documentation does not yet describe the current setup and verification flow

Severity: medium

Evidence:

- [README.md](README.md) is still a generic starter README and does not document this repo's env requirements, audit checks, or test commands.
- The current verification workflow relies on `npm run lint`, `npm run test:run`, `npm run build`, and `npm audit --audit-level=moderate`, but that is not captured in the main project docs.

Impact:

- New maintainers will need tribal knowledge to reproduce the current validation flow.
- Handover quality drops because setup and verification are not discoverable from the repo itself.

Recommendation:

- Replace the placeholder README content with repo-specific setup, env, test, and deployment notes.
- Add a short handover section summarizing the required checks and known risks.

### 4. Performance warnings remain untriaged

Severity: low

Evidence:

- `npm run build` completes successfully but warns about stale Browserslist data.
- The build also reports large chunks above 500 kB.

Impact:

- These are not blockers, but they indicate room for delivery and bundle-size improvement.

Recommendation:

- Refresh Browserslist data.
- Review bundle splitting if the chunk size warnings matter for deployment or load time targets.

## Pass/Fail Checklist

- Architecture is modular and boundaries are clear: pass
- Naming, structure, and duplication are acceptable: pass
- No hardcoded secrets, credentials, or unsafe env handling: fail
- Auth and access control flows are defined and reviewed: pass
- Lint passes: pass
- Unit tests exist and run successfully: pass
- Coverage is measured and meets the project target: partial
- E2E tests cover critical user journeys: partial
- CI runs lint, tests, build, and security checks: pass
- Dependencies are current enough for handover: fail
- Performance risks are identified for critical paths: partial
- README and onboarding docs match the current workflow: fail
- Commit and release workflow are traceable enough for audit purposes: partial

## Evidence Log

- [ToneConsistencyChecker.tsx](src/components/ToneConsistencyChecker.tsx#L214) and [indiaContentIntelligence.ts](src/lib/indiaContentIntelligence.ts#L247) previously contained syntax artifacts that blocked lint and build; both are now fixed.
- [Profile.tsx](src/pages/Profile.tsx#L57) and [Profile.tsx](src/pages/Profile.tsx#L80) previously used `any`; both are now typed.
- [vitest.config.ts](vitest.config.ts#L1) now excludes `e2e/**` so Vitest only runs unit tests.
- [hashtagPolicy.test.ts](src/lib/hashtagPolicy.test.ts#L1) provides a minimal passing unit test.
- [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml#L97) now points the accessibility job at the existing Playwright suite.
- `npm run lint` passes.
- `npm run test:run` passes.
- `npm run build` passes.
`npm audit --audit-level=moderate` now reports 2 moderate vulnerabilities remaining (esbuild/vite); addressing them requires a breaking upgrade to `vite@8`.

## Open Risks

- Dependency vulnerabilities remain open.
- Tracked root `.env` file has been untracked and added to `.gitignore`.
- Documentation still needs a repo-specific setup and verification guide (README updated with initial steps).
- Coverage has not yet been measured in this audit pass, so the target is not verified.

## Conclusion

The codebase is now in a much better technical state than when the audit started: the repo compiles, lints, and runs unit tests successfully. The remaining work is mostly about handover readiness and risk reduction, not core product correctness. Fixing the dependency audit, removing or hardening the tracked env file, and updating the documentation would move this from needs work to handover-ready.

## Remediations Applied (automated)

- Added `.env` to `.gitignore` and untracked the existing `.env` from the repository.
- Updated `README.md` with local setup and verification steps used by this audit.
- Attempted `npm audit fix`; two moderate vulnerabilities remain related to `esbuild`/`vite`. Fixing them requires a breaking upgrade to `vite@8` (owner approval recommended).

See "Open Risks" for items that still require manual review or owner decisions.