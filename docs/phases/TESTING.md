# Testing Strategy & Setup

This document outlines the comprehensive testing strategy for Social Spark, including setup instructions, test organization, and execution guidelines.

## 🧪 Testing Hierarchy

### 1. Unit Testing (80%+ Coverage Target)
- **Framework**: Vitest with React Testing Library
- **Coverage**: Core utilities (90%+), Components (80%+), Hooks (85%+)
- **Location**: `src/**/*.test.ts`, `src/**/*.test.tsx`

### 2. Integration Testing
- **Framework**: Vitest with MSW for API mocking
- **Coverage**: Supabase operations, Edge functions, authentication flows
- **Location**: `src/**/*.test.ts` (integration tests)

### 3. End-to-End Testing
- **Framework**: Playwright
- **Coverage**: Critical user journeys, cross-browser compatibility
- **Location**: `e2e/**/*.spec.ts`

## 🚀 Quick Start

### Prerequisites
```bash
npm install
npx playwright install  # Install Playwright browsers
```

### Run Tests

#### Unit & Integration Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui

# Run tests once with coverage
npm run test:run
npm run test:coverage
```

#### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

## 📁 Test Organization

```
├── src/
│   ├── test/
│   │   ├── setup.ts              # Global test setup
│   │   ├── test-utils.tsx        # Testing utilities
│   │   ├── mocks.ts              # Test data & factories
│   │   └── msw-handlers.ts       # API mocking handlers
│   ├── lib/
│   │   ├── api.test.ts           # API utility tests
│   │   ├── storage.test.ts       # Storage utility tests
│   │   ├── errors.test.ts        # Error handling tests
│   │   └── ...
│   └── components/
│       └── *.test.tsx            # Component tests
├── e2e/
│   ├── critical-paths.spec.ts    # Main E2E test suite
│   └── accessibility.spec.ts     # Accessibility tests
├── playwright.config.ts          # Playwright configuration
├── vitest.config.ts              # Vitest configuration
└── .github/workflows/ci-cd.yml   # CI/CD pipeline
```

## 🛠️ Writing Tests

### Unit Tests

#### Component Testing
```tsx
import { render, screen } from '@/test/test-utils'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

#### API Testing
```ts
import { ApiClient } from '@/lib/api'

describe('ApiClient', () => {
  it('handles successful requests', async () => {
    const result = await ApiClient.get('/test')
    expect(result).toEqual({ success: true })
  })

  it('retries on failure', async () => {
    // MSW will mock network failures
    const result = await ApiClient.get('/retry-test')
    expect(result).toEqual({ success: true })
  })
})
```

### E2E Tests

#### Critical Path Testing
```ts
import { test, expect } from '@playwright/test'

test('creates calendar successfully', async ({ page }) => {
  await page.goto('/')

  // Authenticate
  await page.fill('[name=email]', 'test@example.com')
  await page.fill('[name=password]', 'password')
  await page.click('button[type=submit]')

  // Create calendar
  await page.click('button:has-text("Marketing")')
  await page.selectOption('select[name=platform]', 'LinkedIn')
  await page.click('button:has-text("Generate my week")')

  // Verify result
  await expect(page.locator('.calendar-title')).toContainText('Marketing Calendar')
})
```

## 🎯 Test Data Management

### Mock Data
- **Location**: `src/test/mocks.ts`
- **Purpose**: Consistent test data across all test types
- **Factory Functions**: Generate dynamic test data

### API Mocking
- **Tool**: MSW (Mock Service Worker)
- **Location**: `src/test/msw-handlers.ts`
- **Coverage**: All external API calls (Supabase, OpenAI)

### Test Database
- **Strategy**: Isolated test schemas
- **Seeding**: Automated data population
- **Cleanup**: Automatic teardown between tests

## 📊 Coverage Requirements

| Category | Target | Current | Status |
|----------|--------|---------|--------|
| Unit Tests | 80%+ | - | 🔄 |
| API Integration | 90%+ | - | 🔄 |
| Component Coverage | 80%+ | - | 🔄 |
| E2E Coverage | 100% critical paths | - | 🔄 |
| Accessibility | WCAG 2.1 AA | - | 🔄 |

## 🔧 Configuration

### Vitest Config (`vitest.config.ts`)
- Environment: jsdom
- Setup: `src/test/setup.ts`
- Coverage: V8 with istanbul reporter
- Globals: Enabled for simpler imports

### Playwright Config (`playwright.config.ts`)
- Browsers: Chrome, Firefox, Safari, Mobile
- Parallel: Enabled for faster execution
- Tracing: On failure
- Screenshots: On failure

## 🚦 CI/CD Integration

### Pipeline Stages
1. **Lint**: Code quality checks
2. **Unit Tests**: Isolated component testing
3. **Integration Tests**: API and service testing
4. **E2E Tests**: Full user journey testing
5. **Accessibility**: Automated a11y checks
6. **Security**: Vulnerability scanning
7. **Deploy**: Automated deployment with rollback

### Quality Gates
- **Code Coverage**: Must maintain 80%+ threshold
- **Test Pass Rate**: All tests must pass
- **Performance**: No significant regression
- **Security**: No high/critical vulnerabilities

## 🎯 Success Metrics

### Code Quality
- **Coverage**: 80%+ maintained
- **Mutation Score**: 75%+ (future Stryker integration)
- **Cyclomatic Complexity**: < 10 per function

### Reliability
- **Flakiness Rate**: < 2%
- **False Positives**: < 1%
- **Test Execution Time**: < 10 minutes

### Business Impact
- **Deployment Frequency**: Daily
- **Lead Time**: < 1 hour
- **MTTD**: < 4 hours
- **Change Failure Rate**: < 5%

## 🐛 Debugging Tests

### Unit Tests
```bash
# Debug specific test
npm run test -- --run --reporter=verbose path/to/test.test.ts

# Debug with breakpoints
npm run test:ui
```

### E2E Tests
```bash
# Run with debug mode
npm run test:e2e:debug

# Generate trace
PLAYWRIGHT_TRACE=on npm run test:e2e
```

## 📈 Monitoring & Reporting

### Test Results
- **JUnit XML**: For CI integration
- **HTML Reports**: Human-readable test results
- **Coverage Reports**: Detailed coverage analysis
- **Performance Metrics**: Test execution times

### Alerts & Notifications
- **Slack Integration**: Test failure notifications
- **GitHub Status Checks**: PR blocking for failed tests
- **Dashboard**: Real-time test metrics

## 🔄 Maintenance

### Test Refactoring
- Regular review of test effectiveness
- Remove obsolete tests
- Update tests for code changes
- Performance optimization

### Flaky Test Management
- Quarantine failing tests
- Root cause analysis
- Retry logic implementation
- Test environment stabilization

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library](https://testing-library.com/)

## 🤝 Contributing

### Adding Tests
1. Follow naming convention: `*.test.ts` or `*.test.tsx`
2. Use descriptive test names
3. Include both positive and negative test cases
4. Mock external dependencies
5. Update coverage as needed

### Test Standards
- Tests should be independent and repeatable
- Use meaningful assertions
- Keep tests fast and focused
- Document complex test scenarios
- Follow AAA pattern (Arrange, Act, Assert)