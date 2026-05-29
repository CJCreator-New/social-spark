import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { getE2EAuthFlag, E2E_CALENDAR } from "../src/lib/e2eFixtures";

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, "true");
  }, getE2EAuthFlag());
}

async function checkRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 45000 });
  await injectAxe(page);
  await checkA11y(page, undefined, {
    axeOptions: {
      includedImpacts: ["critical", "serious"],
    },
  });
}

test.describe("Accessibility smoke checks", () => {
  test.describe.configure({ timeout: 60000 });

  test("public landing has no serious axe violations", async ({ page }) => {
    await checkRoute(page, "/");
  });

  test("auth page has no serious axe violations", async ({ page }) => {
    await checkRoute(page, "/auth");
  });

  test("authenticated app shell has no serious axe violations", async ({ page }) => {
    await enableE2EAuth(page);
    await checkRoute(page, "/app");
    await expect(page.getByRole("radiogroup", { name: /industry or niche/i })).toBeVisible();
  });

  test("saved calendars and schedule have no serious axe violations", async ({ page }) => {
    await enableE2EAuth(page);
    await checkRoute(page, "/my-calendars");
    await expect(page.getByRole("heading", { name: /my calendars/i })).toBeVisible();

    await checkRoute(page, "/schedule");
    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible();
  });

  test("calendar detail and delete modal have no serious axe violations", async ({ page }) => {
    await enableE2EAuth(page);
    await checkRoute(page, `/calendar/${E2E_CALENDAR.id}`);
    await expect(page.getByText(E2E_CALENDAR.title)).toBeVisible();

    await page.goto("/my-calendars", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^delete$/i }).first().click();
    await injectAxe(page);
    await checkA11y(page, undefined, {
      axeOptions: {
        includedImpacts: ["critical", "serious"],
      },
    });
  });
});
