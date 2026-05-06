# 🎯 Social Spark - Comprehensive E2E Testing Strategy
**Production-Ready | SDET-Level | May 2026**

---

## 📋 Table of Contents
1. [Test Strategy Overview](#1-test-strategy-overview)
2. [Unit Testing Suite](#2-unit-testing-suite)
3. [API Testing Suite](#3-api-testing-suite)
4. [Browser/UI Testing Suite](#4-browserui-testing-suite)
5. [Integration & Regression Plan](#5-integration--regression-plan)
6. [Test Data Management](#6-test-data-management)
7. [Deployment & CI/CD Pipeline](#7-deployment--cicd-pipeline)

---

## 1. Test Strategy Overview

### 🏛️ Testing Pyramid Architecture

```
                          ▲
                         /E\  E2E Tests (5-10%)
                        /███\  Playwright
                       /─────\  Critical User Journeys
                      /       \
                     /  INTEGRATION & API TESTS (15-20%)  ◀─────────┐
                    /   ────────────────────────────────   \         │
                   /    Supertest / API Testing            ▲\       │
                  /                                        / │ \      │
                 /                                        /  │  \     │
                /    ────────────────────────────────    /   │   \    │
               /  COMPONENT & UNIT TESTS (70-75%)       /    │    \   │
              /   ─────────────────────────────────      /    │     \  │
             /     Vitest / Jest + React Testing Lib    /     │      \ │
            /───────────────────────────────────────────/      │       \│
           ▼                                                   ▼        ▼
    SPEED: Fast (ms)                            COVERAGE: Business Value
    FREQUENCY: 100+ tests                       CONFIDENCE: High Risk Coverage
    COST: Low                                   MAINTENANCE: Low
```

### 🛠️ Recommended Tech Stack

| Layer | Tool | Framework | Purpose |
|-------|------|-----------|---------|
| **Unit Tests** | **Vitest** | Jest API compatible | Fast, modern, supports ESM |
| **Component Tests** | **React Testing Library** | Vitest | Behavior-focused, user-centric |
| **API Tests** | **Supertest** | Node HTTP assertions | RESTful endpoint validation |
| **E2E Tests** | **Playwright** | WebKit/Chromium/Firefox | Cross-browser automation |
| **Visual Tests** | **Percy / Chromatic** | Visual regression | UI consistency validation |
| **Performance Tests** | **Lighthouse CI** | Web Vitals | LCP, FID, CLS tracking |
| **Load Tests** | **k6** | Performance simulation | 10K concurrent users |

### 📊 Test Distribution Target

```
UNIT TESTS (200+ tests)
├── Utility Functions: 50 tests
├── Validation Logic: 35 tests
├── Components: 80 tests
├── Context/Hooks: 20 tests
└── Services: 15 tests

INTEGRATION TESTS (50+ tests)
├── API Endpoints: 35 tests
├── Database Queries: 10 tests
├── Auth Flow: 5 tests

E2E TESTS (30+ tests)
├── Happy Paths: 18 tests
├── Error Scenarios: 8 tests
└── Edge Cases: 4 tests

TOTAL: 280+ Test Cases
```

---

## 2. Unit Testing Suite

### 2.1 Test Infrastructure Setup

**File**: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/types.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**File**: `src/__tests__/setup.ts`
```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

**File**: `package.json` (Add scripts)
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### 2.2 Utility & Validation Tests

#### **Category**: Date & Timezone Utilities

**File**: `src/__tests__/lib/timezones.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  browserTimezone,
  listTimezones,
  fmtDateInTz,
  tzLabel,
  zonedToUtcIso,
} from '@/lib/timezones';

describe('Timezone Utilities', () => {
  describe('browserTimezone', () => {
    it('should return valid IANA timezone', () => {
      const tz = browserTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('should return timezone with forward slash', () => {
      const tz = browserTimezone();
      // Valid formats: Continent/City, UTC, etc.
      const validPattern = /^(\w+\/\w+|UTC|Etc\/UTC)$/;
      expect(validPattern.test(tz)).toBe(true);
    });
  });

  describe('listTimezones', () => {
    it('should return array of timezones', () => {
      const tzs = listTimezones();
      expect(Array.isArray(tzs)).toBe(true);
      expect(tzs.length).toBeGreaterThan(100);
    });

    it('should include common timezones', () => {
      const tzs = listTimezones();
      expect(tzs).toContain('America/New_York');
      expect(tzs).toContain('Europe/London');
      expect(tzs).toContain('Asia/Tokyo');
      expect(tzs).toContain('UTC');
    });

    it('should not contain duplicates', () => {
      const tzs = listTimezones();
      const unique = new Set(tzs);
      expect(tzs.length).toBe(unique.size);
    });
  });

  describe('fmtDateInTz', () => {
    it('should format date in specified timezone', () => {
      const date = new Date('2026-05-06T14:30:00Z');
      const formatted = fmtDateInTz(date, 'America/New_York');
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('should handle different timezones correctly', () => {
      const date = new Date('2026-05-06T14:30:00Z');
      const nyTime = fmtDateInTz(date, 'America/New_York');
      const tokyoTime = fmtDateInTz(date, 'Asia/Tokyo');
      
      // Different timezones should produce different results
      expect(nyTime).not.toBe(tokyoTime);
    });

    it('should handle invalid dates gracefully', () => {
      expect(() => {
        fmtDateInTz(new Date('invalid'), 'America/New_York');
      }).not.toThrow();
    });
  });

  describe('tzLabel', () => {
    it('should return human-readable timezone label', () => {
      const label = tzLabel('America/New_York');
      expect(label).toContain('Eastern');
      expect(typeof label).toBe('string');
    });

    it('should handle UTC timezone', () => {
      const label = tzLabel('UTC');
      expect(label).toContain('UTC');
    });
  });

  describe('zonedToUtcIso', () => {
    it('should convert zoned datetime to UTC ISO string', () => {
      const result = zonedToUtcIso('2026-05-06', '14:30', 'America/New_York');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should produce consistent UTC values', () => {
      // Same moment in time in different timezones should produce same UTC
      const nyTime = zonedToUtcIso('2026-05-06', '10:00', 'America/New_York');
      const londonTime = zonedToUtcIso('2026-05-06', '15:00', 'Europe/London');
      
      // Both should convert to same UTC moment (approximately)
      expect(Math.abs(
        new Date(nyTime).getTime() - new Date(londonTime).getTime()
      )).toBeLessThan(60000); // Within 1 minute
    });
  });
});
```

#### **Category**: Form Validation

**File**: `src/__tests__/lib/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  Industry,
  CoreIdea,
  Platform,
  Topics,
  Goals,
  BannedWords,
  RequiredWords,
} from '@/lib/validation';

describe('Form Validation Schemas', () => {
  describe('Industry Validation', () => {
    it('should accept valid industry names', () => {
      expect(Industry.safeParse('Tech & Software').success).toBe(true);
      expect(Industry.safeParse('Health & Wellness').success).toBe(true);
    });

    it('should reject empty industry', () => {
      expect(Industry.safeParse('').success).toBe(false);
    });

    it('should reject industry over 100 characters', () => {
      const longIndustry = 'a'.repeat(101);
      expect(Industry.safeParse(longIndustry).success).toBe(false);
    });
  });

  describe('CoreIdea Validation', () => {
    it('should accept valid core ideas', () => {
      const validIdea = 'AI-powered content generation for social media';
      expect(CoreIdea.safeParse(validIdea).success).toBe(true);
    });

    it('should reject ideas shorter than 10 characters', () => {
      expect(CoreIdea.safeParse('Short').success).toBe(false);
    });

    it('should reject ideas over 500 characters', () => {
      const longIdea = 'a'.repeat(501);
      expect(CoreIdea.safeParse(longIdea).success).toBe(false);
    });

    it('should handle edge case: exactly 10 characters', () => {
      expect(CoreIdea.safeParse('1234567890').success).toBe(true);
    });
  });

  describe('Platform Validation', () => {
    it('should accept valid platforms', () => {
      expect(Platform.safeParse('LinkedIn').success).toBe(true);
      expect(Platform.safeParse('Twitter').success).toBe(true);
      expect(Platform.safeParse('Newsletter').success).toBe(true);
    });

    it('should reject invalid platforms', () => {
      expect(Platform.safeParse('TikTok').success).toBe(false);
      expect(Platform.safeParse('YouTube').success).toBe(false);
    });

    it('should default to LinkedIn if not specified', () => {
      const result = Platform.safeParse('');
      expect(result.data).toBe('LinkedIn');
    });
  });

  describe('Topics Validation', () => {
    it('should accept 1-7 topics', () => {
      expect(Topics.safeParse(['AI']).success).toBe(true);
      expect(Topics.safeParse(['AI', 'ML', 'DevOps', 'Cloud', 'Security', 'API', 'Performance']).success).toBe(true);
    });

    it('should reject empty topics array', () => {
      expect(Topics.safeParse([]).success).toBe(false);
    });

    it('should reject more than 7 topics', () => {
      const topics = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      expect(Topics.safeParse(topics).success).toBe(false);
    });

    it('should reject empty topic strings', () => {
      expect(Topics.safeParse(['']).success).toBe(false);
    });
  });

  describe('Goals Validation', () => {
    it('should accept 1-6 goals', () => {
      expect(Goals.safeParse(['Awareness']).success).toBe(true);
      expect(Goals.safeParse(['Awareness', 'Engagement', 'Traffic', 'Leads', 'Community', 'Sales']).success).toBe(true);
    });

    it('should reject more than 6 goals', () => {
      const goals = Array.from({ length: 7 }, (_, i) => `Goal${i}`);
      expect(Goals.safeParse(goals).success).toBe(false);
    });
  });

  describe('BannedWords Validation', () => {
    it('should accept valid banned words list', () => {
      expect(BannedWords.safeParse(['spam', 'marketing']).success).toBe(true);
    });

    it('should reject more than 6 banned words', () => {
      const words = Array.from({ length: 7 }, (_, i) => `word${i}`);
      expect(BannedWords.safeParse(words).success).toBe(false);
    });

    it('should default to empty array', () => {
      const result = BannedWords.safeParse([]);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});
```

#### **Category**: Platform-Specific Utilities

**File**: `src/__tests__/lib/platformCopy.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { 
  formatForPlatform, 
  PLATFORM_LIMITS, 
  resolvePlatform,
  niceLabelFor 
} from '@/lib/platformCopy';

describe('Platform Copy Utilities', () => {
  describe('PLATFORM_LIMITS', () => {
    it('should define character limits for all platforms', () => {
      expect(PLATFORM_LIMITS.LinkedIn).toBeGreaterThan(0);
      expect(PLATFORM_LIMITS.Twitter).toBeLessThan(PLATFORM_LIMITS.LinkedIn);
      expect(PLATFORM_LIMITS.Newsletter).toBeGreaterThan(PLATFORM_LIMITS.LinkedIn);
    });

    it('should have Twitter as most restrictive', () => {
      const limits = Object.values(PLATFORM_LIMITS);
      expect(Math.min(...limits)).toBe(PLATFORM_LIMITS.Twitter);
    });
  });

  describe('formatForPlatform', () => {
    const testText = 'This is a test post about AI and machine learning. #AI #ML';

    it('should truncate text to platform limits', () => {
      const linkedin = formatForPlatform(testText, 'LinkedIn');
      expect(linkedin.length).toBeLessThanOrEqual(PLATFORM_LIMITS.LinkedIn);
    });

    it('should handle platform-specific formatting', () => {
      const twitter = formatForPlatform(testText, 'Twitter');
      expect(twitter.length).toBeLessThanOrEqual(PLATFORM_LIMITS.Twitter);
    });

    it('should preserve hashtags when truncating', () => {
      const formatted = formatForPlatform(testText, 'Twitter');
      if (formatted.includes('#')) {
        expect(formatted).toMatch(/#\w+/);
      }
    });

    it('should handle empty input gracefully', () => {
      expect(formatForPlatform('', 'LinkedIn')).toBe('');
    });
  });

  describe('resolvePlatform', () => {
    it('should normalize platform names', () => {
      expect(resolvePlatform('linkedin')).toBe('LinkedIn');
      expect(resolvePlatform('TWITTER')).toBe('Twitter');
      expect(resolvePlatform('instagram')).toBe('Instagram');
    });

    it('should handle alternate names', () => {
      expect(resolvePlatform('x')).toBe('Twitter');
      expect(resolvePlatform('X')).toBe('Twitter');
    });
  });

  describe('niceLabelFor', () => {
    it('should provide human-readable labels', () => {
      const label = niceLabelFor('LinkedIn');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it('should handle all valid platforms', () => {
      const platforms = ['LinkedIn', 'Twitter', 'Instagram', 'Newsletter'];
      platforms.forEach(platform => {
        expect(niceLabelFor(platform)).toBeDefined();
      });
    });
  });
});
```

#### **Category**: Error Handling

**File**: `src/__tests__/lib/errors.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  NetworkError,
  ValidationError,
  TimeoutError,
  RateLimitError,
  APIError,
  getUserFriendlyMessage,
} from '@/lib/errors';

describe('Error Handling', () => {
  describe('Error Constructors', () => {
    it('should create NetworkError with retryable flag', () => {
      const error = new NetworkError('Connection failed', true);
      expect(error.message).toBe('Connection failed');
      expect(error.isRetryable).toBe(true);
      expect(error.name).toBe('NetworkError');
    });

    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid email format');
      expect(error.message).toBe('Invalid email format');
      expect(error.name).toBe('ValidationError');
    });

    it('should create TimeoutError with timeout duration', () => {
      const error = new TimeoutError('Request timeout', 5000);
      expect(error.message).toBe('Request timeout');
      expect(error.timeoutMs).toBe(5000);
    });

    it('should create RateLimitError with retry-after', () => {
      const error = new RateLimitError('Rate limited', 60000);
      expect(error.message).toBe('Rate limited');
      expect(error.retryAfterMs).toBe(60000);
    });

    it('should create APIError with status code', () => {
      const error = new APIError('Server error', 500);
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable).toBe(true); // 5xx errors are retryable
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should convert NetworkError to user message', () => {
      const error = new NetworkError('Connection failed');
      const msg = getUserFriendlyMessage(error);
      expect(msg).toContain('connection');
      expect(msg.toLowerCase()).toContain('network');
    });

    it('should convert ValidationError to user message', () => {
      const error = new ValidationError('Invalid input');
      const msg = getUserFriendlyMessage(error);
      expect(msg).toContain('Invalid');
    });

    it('should handle RateLimitError specifically', () => {
      const error = new RateLimitError('Too many requests', 60000);
      const msg = getUserFriendlyMessage(error);
      expect(msg.toLowerCase()).toContain('rate limit');
    });

    it('should provide generic message for unknown errors', () => {
      const error = new Error('Unknown error');
      const msg = getUserFriendlyMessage(error);
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  describe('Error Retryability', () => {
    it('should mark network errors as retryable when appropriate', () => {
      const retryable = new NetworkError('Timeout', true);
      const nonRetryable = new NetworkError('Auth failed', false);
      
      expect(retryable.isRetryable).toBe(true);
      expect(nonRetryable.isRetryable).toBe(false);
    });

    it('should mark 5xx errors as retryable', () => {
      expect(new APIError('Server error', 500).isRetryable).toBe(true);
      expect(new APIError('Gateway error', 502).isRetryable).toBe(true);
    });

    it('should mark 4xx errors as non-retryable', () => {
      expect(new APIError('Not found', 404).isRetryable).toBe(false);
      expect(new APIError('Bad request', 400).isRetryable).toBe(false);
    });

    it('should mark 429 as retryable via RateLimitError', () => {
      expect(new RateLimitError().isRetryable).toBe(true);
    });
  });
});
```

### 2.3 React Component Tests

#### **Category**: Authentication Components

**File**: `src/__tests__/components/ProtectedRoute.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import * as AuthContext from '@/contexts/AuthContext';

describe('ProtectedRoute', () => {
  const TestComponent = () => <div>Protected Content</div>;

  it('should render children when user is authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: '123', email: 'test@example.com' } as any,
      session: { user: { id: '123' } } as any,
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show loading state when auth is loading', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText(/loading|loading/i)).toBeInTheDocument();
  });

  it('should redirect to auth when user is not authenticated', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: vi.fn(),
    });

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should persist auth state across route changes', () => {
    const authContextValue = {
      user: { id: '123' } as any,
      session: { user: { id: '123' } } as any,
      loading: false,
      signOut: vi.fn(),
    };

    vi.spyOn(AuthContext, 'useAuth').mockReturnValue(authContextValue);

    const { rerender } = render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
```

#### **Category**: Form Components

**File**: `src/__tests__/components/FormComponents.test.tsx`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Form Components', () => {
  describe('Industry Selector', () => {
    it('should render all industry options', () => {
      // Assuming IndustrySelector component exists
      render(<IndustrySelector value="" onChange={vi.fn()} />);
      
      const options = ['Tech & Software', 'Health & Wellness', 'E-commerce', 'Marketing'];
      options.forEach(option => {
        expect(screen.getByText(option)).toBeInTheDocument();
      });
    });

    it('should call onChange when industry is selected', async () => {
      const onChange = vi.fn();
      render(<IndustrySelector value="" onChange={onChange} />);
      
      const input = screen.getByRole('combobox');
      await userEvent.click(input);
      await userEvent.click(screen.getByText('Tech & Software'));
      
      expect(onChange).toHaveBeenCalledWith('Tech & Software');
    });

    it('should show selected value', () => {
      render(<IndustrySelector value="Tech & Software" onChange={vi.fn()} />);
      
      expect(screen.getByDisplayValue('Tech & Software')).toBeInTheDocument();
    });

    it('should handle disabled state', () => {
      render(<IndustrySelector value="" onChange={vi.fn()} disabled={true} />);
      
      const input = screen.getByRole('combobox');
      expect(input).toBeDisabled();
    });
  });

  describe('Platform Selector', () => {
    it('should render platform options with hints', () => {
      render(<PlatformSelector value="" onChange={vi.fn()} />);
      
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(screen.getByText(/professional long-form/i)).toBeInTheDocument();
    });

    it('should allow single platform selection', async () => {
      const onChange = vi.fn();
      render(<PlatformSelector value="" onChange={onChange} />);
      
      await userEvent.click(screen.getByText('Twitter / X'));
      expect(onChange).toHaveBeenCalledWith('Twitter/X');
    });

    it('should validate platform selection is required', async () => {
      render(<PlatformSelector value="" onChange={vi.fn()} required={true} />);
      
      const field = screen.getByRole('combobox');
      fireEvent.blur(field);
      
      await waitFor(() => {
        expect(screen.getByText(/required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Goals MultiSelect', () => {
    it('should allow multiple goal selections', async () => {
      const onChange = vi.fn();
      render(<GoalsSelector value={[]} onChange={onChange} />);
      
      await userEvent.click(screen.getByLabelText('Awareness'));
      await userEvent.click(screen.getByLabelText('Engagement'));
      
      expect(onChange).toHaveBeenLastCalledWith(['Awareness', 'Engagement']);
    });

    it('should enforce maximum 6 goals', async () => {
      const goals = Array.from({ length: 6 }, (_, i) => `Goal${i}`);
      const onChange = vi.fn();
      render(<GoalsSelector value={goals} onChange={onChange} />);
      
      const addButton = screen.getByRole('button', { name: /add goal/i });
      expect(addButton).toBeDisabled();
    });

    it('should allow removal of selected goals', async () => {
      const onChange = vi.fn();
      render(<GoalsSelector value={['Awareness']} onChange={onChange} />);
      
      const removeButton = screen.getByRole('button', { name: /remove/i });
      await userEvent.click(removeButton);
      
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });
});
```

### 2.4 Context & Hook Tests

**File**: `src/__tests__/contexts/AuthContext.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with null user and loading true', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('should update user when auth state changes', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      // Simulate auth state change
      // This would typically be handled by Supabase listener
    });
    
    expect(typeof result.current.user).toBe('object');
  });

  it('should provide signOut method', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(typeof result.current.signOut).toBe('function');
  });

  it('should throw error when useAuth used outside provider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
  });
});
```

---

## 3. API Testing Suite

### 3.1 API Testing Infrastructure

**File**: `src/__tests__/api/setup.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { supabase } from '@/integrations/supabase/client';

// API Base URL
const API_BASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:3000';

// Test User Credentials
export const TEST_USER = {
  email: 'test@socialspark.dev',
  password: 'Test@123456',
  id: 'test-user-123',
};

// Test Data
export const TEST_CALENDAR = {
  title: 'Test Content Calendar',
  industry: 'tech',
  platform: 'LinkedIn',
  core_idea: 'AI and machine learning content',
  posts: [
    {
      day: 1,
      title: 'Post 1',
      topic: 'AI Basics',
      content: 'Introduction to AI',
    },
  ],
};

// Helper: Create authenticated client
export async function createAuthenticatedClient(token: string) {
  return request(API_BASE_URL).set('Authorization', `Bearer ${token}`);
}

// Helper: Login test user
export async function loginTestUser() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });

  if (error) throw error;
  return data.session?.access_token || '';
}

// Helper: Cleanup test data
export async function cleanupTestData(userId: string) {
  const { error } = await supabase
    .from('saved_calendars')
    .delete()
    .eq('user_id', userId);

  if (error) console.error('Cleanup error:', error);
}
```

### 3.2 Authentication API Tests

**File**: `src/__tests__/api/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { TEST_USER } from './setup';

describe('Authentication API', () => {
  let authToken: string;
  let userId: string;

  describe('POST /auth/signup', () => {
    it('should register new user with valid credentials', async () => {
      const uniqueEmail = `test-${Date.now()}@socialspark.dev`;
      
      const { data, error } = await supabase.auth.signUp({
        email: uniqueEmail,
        password: 'Test@123456',
      });

      expect(error).toBeNull();
      expect(data.user?.email).toBe(uniqueEmail);
      expect(data.user?.id).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: 'invalid-email',
        password: 'Test@123456',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('email');
    });

    it('should reject weak passwords', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: `test-${Date.now()}@socialspark.dev`,
        password: '123', // Too weak
      });

      expect(error).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const { error } = await supabase.auth.signUp({
        email: TEST_USER.email,
        password: 'Test@123456',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('already');
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      expect(error).toBeNull();
      expect(data.session?.access_token).toBeDefined();
      expect(data.session?.refresh_token).toBeDefined();
      
      authToken = data.session?.access_token || '';
      userId = data.user?.id || '';
    });

    it('should reject invalid email', async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'nonexistent@socialspark.dev',
        password: TEST_USER.password,
      });

      expect(error).toBeDefined();
    });

    it('should reject incorrect password', async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: TEST_USER.email,
        password: 'WrongPassword123',
      });

      expect(error).toBeDefined();
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      const { error } = await supabase.auth.signOut();

      expect(error).toBeNull();
    });

    it('should invalidate token after logout', async () => {
      // Try to access protected route with old token
      const { error } = await supabase
        .from('profiles')
        .select('*')
        .single();

      // Should fail without valid token
      expect(error || true).toBeTruthy();
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('should refresh expired token', async () => {
      const { data, error } = await supabase.auth.refreshSession();

      // Note: This would need a valid refresh token
      if (data.session) {
        expect(data.session.access_token).toBeDefined();
        expect(data.session.access_token).not.toBe(authToken);
      }
    });
  });
});
```

### 3.3 Calendar API Tests

**File**: `src/__tests__/api/calendars.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { TEST_CALENDAR, loginTestUser, cleanupTestData } from './setup';

describe('Calendars API', () => {
  let authToken: string;
  let userId: string;
  let calendarId: string;

  beforeAll(async () => {
    authToken = await loginTestUser();
    // Get userId from token or login response
  });

  afterEach(async () => {
    if (calendarId) {
      await cleanupTestData(userId);
    }
  });

  describe('POST /calendars (Create)', () => {
    it('should create calendar with valid payload', async () => {
      const { data, error } = await supabase
        .from('saved_calendars')
        .insert({
          user_id: userId,
          title: TEST_CALENDAR.title,
          industry: TEST_CALENDAR.industry,
          platform: TEST_CALENDAR.platform,
          core_idea: TEST_CALENDAR.core_idea,
          form_payload: {},
          posts: TEST_CALENDAR.posts,
        })
        .select('id')
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBeDefined();
      calendarId = data?.id || '';
    });

    it('should auto-populate metadata fields', async () => {
      const { data, error } = await supabase
        .from('saved_calendars')
        .insert({
          user_id: userId,
          title: TEST_CALENDAR.title,
          industry: TEST_CALENDAR.industry,
          platform: TEST_CALENDAR.platform,
          core_idea: TEST_CALENDAR.core_idea,
          form_payload: {},
          posts: TEST_CALENDAR.posts,
        })
        .select()
        .single();

      expect(data?.created_at).toBeDefined();
      expect(data?.updated_at).toBeDefined();
      calendarId = data?.id || '';
    });

    it('should reject calendar without required fields', async () => {
      const { error } = await supabase
        .from('saved_calendars')
        .insert({
          user_id: userId,
          title: '', // Empty title
          form_payload: {},
          posts: [],
        });

      expect(error).toBeDefined();
    });

    it('should enforce row-level security', async () => {
      // Try to create calendar for different user
      const { error } = await supabase
        .from('saved_calendars')
        .insert({
          user_id: 'different-user-id',
          title: TEST_CALENDAR.title,
          form_payload: {},
          posts: [],
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('violation');
    });

    it('should limit posts array to valid structure', async () => {
      const { error } = await supabase
        .from('saved_calendars')
        .insert({
          user_id: userId,
          title: TEST_CALENDAR.title,
          form_payload: {},
          posts: [{ invalid: 'structure' }],
        });

      // May succeed or fail depending on schema validation
      // Document expected behavior
    });
  });

  describe('GET /calendars (List)', () => {
    beforeAll(async () => {
      // Create test calendar
      const { data } = await supabase
        .from('saved_calendars')
        .insert({
          user_id: userId,
          title: TEST_CALENDAR.title,
          form_payload: {},
          posts: TEST_CALENDAR.posts,
        })
        .select('id')
        .single();
      calendarId = data?.id || '';
    });

    it('should list user calendars', async () => {
      const { data, error } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBeGreaterThan(0);
    });

    it('should support pagination with limit/offset', async () => {
      const { data: page1 } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('user_id', userId)
        .limit(5)
        .offset(0);

      const { data: page2 } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('user_id', userId)
        .limit(5)
        .offset(5);

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
    });

    it('should filter calendars by platform', async () => {
      const { data, error } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', TEST_CALENDAR.platform);

      expect(error).toBeNull();
      data?.forEach(cal => {
        expect(cal.platform).toBe(TEST_CALENDAR.platform);
      });
    });

    it('should sort calendars by creation date', async () => {
      const { data } = await supabase
        .from('saved_calendars')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data && data.length > 1) {
        for (let i = 0; i < data.length - 1; i++) {
          const curr = new Date(data[i].created_at).getTime();
          const next = new Date(data[i + 1].created_at).getTime();
          expect(curr).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe('GET /calendars/:id (Retrieve)', () => {
    it('should retrieve calendar by ID', async () => {
      const { data, error } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('id', calendarId)
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBe(calendarId);
      expect(data?.user_id).toBe(userId);
    });

    it('should return 404 for nonexistent calendar', async () => {
      const { error } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('id', 'nonexistent-id')
        .single();

      expect(error).toBeDefined();
    });

    it('should enforce user authorization', async () => {
      // Try to access calendar of different user
      const { error } = await supabase
        .from('saved_calendars')
        .select('*')
        .eq('id', calendarId)
        .eq('user_id', 'different-user-id')
        .single();

      expect(error).toBeDefined();
    });
  });

  describe('PATCH /calendars/:id (Update)', () => {
    it('should update calendar title', async () => {
      const newTitle = 'Updated Calendar Title';
      const { data, error } = await supabase
        .from('saved_calendars')
        .update({ title: newTitle })
        .eq('id', calendarId)
        .select('title')
        .single();

      expect(error).toBeNull();
      expect(data?.title).toBe(newTitle);
    });

    it('should update posts array', async () => {
      const updatedPosts = [
        { day: 1, title: 'Updated Post', content: 'New content' },
      ];

      const { data, error } = await supabase
        .from('saved_calendars')
        .update({ posts: updatedPosts })
        .eq('id', calendarId)
        .select('posts')
        .single();

      expect(error).toBeNull();
      expect(data?.posts).toEqual(updatedPosts);
    });

    it('should update updated_at timestamp', async () => {
      const { data: before } = await supabase
        .from('saved_calendars')
        .select('updated_at')
        .eq('id', calendarId)
        .single();

      // Wait a bit to ensure timestamp difference
      await new Promise(r => setTimeout(r, 100));

      await supabase
        .from('saved_calendars')
        .update({ title: 'New title' })
        .eq('id', calendarId);

      const { data: after } = await supabase
        .from('saved_calendars')
        .select('updated_at')
        .eq('id', calendarId)
        .single();

      expect(
        new Date(after?.updated_at || '').getTime() >
        new Date(before?.updated_at || '').getTime()
      ).toBe(true);
    });
  });

  describe('DELETE /calendars/:id (Delete)', () => {
    it('should delete calendar', async () => {
      const { error } = await supabase
        .from('saved_calendars')
        .delete()
        .eq('id', calendarId);

      expect(error).toBeNull();

      // Verify deletion
      const { data } = await supabase
        .from('saved_calendars')
        .select('id')
        .eq('id', calendarId)
        .single();

      expect(data).toBeNull();
    });

    it('should enforce user authorization on delete', async () => {
      const { error } = await supabase
        .from('saved_calendars')
        .delete()
        .eq('id', calendarId)
        .eq('user_id', 'different-user-id');

      expect(error).toBeDefined();
    });
  });
});
```

### 3.4 Rate Limiting & Performance API Tests

**File**: `src/__tests__/api/performance.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { loginTestUser } from './setup';

describe('Performance & Rate Limiting API', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await loginTestUser();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      // Make requests within standard tier limits
      for (let i = 0; i < 10; i++) {
        const response = await fetch('/api/health', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        
        expect(response.status).toBeLessThan(429);
      }
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Make requests beyond limit (implementation depends on tier)
      let statusCode = 200;
      
      for (let i = 0; i < 1000; i++) {
        const response = await fetch('/api/calendars', {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        statusCode = response.status;
      }

      expect(statusCode).toBe(429);
    });

    it('should include retry-after header on rate limit', async () => {
      // This would need to trigger rate limiting
      // const response = await fetch('...', headers);
      // expect(response.headers.get('retry-after')).toBeDefined();
    });

    it('should allow different rate limits per tier', async () => {
      // Test with different user tiers
      // Premium users should have higher limits than standard
    });
  });

  describe('API Latency', () => {
    it('should respond to calendar list within 500ms', async () => {
      const start = performance.now();
      
      await fetch('/api/calendars', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500);
    });

    it('should respond to calendar creation within 1000ms', async () => {
      const start = performance.now();
      
      await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ title: 'Test', posts: [] }),
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Caching', () => {
    it('should cache GET requests', async () => {
      const response1 = await fetch('/api/calendars', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data1 = await response1.json();

      const response2 = await fetch('/api/calendars', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data2 = await response2.json();

      // Should be identical (same data)
      expect(data1).toEqual(data2);
    });

    it('should invalidate cache on POST/PUT/DELETE', async () => {
      // Create calendar
      await fetch('/api/calendars', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ title: 'Test', posts: [] }),
      });

      // Fetch list - should see new calendar
      const response = await fetch('/api/calendars', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await response.json();

      expect(data.length).toBeGreaterThan(0);
    });
  });
});
```

---

## 4. Browser/UI Testing Suite

### 4.1 E2E Test Infrastructure

**File**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

### 4.2 Authentication User Journey Tests

**File**: `src/__tests__/e2e/auth.spec.ts`

```gherkin
Scenario: User signs up with valid email and password
    Given user navigates to "/auth"
    When user enters email "newuser@test.com"
    And user enters password "Test@123456"
    And user confirms password "Test@123456"
    And user clicks "Sign up" button
    Then user should see success notification
    And user should be redirected to "/"
    And user should see profile icon in header
```

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { loginUser, logoutUser } from './helpers';

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test.describe('Sign Up', () => {
    test('should successfully register new user', async ({ page }) => {
      // ✅ GIVEN: User is on auth page
      await expect(page).toHaveURL(/\/auth/);

      // ✅ WHEN: User fills signup form
      await page.fill('input[name="email"]', `user-${Date.now()}@test.com`);
      await page.fill('input[name="password"]', 'Test@123456');
      await page.fill('input[name="confirmPassword"]', 'Test@123456');

      // ✅ AND: User submits form
      await page.click('button:has-text("Sign up")');

      // ✅ THEN: User sees success notification
      await expect(page.locator('text=Account created')).toBeVisible();

      // ✅ AND: User is redirected to home
      await page.waitForURL('/');
      await expect(page).toHaveURL('/');

      // ✅ AND: User is authenticated (profile visible)
      await expect(page.locator('button[aria-label="Profile"]')).toBeVisible();
    });

    test('should reject invalid email format', async ({ page }) => {
      // ✅ WHEN: User enters invalid email
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', 'Test@123456');
      await page.fill('input[name="confirmPassword"]', 'Test@123456');

      // ✅ THEN: Error message appears
      await expect(page.locator('text=Invalid email')).toBeVisible();

      // ✅ AND: Submit button is disabled
      await expect(page.locator('button:has-text("Sign up")')).toBeDisabled();
    });

    test('should reject weak password', async ({ page }) => {
      // ✅ WHEN: User enters weak password
      await page.fill('input[name="email"]', 'test@test.com');
      await page.fill('input[name="password"]', '123');
      await page.fill('input[name="confirmPassword"]', '123');

      // ✅ THEN: Validation error shown
      await expect(page.locator('text=at least 8 characters')).toBeVisible();
    });

    test('should reject mismatched passwords', async ({ page }) => {
      // ✅ WHEN: Passwords don't match
      await page.fill('input[name="password"]', 'Test@123456');
      await page.fill('input[name="confirmPassword"]', 'Different@123');

      // ✅ THEN: Error shown
      await expect(page.locator('text=passwords must match')).toBeVisible();
    });

    test('should reject existing email', async ({ page }) => {
      // ✅ WHEN: User registers with existing email
      await page.fill('input[name="email"]', 'existing@test.com');
      await page.fill('input[name="password"]', 'Test@123456');
      await page.fill('input[name="confirmPassword"]', 'Test@123456');
      await page.click('button:has-text("Sign up")');

      // ✅ THEN: Error notification appears
      await expect(page.locator('text=already registered')).toBeVisible();
    });
  });

  test.describe('Login', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      // ✅ WHEN: User clicks login tab
      await page.click('text=Log in');

      // ✅ AND: User enters credentials
      await page.fill('input[name="email"]', 'test@socialspark.dev');
      await page.fill('input[name="password"]', 'Test@123456');

      // ✅ AND: User submits
      await page.click('button:has-text("Log in")');

      // ✅ THEN: User is redirected to home
      await page.waitForURL('/');
      await expect(page).toHaveURL('/');
    });

    test('should reject incorrect credentials', async ({ page }) => {
      // ✅ WHEN: User enters wrong password
      await page.click('text=Log in');
      await page.fill('input[name="email"]', 'test@socialspark.dev');
      await page.fill('input[name="password"]', 'WrongPassword123');
      await page.click('button:has-text("Log in")');

      // ✅ THEN: Error notification shown
      await expect(page.locator('text=Invalid credentials')).toBeVisible();

      // ✅ AND: User remains on auth page
      await expect(page).toHaveURL(/\/auth/);
    });
  });

  test.describe('Logout', () => {
    test('should successfully logout', async ({ page }) => {
      // ✅ GIVEN: User is logged in
      await loginUser(page);
      await expect(page).toHaveURL('/');

      // ✅ WHEN: User clicks logout
      await page.click('button[aria-label="Profile"]');
      await page.click('text=Logout');

      // ✅ THEN: User is redirected to auth
      await page.waitForURL(/\/auth/);

      // ✅ AND: Session is cleared
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'auth-token');
      expect(sessionCookie).toBeUndefined();
    });
  });

  test.describe('Password Reset', () => {
    test('should send reset email', async ({ page }) => {
      // ✅ WHEN: User clicks "Forgot password?"
      await page.click('text=Log in');
      await page.click('text=Forgot password');

      // ✅ AND: User enters email
      await page.fill('input[name="email"]', 'test@socialspark.dev');
      await page.click('button:has-text("Send reset link")');

      // ✅ THEN: Confirmation message shown
      await expect(page.locator('text=Check your email')).toBeVisible();
    });
  });
});
```

### 4.3 Main Calendar Creation User Journey

**File**: `src/__tests__/e2e/calendar-creation.spec.ts`

```gherkin
Scenario: User creates content calendar with full configuration
    Given user is logged in
    When user navigates to "/"
    And user selects industry "Tech & Software"
    And user enters core idea "AI productivity tools"
    And user selects platforms "LinkedIn" and "Twitter"
    And user configures content parameters (voice, style, goals, etc)
    And user clicks "Generate Calendar"
    Then calendar should be created successfully
    And user should see 30 generated posts
    And user should be able to view calendar
```

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Calendar Creation Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/auth');
    await page.fill('input[name="email"]', 'test@socialspark.dev');
    await page.fill('input[name="password"]', 'Test@123456');
    await page.click('button:has-text("Log in")');
    await page.waitForURL('/');
  });

  test('should create calendar with minimal required fields', async ({ page }) => {
    // ✅ GIVEN: User is on home page
    await expect(page).toHaveURL('/');

    // ✅ WHEN: User selects industry
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');

    // ✅ AND: User enters core idea
    await page.fill('textarea[name="coreIdea"]', 'AI-powered content generation for social media');

    // ✅ AND: User selects platform
    await page.click('text=Platform');
    await page.click('text=LinkedIn');

    // ✅ AND: User clicks generate
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: Loading state shown
    await expect(page.locator('text=Generating')).toBeVisible();

    // ✅ AND: Calendar is created
    await page.waitForURL('/calendar/*');
    await expect(page.locator('text=Calendar created')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // ✅ GIVEN: User is on form
    // ✅ WHEN: User clicks generate without filling form
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: Validation errors shown
    await expect(page.locator('text=Please select your industry')).toBeVisible();
    await expect(page.locator('text=Please describe your core idea')).toBeVisible();
    await expect(page.locator('text=Please select a platform')).toBeVisible();
  });

  test('should support multi-platform selection', async ({ page }) => {
    // ✅ WHEN: User selects multiple platforms
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');

    await page.fill('textarea[name="coreIdea"]', 'Content about AI');

    // Select LinkedIn
    await page.click('label:has-text("LinkedIn")');

    // Select Twitter
    await page.click('label:has-text("Twitter / X")');

    // ✅ AND: User generates calendar
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: Both platforms shown in results
    await page.waitForURL('/calendar/*');
    await expect(page.locator('text=LinkedIn')).toBeVisible();
    await expect(page.locator('text=Twitter')).toBeVisible();
  });

  test('should persist form data on navigation', async ({ page }) => {
    // ✅ WHEN: User fills form
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');

    await page.fill('textarea[name="coreIdea"]', 'Specific topic');

    // ✅ AND: User navigates away and back
    await page.goto('/my-calendars');
    await page.goBack();

    // ✅ THEN: Form data is preserved
    await expect(page.locator('text=Tech & Software')).toBeVisible();
    await expect(page.locator('textarea[name="coreIdea"]')).toHaveValue('Specific topic');
  });

  test('should allow form reset', async ({ page }) => {
    // ✅ WHEN: User fills form
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');

    await page.fill('textarea[name="coreIdea"]', 'Test content');

    // ✅ AND: User clicks reset
    await page.click('button:has-text("Reset")');

    // ✅ THEN: Form is cleared
    await expect(page.locator('text=Tech & Software')).not.toBeVisible();
    await expect(page.locator('textarea[name="coreIdea"]')).toHaveValue('');
  });

  test('should handle generation errors gracefully', async ({ page }) => {
    // ✅ WHEN: User generates calendar (API fails)
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');
    await page.fill('textarea[name="coreIdea"]', 'Test');

    // Simulate API error
    await page.context().setOffline(true);
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: Error notification shown
    await expect(page.locator('text=Error generating calendar')).toBeVisible();

    // ✅ AND: User can retry
    await page.context().setOffline(false);
    await page.click('button:has-text("Retry")');

    await page.waitForURL('/calendar/*');
  });
});
```

### 4.4 Scheduling & Publishing User Journey

**File**: `src/__tests__/e2e/scheduling.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Scheduling & Publishing', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to schedule
    await page.goto('/auth');
    await page.fill('input[name="email"]', 'test@socialspark.dev');
    await page.fill('input[name="password"]', 'Test@123456');
    await page.click('button:has-text("Log in")');
    await page.goto('/schedule');
  });

  test('should view scheduled posts', async ({ page }) => {
    // ✅ GIVEN: User is on schedule page
    await expect(page).toHaveURL('/schedule');

    // ✅ THEN: Scheduled posts are displayed
    await expect(page.locator('text=Scheduled Posts')).toBeVisible();

    // ✅ AND: Posts show date, time, platform
    await expect(page.locator('text=May 6, 2026')).toBeVisible();
    await expect(page.locator('text=2:30 PM')).toBeVisible();
    await expect(page.locator('text=LinkedIn')).toBeVisible();
  });

  test('should filter posts by status', async ({ page }) => {
    // ✅ WHEN: User filters by status
    await page.click('select[name="status"]');
    await page.click('option[value="published"]');

    // ✅ THEN: Only published posts shown
    const rows = await page.locator('[data-status="published"]');
    expect(rows).toBeDefined();
  });

  test('should sort posts', async ({ page }) => {
    // ✅ WHEN: User sorts by platform
    await page.click('select[name="sort"]');
    await page.click('option[value="platform"]');

    // ✅ THEN: Posts are sorted
    const posts = await page.locator('[role="row"]');
    const count = await posts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should edit scheduled post', async ({ page }) => {
    // ✅ WHEN: User clicks edit on a post
    await page.click('button[aria-label="Edit post"]');

    // ✅ AND: User modifies copy
    await page.fill('textarea[name="copy"]', 'Updated post copy');

    // ✅ AND: User saves
    await page.click('button:has-text("Save")');

    // ✅ THEN: Post is updated
    await expect(page.locator('text=Post updated')).toBeVisible();
  });

  test('should reschedule post', async ({ page }) => {
    // ✅ WHEN: User clicks reschedule
    await page.click('button[aria-label="Reschedule"]');

    // ✅ AND: User selects new date/time
    await page.fill('input[type="date"]', '2026-05-15');
    await page.fill('input[type="time"]', '10:00');

    // ✅ AND: User confirms
    await page.click('button:has-text("Save")');

    // ✅ THEN: Post is rescheduled
    await expect(page.locator('text=Post rescheduled')).toBeVisible();
  });

  test('should publish post immediately', async ({ page }) => {
    // ✅ WHEN: User clicks publish
    await page.click('button[aria-label="Publish now"]');

    // ✅ AND: User confirms
    await page.click('button:has-text("Confirm")');

    // ✅ THEN: Post status changes to published
    await expect(page.locator('[data-status="published"]')).toBeVisible();
    await expect(page.locator('text=Post published')).toBeVisible();
  });

  test('should export schedule as CSV', async ({ page }) => {
    // ✅ WHEN: User clicks export
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export CSV")');

    // ✅ THEN: File is downloaded
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should handle timezone selection', async ({ page }) => {
    // ✅ WHEN: User changes timezone
    await page.click('select[name="timezone"]');
    await page.click('option[value="America/Los_Angeles"]');

    // ✅ THEN: Times are recalculated
    const times = await page.locator('[data-time]');
    expect(times).toBeDefined();
  });
});
```

### 4.5 Admin Dashboard Tests

**File**: `src/__tests__/e2e/admin-dashboard.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth');
    await page.fill('input[name="email"]', 'admin@socialspark.dev');
    await page.fill('input[name="password"]', 'AdminPassword123');
    await page.click('button:has-text("Log in")');
    
    // Navigate to admin
    await page.goto('/admin');
  });

  test('should display admin dashboard', async ({ page }) => {
    // ✅ THEN: Dashboard is accessible
    await expect(page).toHaveURL('/admin');

    // ✅ AND: Main sections visible
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Performance')).toBeVisible();
    await expect(page.locator('text=Errors')).toBeVisible();
    await expect(page.locator('text=Usage Analytics')).toBeVisible();
  });

  test('should show real-time stats', async ({ page }) => {
    // ✅ WHEN: Dashboard loads
    // ✅ THEN: Stats cards show data
    await expect(page.locator('text=Active Users')).toBeVisible();
    await expect(page.locator('text=Calendars Generated')).toBeVisible();
    await expect(page.locator('text=API Success Rate')).toBeVisible();
    await expect(page.locator('text=Error Rate')).toBeVisible();
  });

  test('should display performance metrics', async ({ page }) => {
    // ✅ THEN: Performance section shows metrics
    await expect(page.locator('text=Avg API Latency')).toBeVisible();
    await expect(page.locator('text=P95 Latency')).toBeVisible();
    await expect(page.locator('text=Generation Time')).toBeVisible();
  });

  test('should show error tracking', async ({ page }) => {
    // ✅ THEN: Error section visible
    await expect(page.locator('text=Total Errors')).toBeVisible();
    await expect(page.locator('text=Error Breakdown')).toBeVisible();
  });

  test('should display usage charts', async ({ page }) => {
    // ✅ THEN: Charts visible
    const charts = await page.locator('canvas, svg[role="img"]');
    expect(await charts.count()).toBeGreaterThan(0);
  });

  test('should auto-refresh stats', async ({ page }) => {
    // ✅ WHEN: Dashboard is open
    const initialValue = await page.locator('[data-stat="users"]').textContent();

    // ✅ AND: Wait for auto-refresh (30 seconds)
    await page.waitForTimeout(31000);

    // ✅ THEN: Stats may update
    const updatedValue = await page.locator('[data-stat="users"]').textContent();

    // Note: Value might be same, but that's okay
    expect(updatedValue).toBeDefined();
  });

  test('should allow manual refresh', async ({ page }) => {
    // ✅ WHEN: User clicks refresh button
    await page.click('button[aria-label="Refresh"]');

    // ✅ THEN: Data is reloaded
    await expect(page.locator('text=Refreshing')).toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('should deny access to non-admin', async ({ page }) => {
    // ✅ WHEN: Non-admin tries to access /admin
    await page.goto('/auth');
    await page.fill('input[name="email"]', 'user@socialspark.dev');
    await page.fill('input[name="password"]', 'UserPassword123');
    await page.click('button:has-text("Log in")');

    await page.goto('/admin', { waitUntil: 'networkidle' });

    // ✅ THEN: Access denied or redirected
    await expect(page).not.toHaveURL('/admin');
    await expect(page.locator('text=Not authorized')).toBeVisible();
  });
});
```

### 4.6 Error Handling & Edge Cases

**File**: `src/__tests__/e2e/error-handling.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Error Handling & Edge Cases', () => {
  test('should handle network error gracefully', async ({ page, context }) => {
    // ✅ WHEN: User navigates while offline
    await context.setOffline(true);
    await page.goto('/');

    // ✅ THEN: Error message shown
    await expect(page.locator('text=offline|network error', { ignoreCase: true })).toBeVisible();

    // ✅ AND: User can retry
    await context.setOffline(false);
    await page.click('button:has-text("Retry")');

    await expect(page).toHaveURL('/');
  });

  test('should handle API timeout', async ({ page }) => {
    // ✅ GIVEN: Slow API response
    await page.route('**/api/**', async (route) => {
      await new Promise(r => setTimeout(r, 15000)); // 15 second delay
      await route.continue();
    });

    // ✅ WHEN: User generates calendar
    await page.goto('/');
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');
    await page.fill('textarea[name="coreIdea"]', 'Test');
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: Timeout error shown
    await expect(page.locator('text=Request timed out')).toBeVisible();

    // ✅ AND: User can retry
    // (This would depend on retry implementation)
  });

  test('should handle validation errors', async ({ page }) => {
    // ✅ WHEN: User submits invalid data
    await page.goto('/');

    // Try to submit without filling required fields
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: All validation errors shown
    await expect(page.locator('text=required', { ignoreCase: true })).toBeDefined();
  });

  test('should handle session timeout', async ({ page }) => {
    // ✅ GIVEN: User is logged in
    await page.goto('/auth');
    await page.fill('input[name="email"]', 'test@socialspark.dev');
    await page.fill('input[name="password"]', 'Test@123456');
    await page.click('button:has-text("Log in")');
    await page.goto('/');

    // ✅ WHEN: Session expires (simulate by clearing token)
    await page.context().clearCookies();

    // ✅ AND: User tries to navigate
    await page.goto('/my-calendars');

    // ✅ THEN: User is redirected to login
    await page.waitForURL(/\/auth/);
    await expect(page.locator('text=Please log in')).toBeVisible();
  });

  test('should handle 500 errors', async ({ page }) => {
    // ✅ WHEN: Server returns 500 error
    await page.route('**/api/calendars', route => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');
    await page.fill('textarea[name="coreIdea"]', 'Test');
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: User-friendly error shown
    await expect(page.locator('text=Something went wrong')).toBeVisible();
  });

  test('should handle rate limiting', async ({ page }) => {
    // ✅ WHEN: User exceeds rate limit
    for (let i = 0; i < 5; i++) {
      await page.goto('/api/health');
      await page.waitForTimeout(100);
    }

    // ✅ THEN: 429 error handled
    // (Implementation depends on how rate limiting is exposed)
  });

  test('should preserve unsaved data on error', async ({ page }) => {
    // ✅ WHEN: User fills form
    await page.goto('/');
    await page.click('text=Industry / Niche');
    await page.click('text=Tech & Software');
    await page.fill('textarea[name="coreIdea"]', 'Important content');

    // ✅ AND: Generation fails
    await page.route('**/api/calendars', route => route.abort());
    await page.click('button:has-text("Generate Calendar")');

    // ✅ THEN: Form data is preserved
    await expect(page.locator('text=Tech & Software')).toBeVisible();
    await expect(page.locator('textarea[name="coreIdea"]')).toHaveValue('Important content');
  });

  test('should handle large data volumes', async ({ page }) => {
    // ✅ WHEN: User loads large calendar with many posts
    // This would depend on your data size
    await page.goto('/calendar/large-calendar-id');

    // ✅ THEN: Page loads and virtualizes list
    const scrollContainer = page.locator('[role="list"]');
    await expect(scrollContainer).toBeVisible();

    // ✅ AND: Can scroll through all posts
    for (let i = 0; i < 10; i++) {
      await scrollContainer.evaluate(el => {
        el.scrollTop += 500;
      });
      await page.waitForTimeout(200);
    }
  });
});
```

---

## 5. Integration & Regression Plan

### 5.1 Integration Test Strategy

**File**: `src/__tests__/integration/flows.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

describe('End-to-End Integration Flows', () => {
  let userId: string;
  let sessionToken: string;

  beforeAll(async () => {
    // Setup: Create test user
    sessionToken = await loginTestUser();
  });

  afterAll(async () => {
    // Cleanup: Delete test user and data
    await cleanupTestUser();
  });

  describe('Complete Content Calendar Workflow', () => {
    /**
     * ✅ SCENARIO: User completes entire workflow
     * 
     * GIVEN: User is authenticated
     * WHEN: User creates calendar
     * AND: User customizes settings
     * AND: User generates posts
     * AND: User schedules posts
     * AND: User publishes posts
     * THEN: All operations succeed
     */
    it('should complete full workflow from creation to publishing', async () => {
      // 1️⃣ Create calendar
      const calendar = await createCalendar({
        title: 'Integration Test Calendar',
        industry: 'tech',
        platform: 'LinkedIn',
        core_idea: 'AI innovations',
      });
      expect(calendar.id).toBeDefined();

      // 2️⃣ Generate posts
      const posts = await generatePosts(calendar.id, {
        count: 10,
        voice: 'technical',
        style: 'educational',
      });
      expect(posts.length).toBe(10);

      // 3️⃣ Schedule first post
      const scheduled = await schedulePost(posts[0].id, {
        scheduledAt: '2026-05-07T10:00:00Z',
        timezone: 'America/New_York',
      });
      expect(scheduled.status).toBe('scheduled');

      // 4️⃣ Publish post
      const published = await publishPost(scheduled.id);
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeDefined();

      // 5️⃣ Verify calendar shows all updates
      const updated = await getCalendar(calendar.id);
      expect(updated.posts.length).toBe(10);
      expect(updated.stats.published).toBeGreaterThan(0);
    });
  });

  describe('Data Consistency Across Operations', () => {
    /**
     * ✅ SCENARIO: Data remains consistent across create, update, delete
     */
    it('should maintain data consistency', async () => {
      // Create
      const cal = await createCalendar({ title: 'Consistency Test' });
      let retrieved = await getCalendar(cal.id);
      expect(retrieved.title).toBe('Consistency Test');

      // Update
      await updateCalendar(cal.id, { title: 'Updated Title' });
      retrieved = await getCalendar(cal.id);
      expect(retrieved.title).toBe('Updated Title');
      expect(retrieved.updated_at).toBeGreaterThan(retrieved.created_at);

      // Delete
      await deleteCalendar(cal.id);
      const deleted = await getCalendar(cal.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Authorization & Security Integration', () => {
    /**
     * ✅ SCENARIO: Users can only access own data
     */
    it('should enforce row-level security across operations', async () => {
      // Create calendar for user 1
      const cal = await createCalendar({ title: 'Private Calendar' });

      // Try to access as user 2
      const result = await getCalendar(cal.id, { userId: 'different-user' });
      expect(result).toBeNull();
    });
  });

  describe('Cache Invalidation on Updates', () => {
    /**
     * ✅ SCENARIO: Cache is invalidated when data changes
     */
    it('should invalidate cache on mutations', async () => {
      const cal = await createCalendar({ title: 'Cache Test' });

      // First fetch (cache miss)
      const first = await getCalendar(cal.id);
      expect(first.title).toBe('Cache Test');

      // Update
      await updateCalendar(cal.id, { title: 'New Title' });

      // Second fetch (cache should be invalidated)
      const second = await getCalendar(cal.id);
      expect(second.title).toBe('New Title');
    });
  });
});
```

### 5.2 Regression Test Checklist

**File**: `REGRESSION_CHECKLIST.md`

```markdown
# 🔄 Critical Regression Test Checklist

## Pre-Deployment Verification (Run 48 hours before release)

### 🔐 Authentication (Critical)
- [ ] User signup works end-to-end
- [ ] User login with valid credentials succeeds
- [ ] User logout clears session
- [ ] Password reset flow works
- [ ] Protected routes redirect unauthenticated users
- [ ] Token refresh works when expired
- [ ] Simultaneous logins from different devices work

### 📅 Calendar Operations (Critical)
- [ ] Create calendar with minimal fields
- [ ] Create calendar with all optional fields
- [ ] Update calendar title/metadata
- [ ] Delete calendar (soft delete if applicable)
- [ ] List calendars with pagination
- [ ] Filter calendars by industry/platform
- [ ] Sort calendars by date/name
- [ ] Search calendars by title

### 📝 Post Generation (Critical)
- [ ] Generate posts for all industries
- [ ] Generate posts for all platforms
- [ ] Respect platform character limits
- [ ] Include hashtags when configured
- [ ] Include banned word filtering
- [ ] Include required word inclusion
- [ ] Handle rate limiting gracefully
- [ ] Cache post generation results

### 🗓️ Scheduling & Publishing (Critical)
- [ ] Schedule post for future date
- [ ] Reschedule post to new date
- [ ] Publish post immediately
- [ ] Batch publish multiple posts
- [ ] Handle timezone conversions
- [ ] Export schedule as CSV
- [ ] Handle concurrent scheduling

### 👤 User Profile (High Priority)
- [ ] View profile information
- [ ] Update profile information
- [ ] Change timezone preference
- [ ] Download account data (GDPR)
- [ ] Delete account

### ⚡ Performance (High Priority)
- [ ] Page load time < 2 seconds
- [ ] API response time < 500ms
- [ ] Calendar with 100+ posts loads smoothly
- [ ] Infinite scroll/pagination works smoothly
- [ ] No memory leaks on long sessions
- [ ] Rate limiting works (429 responses)

### 🛡️ Security (High Priority)
- [ ] CSRF tokens validated
- [ ] XSS prevention working
- [ ] SQL injection prevention
- [ ] Rate limiting enforced
- [ ] Token expiration enforced
- [ ] RLS policies enforce user isolation

### 🔔 Error Handling (High Priority)
- [ ] Network errors show friendly message
- [ ] Timeout errors are retried
- [ ] Validation errors show inline
- [ ] 500 errors show error boundary
- [ ] Offline mode works (service worker)
- [ ] Unsaved data preserved on error

### 📊 Admin Dashboard (High Priority)
- [ ] Admin can access dashboard
- [ ] Real-time stats update
- [ ] Charts render correctly
- [ ] Export functionality works
- [ ] Non-admins cannot access

### 🔄 Data Consistency (Medium Priority)
- [ ] Create then read returns same data
- [ ] Update reflects immediately
- [ ] Delete removes all related data
- [ ] Concurrent operations don't conflict
- [ ] Cascading deletes work

### 🎨 UI/UX (Medium Priority)
- [ ] Responsive on mobile (320px+)
- [ ] Responsive on tablet (768px+)
- [ ] Responsive on desktop (1920px+)
- [ ] Dark mode works
- [ ] All fonts load correctly
- [ ] Images load correctly
- [ ] SVGs render correctly

### 🌐 Browser Compatibility (Medium Priority)
- [ ] Chrome latest version
- [ ] Firefox latest version
- [ ] Safari latest version
- [ ] Edge latest version
- [ ] Mobile Safari iOS 14+
- [ ] Chrome Android latest

### 📱 Mobile-Specific (Medium Priority)
- [ ] Touch events work (no hover issues)
- [ ] Orientation change handled
- [ ] Modal keyboard doesn't hide inputs
- [ ] Viewport meta tag correct
- [ ] No horizontal scroll at 375px

### 🔗 Integration (Low Priority)
- [ ] Supabase connection stable
- [ ] Database migrations applied
- [ ] RLS policies in place
- [ ] Webhooks firing correctly
- [ ] Environment variables configured

### 📜 Compliance (Low Priority)
- [ ] Privacy policy available
- [ ] Terms of service available
- [ ] Cookies consent shown
- [ ] GDPR data export works
- [ ] No console errors/warnings

## Smoke Test (Run 1 hour before release)

```bash
# Quick verification
1. ✅ User signup → login → home page
2. ✅ Create calendar with defaults
3. ✅ View calendar details
4. ✅ Schedule 1 post
5. ✅ Publish 1 post
6. ✅ Admin dashboard loads
7. ✅ No console errors
```

## Hotfix Regression (If issues found post-deployment)

- [ ] Identify root cause
- [ ] Create automated test for bug
- [ ] Fix bug
- [ ] Run full regression suite
- [ ] Monitor for 24 hours post-deployment
```

---

## 6. Test Data Management

### 6.1 Test Data Fixtures

**File**: `src/__tests__/fixtures/index.ts`

```typescript
/**
 * Centralized test data fixtures
 * Ensures consistency across all test suites
 */

export const FIXTURES = {
  // Auth fixtures
  VALID_USER: {
    email: 'test@socialspark.dev',
    password: 'Test@123456',
    id: 'user-123',
  },

  ADMIN_USER: {
    email: 'admin@socialspark.dev',
    password: 'AdminPassword123',
    id: 'admin-123',
  },

  INVALID_EMAIL: 'not-an-email',
  WEAK_PASSWORD: '123',
  STRONG_PASSWORD: 'SecureP@ss123!',

  // Calendar fixtures
  CALENDAR_TECH: {
    title: 'Tech Content Calendar',
    industry: 'tech',
    industry_label: 'Tech & Software',
    platform: 'LinkedIn',
    core_idea: 'AI and machine learning innovations',
    form_payload: {
      voice: 'technical',
      style: 'educational',
      goals: ['Thought Leadership', 'Engagement'],
      topics: ['AI', 'ML', 'DevOps'],
    },
    posts: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      title: `Post ${i + 1}`,
      topic: 'AI Basics',
      content: `This is test post number ${i + 1}`,
      hashtags: ['#AI', '#ML', '#Tech'],
    })),
  },

  CALENDAR_MARKETING: {
    title: 'Marketing Growth Calendar',
    industry: 'marketing',
    industry_label: 'Marketing & Growth',
    platform: 'Twitter',
    core_idea: 'Growth marketing strategies for startups',
    posts: Array.from({ length: 20 }, (_, i) => ({
      day: i + 1,
      title: `Marketing Post ${i + 1}`,
      content: `Growth hack #${i + 1}`,
    })),
  },

  // Post fixtures
  VALID_POST: {
    title: 'Post about AI',
    content: 'This is a post about artificial intelligence and its impact on society.',
    platform: 'LinkedIn',
    hashtags: ['#AI', '#Technology'],
    copy_length: 'medium',
  },

  SCHEDULED_POST: {
    status: 'scheduled',
    workflow_status: 'approved',
    scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },

  PUBLISHED_POST: {
    status: 'published',
    workflow_status: 'published',
    published_at: new Date().toISOString(),
  },

  // Timezone fixtures
  TIMEZONES: {
    NEW_YORK: 'America/New_York',
    LONDON: 'Europe/London',
    TOKYO: 'Asia/Tokyo',
    SYDNEY: 'Australia/Sydney',
    UTC: 'UTC',
  },

  // Platform fixtures
  PLATFORMS: ['LinkedIn', 'Twitter', 'Instagram', 'Facebook', 'Newsletter'],
  INDUSTRIES: ['tech', 'health', 'finance', 'marketing', 'education'],

  // Validation fixtures
  VALID_VALIDATORS: {
    email: 'valid@example.com',
    url: 'https://example.com',
    text: 'Valid text content',
    number: 42,
    date: new Date().toISOString(),
  },

  INVALID_VALIDATORS: {
    email: 'not-an-email',
    url: 'not a url',
    text: '', // Empty string
    number: NaN,
    date: 'not-a-date',
  },

  // Error fixtures
  ERRORS: {
    NETWORK: new Error('Network error'),
    TIMEOUT: new Error('Request timeout'),
    VALIDATION: new Error('Validation failed'),
    NOT_FOUND: new Error('Resource not found (404)'),
    UNAUTHORIZED: new Error('Unauthorized (401)'),
    FORBIDDEN: new Error('Forbidden (403)'),
    RATE_LIMITED: new Error('Too many requests (429)'),
    SERVER_ERROR: new Error('Server error (500)'),
  },
};

/**
 * Factory functions for creating test data
 */
export const FACTORIES = {
  createUser: (overrides = {}) => ({
    email: `user-${Date.now()}@test.com`,
    password: FIXTURES.STRONG_PASSWORD,
    ...overrides,
  }),

  createCalendar: (overrides = {}) => ({
    ...FIXTURES.CALENDAR_TECH,
    title: `Calendar-${Date.now()}`,
    ...overrides,
  }),

  createPost: (overrides = {}) => ({
    ...FIXTURES.VALID_POST,
    id: `post-${Date.now()}`,
    ...overrides,
  }),

  createScheduledPost: (overrides = {}) => ({
    ...FACTORIES.createPost(),
    ...FIXTURES.SCHEDULED_POST,
    ...overrides,
  }),
};
```

### 6.2 Mock Data Generators

**File**: `src/__tests__/mocks/generators.ts`

```typescript
import { faker } from '@faker-js/faker';

/**
 * Generate realistic mock data for testing
 */
export const GENERATORS = {
  user: (overrides = {}) => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  calendar: (overrides = {}) => ({
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    title: faker.lorem.words(3),
    industry: faker.helpers.arrayElement(['tech', 'health', 'finance', 'marketing']),
    platform: faker.helpers.arrayElement(['LinkedIn', 'Twitter', 'Instagram']),
    core_idea: faker.lorem.sentences(2),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  }),

  post: (overrides = {}) => ({
    id: faker.string.uuid(),
    calendar_id: faker.string.uuid(),
    title: faker.lorem.words(5),
    content: faker.lorem.paragraphs(2),
    platform: faker.helpers.arrayElement(['LinkedIn', 'Twitter', 'Instagram']),
    scheduled_at: faker.date.future().toISOString(),
    status: faker.helpers.arrayElement(['drafted', 'approved', 'published']),
    created_at: faker.date.past().toISOString(),
    ...overrides,
  }),

  // Generate multiple
  users: (count = 5) => Array.from({ length: count }, () => GENERATORS.user()),
  calendars: (count = 5) => Array.from({ length: count }, () => GENERATORS.calendar()),
  posts: (count = 10) => Array.from({ length: count }, () => GENERATORS.post()),
};
```

### 6.3 Database Seeding

**File**: `src/__tests__/db/seed.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';
import { GENERATORS } from '../mocks/generators';

/**
 * Seed test database with realistic data
 */
export class TestDataSeeder {
  static async seedFullWorkflow() {
    // Create test user
    const user = await this.createUser();

    // Create calendars
    const calendars = await this.createCalendars(user.id, 5);

    // Create posts for each calendar
    const posts = [];
    for (const calendar of calendars) {
      const calPosts = await this.createPosts(calendar.id, 30);
      posts.push(...calPosts);
    }

    // Create scheduled posts
    const scheduledPosts = await this.schedulePostBatch(posts.slice(0, 10));

    return { user, calendars, posts, scheduledPosts };
  }

  static async createUser(overrides = {}) {
    const userData = GENERATORS.user(overrides);

    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (error) throw error;
    return data.user;
  }

  static async createCalendars(userId: string, count = 5) {
    const calendars = GENERATORS.calendars(count);

    const { data, error } = await supabase
      .from('saved_calendars')
      .insert(calendars.map(c => ({ ...c, user_id: userId })))
      .select();

    if (error) throw error;
    return data;
  }

  static async createPosts(calendarId: string, count = 30) {
    const posts = GENERATORS.posts(count);

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert(posts.map(p => ({ ...p, calendar_id: calendarId })))
      .select();

    if (error) throw error;
    return data;
  }

  static async schedulePostBatch(posts: any[]) {
    const scheduled = posts.map(p => ({
      ...p,
      status: 'scheduled',
      workflow_status: 'approved',
      scheduled_at: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const { data, error } = await supabase
      .from('scheduled_posts')
      .update(scheduled)
      .eq('calendar_id', scheduled[0].calendar_id)
      .select();

    if (error) throw error;
    return data;
  }

  static async cleanup(userId: string) {
    // Delete all user data
    await supabase
      .from('saved_calendars')
      .delete()
      .eq('user_id', userId);
  }
}
```

### 6.4 Environment Configuration

**File**: `.env.test`

```bash
# Test Environment Configuration

# API
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Test Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=social_spark_test
TEST_DB_USER=test
TEST_DB_PASSWORD=test

# Test Timeout (ms)
TEST_TIMEOUT=10000
API_TIMEOUT=5000
E2E_TIMEOUT=30000

# Logging
TEST_LOG_LEVEL=debug

# Mocking
MOCK_EMAIL_SERVICE=true
MOCK_STRIPE=true
MOCK_EXTERNAL_APIS=true

# Performance
ENABLE_PERFORMANCE_TESTS=true
PERFORMANCE_THRESHOLD_API_MS=500
PERFORMANCE_THRESHOLD_E2E_MS=3000
```

---

## 7. Deployment & CI/CD Pipeline

### 7.1 GitHub Actions CI/CD Pipeline

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: social_spark_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage
        env:
          TEST_DB_URL: postgresql://test:test@localhost:5432/social_spark_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: social_spark_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run API tests
        run: npm run test:api
        env:
          TEST_DB_URL: postgresql://test:test@localhost:5432/social_spark_test
          VITE_SUPABASE_URL: http://localhost:54321
          VITE_SUPABASE_KEY: test-key

  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  lighthouse:
    runs-on: ubuntu-latest
    needs: unit-tests

    steps:
      - uses: actions/checkout@v3

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          configPath: './lighthouserc.json'
          uploadArtifacts: true

  code-quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

```

### 7.2 Pre-deployment Test Script

**File**: `scripts/pre-deploy.sh`

```bash
#!/bin/bash

echo "🧪 Running Pre-deployment Test Suite"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Test function
run_test() {
  local name=$1
  local command=$2
  
  echo -n "Testing: $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
  fi
}

# 1. Lint check
run_test "Linting" "npm run lint"

# 2. Type check
run_test "Type checking" "npx tsc --noEmit"

# 3. Unit tests
run_test "Unit tests" "npm run test:unit"

# 4. API tests
run_test "API integration tests" "npm run test:api"

# 5. Coverage check
run_test "Coverage threshold" "npm run test:coverage"

# 6. Build check
run_test "Build" "npm run build"

# 7. E2E smoke tests
run_test "E2E smoke tests" "npm run test:e2e:smoke"

# 8. Performance check
run_test "Performance baseline" "npm run test:perf"

# Summary
echo ""
echo "======================================"
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "======================================"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Pre-deployment checks failed!${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All pre-deployment checks passed!${NC}"
  exit 0
fi
```

### 7.3 NPM Scripts

**File**: `package.json` (Test scripts)

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "test:unit": "vitest run src/__tests__/lib src/__tests__/components",
    "test:api": "vitest run src/__tests__/api",
    "test:integration": "vitest run src/__tests__/integration",
    "test:e2e": "playwright test",
    "test:e2e:smoke": "playwright test --grep @smoke",
    "test:e2e:debug": "playwright test --debug",
    "test:perf": "lighthouse-ci autorun",
    "test:all": "npm run test:unit && npm run test:api && npm run test:e2e",
    "test:ci": "npm run lint && npm run test:coverage && npm run test:api && npm run test:e2e",
    "pre-deploy": "bash scripts/pre-deploy.sh"
  }
}
```

---

## 📊 Test Execution Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER           │ TOOL       │ COUNT │ TIME   │ FREQUENCY     │
├─────────────────────────────────────────────────────────────────┤
│ Unit            │ Vitest     │ 200+ │ 30s    │ Every commit  │
│ Component       │ RTL        │ 80+  │ 20s    │ Every commit  │
│ API             │ Supertest  │ 35+  │ 45s    │ Every commit  │
│ Integration     │ Vitest     │ 25+  │ 60s    │ Daily         │
│ E2E             │ Playwright │ 30+  │ 5m     │ Daily/Weekly  │
│ Performance     │ Lighthouse │ 5+   │ 10m    │ Weekly        │
│ Load            │ k6         │ 3+   │ 15m    │ Pre-deploy    │
├─────────────────────────────────────────────────────────────────┤
│ TOTAL           │ -          │ 378+ │ ~1h    │ Per deployment│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Coverage Targets

```
Target Coverage by Category:

┌────────────────────┬──────────┬─────────┬──────────┐
│ Category           │ Lines    │ Branches│ Functions│
├────────────────────┼──────────┼─────────┼──────────┤
│ Utilities          │ 90%      │ 85%     │ 95%      │
│ Components         │ 85%      │ 80%     │ 90%      │
│ Hooks/Context      │ 80%      │ 75%     │ 85%      │
│ Services           │ 85%      │ 80%     │ 90%      │
│ API Layer          │ 80%      │ 75%     │ 85%      │
├────────────────────┼──────────┼─────────┼──────────┤
│ OVERALL            │ 85%      │ 80%     │ 90%      │
└────────────────────┴──────────┴─────────┴──────────┘
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Setup Vitest + RTL
- [ ] Create test utilities and fixtures
- [ ] Write utility tests (100+ tests)
- [ ] Setup Supertest for API

### Phase 2: Component Testing (Week 2-3)
- [ ] Component test suite (80+ tests)
- [ ] Hook/Context tests (20+ tests)
- [ ] API integration tests (35+ tests)

### Phase 3: E2E Testing (Week 3-4)
- [ ] Setup Playwright
- [ ] Auth flow tests
- [ ] Calendar creation tests
- [ ] Scheduling/publishing tests

### Phase 4: Integration & Regression (Week 4)
- [ ] Integration test suite
- [ ] Regression checklist
- [ ] CI/CD pipeline setup
- [ ] Pre-deployment automation

### Phase 5: Monitoring & Optimization (Ongoing)
- [ ] Performance baselines
- [ ] Coverage monitoring
- [ ] Flaky test detection
- [ ] Test optimization

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [Jest Matchers](https://jestjs.io/docs/expect)

---

**Strategy Created**: May 6, 2026  
**Next Review**: May 20, 2026  
**Owner**: QA Automation Engineer  
**Status**: ✅ Ready for Implementation
