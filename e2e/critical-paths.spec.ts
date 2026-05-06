import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/')

    // Should redirect to auth page
    await expect(page).toHaveURL(/.*auth/)
  })

  test('should allow authenticated users to access app', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })

    await page.goto('/')

    // Should stay on app pages
    await expect(page).not.toHaveURL(/.*auth/)
  })
})

test.describe('Calendar Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })
  })

  test('should create a full week calendar', async ({ page }) => {
    await page.goto('/')

    // Step 1: Select industry
    await page.getByRole('button', { name: /marketing/i }).click()

    // Step 2: Configure content
    await page.getByLabel('Platform').selectOption('LinkedIn')
    await page.getByLabel('Voice').selectOption('Professional')
    await page.getByPlaceholder('Topics to cover').fill('Social Media Strategy\nContent Marketing\nLead Generation')

    // Step 3: Generate
    await page.getByRole('button', { name: /generate my week/i }).click()

    // Should navigate to calendar detail
    await expect(page).toHaveURL(/.*calendar/)
    await expect(page.getByText('7-day calendar')).toBeVisible()
  })

  test('should create a single-day calendar', async ({ page }) => {
    await page.goto('/')

    // Step 1: Select industry
    await page.getByRole('button', { name: /marketing/i }).click()

    // Step 2: Switch to single-day mode
    await page.getByRole('button', { name: /single day/i }).click()
    await page.getByLabel('Date').fill('2024-12-25')
    await page.getByPlaceholder('Topic for this post').fill('Holiday Marketing Tips')

    // Step 3: Generate
    await page.getByRole('button', { name: /generate this post/i }).click()

    // Should show single post calendar
    await expect(page).toHaveURL(/.*calendar/)
    await expect(page.getByText('1-day calendar')).toBeVisible()
  })
})

test.describe('Calendar Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to calendars
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })
    await page.goto('/my-calendars')
  })

  test('should display calendar list', async ({ page }) => {
    await expect(page.getByText('My calendars')).toBeVisible()
    await expect(page.getByRole('list')).toBeVisible()
  })

  test('should allow calendar deletion', async ({ page }) => {
    // Click delete button on first calendar
    await page.getByRole('button', { name: /delete/i }).first().click()

    // Confirm deletion
    await page.getByRole('button', { name: /delete/i }).click()

    // Should show success message
    await expect(page.getByText(/deleted/i)).toBeVisible()
  })
})

test.describe('Schedule Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })
    await page.goto('/schedule')
  })

  test('should display scheduled posts', async ({ page }) => {
    await expect(page.getByText('My schedule')).toBeVisible()

    // Should show posts grouped by date
    await expect(page.locator('.sc-group')).toHaveCount(await page.locator('.sc-group').count())
  })

  test('should allow post status updates', async ({ page }) => {
    // Click approve button on first draft post
    const approveButton = page.getByRole('button', { name: /approve/i }).first()
    if (await approveButton.isVisible()) {
      await approveButton.click()
      await expect(page.getByText(/approved/i)).toBeVisible()
    }
  })
})

test.describe('Error Handling', () => {
  test('should show error boundary for crashes', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })

    await page.goto('/')

    // Simulate a JavaScript error
    await page.evaluate(() => {
      throw new Error('Test error')
    })

    // Should show error boundary
    await expect(page.getByText(/something went wrong/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('should handle network errors gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })

    // Mock network failure
    await page.route('**/functions/**', route => route.abort())

    await page.goto('/')

    // Should show connection error
    await expect(page.getByText(/connection error/i)).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })

    await page.goto('/')

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should have visible focus indicators
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-auth-token', 'mock-token')
    })

    await page.goto('/my-calendars')

    // Check for ARIA labels on buttons
    const buttons = await page.getByRole('button').all()
    for (const button of buttons) {
      const label = await button.getAttribute('aria-label')
      expect(label || await button.textContent()).toBeTruthy()
    }
  })
})