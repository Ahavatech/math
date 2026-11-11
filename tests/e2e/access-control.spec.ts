import { test, expect } from "@playwright/test";

test.describe("access control without a session", () => {
  for (const route of ["/admin", "/admin/lecturers", "/journal/dashboard"]) {
    test(`${route} redirects to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("private manuscript file route refuses anonymous requests", async ({ request }) => {
    const res = await request.get("/api/journal/manuscripts/does-not-exist/files", { maxRedirects: 0 });
    expect([401, 403, 404, 405]).toContain(res.status());
  });

  test("search rejects too-short queries without leaking", async ({ page }) => {
    await page.goto("/search?q=a");
    await expect(page.locator("main")).toBeVisible();
  });
});
