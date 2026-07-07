# Implementation Notes

> **Feature / Epic:** [Feature Name]  
> **Jira / GitHub Issue:** [Issue ID]  
> **PR Number:** [PR #]  
> **Author(s):** [Full Name]  
> **Reviewer(s):** [Full Name]  
> **Date Started:** YYYY-MM-DD  
> **Date Completed:** YYYY-MM-DD  
> **Branch:** `feature/[branch-name]`  
> **Base Branch:** `main`

---

## 1. Scope & Objective

### 1.1 Problem Statement

[Describe the problem or user need this implementation addresses.]

### 1.2 Goals

- [Goal 1]
- [Goal 2]

### 1.3 Non-Goals

- [What is explicitly out of scope]

---

## 2. Technical Approach

### 2.1 Architecture & Design

[Describe the chosen technical solution and any architectural decisions.]

### 2.2 Data Model Changes

| Entity | Change Type | Description |
|--------|------------|-------------|
| [Table/Collection] | [New/Modified/Removed] | [Brief description] |

### 2.3 API Changes

| Endpoint | Method | Change Type | Description |
|----------|--------|------------|-------------|
| `/api/...` | [GET/POST/PUT/DELETE] | [New/Modified/Removed] | [Brief description] |

### 2.4 Frontend Component Changes

| File | Component/Page | Change Summary |
|------|---------------|----------------|
| `src/pages/...` | [Component Name] | [Brief description] |
| `src/components/...` | [Component Name] | [Brief description] |

---

## 3. Implementation Details

### 3.1 Key Code Changes

[Reference the most important code changes with brief explanations.]

- **File:** `src/.../file.tsx`
  - **Change:** [Description]
  - **Rationale:** [Why this was done]

- **File:** `src/.../file.tsx`
  - **Change:** [Description]
  - **Rationale:** [Why this was done]

### 3.2 Threading & Concurrency

[Describe any async handling, race conditions addressed, or optimistic updates.]

### 3.3 State Management

[Describe how state was managed or refactored.]

### 3.4 Performance Optimizations Applied

| Optimization | Technique | File/Component | Measured Impact |
|-------------|-----------|----------------|-----------------|
| [e.g., Memoization] | [e.g., React.memo, useMemo, useCallback] | [Component] | [Metric improvement] |
| [e.g., Lazy loading] | [e.g., React.lazy, Suspense] | [Component/Route] | [Metric improvement] |

---

## 4. Testing & Quality

### 4.1 Unit Tests

| File | Tests Added | Tests Modified | Test Framework |
|------|-------------|----------------|---------------|
| `src/.../file.test.ts` | X | Y | [e.g., Vitest] |

### 4.2 Integration / E2E Tests

| File | Tests Added | Tests Modified | Test Framework |
|------|-------------|----------------|---------------|
| `tests/...` | X | Y | [e.g., Playwright] |

### 4.3 Test Results

| Test Suite | Total | Passed | Failed | Skipped | Coverage |
|-----------|-------|--------|--------|---------|----------|
| Unit Tests | XX | XX | XX | XX | XX% |
| Integration Tests | XX | XX | XX | XX | — |
| E2E Tests | XX | XX | XX | XX | — |

### 4.4 Edge Cases Handled

- [Edge case and how it was addressed]
- [Edge case]

---

## 5. Open Questions & Risks

| Question / Risk | Owner | Resolution |
|----------------|-------|------------|
| [Open question] | [Name] | [Pending / Resolved] |
| [Technical debt] | [Name] | [Pending / Addressed] |

---

## 6. Follow-ups & Observations

### 6.1 Tech Debt Identified

- [ ] [Debt item and recommended follow-up]

### 6.2 Known Issues

- [ ] [Known limitation with planned resolution]

### 6.3 Recommendations

- [ ] [Recommendation for future work]

---

## 7. Sign-Off

| Role | Name | Approval | Date |
|------|------|----------|------|
| Author | [Name] | ✅ / ❌ | YYYY-MM-DD |
| Reviewer | [Name] | ✅ / ❌ | YYYY-MM-DD |
| QA Lead | [Name] | ✅ / ❌ | YYYY-MM-DD |
