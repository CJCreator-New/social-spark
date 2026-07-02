import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { getE2EAuthFlag, E2E_CALENDAR } from "../src/lib/e2eFixtures";

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, "true");
    window.localStorage.setItem("social_spark_onboarding_completed", "true");
  }, getE2EAuthFlag());
}

async function checkRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  // RouteFallback (the lazy-load skeleton) renders its own <h1>, so a bare
  // heading wait can resolve against the skeleton instead of the real page.
  // Wait for the skeleton's loading copy to clear before scanning.
  await expect(page.getByText(/loading the workspace and restoring/i)).toBeHidden({ timeout: 45000 });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 45000 });
  await injectAxe(page);
  // includedImpacts is a sibling of axeOptions, not nested inside it — nesting it
  // silently no-ops (checkA11y forwards axeOptions to axe.run() untouched, which
  // ignores the unknown key), so every impact level, including "minor", was failing.
  await checkA11y(page, undefined, {
    axeOptions: {},
    includedImpacts: ["critical", "serious"],
  } as any);
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
    await expect(page.getByRole("radiogroup", { name: /industry or niche/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/AI content studio/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/platform:/i)).toBeVisible({ timeout: 30000 });
  });

  test("saved calendars and schedule have no serious axe violations", async ({ page }) => {
    await enableE2EAuth(page);
    await checkRoute(page, "/my-calendars");
    await expect(page.getByRole("heading", { name: /my calendars/i })).toBeVisible({ timeout: 30000 });

    await checkRoute(page, "/schedule");
    await expect(page.getByRole("heading", { name: /my schedule/i })).toBeVisible({ timeout: 30000 });
  });

  test("calendar detail and delete modal have no serious axe violations", async ({ page }) => {
    await enableE2EAuth(page);
    await checkRoute(page, `/calendar/${E2E_CALENDAR.id}`);
    await expect(page.getByRole("heading", { name: E2E_CALENDAR.title })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: /workspace controls/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: /reformat and export/i })).toBeVisible({ timeout: 30000 });

    await page.goto("/my-calendars", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /calendar actions/i }).first().click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await injectAxe(page);
    await checkA11y(page, undefined, {
      axeOptions: {},
      includedImpacts: ["critical", "serious"],
    } as any);
  });
});
