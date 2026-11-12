import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Admin checks need a real account. Set E2E_ADMIN_EMAIL and
 * E2E_ADMIN_PASSWORD (a test account on a development or staging database,
 * never a production login). Without them the whole file skips, so CI and
 * a bare checkout stay green.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.skip(!email || !password, "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are not set");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin|\/journal|\/$/);
}

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.nodes.length})`);
}

const ADMIN_PAGES = ["/admin", "/admin/site", "/admin/news", "/admin/lecturers", "/admin/media", "/admin/users"];

// Sign in once and reuse the session: the login form is rate limited, so
// signing in before every test would lock the suite out.
const stateFile = path.join(process.cwd(), "test-results", "admin-state.json");

test.describe("admin area", () => {
  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await signIn(page);
    await context.storageState({ path: stateFile });
    await context.close();
  });

  test.use({ storageState: stateFile });

  for (const route of ADMIN_PAGES) {
    test(`${route} loads and has no serious accessibility violations`, async ({ page }) => {
      // The users list is unpaginated, so a database with thousands of test
      // users makes the axe scan slow. Give the scan room.
      test.setTimeout(150_000);
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("the sidebar marks the current page", async ({ page }) => {
    await page.goto("/admin/news");
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "News" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("on a phone the sidebar sits behind a Menu button and the page does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/lecturers");
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  });

  test("the donations form refuses to turn the page on without bank details", async ({ page }) => {
    await page.goto("/admin/site");
    const section = page.locator("section", { hasText: "Donations page" });
    const toggle = section.getByLabel("Show the donations page at /donate");
    const wasOn = await toggle.isChecked();
    test.skip(wasOn, "donations are already on in this database; not changing a configured page");
    await toggle.check();
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section.getByText(/required before the page can be turned on/)).toBeVisible();
  });
});
