---
name: bug-finder
description: |
  Automated codebase bug finder. Runs a configurable set of scans (typecheck, tests,
  linters, static analysis, pattern searches, dependency checks, and CI/coverage
  inspections), aggregates findings, and outputs an actionable, prioritized list
  of issues with reproduction steps and quick remediation hints.
scope: repository
usage: |
  Use this skill when you want a focused audit of the entire repository to find
  defects, warnings, and risky patterns. The skill is intended to be invoked by
  an assistant in the workspace (local run) or by automation (CI job) that can
  run commands and read files.
---

## What this skill does

- Runs a configurable sequence of checks across the codebase:
  - Type checking (`npm run typecheck` / `tsc -p`)
  - Unit tests and test-suite status (`npm run test:run` / `vitest` / `jest`)
  - Linters (`npm run lint` / `eslint` / `prettier`)
  - Static-analysis and security scans (grep/semgrep/sonar-like rules)
  - Search for TODO/FIXME/XXX comments and panic markers
  - Search for common security anti-patterns (eval, unsanitized templates,
    insecure random, direct DB string concatenation)
  - Dependency issues (outdated/known-vulnerable packages via `npm audit`)
  - Missing or broken CI/workflow files
  - Files containing secrets (quick scan for high-entropy strings / API keys)
  - Runtime error triage: look for uncaught Promise rejections, top-level
    try/catch absence, and unsafe async patterns

- Aggregates results and classifies each finding by severity: Critical, High,
  Medium, Low, Info.

- Produces an output format that is human- and machine-readable (Markdown and
  JSON) with:
  - Title, severity, category (typecheck, test, lint, security, dependency)
  - File path(s) and line excerpts (1–3 lines)
  - Reproduction steps (commands to run) and immediate remediation hints
  - Confidence score and suggested owner/area

## Execution flow

1. Configure the run via the skill prompt (see Prompts section). Decide which
   scanners to run and whether to run destructive or lengthy checks (e.g., full
   semgrep, heavy dependency scans).
2. Run `typecheck` and capture diagnostics.
3. Run `test` (fast mode) and capture failing tests and stack traces.
4. Run linter and capture rule violations grouped by rule id.
5. Run pattern searches and security heuristics (fast grep + optional semgrep).
6. Run lightweight dependency audit (`npm audit --json`) and summarize findings.
7. Correlate results and prioritize by severity and reproducibility.
8. Render final report in Markdown and optionally as JSON for downstream tools.

## Decision points

- Scope: full repo vs specific folders/files.
- Depth: quick/passive (typecheck+test+lint+grep) vs deep (semgrep, full
  `npm audit` remediation, dynamic analysis).
- CI logs: include CI run logs if provided to reproduce flaky failures.
- Fix attempts: the skill only reports issues by default. Optionally, it can
  attempt automated fixes for low-risk items (formatting, minor lint fixes).

## Quality criteria / Completion checks

- No Critical or High severity issues remain unresolved (or they are clearly
  assigned and reproducible).
- All failing tests are catalogued with stack traces and failing assertions.
- Type errors map to source files and suggested fixes (e.g., add null guards,
  adjust types, or correct generics).
- Linter failures include rule ids and quick fixes (when available).
- Security findings include a precise location, a minimal reproduction and a
  suggested mitigation (escape, sanitize, use parameterized queries).

## Prompts — examples to call the skill

- Quick audit (default fast checks):

  "Run the bug-finder skill with default quick checks (typecheck, tests,
  lint, grep). Output a Markdown report and JSON summary. Scope: repository root."

- Deep security scan (longer):

  "Run the bug-finder skill in deep mode: include semgrep rules, `npm audit`,
  and a secret-scan. Only report Critical/High findings. Provide remediation
  steps and suggested PR titles."

- Focused run on a directory:

  "Run the bug-finder skill limited to `src/lib` and `supabase/functions`. Run
  typecheck, unit tests for that area, lint, and grep for TODO/FIXME."

## Output format

- Markdown summary with top findings and quick links to locations.
- Full JSON output schema (example):

```json
{
  "summary": { "critical": 1, "high": 2, "medium": 5, "low": 12 },
  "findings": [
    {
      "id": "F-0001",
      "severity": "Critical",
      "category": "typecheck",
      "path": "src/lib/api.ts",
      "lines": "45-48",
      "excerpt": "const x: number = getValue();",
      "reproduction": "npm run typecheck -- --pretty false",
      "hint": "The function getValue() returns string | number — refine types or coerce",
      "confidence": 0.95
    }
  ]
}
```

## Implementation notes / recommended commands

- Fast mode (recommended for interactive use):

```bash
npm run typecheck
npm run test:run -- --runInBand --reporter=json
npm run lint -- --format=json
node scripts/quick-secret-scan.js
grep -R --line-number "TODO\|FIXME\|XXX" src || true
```

- Deep mode (CI / scheduled run):

```bash
npm run typecheck
npm run test:run
npm run lint
semgrep --config path/to/rules --json
npm audit --json
```

## Safety and permissions

- The skill reads repository files and executes local commands. Ensure the
  environment running the skill has no untrusted network mounts and that
  secrets are not accidentally printed to logs.

## Next steps and extensions

- Integrate with CI: add a job that runs the bug-finder nightly and uploads the
  JSON findings to an issue tracker.
- Add auto-fix mode for low-risk items (formatting, missing imports, trivial
  ESLint --fixable issues).
- Add mapping to relevant owners (CODEOWNERS) for automated triage.

---
This SKILL.md follows the `agent-customization` pattern and is written to be
workspace-scoped. Ask me to tune the default checks, severity thresholds, or
output schema for your team's workflows.
