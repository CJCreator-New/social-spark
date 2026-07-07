# QA Testing Report

> **Report Version:** 1.0.0  
> **Date:** YYYY-MM-DD  
> **Build / Commit:** [Commit Hash or Version Tag]  
> **Test Environment:** [e.g., Staging, Production Preview]  
> **QA Lead:** [Name]  
> **Author(s):** [Names]  
> **Duration:** [Start Date] → [End Date]

---

## 1. Executive Summary

[Provide a high-level summary of the testing results, overall pass/fail rate, key findings, and deployment readiness.]

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Test Cases | XX |
| Passed | XX |
| Failed | XX |
| Blocked | XX |
| Skipped | XX |
| Pass Rate | XX% |
| Critical Defects | XX |
| Major Defects | XX |
| Minor Defects | XX |

---

## 2. Test Scope

### 2.1 In Scope

- [Feature/Component Name]
- [Integration Point]
- [Regression Area]

### 2.2 Out of Scope

- [Feature not covered]
- [Environment not tested]

### 2.3 Assumptions & Dependencies

- [Assumption 1]
- [Assumption 2]

---

## 3. Test Environment

| Component | Details |
|-----------|---------|
| OS / Platform | [e.g., Windows 11, macOS Sonoma, iOS 17, Android 14] |
| Browser(s) | [e.g., Chrome 120, Firefox 121, Safari 17, Edge 120] |
| Screen Resolutions | [e.g., 1920x1080, 1440x900, 375x812] |
| API Environment | [e.g., Staging API v2] |
| Test Data | [e.g., Synthetic user accounts, seeded fixtures] |
| Special Config | [e.g., VPN, proxy, debug flags] |

---

## 4. Unit Test Results

### 4.1 Test Specification

| ID | Test Case | Description | Expected Result | Status |
|----|-----------|-------------|----------------|--------|
| UT-001 | Wizard cancel | [Full description] | [Expected Result] | Pass / Fail / Blocked |
| UT-002 | Wizard timeout | [Full description] | [Expected Result] | Pass / Fail / Blocked |
| UT-003 | Drag reorder | [Full description] | [Expected Result] | Pass / Fail / Blocked |
| UT-004 | Timezone conversion | [Full description] | [Expected Result] | Pass / Fail / Blocked |
| UT-005 | Conflict detection | [Full description] | [Expected Result] | Pass / Fail / Blocked |
| UT-006 | Avatar upload | [Full description] | [Expected Result] | Pass / Fail / Blocked |
| UT-007 | Password validator | [Full description] | [Expected Result] | Pass / Fail / Blocked |

### 4.2 Coverage

- **Overall Coverage:** XX%
- **Lines Covered:** XX / XX
- **Branches Covered:** XX / XX
- **Functions Covered:** XX / XX

---

## 5. Integration Test Results

### 5.1 Test Specification

| ID | Test Case | End-to-End Flow | Expected Result | Status |
|----|-----------|-----------------|----------------|--------|
| IT-001 | Generate → Save → Calendar | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-002 | Calendar → Schedule | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-003 | Schedule → Edit | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-004 | Admin dashboard | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-005 | Reset password | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-006 | OAuth login | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-007 | Offline generation | [Flow description] | [Expected Result] | Pass / Fail / Blocked |
| IT-008 | AI unavailable | [Flow description] | [Expected Result] | Pass / Fail / Blocked |

### 5.2 API Endpoints Validated

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/api/...` | 200 / 4xx / 5xx | [Notes] |
| POST | `/api/...` | 200 / 4xx / 5xx | [Notes] |

---

## 6. Regression Test Results

### 6.1 Test Specification

| ID | Test Case | Area | Expected Result | Status |
|----|-----------|------|----------------|--------|
| RT-001 | Existing scheduling | Scheduling | [Expected Result] | Pass / Fail / Blocked |
| RT-002 | Draft restore | Drafts | [Expected Result] | Pass / Fail / Blocked |
| RT-003 | Clipboard | Copy/Paste | [Expected Result] | Pass / Fail / Blocked |
| RT-004 | Export | Export | [Expected Result] | Pass / Fail / Blocked |
| RT-005 | ICS export | Calendar Sync | [Expected Result] | Pass / Fail / Blocked |
| RT-006 | Batch regenerate | Generation | [Expected Result] | Pass / Fail / Blocked |
| RT-007 | Brand memory | Brand Settings | [Expected Result] | Pass / Fail / Blocked |
| RT-008 | Profile update | Profile | [Expected Result] | Pass / Fail / Blocked |

### 6.2 Regression Scope

- Affected modules: [List of modules]
- Tested with baseline: [Previous version/commit]

---

## 7. Defect Log

### 7.1 Critical / Blockers

| ID | Severity | Component | Description | Steps to Reproduce | Status |
|----|----------|-----------|-------------|-------------------|--------|
| DEF-001 | Critical | [Component] | [Description] | [Steps] | Open / In Progress / Resolved / Wont Fix |
| DEF-002 | Critical | [Component] | [Description] | [Steps] | Open / In Progress / Resolved / Wont Fix |

### 7.2 Major

| ID | Severity | Component | Description | Steps to Reproduce | Status |
|----|----------|-----------|-------------|-------------------|--------|
| DEF-003 | Major | [Component] | [Description] | [Steps] | Open / In Progress / Resolved / Wont Fix |

### 7.3 Minor / Cosmetic

| ID | Severity | Component | Description | Steps to Reproduce | Status |
|----|----------|-----------|-------------|-------------------|--------|
| DEF-004 | Minor | [Component] | [Description] | [Steps] | Open / In Progress / Resolved / Wont Fix |

### 7.4 Summary

- **Critical (Blocker):** X
- **Major:** X
- **Minor:** X
- **Total Open:** X

---

## 8. Non-Functional Testing

### 8.1 Performance

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| First Contentful Paint (FCP) | < 1.5s | X.Xs | Pass / Fail |
| Largest Contentful Paint (LCP) | < 2.5s | X.Xs | Pass / Fail |
| Cumulative Layout Shift (CLS) | < 0.1 | X.XX | Pass / Fail |
| Time to Interactive (TTI) | < 3.5s | X.Xs | Pass / Fail |
| Memory Usage | < 150MB | XXX MB | Pass / Fail |

### 8.2 Accessibility (A11y)

| Standard | Tool | Issues Found | Critical | Status |
|----------|------|-------------|----------|--------|
| WCAG 2.1 AA | [e.g., axe-core] | X | X | Pass / Conditional / Fail |
| Keyboard Navigation | Manual | X | X | Pass / Conditional / Fail |
| Screen Reader | [e.g., VoiceOver, NVDA] | X | X | Pass / Conditional / Fail |

### 8.3 Browser Compatibility

| Browser | Version | OS | Status | Notes |
|---------|---------|----|--------|-------|
| Chrome | [Latest] | Win/Mac/Linux | Supported / Unsupported | [Notes] |
| Firefox | [Latest] | Win/Mac/Linux | Supported / Unsupported | [Notes] |
| Safari | [Latest] | macOS / iOS | Supported / Unsupported | [Notes] |

---

## 9. Test Evidence & Artifacts

- [ ] Screenshot / video evidence for each failing test case attached
- [ ] Network logs for API validation attached
- [ ] Performance profiling results attached
- [ ] Accessibility audit report attached
- [ ] Test run log (CI or local) attached

---

## 10. Sign-Off

| Role | Name | Approval | Date | Comments |
|------|------|----------|------|----------|
| QA Lead | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |
| Engineering Lead | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |
| Product Owner | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |
| Security Lead | [Name] | ✅ / ❌ / ⚠️ | YYYY-MM-DD | [Comments] |

---

## 11. Appendices

### 11.1 Test Data Used

[List of test accounts, fixtures, or environments.]

### 11.2 Third-Party Dependencies

[List of any external services or integrations tested.]

### 11.3 Hyperlinks

- [Link to test execution in CI]
- [Link to bug tracker]
- [Link to performance profiling]
