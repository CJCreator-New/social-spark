# Social Spark Developer Guide

This repository contains **Social Spark**, a React + TypeScript + Supabase + Zustand web application for AI-powered social media content generation, planning, scheduling, and admin analytics.

## Core Architectural Patterns

1. **Vite + React (TypeScript)**: The front-end resides in the `src/` directory.
2. **Supabase Back-end**: Supabase handles Authentication, database schemas (`migrations/`), storage buckets, and Edge Functions (`supabase/functions/`).
3. **Zustand State Management**: The wizard flow, calendars, and schedules are orchestrated centrally in Zustand stores (`src/stores/`).
4. **Client-Side Scoring & Insights**: Content scoring (Hook, CTA, hashtags, readability) resides under `src/lib/postPerformanceScore.ts` and `src/lib/postInsights.ts`.

---

## Critical Developer Rules

- **Use specialized agents**: For large-scale feature additions, always run the specialized agents to guide planning (`feature-planner`), react layout (`react-ui-builder`), backend schema/Edge Functions (`supabase-architect`), LLM prompt orchestration (`content-ai-engineer`), global store flows (`state-flow-keeper`), test suites (`test-runner`), and code review checks (`code-reviewer`). For QA passes/release audits use `qa-test-auditor`, for Playwright E2E specs use `e2e-test-writer`, and for visual/product-feel polish use `saas-design-architect`.
- **Plan before coding**: Prefer utilizing the `feature-planner` to create a formal implementation plan before making modifications to source code files.
- **Maintain security boundaries**: Treat Auth, Row-Level Security (RLS) policies, and per-user analytics boundaries as high-risk areas. RLS must be enabled on every table.
- **AI Graceful Fallback**: Any code interacting with AI generation must gracefully handle failed requests, timeouts, and malformed model outputs.
- **Loading & Recovery states**: Design pages to handle loading, empty, error, and recovery states (such as draft restoration on application reload).
- **No bold/italic tags in post copy**: Enforce rules that prevent the LLM from outputting markdown formatting (`**` or `*`) inside the post text copy.
- **Verify with tests**: Always run tests using `npm run test:run` and verify that the test suite passes cleanly before marking tasks as complete.

---

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/` in this repo (no external tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` at the repo root and `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.

### Full-app audit

A standing, reusable prompt for a comprehensive security/AI-reliability/code-quality/UX/test audit. See `docs/agents/full-app-audit.md`.
