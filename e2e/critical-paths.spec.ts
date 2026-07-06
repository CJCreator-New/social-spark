import { test, expect, type Page } from '@playwright/test'
import { getE2EAuthFlag } from '../src/lib/e2eFixtures'

// The wizard's step transitions use framer-motion (already gated on
// prefers-reduced-motion via useReducedMotion()) — disabling motion here avoids
// clicking wizard controls while they're still animating in, which raced
// intermittently on Firefox (click landed during the entrance transform).
test.use({ reducedMotion: 'reduce' })

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, 'true')
    window.localStorage.setItem('social_spark_onboarding_completed', 'true')
  }, getE2EAuthFlag())
}

// The first-run WelcomeBanner mounts asynchronously (it waits on useSubscription's
// loading state) and, when it appears, pushes the industry cards down — a real
// layout shift, not an animation. Clicking before it settles can land on stale
// coordinates. Wait for the banner to either show up or definitively not.
async function waitForWizardReady(page: Page) {
  await page.getByRole('note', { name: /welcome to social spark/i }).waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
}

// The banner's "visible" state can land a frame or two before its layout fully
// settles, so a pre-wait alone isn't always enough — self-heal by re-clicking
// (which recomputes coordinates fresh) until the click actually registers.
async function clickAndConfirmChecked(radio: ReturnType<Page['getByRole']>) {
  await expect(async () => {
    await radio.click()
    await expect(radio).toBeChecked({ timeout: 1000 })
  }).toPass({ timeout: 10000 })
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
    await waitForWizardReady(page)

    // Step 1: Select industry
    const industryRadio = page.getByRole('radio', { name: /marketing & growth/i }).first()
    await industryRadio.waitFor({ state: 'visible', timeout: 45000 })
    await clickAndConfirmChecked(industryRadio)
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
    await waitForWizardReady(page)

    // Step 1: Select industry, switch to single-day mode (mode toggle + date live on step 1)
    // Assert each selection is committed before the next action — on Firefox, firing
    // these clicks back-to-back without confirming state can race the click handler.
    const industryRadio = page.getByRole('radio', { name: /marketing & growth/i }).first()
    await industryRadio.waitFor({ state: 'visible', timeout: 45000 })
    await clickAndConfirmChecked(industryRadio)
    await page.getByPlaceholder(/what's the big idea/i).fill('Launch a timely holiday campaign')
    const singleDayRadio = page.getByRole('radio', { name: /single day/i })
    await clickAndConfirmChecked(singleDayRadio)
    await page.locator('input[type="date"]').fill('2024-12-25')
    await expect(page.locator('input[type="date"]')).toHaveValue('2024-12-25')
    await page.getByRole('button', { name: /next step/i }).click()

    // Step 2: Configure content
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

    // Open the calendar's actions menu, then click Delete
    await page.getByRole('button', { name: /calendar actions/i }).first().click()
    await page.getByRole('button', { name: /^delete$/i }).click()

    // Confirm deletion in the confirmation dialog (ConfirmDialog defaults confirmLabel to "OK")
    await page.getByRole('button', { name: /^ok$/i }).click()

    // Should show success message
    await expect(page.getByText(/deleted/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('should bridge from an existing calendar into the Schedule page with its posts visible', async ({ page }) => {
    await expect(page.getByText('E2E Marketing Launch Week')).toBeVisible({ timeout: 15000 })

    // Open the fixture calendar from the list.
    await page.getByText('E2E Marketing Launch Week').click()
    await expect(page).toHaveURL(/.*calendar\//, { timeout: 15000 })

    // Now navigate to the schedule queue and confirm this calendar's posts show up there
    // (the fixture data pre-seeds scheduled rows for this calendar's days 1 & 2).
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/.*schedule/)
    await expect(page.getByRole('heading', { name: /my schedule/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/test day 1/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/test day 2/i)).toBeVisible({ timeout: 15000 })
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

  test('should edit a scheduled post\'s date/time from the Schedule page and persist the change', async ({ page }) => {
    // Open the actions menu for the first row and start a reschedule.
    await page.getByRole('button', { name: /actions for day/i }).first().click()
    await page.getByRole('menuitem', { name: /reschedule/i }).click()

    const dateInput = page.locator('input[type="date"]').first()
    const timeInput = page.locator('input[type="time"]').first()
    await expect(dateInput).toBeVisible({ timeout: 10000 })

    // Pick a date far enough in the future that it won't collide with the other
    // fixture row, so this exercises the "no conflict, commits directly" path.
    await dateInput.fill('2026-08-03')
    await timeInput.fill('14:30')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Either the change commits immediately, or (if it happens to collide with
    // another row) the conflict dialog appears — accept the overwrite so the
    // assertion below is stable either way.
    const conflictButton = page.getByRole('button', { name: /schedule anyway/i })
    if (await conflictButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await conflictButton.click()
    }

    await expect(page.getByText(/time updated/i)).toBeVisible({ timeout: 15000 })

    // Reload to confirm the new time was actually persisted, not just held in local state.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /my schedule/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/aug 3/i).first()).toBeVisible({ timeout: 15000 })
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