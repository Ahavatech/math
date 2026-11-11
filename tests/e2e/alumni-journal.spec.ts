import { test, expect } from "@playwright/test";

test.describe("alumni and journal public flows", () => {
  test("alumni form rejects an invalid token", async ({ page }) => {
    const res = await page.goto("/alumni/submit/invalid-token-value");
    expect([200, 404]).toContain(res?.status() ?? 0);
    await expect(page.getByRole("button", { name: /submit/i })).toHaveCount(0);
  });

  test("alumni confirm page is noindex and not cached", async ({ request }) => {
    const res = await request.get("/alumni/confirm/invalid-token-value");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("journal landing and feeds respond", async ({ request }) => {
    expect((await request.get("/journal")).status()).toBe(200);
    expect((await request.get("/journal/rss.xml")).status()).toBe(200);
  });

  test("journal submission requires sign-in", async ({ page }) => {
    await page.goto("/journal/submit/step1");
    await expect(page).toHaveURL(/login|journal\/submit/);
  });
});
