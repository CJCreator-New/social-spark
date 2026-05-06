# 🚀 E2E Testing Quick-Start Implementation Guide

**Document**: Social Spark QA Automation Setup  
**Date**: May 6, 2026  
**Target**: 30-day full implementation

---

## 📋 Quick Navigation

- [1-Minute Overview](#1-minute-overview)
- [Day 1-3: Setup](#day-1-3-setup)
- [Day 4-10: Unit Tests](#day-4-10-unit-tests)
- [Day 11-17: Component Tests](#day-11-17-component-tests)
- [Day 18-24: API Tests](#day-18-24-api-tests)
- [Day 25-30: E2E Tests](#day-25-30-e2e-tests)
- [Daily Checklist](#daily-checklist)

---

## 1-Minute Overview

### What We're Building

```
TESTING PYRAMID
                    ▲
                   /E\  5% E2E (30 tests)
                  /███\
                 /─────\
                /       \
               / API     \ 15% Integration (50 tests)
              /───────────\
             /            \
            / UNIT + COMP   \ 80% Unit (200 tests)
           /─────────────────\
          ▼                    ▼
```

### Quick Command Reference

```bash
# All tests
npm run test:all

# By layer
npm run test:unit          # Utilities, functions
npm run test:component     # React components
npm run test:api           # API endpoints
npm run test:e2e           # Browser automation

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Pre-deployment check
npm run pre-deploy
```

### Expected Outcomes

| Phase | Count | Time | Status |
|-------|-------|------|--------|
| Setup | - | 2d | Pre-req |
| Unit | 100+ | 3d | Core logic |
| Component | 80+ | 3d | React UI |
| API | 50+ | 3d | Backend |
| Integration | 25+ | 2d | Workflows |
| E2E | 30+ | 2d | User journeys |

---

## Day 1-3: Setup

### Day 1: Environment & Dependencies

#### 1.1 Install Test Dependencies

```bash
# Install Vitest (unit testing)
npm install -D vitest @vitest/ui @vitest/coverage-v8

# Install testing utilities
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom

# Install API testing
npm install -D supertest

# Install E2E testing
npm install -D @playwright/test

# Install faker for mock data
npm install -D @faker-js/faker
```

#### 1.2 Create Config Files

**File**: `vitest.config.ts` (already in strategy doc)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

**File**: `playwright.config.ts` (already in strategy doc)

#### 1.3 Create Test Structure

```bash
mkdir -p src/__tests__/{
  lib,
  components,
  contexts,
  pages,
  api,
  e2e,
  fixtures,
  mocks,
  db,
  helpers
}
```

---

### Day 2: Test Infrastructure

#### 2.1 Create Setup Files

**File**: `src/__tests__/setup.ts`

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ 
        subscription: { unsubscribe: vi.fn() } 
      })),
      getSession: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    })),
  },
}));
```

**File**: `src/__tests__/helpers/index.ts`

```typescript
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function renderWithProviders(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

#### 2.2 Create Fixtures

**File**: `src/__tests__/fixtures/users.ts`

```typescript
export const TEST_USERS = {
  valid: {
    email: 'test@socialspark.dev',
    password: 'Test@123456',
  },
  admin: {
    email: 'admin@socialspark.dev',
    password: 'AdminPassword123',
  },
  invalid: {
    email: 'invalid-email',
    password: '123',
  },
};

export const TEST_CALENDARS = {
  tech: {
    title: 'Tech Calendar',
    industry: 'tech',
    platform: 'LinkedIn',
    core_idea: 'AI and machine learning',
  },
  marketing: {
    title: 'Marketing Calendar',
    industry: 'marketing',
    platform: 'Twitter',
    core_idea: 'Growth marketing strategies',
  },
};
```

---

### Day 3: CI/CD Setup

#### 3.1 Create GitHub Actions Workflow

**File**: `.github/workflows/test.yml` (already in strategy doc)

#### 3.2 Update package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:unit": "vitest run src/__tests__/lib",
    "test:component": "vitest run src/__tests__/components",
    "test:api": "vitest run src/__tests__/api",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:component && npm run test:api && npm run test:e2e"
  }
}
```

#### 3.3 Verify Setup

```bash
# Run a simple test to verify setup
npm run test:unit -- --run

# Open test UI
npm run test:ui
```

**✅ End of Day 3**: Basic infrastructure in place, ready for tests.

---

## Day 4-10: Unit Tests

### Prioritized Unit Test List

```
Priority 1 (Must have - 60 tests):
├── Timezone utilities (10 tests)
├── Validation schemas (25 tests)
├── Platform utilities (15 tests)
└── Error handling (10 tests)

Priority 2 (Should have - 40 tests):
├── String/text utils (15 tests)
├── Date/time utils (15 tests)
└── Data transformation (10 tests)

Priority 3 (Nice to have - 30 tests):
├── Cache logic (15 tests)
├── Rate limiting (10 tests)
└── Other utilities (5 tests)
```

### Day 4-5: Timezone & Validation Tests

**Quick Start**:

```bash
# Create test file
touch src/__tests__/lib/timezones.test.ts

# Run just this test
npm run test:unit -- timezones.test

# Run with coverage
npm run test:coverage -- timezones.test
```

**Example Test Template**:

```typescript
import { describe, it, expect } from 'vitest';
import { browserTimezone, listTimezones } from '@/lib/timezones';

describe('Timezone Utilities', () => {
  it('should return valid IANA timezone', () => {
    const tz = browserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  // Add more tests...
});
```

### Day 6-7: Platform & Error Tests

Similar approach:
- `src/__tests__/lib/platformCopy.test.ts`
- `src/__tests__/lib/errors.test.ts`
- `src/__tests__/lib/validation.test.ts`

### Day 8-10: Coverage & Refactoring

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# Target 85% coverage
```

**Expected Outcome**: 100+ unit tests, 85%+ coverage

---

## Day 11-17: Component Tests

### Component Test Priorities

```
Priority 1 (Auth - 25 tests):
├── ProtectedRoute.test.tsx
├── AuthContext.test.tsx
└── Error Boundary.test.tsx

Priority 2 (Forms - 30 tests):
├── Industry Selector
├── Platform Selector
├── Goals MultiSelect
└── Form Validation

Priority 3 (UI Components - 25 tests):
├── Button behaviors
├── Dialog interactions
├── Toast notifications
└── Loading states
```

### Day 11-12: Auth Component Tests

**File**: `src/__tests__/components/ProtectedRoute.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import * as AuthContext from '@/contexts/AuthContext';

describe('ProtectedRoute', () => {
  it('should render children when authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '123', email: 'test@test.com' } as any,
      session: {} as any,
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('should redirect when not authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <div>Protected</div>
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });
});
```

### Day 13-14: Form Component Tests

**File**: `src/__tests__/components/IndustrySelector.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IndustrySelector } from '@/components/IndustrySelector';

describe('IndustrySelector', () => {
  it('should render all options', () => {
    render(<IndustrySelector value="" onChange={vi.fn()} />);
    
    expect(screen.getByText('Tech & Software')).toBeInTheDocument();
    expect(screen.getByText('Health & Wellness')).toBeInTheDocument();
  });

  it('should call onChange when selected', async () => {
    const onChange = vi.fn();
    render(<IndustrySelector value="" onChange={onChange} />);
    
    await userEvent.click(screen.getByText('Tech & Software'));
    expect(onChange).toHaveBeenCalledWith('Tech & Software');
  });
});
```

### Day 15-17: Refine & Optimize

```bash
# Run all component tests
npm run test:component

# Generate report
npm run test:coverage -- src/__tests__/components

# Aim for 85%+ coverage
```

**Expected Outcome**: 80+ component tests, high confidence in UI behavior

---

## Day 18-24: API Tests

### API Test Priorities

```
Priority 1 (Auth - 15 tests):
├── Signup validations
├── Login flow
├── Logout
└── Token refresh

Priority 2 (Calendars - 20 tests):
├── Create calendar
├── List calendars
├── Update calendar
├── Delete calendar
└── Filtering/sorting

Priority 3 (Posts - 15 tests):
├── Schedule post
├── Update post
├── Publish post
└── Batch operations
```

### Day 18-19: Auth API Tests

**File**: `src/__tests__/api/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Auth API', () => {
  it('should signup with valid credentials', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `test-${Date.now()}@test.com`,
      password: 'Test@123456',
    });

    expect(error).toBeNull();
    expect(data.user?.email).toBeDefined();
  });

  it('should reject invalid email', async () => {
    const { error } = await supabase.auth.signUp({
      email: 'invalid',
      password: 'Test@123456',
    });

    expect(error).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    const { error } = await supabase.auth.signUp({
      email: 'existing@test.com',
      password: 'Test@123456',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('already');
  });
});
```

### Day 20-21: Calendar API Tests

**File**: `src/__tests__/api/calendars.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('Calendars API', () => {
  let calendarId: string;

  afterEach(async () => {
    if (calendarId) {
      await supabase.from('saved_calendars').delete().eq('id', calendarId);
    }
  });

  it('should create calendar', async () => {
    const { data, error } = await supabase
      .from('saved_calendars')
      .insert({
        user_id: 'test-user',
        title: 'Test Calendar',
        form_payload: {},
        posts: [],
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeDefined();
    calendarId = data?.id || '';
  });

  it('should list calendars', async () => {
    const { data, error } = await supabase
      .from('saved_calendars')
      .select('*')
      .eq('user_id', 'test-user');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should update calendar', async () => {
    // Create first
    const { data: created } = await supabase
      .from('saved_calendars')
      .insert({
        user_id: 'test-user',
        title: 'Original',
        form_payload: {},
        posts: [],
      })
      .select()
      .single();

    calendarId = created?.id || '';

    // Update
    const { data, error } = await supabase
      .from('saved_calendars')
      .update({ title: 'Updated' })
      .eq('id', calendarId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.title).toBe('Updated');
  });

  it('should delete calendar', async () => {
    // Create first
    const { data: created } = await supabase
      .from('saved_calendars')
      .insert({
        user_id: 'test-user',
        title: 'To Delete',
        form_payload: {},
        posts: [],
      })
      .select()
      .single();

    const id = created?.id;

    // Delete
    const { error } = await supabase
      .from('saved_calendars')
      .delete()
      .eq('id', id);

    expect(error).toBeNull();

    // Verify deletion
    const { data: deleted } = await supabase
      .from('saved_calendars')
      .select('*')
      .eq('id', id)
      .single();

    expect(deleted).toBeNull();
  });
});
```

### Day 22-24: Complete & Optimize

```bash
# Run all API tests
npm run test:api

# Coverage check
npm run test:coverage -- src/__tests__/api
```

**Expected Outcome**: 50+ API tests, all endpoints covered

---

## Day 25-30: E2E Tests

### E2E Test Priorities

```
Priority 1 (User Journeys - 18 tests):
├── Sign up → Home (1 test)
├── Login → Home (1 test)
├── Create calendar (2 tests)
├── Generate posts (2 tests)
├── Schedule posts (2 tests)
├── Publish posts (2 tests)
├── View schedule (2 tests)
├── Admin dashboard (2 tests)
├── Error scenarios (2 tests)
└── Mobile flows (2 tests)

Priority 2 (Edge Cases - 8 tests):
├── Network errors
├── Timeout handling
├── Session expiry
└── Rate limiting
```

### Day 25-26: Setup & Auth Flows

**File**: `src/__tests__/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Auth Flows', () => {
  test('should signup and login successfully', async ({ page }) => {
    // Navigate to auth
    await page.goto('/auth');

    // Fill signup form
    const email = `user-${Date.now()}@test.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'Test@123456');
    await page.fill('input[name="confirmPassword"]', 'Test@123456');

    // Submit
    await page.click('button:has-text("Sign up")');

    // Verify redirect
    await page.waitForURL('/');
    expect(page.url()).toContain('/');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/auth');
    
    // Click login tab
    await page.click('text=Log in');

    // Fill form
    await page.fill('input[name="email"]', 'test@socialspark.dev');
    await page.fill('input[name="password"]', 'Test@123456');

    // Submit
    await page.click('button:has-text("Log in")');

    // Verify
    await page.waitForURL('/');
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/auth');
    await page.click('text=Log in');
    
    await page.fill('input[name="email"]', 'test@socialspark.dev');
    await page.fill('input[name="password"]', 'WrongPassword');
    await page.click('button:has-text("Log in")');

    // Should show error
    await expect(page.locator('text=Invalid')).toBeVisible();
  });
});
```

### Day 27-28: Calendar & Scheduling Flows

**File**: `src/__tests__/e2e/calendar.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Calendar Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth');
    await page.fill('input[name="email"]', 'test@socialspark.dev');
    await page.fill('input[name="password"]', 'Test@123456');
    await page.click('button:has-text("Log in")');
    await page.waitForURL('/');
  });

  test('should create calendar with form', async ({ page }) => {
    // Select industry
    await page.click('label:has-text("Tech & Software")');

    // Enter core idea
    await page.fill('textarea[name="coreIdea"]', 'AI productivity tools');

    // Select platform
    await page.click('label:has-text("LinkedIn")');

    // Generate
    await page.click('button:has-text("Generate")');

    // Wait for creation
    await page.waitForURL('/calendar/*');
    
    // Verify content
    await expect(page.locator('text=Calendar created')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to generate without filling form
    await page.click('button:has-text("Generate")');

    // Errors should appear
    await expect(page.locator('text=required')).toBeVisible();
  });
});
```

### Day 29-30: Polish & Integration

```bash
# Run all E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test auth.spec.ts

# Generate report
npx playwright show-report
```

**Expected Outcome**: 30+ E2E tests, all user journeys covered

---

## Daily Checklist

### Morning (Start of Day)

- [ ] Pull latest code
- [ ] Review test failures (if any)
- [ ] Check coverage trends
- [ ] Plan day's tests

### During Development

- [ ] Write test first (TDD)
- [ ] Implement feature
- [ ] Run `npm run test:watch`
- [ ] Commit passing tests

### End of Day

- [ ] Run full test suite
- [ ] Check coverage
- [ ] Commit changes
- [ ] Document blockers

```bash
# Daily test routine
npm run lint              # Check code quality
npm run test:coverage     # Verify coverage
npm run test:e2e --headed # Visual verification
npm run pre-deploy        # Final check
```

---

## Week-by-Week Progress

### Week 1: Foundation
```
✅ Mon: Setup infrastructure
✅ Tue: Create fixtures/mocks
✅ Wed: Validate setup
✅ Thu: Begin unit tests
✅ Fri: 25 unit tests done
```

### Week 2: Unit Tests
```
✅ Mon: Continue unit tests
✅ Tue: Reach 100+ tests
✅ Wed: Hit 85% coverage
✅ Thu: Begin component tests
✅ Fri: 30 component tests
```

### Week 3: Component Tests
```
✅ Mon: Continue component tests
✅ Tue: Reach 80 tests
✅ Wed: Begin API tests
✅ Thu: 20 API tests
✅ Fri: Begin E2E tests
```

### Week 4: Integration & E2E
```
✅ Mon: Continue E2E tests
✅ Tue: 30+ E2E tests
✅ Wed: Integration tests
✅ Thu: CI/CD pipeline live
✅ Fri: Full suite passing!
```

---

## 🎯 Success Metrics

By end of 30 days:

```
✅ 280+ Total Tests
✅ 85%+ Code Coverage
✅ <1 hour full suite runtime
✅ 0 flaky tests
✅ CI/CD pipeline active
✅ Pre-deployment automation
✅ Team trained on test patterns
```

---

## 📞 Quick Support

### Common Issues

**Issue**: Vitest not finding modules  
**Solution**: Check `tsconfig.json` paths, clear cache with `rm -rf node_modules/.vite`

**Issue**: E2E tests timing out  
**Solution**: Increase timeout in `playwright.config.ts`, check network

**Issue**: Mocks not working  
**Solution**: Ensure `vi.mock()` is at top of file, check mock path

### Resources

- [Vitest Docs](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Social Spark E2E Strategy](./E2E_TESTING_STRATEGY.md)

---

**Created**: May 6, 2026  
**Review Date**: May 20, 2026  
**Owner**: QA Automation Team
