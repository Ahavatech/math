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

const ADMIN_PAGES = [
  "/admin",
  "/admin/site",
  "/admin/news",
  "/admin/news/new",
  "/admin/events/new",
  "/admin/lecturers",
  "/admin/media",
  "/admin/users",
  "/admin/my-profile/security",
  "/two-factor",
];

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
      // Let client components finish hydrating before scanning, so a control
      // that is still being given its label is not reported.
      await page.waitForLoadState("networkidle");
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("the sidebar marks the current page and opens only the group you are in", async ({ page }) => {
    await page.goto("/admin/news");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "News", exact: true })).toHaveAttribute("aria-current", "page");
    // Other groups start folded, so the list stays short.
    await expect(nav.getByRole("link", { name: "Programmes", exact: true })).toHaveCount(0);
    const academics = nav.getByRole("button", { name: /Academics/ });
    await expect(academics).toHaveAttribute("aria-expanded", "false");
    await academics.click();
    await expect(academics).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Programmes", exact: true })).toBeVisible();
  });

  test("the jump box finds a page by name", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("searchbox", { name: "Jump to a page" }).fill("lectur");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: /Lecturers/ })).toBeVisible();
    await nav.getByRole("link", { name: /Lecturers/ }).click();
    await page.waitForURL(/\/admin\/lecturers/);
    await page.goto("/admin");
    await page.getByRole("searchbox", { name: "Jump to a page" }).fill("zzzz-no-such-page");
    await expect(page.getByText(/No page matches/)).toBeVisible();
  });

  test("pressing / jumps to the search box", async ({ page }) => {
    await page.goto("/admin");
    await page.locator("main").click();
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Jump to a page" })).toBeFocused();
  });

  test("on a large screen the sidebar can be hidden, and stays hidden after a reload", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav).toBeVisible();
    await page.getByRole("button", { name: "Hide the menu" }).click();
    await expect(nav).toBeHidden();
    await page.reload();
    await expect(nav).toBeHidden();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(nav).toBeVisible();
  });

  test("on a phone the sidebar is a drawer behind a Menu button, closes with Escape, and the page does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/lecturers");
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
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

  test("an edit page offers the way back to its list", async ({ page }) => {
    await page.goto("/admin/news/new");
    const back = page.getByRole("link", { name: "Back to News" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/admin\/news$/);
    await expect(page.getByRole("link", { name: /^Back to/ })).toHaveCount(0);
  });

  test("the news form has a labelled toolbar, titled sections and a Save bar that stays on screen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/admin/news/new");
    const toolbar = page.getByRole("toolbar", { name: "Formatting" });
    await expect(toolbar).toBeVisible();
    for (const name of ["Heading", "Bold", "Italic", "Bulleted list", "Link", "Image"]) {
      await expect(toolbar.getByRole("button", { name, exact: true })).toBeVisible();
    }
    // Pressing a formatting button reports its state.
    await toolbar.getByRole("button", { name: "Bold" }).click();
    await expect(toolbar.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");

    await expect(page.getByRole("heading", { name: "About the post" })).toBeVisible();
    // The Save button is in view even though the form is longer than the window.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeInViewport();
  });

  test("the security page shows two-factor status and a sign-out-everywhere button", async ({ page }) => {
    await page.goto("/admin/my-profile/security");
    await expect(page.getByRole("heading", { name: "Two-factor sign-in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /two-factor sign-in/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out on all devices" })).toBeVisible();
  });

  test("a delete asks first and says what will happen", async ({ page }) => {
    await page.goto("/admin/calendar");
    const del = page.getByRole("button", { name: /^Delete:/ }).first();
    test.skip((await del.count()) === 0, "no calendar entries in this database to try it on");
    await del.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/cannot be undone/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("signing out ends the session on the server, so a copied cookie stops working", async ({ browser }) => {
    // Sign in fresh (not the shared session) so signing out does not end the
    // other tests' session.
    const first = await browser.newContext({ storageState: undefined });
    const page = await first.newPage();
    await signIn(page);
    await page.goto("/admin");
    await expect(page.locator("main h1").first()).toBeVisible();

    // Someone copies the session cookie.
    const stolen = await first.cookies();
    const thief = await browser.newContext({ storageState: undefined });
    await thief.addCookies(stolen);
    const thiefPage = await thief.newPage();
    await thiefPage.goto("/admin");
    await expect(thiefPage.locator("main h1").first()).toBeVisible();

    // The owner signs out.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    // The copy no longer works, even though the cookie itself is untouched.
    await thiefPage.goto("/admin");
    await expect(thiefPage).toHaveURL(/\/login/);

    await first.close();
    await thief.close();
  });
});
