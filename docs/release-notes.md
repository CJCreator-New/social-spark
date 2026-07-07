# Release Notes

> **Release:** [e.g., v2.4.0]  
> **Release Date:** YYYY-MM-DD  
> **Tag:** [e.g., v2.4.0]  
> **Commit Range:** `[base-sha]` → `[head-sha]`  
> **Release Manager:** [Name]  
> **Jira Epic:** [Epic ID]

---

## 1. Overview

[Provide a brief, high-level description of the release purpose and the primary user value delivered.]

> **Example:** This release ships the WYSIWYG post editor, offline generation support, and major scheduling UX improvements.

---

## 2. What's New

### 2.1 Features

| Feature | Description | User Value | Jira Ticket |
|---------|-------------|-----------|-------------|
| [Feature Name] | [Brief description] | [Value] | [Ticket ID] |
| [Feature Name] | [Brief description] | [Value] | [Ticket ID] |

### 2.2 Enhancements

- **[Enhancement Name]:** [Description of what was improved and why.]
- **[Enhancement Name]:** [Description]

### 2.3 UX / Design Changes

- [Change description]
- [Change description]

---

## 3. Bug Fixes

| Issue | Description | Severity | Fix Commit | Ticket |
|-------|-------------|----------|-------------|--------|
| DEF-001 | [Bug description] | Critical / Major / Minor | [SHA] | [Ticket ID] |
| DEF-002 | [Bug description] | Critical / Major / Minor | [SHA] | [Ticket ID] |

---

## 4. Performance Improvements

| Area | Before | After | Improvement | Ticket |
|------|--------|-------|-------------|--------|
| [e.g., Initial bundle size] | [e.g., 450 kB] | [e.g., 320 kB] | [e.g., -29%] | [Ticket ID] |
| [e.g., Calendar load time] | [e.g., 1.8s] | [e.g., 0.9s] | [e.g., -50%] | [Ticket ID] |
| [e.g., Memory usage] | [e.g., 180 MB] | [e.g., 120 MB] | [e.g., -33%] | [Ticket ID] |

### 4.1 Frontend Optimizations

- [e.g., Memoized expensive selectors in Dashboard]
- [e.g., Lazy-loaded large pages / heavy components]
- [e.g., Removed duplicate CSS and dead code]

---

## 5. Security & Compliance

- [e.g., Fixed token refresh race condition]
- [e.g., Added rate limiting to public API endpoints]
- [e.g., Updated dependency: auth-lib 3.2.1 → 3.3.0 (CVE-2024-XXXX)]

### 5.1 Security Fixes

| Vulnerability | CVE / Advisory | Severity | Fix |
|---------------|---------------|----------|-----|
| [Vulnerability] | [CVE ID] | High / Medium / Low | [Updated / Patched] |

---

## 6. Breaking Changes

> **If there are no breaking changes, write:** *None*

| Change | Migration | Impact |
|--------|-----------|--------|
| [e.g., API endpoint `/v1/posts` removed] | [e.g., Migrate to `/v2/posts` before deploy] | [e.g., High] |
| [e.g., Config key `brand.color` renamed] | [e.g., Update `brand.primaryColor`] | [e.g., Low] |

---

## 7. Deprecations & Removals

| Item | Type | Removed in Version | Replacement |
|------|------|--------------------|-------------|
| [e.g., `legacy-auth` package] | Removal | [Version] | [e.g., `@modern-auth`] |
| [e.g., `/api/legacy/export`] | Deprecation | [Version] | [e.g., `/api/v2/export`] |

---

## 8. Known Issues

| Issue | Severity | Workaround | Planned Fix |
|-------|----------|-----------|-------------|
| [Known Issue] | [Severity] | [Workaround] | [Next release] |

---

## 9. Upgrade & Deployment Instructions

### 9.1 Prerequisites

- [e.g., Node.js >= 20.x]
- [e.g., Database migration: `npm run migrate`]

### 9.2 Deployment Steps

1. Pull release tag `[tag]`
2. Run `[e.g., npm install && npm run build]`
3. Run `[e.g., kubectl apply -f k8s/]`
4. Verify health at `[e.g., /health]`

---

## 10. QA & Verification

| Test Suite | Status | Report Link |
|------------|--------|-------------|
| Unit Tests | ✅ Passed / ❌ Failed | [Link to testing-report.md] |
| Integration Tests | ✅ Passed / ❌ Failed | [Link to testing-report.md] |
| Regression Tests | ✅ Passed / ❌ Failed | [Link to regression-report.md] |
| Performance / Lighthouse | ✅ Pass / ❌ Fail | [Link] |

### 10.1 Quality Gate Summary

- [x] All TypeScript passes
- [x] ESLint passes
- [x] Prettier passes
- [x] Build succeeds
- [x] No console errors
- [x] No React warnings
- [x] No accessibility violations
- [x] No hardcoded colors remaining
- [x] No `native confirm()` usage
- [x] No duplicated loading/error UI
- [x] All acceptance criteria satisfied

---

## 11. Rollback Plan

| Rollback Condition | Trigger | Action |
|--------------------|---------|--------|
| [e.g., Error rate > 1%] | Monitoring alert | `[e.g., kubectl rollout undo]` |
| [e.g., Critical security issue] | Security team | `[e.g., Revert PR #1234]` |

---

## 12. Sign-Off

| Role | Name | Approval | Date | Comments |
|------|------|----------|------|----------|
| Release Manager | [Name] | ✅ / ❌ | YYYY-MM-DD | |
| Engineering Lead | [Name] | ✅ / ❌ | YYYY-MM-DD | |
| QA Lead | [Name] | ✅ / ❌ | YYYY-MM-DD | |
| Product Owner | [Name] | ✅ / ❌ | YYYY-MM-DD | |
| Security Lead | [Name] | ✅ / ❌ | YYYY-MM-DD | |

---

## 13. References

- [Link to architecture review]
- [Link to implementation notes]
- [Link to testing report]
- [Link to regression report]
- [Link to changelog]
- [Link to CI/CD pipeline]
