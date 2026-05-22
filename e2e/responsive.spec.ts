import { test, expect, type Page } from "@playwright/test";
import { E2E_AUTH_FLAG } from "../src/lib/e2eFixtures";

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, "true");
  }, E2E_AUTH_FLAG);
}

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test.describe(`Responsive smoke checks: ${viewport.name}`, () => {
    test.use({ viewport });

    test("public and auth routes keep primary actions visible", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("link", { name: /create your first calendar/i })).toBeVisible();

      await page.goto("/auth");
      await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    });

    test("authenticated work routes render without horizontal overflow", async ({ page }) => {
      await enableE2EAuth(page);

      for (const path of ["/app", "/my-calendars", "/schedule"]) {
        await page.goto(path);
        await expect(page.locator("body")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(2);
      }
    });
  });
}
