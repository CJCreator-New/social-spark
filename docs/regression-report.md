# Regression Testing Report

> **Report Version:** 1.0.0  
> **Date:** YYYY-MM-DD  
> **PR / Commit:** [PR #] ([Commit Hash])  
> **Baseline Version:** [Tag / Commit against which regression was measured]  
> **QA Lead:** [Name]  
> **Tester(s):** [Names]

---

## 1. Executive Summary

[Provide a concise summary of the regression testing results, highlighting whether the release is safe to merge and deploy, and summarizing key risks.]

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Test Cases | XX |
| Passed | XX |
| Failed | XX |
| Blocked | XX |
| Pass Rate | XX% |
| New Defects Found | XX |
| Critical Blockers | XX |

---

## 2. Test Scope

### 2.1 Areas Covered

| Area | Risk Level | Rationale |
|------|-----------|-----------|
| Scheduling | High | Core user workflow |
| Draft restore | Medium | Data integrity risk |
| Clipboard | Low | UX impact |
| Export | High | Data correctness |
| ICS export | Medium | Calendar sync impact |
| Batch regeneration | High | Performance and cost risk |
| Brand memory | Medium | Persistence and migration |
| Profile update | Medium | Data integrity |

### 2.2 Baseline

- **Baseline Version:** [e.g., v1.2.3]
- **Baseline Commit:** [Commit hash]
- **Build Environment:** [e.g., Production build]

---

## 3. Regression Test Results

### 3.1 Test Execution

| ID | Test Case | Expected Result | Actual Result | Status | Notes |
|----|-----------|-----------------|--------------|--------|-------|
| RT-001 | Existing scheduling | Preserved | [Description] | Pass / Fail | [Notes] |
| RT-002 | Draft restore | Preserved | [Description] | Pass / Fail | [Notes] |
| RT-003 | Clipboard | Worked | [Description] | Pass / Fail | [Notes] |
| RT-004 | Export | Correct output | [Description] | Pass / Fail | [Notes] |
| RT-005 | ICS export | Correct .ics | [Description] | Pass / Fail | [Notes] |
| RT-006 | Batch regenerate | Completed | [Description] | Pass / Fail | [Notes] |
| RT-007 | Brand memory | Preserved | [Description] | Pass / Fail | [Notes] |
| RT-008 | Profile update | Saved | [Description] | Pass / Fail | [Notes] |

### 3.2 Test Matrix

| Module | Total | Passed | Failed | Pass Rate |
|--------|-------|--------|--------|-----------|
| Scheduling | X | X | X | XX% |
| Drafts | X | X | X | XX% |
| Clipboard | X | X | X | XX% |
| Export | X | X | X | XX% |
| Calendar Sync | X | X | X | XX% |
| Generation | X | X | X | XX% |
| Brand | X | X | X | XX% |
| Profile | X | X | X | XX% |

---

## 4. Defect Analysis

### 4.1 Defects Found During Regression

| ID | Severity | Module | Test Case | Description | Steps to Reproduce | Status |
|----|----------|--------|-----------|-------------|-------------------|--------|
| DEF-XXX | [Severity] | [Module] | [RT-00X] | [Description] | [Steps] | Open / In Progress / Resolved / Wont Fix |

### 4.2 Defect Distribution

| Severity | Count | % of Total |
|----------|-------|-----------|
| Blocker / Critical | X | XX% |
| Major | X | XX% |
| Minor | X | XX% |
| Cosmetic | X | XX% |

### 4.3 Root Cause Analysis (for Critical Defects only)

| Defect ID | Root Cause | Resolution | Prevention |
|-----------|-----------|------------|-----------|
| DEF-XXX | [e.g., Unintended side effect of refactoring] | [How it was fixed] | [How to prevent recurrence] |

---

## 5. Environment Details

| Environment | URL / Details | Status |
|-------------|--------------|--------|
| Staging | https://staging.example.com | Available |
| Production Preview | https://preview.example.com | Available |
| Local | localhost:5173 | Available |

### 5.1 Test Data

- [Dataset used]
- [Test accounts]
- [Fixtures]

### 5.2 Tools & Versions

| Tool | Version | Notes |
|------|---------|-------|
| Playwright | [Version] | E2E tests |
| Vitest | [Version] | Unit tests |
| Cypress | [Version] | Integration tests (if used) |
| axe-core | [Version] | Accessibility |

---

## 6. Performance & Stability

### 6.1 Performance Regression Check

| Metric | Baseline | Current | Δ | Status |
|--------|----------|---------|---|--------|
| LCP | X.Xs | X.Xs | +/-X% | Pass / Fail |
| FID | Xms | Xms | +/-X% | Pass / Fail |
| CLS | X.XX | X.XX | +/-X% | Pass / Fail |
| Memory Usage | XX MB | XX MB | +/-X% | Pass / Fail |

### 6.2 Stability

- [e.g., No crashes or memory leaks observed during 1-hour soak test]

---

## 7. Conclusion

### 7.1 Readiness Assessment

- [ ] **Safe to Merge:** Yes / No / Conditional
- [ ] **Safe to Deploy:** Yes / No / Conditional

### 7.2 Conditions for Merge/Deploy (if any)

- [ ] [e.g., DEF-001 must be resolved]
- [ ] [e.g., Accessibility audit re-run after fix]

### 7.3 Recommendations

- [e.g., Add regression test for DEF-XXX before next release]

---

## 8. Sign-Off

| Role | Name | Approval | Date | Comments |
|------|------|----------|------|----------|
| QA Lead | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |
| Engineering Lead | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |
| Product Owner | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |

---

## 9. Appendices

- [ ] Full test execution log (CI link or local file)
- [ ] Screenshots of failing tests
- [ ] Performance profiling artifacts
- [ ] Accessibility violation details
