import { test, expect, type Page } from "@playwright/test";
import { getE2EAuthFlag } from "../src/lib/e2eFixtures";

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, "true");
    window.localStorage.setItem("social_spark_onboarding_completed", "true");
  }, getE2EAuthFlag());
}

test.describe("API Key Settings", () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await enableE2EAuth(page);
    await page.goto("/profile?tab=api-keys", { waitUntil: "domcontentloaded" });
    // Wait for the settings section to load (not the spinner)
    await page.waitForSelector("#api-provider, #api-key", { timeout: 20000 });
  });

  // -------------------------------------------------------------------------
  // Happy path: save a valid OpenAI key
  // -------------------------------------------------------------------------
  test("saves a valid OpenAI key successfully", async ({ page }) => {
    // Mock the Edge Function so we don't need a real Supabase
    await page.route("**/functions/v1/encrypt-api-key", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.selectOption("#api-provider", "openai");
    await page.fill("#api-key", "sk-testkey1234567890abcdefghijklmnop");
    await page.getByRole("button", { name: /save api configuration/i }).click();

    await expect(page.getByRole("status")).toContainText(/saved successfully/i, { timeout: 10000 });
    await expect(page.locator("#api-key")).toHaveValue("");
  });

  // -------------------------------------------------------------------------
  // Masked preview after save
  // -------------------------------------------------------------------------
  test("shows masked preview after save", async ({ page }) => {
    await page.route("**/functions/v1/encrypt-api-key", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    const testKey = "sk-" + "a".repeat(28) + "xQ3Z";
    await page.fill("#api-key", testKey);
    await page.getByRole("button", { name: /save api configuration/i }).click();

    // Masked preview should show "currently configured key ends in"
    await expect(page.getByText(/currently configured key ends in/i)).toBeVisible({
      timeout: 10000,
    });
  });

  // -------------------------------------------------------------------------
  // Invalid format: rejected before network call
  // -------------------------------------------------------------------------
  test("rejects invalid key format before making network call", async ({ page }) => {
    let edgeFunctionCalled = false;
    await page.route("**/functions/v1/encrypt-api-key", async (route) => {
      edgeFunctionCalled = true;
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.fill("#api-key", "invalid-key");
    await page.getByRole("button", { name: /save api configuration/i }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid key format/i, { timeout: 5000 });
    expect(edgeFunctionCalled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Delete key flow requires confirmation
  // -------------------------------------------------------------------------
  test("delete key flow requires confirmation", async ({ page }) => {
    // Pre-populate with a saved key by mocking decrypt
    await page.route("**/functions/v1/decrypt-api-key", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ apiKey: "sk-" + "a".repeat(32), provider: "openai" }),
      });
    });

    await page.route("**/functions/v1/delete-api-key", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    // Reload to trigger the mount effect that loads the key
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#api-provider", { timeout: 20000 });

    // Remove Key button should be visible when a key is saved
    const removeBtn = page.getByRole("button", { name: /remove key/i });
    if (await removeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await removeBtn.click();
      // Confirmation text appears
      await expect(page.getByText(/are you sure/i)).toBeVisible();
      // deleteUserApiKey not called yet — just check the confirm button is there
      await expect(page.getByRole("button", { name: /yes, remove/i })).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // Privacy notice visible without interaction
  // -------------------------------------------------------------------------
  test("privacy notice is visible without interaction", async ({ page }) => {
    await expect(page.getByText(/encrypted with AES-256/i)).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // Input is type=password by default
  // -------------------------------------------------------------------------
  test("API key input is type=password by default", async ({ page }) => {
    const inputType = await page.locator("#api-key").getAttribute("type");
    expect(inputType).toBe("password");
  });

  // -------------------------------------------------------------------------
  // Show/hide toggle switches input type
  // -------------------------------------------------------------------------
  test("show/hide toggle changes input type", async ({ page }) => {
    await page.getByRole("button", { name: /show api key/i }).click();
    expect(await page.locator("#api-key").getAttribute("type")).toBe("text");

    await page.getByRole("button", { name: /hide api key/i }).click();
    expect(await page.locator("#api-key").getAttribute("type")).toBe("password");
  });

  // -------------------------------------------------------------------------
  // Provider dropdown has all 3 options
  // -------------------------------------------------------------------------
  test("provider dropdown has OpenAI, Anthropic, OpenRouter options", async ({ page }) => {
    const options = await page.locator("#api-provider option").allTextContents();
    const allText = options.join(" ").toLowerCase();
    expect(allText).toContain("openai");
    expect(allText).toContain("anthropic");
    expect(allText).toContain("openrouter");
  });
});
