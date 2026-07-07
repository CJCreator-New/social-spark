# Full-App Audit Plan — 2026-07-07

## Objective
Produce an exhaustive, evidence-grounded technical audit of ContentForge across all 9 domains defined in the audit prompt, with per-finding file:line citations. Deliverable persisted to `.scratch/audit-2026-07-07/`. No fixes, no refactors, no unrequested abstractions.

## Approach

### Phase 0 — Repository traversal
- Parallel `list_dir` on all top-level dirs (`src/`, `supabase/`, `e2e/`, `scripts/`, `dashboard-deploy/`, `migrations/`, `docs/`, `public/`, `.github/`, config roots).
- Recursive listing of `src/components/`, `src/pages/`, `src/lib/`, `src/hooks/`, `src/stores/`, `supabase/functions/`, `supabase/migrations/`.
- Parallel `view` batches (10–20 files per round) covering: every `.ts`/`.tsx` source file, every migration, every edge function, every test, every config (`vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts`, `package.json`, `.env.example`), CI workflows, and infra manifests.
- Progress line emitted after each batch: `[TRAVERSAL] Batch N complete — X files read, Y queued`.
- Unreadable files flagged inline.

### Phase 1 — Evidence collection
Every finding carries either a direct quote or a `path:line` citation. Unverifiable claims marked `[UNVERIFIED — requires manual check]` with a note of what was sought and where.

### Phase 2 — Full-coverage finding pass
Sweep all 9 domains (Architecture, Frontend Components, User Journeys, Functional Correctness, Performance, Backend/DB, Security, DevOps/Testing, UI/UX) across every file. Each candidate tagged `[confidence: high/medium/low]` and `[severity: critical/high/medium/low]`. No filtering at this stage.

Backend/security pass augmented with:
- `security--run_security_scan` and `security--get_scan_results`
- `security--get_table_schema` for RLS/grant verification
- `supabase--read_query` to confirm policies, grants, indexes on `pg_catalog`/`pg_policies`
- `supabase--linter` for advisor findings
- `code--dependency_scan` for CVE/outdated deps

### Phase 3 — Self-verification
Checklist run before writing final files: every finding cited or `[UNVERIFIED]`; no inferred content; all 9 domains present (or explicit `[NO FINDINGS]`); no pre-filtering.

### Phase 4 — Report output
Written to `.scratch/audit-2026-07-07/`:

```text
.scratch/audit-2026-07-07/
├── README.md                       Executive summary + scores + index
├── findings-register.md            Full structured findings (all severities)
├── workflows.md                    Per-workflow happy/failure/recovery paths
├── interactive-components.md       Per-element correctness/a11y/keyboard/states
├── thematic/
│   ├── architecture.md
│   ├── security.md
│   ├── performance.md
│   ├── accessibility.md
│   ├── technical-debt.md
│   ├── missing-tests.md
│   ├── code-duplication.md
│   ├── dead-code.md
│   └── quick-wins.md
├── roadmap.md                      P0/P1/P2/P3, each item referencing a finding ID
└── traversal-log.md                Batch log + any unreadable files
```

Each finding uses a stable ID (`F-001`, `F-002`, …) so the roadmap and thematic reports reference back to the register instead of duplicating text.

## Scope guardrails
- Read-only: no code edits, no migrations, no config changes.
- No speculative refactors — recommendations scoped strictly to the defect they address.
- Excluded from re-audit (per standing prompt): `src/components/brand/`, `src/constants/branding.ts`, `public/brand/`.
- Prior audit artifacts (`.scratch/audit-2026-07-02/`, `docs/agents/full-app-audit.md`, `memory/`) read for context but findings re-verified against current source, not carried forward blindly.

## Technical details
- Batch size target: 15 parallel `view` calls per round to stay within tool-call limits while minimizing round-trips.
- Line-number citations use current file contents at read time; if a file changes mid-audit, re-read and update citation.
- Severity rubric: Security/RLS/BYOK and AI reliability defects weighted one tier higher than the same defect elsewhere (per `docs/agents/full-app-audit.md`).
- Confidence rubric: `high` = defect reproducible from quoted code alone; `medium` = defect requires a plausible runtime assumption; `low` = pattern-smell without a concrete failure scenario.

## Out of scope
- Implementing any fix.
- Re-auditing branding assets.
- Load testing, live pentest, or anything requiring production traffic.
- Design/UX redesign proposals beyond fixing cited defects.

## Deliverable
Once approved and switched to build mode, I will execute Phases 0–4 and write the report files above. Final chat reply will link the report and summarize the top P0/P1 findings only.
