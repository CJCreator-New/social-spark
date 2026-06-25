import { test, expect, type Page } from '@playwright/test'
import { getE2EAuthFlag } from '../src/lib/e2eFixtures'

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, 'true')
    window.localStorage.setItem('social_spark_onboarding_completed', 'true')
  }, getE2EAuthFlag())
}

test.describe('Authentication Flow', () => {
  test.describe.configure({ timeout: 60000 })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/app')

    // Should redirect to auth page
    await expect(page).toHaveURL(/.*auth/)
  })

  test('should allow authenticated users to access app', async ({ page }) => {
    // Mock authenticated state
    await enableE2EAuth(page)

    await page.goto('/app', { waitUntil: 'domcontentloaded' })

    // Should stay on app pages — wait for main hero copy to appear
    await expect(page).not.toHaveURL(/.*auth/)
    await page.getByText(/AI content studio/i).waitFor({ state: 'visible', timeout: 30000 })
    await expect(page.getByText(/AI content studio/i)).toBeVisible()
  })
})

test.describe('Calendar Creation Flow', () => {
  test.describe.configure({ timeout: 60000 })

  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await enableE2EAuth(page)
  })

  test('should create a full week calendar', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' })

    // Step 1: Select industry
    await page.getByRole('radio', { name: /marketing & growth/i }).first().waitFor({ state: 'visible', timeout: 45000 })
    await page.getByRole('radio', { name: /marketing & growth/i }).first().click()
    await page.getByPlaceholder(/what's the big idea/i).fill('Launch a better B2B content workflow')
    await page.getByRole('button', { name: /next step/i }).click()

    // Step 2: Configure content
    await expect(page.getByPlaceholder(/add a custom topic/i)).toBeVisible({ timeout: 45000 })
    await page.getByPlaceholder(/add a custom topic/i).fill('Social Media Strategy')
    await page.getByRole('button', { name: /^add$/i }).click()
    await page.getByPlaceholder(/add a custom topic/i).fill('Content Marketing')
    await page.getByRole('button', { name: /^add$/i }).click()
    await page.getByPlaceholder(/add a custom topic/i).fill('Lead Generation')
    await page.getByRole('button', { name: /^add$/i }).click()

    // Step 3: Generate
    await page.getByRole('button', { name: /generate my week/i }).click()
    const confirmGenerate = page.getByRole('button', { name: /looks good, generate/i })
    if (await confirmGenerate.first().isVisible()) {
      await confirmGenerate.first().click()
    }

    // Should navigate to calendar detail
    await expect(page).toHaveURL(/.*calendar/, { timeout: 60000 })
    await expect(page.getByText('7-day calendar')).toBeVisible({ timeout: 60000 })
  })

  test('should create a single-day calendar', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' })

    // Step 1: Select industry
    await page.getByRole('radio', { name: /marketing & growth/i }).first().waitFor({ state: 'visible', timeout: 45000 })
    await page.getByRole('radio', { name: /marketing & growth/i }).first().click()
    await page.getByPlaceholder(/what's the big idea/i).fill('Launch a timely holiday campaign')
    await page.getByRole('button', { name: /next step/i }).click()

    // Step 2: Switch to single-day mode
    await page.getByRole('radio', { name: /single day/i }).click()
    await page.locator('input[type="date"]').fill('2024-12-25')
    await page.getByPlaceholder(/add a custom topic/i).fill('Holiday Marketing Tips')
    await page.getByRole('button', { name: /^add$/i }).click()

    // Step 3: Generate
    await page.getByRole('button', { name: /generate this post/i }).click()
    const confirmGenerate = page.getByRole('button', { name: /looks good, generate/i })
    if (await confirmGenerate.first().isVisible()) {
      await confirmGenerate.first().click()
    }

    // Should show single post calendar
    await expect(page).toHaveURL(/.*calendar/, { timeout: 60000 })
    await expect(page.getByText('1-day calendar')).toBeVisible({ timeout: 60000 })
  })
})

test.describe('Calendar Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to calendars
    await enableE2EAuth(page)
    await page.goto('/my-calendars', { waitUntil: 'domcontentloaded' })
  })

  test('should display calendar list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my calendars/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('E2E Marketing Launch Week')).toBeVisible({ timeout: 15000 })
  })

  test('should allow calendar deletion', async ({ page }) => {
    await expect(page.getByText('E2E Marketing Launch Week')).toBeVisible({ timeout: 15000 })

    // Click delete button on first calendar
    await page.getByRole('button', { name: /^delete$/i }).first().click()

    // Confirm deletion
    await page.getByRole('button', { name: /^delete$/i }).click()

    // Should show success message
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 15000 })
  })
})

test.describe('Schedule Management', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAuth(page)
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' })
  })

  test('should display scheduled posts', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /my schedule/i })).toBeVisible({ timeout: 15000 })

    // Should show posts grouped by date
    await expect(page.getByRole('button', { name: /approve/i }).first()).toBeVisible({ timeout: 15000 })
  })

  test('should allow post status updates', async ({ page }) => {
    // Click approve button on first draft post
    const approveButton = page.getByRole('button', { name: /approve/i }).first()
    if (await approveButton.isVisible()) {
      await approveButton.click()
      await expect(page.locator('.sc-status.approved').first()).toBeVisible({ timeout: 15000 })
    }
  })
})

test.describe('Error Handling', () => {
  test('should show error boundary for crashes', async ({ page }) => {
    await page.goto('/__e2e/crash', { waitUntil: 'domcontentloaded' })

    // Should show error boundary
    await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('should handle network errors gracefully', async ({ page }) => {
    await enableE2EAuth(page)

    // Mock network failure
    await page.route('**/functions/**', route => route.abort())

    await page.goto('/app?e2e-network-error=1', { waitUntil: 'domcontentloaded' })

    // Should show connection error
    await page.locator('.err-box').first().waitFor({ state: 'visible', timeout: 30000 })
    await expect(page.locator('.err-box').first()).toHaveText(/connection error\. please check your internet and try again\./i)
  })
})

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await enableE2EAuth(page)

    await page.goto('/app', { waitUntil: 'domcontentloaded' })

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should have visible focus indicators
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await enableE2EAuth(page)

    await page.goto('/my-calendars', { waitUntil: 'domcontentloaded' })

    // Check for ARIA labels on buttons
    const buttons = await page.getByRole('button').all()
    for (const button of buttons) {
      const label = await button.getAttribute('aria-label')
      expect(label || await button.textContent()).toBeTruthy()
    }
  })
})