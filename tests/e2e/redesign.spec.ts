import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Regression coverage for the Stage 15 and 16 redesign: pages the original
 * suite did not reach, layout at phone and laptop widths, and the mobile
 * menu. Data-dependent pages skip themselves when the database has no
 * matching content, so the suite still runs against a bare seed.
 */

const MORE_ROUTES = [
  "/journal/about",
  "/journal/articles",
  "/journal/issues",
  "/journal/editorial-board",
  "/journal/guidelines",
  "/journal/call-for-papers",
  "/journal/policies",
  "/programmes/bsc",
  "/research",
  "/donate",
];

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.nodes.length})`);
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test.describe("more pages have no serious accessibility violations", () => {
  for (const route of MORE_ROUTES) {
    test(route, async ({ page }) => {
      const response = await page.goto(route);
      test.skip(response?.status() === 404, `${route} has no content in this database`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("a lecturer profile", async ({ page }) => {
    await page.goto("/staff");
    const link = page.locator('a[href^="/lecturer/"]').first();
    test.skip((await link.count()) === 0, "no published lecturers in this database");
    await link.click();
    await expect(page.locator("main h1")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("layout does not overflow", () => {
  const ROUTES = ["/", "/staff", "/news", "/events", "/students/courses", "/journal", "/contact", "/donate"];
  const WIDTHS = [
    { name: "phone", width: 390, height: 844 },
    { name: "small laptop", width: 1280, height: 800 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const size of WIDTHS) {
    for (const route of ROUTES) {
      test(`${route} at ${size.name} (${size.width}px)`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        const response = await page.goto(route);
        test.skip(response?.status() === 404, `${route} has no content in this database`);
        await expect(page.locator("main")).toBeVisible();
        expect(await hasHorizontalOverflow(page)).toBe(false);
      });
    }
  }

  test("the header search link is fully inside the window at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const box = await page.locator("header a[href='/search']").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  });
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, lists the site sections, and closes with Escape", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Menu" });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await menuButton.click();
    await expect(page.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Primary (mobile)" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link").first()).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search the site" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-nav")).toHaveCount(0);
  });

  test("closes by itself after following a link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("navigation", { name: "Primary (mobile)" }).getByRole("link").nth(1).click();
    await page.waitForLoadState("load");
    await expect(page.locator("#mobile-nav")).toHaveCount(0);
  });

  test("the journal section bar scrolls sideways instead of wrapping", async ({ page }) => {
    await page.goto("/journal/issues");
    const nav = page.getByRole("navigation", { name: "Journal sections" });
    await expect(nav).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("filters are links that announce the current choice", () => {
  test("news categories and event tabs mark the active item", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("link", { name: "Upcoming", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goto("/events?tab=past");
    await expect(page.getByRole("link", { name: "Past", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goto("/news");
    await expect(page.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "true");
  });
});

test.describe("donations page", () => {
  test("is either absent or complete, and never shows empty bank details", async ({ page }) => {
    const response = await page.goto("/donate");
    if (response?.status() === 404) {
      // Off: the footer must not advertise it either.
      await page.goto("/");
      await expect(page.locator("footer a[href='/donate']")).toHaveCount(0);
      return;
    }
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Account number", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy account number/ })).toBeVisible();
    await expect(page.getByText(/confirm these details with the department/)).toBeVisible();
    await page.goto("/");
    await expect(page.locator("footer a[href='/donate']")).toHaveCount(1);
  });
});
