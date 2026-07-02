import { test, expect, type Page } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";
import { getE2EAuthFlag, E2E_CALENDAR } from "../src/lib/e2eFixtures";

async function enableE2EAuth(page: Page) {
  await page.addInitScript((flag) => {
    window.localStorage.setItem(flag, "true");
    window.localStorage.setItem("social_spark_onboarding_completed", "true");
  }, getE2EAuthFlag());
}

async function checkRoute(page: Page, path: string, settleMs = 0) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  // RouteFallback (the lazy-load skeleton) renders its own <h1>, so a bare
  // heading wait can resolve against the skeleton instead of the real page.
  // Wait for the skeleton's loading copy to clear before scanning.
  await expect(page.getByText(/loading the workspace and restoring/i)).toBeHidden({ timeout: 45000 });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 45000 });
  // Lazy routes inject their CSS chunk alongside their JS chunk — the heading
  // being visible doesn't guarantee that chunk's stylesheet has finished
  // applying yet, which intermittently caught elements still on inherited/
  // unstyled colors and produced flaky color-contrast violations.
  await page.waitForLoadState("networkidle").catch(() => {});
  if (settleMs) await page.waitForTimeout(settleMs);
  await injectAxe(page);
  // includedImpacts is a sibling of axeOptions, not nested inside it — nesting it
  // silently no-ops (checkA11y forwards axeOptions to axe.run() untouched, which
  // ignores the unknown key), so every impact level, including "minor", was failing.
  await checkA11y(page, AXE_CONTEXT, {
    axeOptions: {},
    includedImpacts: ["critical", "serious"],
  } as any);
}

// .ld-w-step-num-ghost is a huge, deliberately low-contrast background numeral
// ("01"/"02"/"03") purely decorative behind each "How it works" step card — it's
// aria-hidden and the step's real content has its own properly-contrasted text.
// This is WCAG 1.4.3's "incidental" exception (decorative text has no contrast
// minimum), which axe-core's automated check can't infer, so it's excluded here
// rather than raising the ghost numeral's opacity and ruining the intended effect.
const AXE_CONTEXT = { exclude: [[".ld-w-step-num-ghost"]] };

test.describe("Accessibility smoke checks", () => {
  test.describe.configure({ timeout: 60000 });
  // Scan the settled UI, not a mid-animation frame. LandingHero's GSAP entrance
  // timeline and Index.tsx's wizard both already honor prefers-reduced-motion,
  // so this also avoids flaking on transient sub-threshold contrast during fades.
  test.use({ reducedMotion: "reduce" });

  test("public landing has no serious axe violations", async ({ page }) => {
    // Belt-and-suspenders on top of reducedMotion: the emulated media feature
    // is a context-level setting, and on Firefox/WebKit it can land a beat
    // after the very first synchronous matchMedia() check LandingHero's mount
    // effect runs, letting its GSAP entrance timeline fire anyway. Rather than
    // depend on emulation timing, wait out the widget's own documented worst-
    // case animation budget (1.5s stagger delay + ~0.9s stagger duration).
    await checkRoute(page, "/", 2600);
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
    await checkA11y(page, AXE_CONTEXT, {
      axeOptions: {},
      includedImpacts: ["critical", "serious"],
    } as any);
  });
});
