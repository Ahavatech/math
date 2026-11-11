import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_ROUTES = [
  "/", "/about", "/programmes", "/research", "/staff", "/news", "/events",
  "/alumni", "/students", "/students/courses", "/students/handbook",
  "/students/downloads", "/students/calendar", "/journal", "/contact",
  "/privacy", "/search?q=mathematics",
];

test.describe("public pages", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders and has no serious accessibility violations`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => v.id)).toEqual([]);
    });
  }

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  test("page hydrates under the CSP without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
  });

  test("sitemap and robots are served and hide private routes", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/journal/dashboard");
  });
});
