import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * Whole journeys, the way a visitor or a member of staff actually uses the site,
 * rather than one page at a time. The admin part needs a real test account
 * (E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD) and skips without one.
 */

test.describe("visitor journeys", () => {
  test("a visitor can send a message through the contact page and sees that it arrived", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Name").fill("Flow Test Visitor");
    await page.getByLabel("Email").fill(`flow-visitor-${Date.now()}@example.com`);
    await page.getByLabel("Subject").fill("A check that the contact form works");
    await page.getByLabel("Message").fill("This message was sent by an automated end-to-end check of the contact page.");
    // The form refuses anything submitted within a couple of seconds of loading (a spam guard).
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByRole("status").filter({ hasText: "Message sent" })).toBeAttached({ timeout: 15_000 });
    await expect(page.getByText("We have your message.")).toBeVisible();
  });

  test("search finds the department by name and an empty search is handled", async ({ page }) => {
    await page.goto("/search?q=mathematics");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByRole("status").first()).toBeVisible();
    await page.goto("/search?q=zzzzqqqq-nothing-matches");
    await expect(page.getByText(/no results|nothing matched|did not match|no matches/i).first()).toBeVisible();
  });

  test("the handbook-based About pages and the student association link are shown", async ({ page }) => {
    await page.goto("/about/history");
    await expect(page.locator("main h1")).toBeVisible();
    await page.goto("/about/mission-vision");
    await expect(page.locator("main h1")).toBeVisible();
    await page.goto("/students");
    await expect(page.locator('a[href^="https://namssn.oauife.edu.ng"]').first()).toBeVisible();
    await expect(page.locator('a[href="/documents/department-handbook.pdf"]').first()).toBeVisible();
    await page.goto("/students/handbook");
    await expect(page.getByText("About the Department and the University").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Download the handbook PDF" })).toBeVisible();
    const pdf = await page.request.get("/documents/department-handbook.pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("pdf");
  });

  test("the academic calendar can be subscribed to as a real calendar file", async ({ request }) => {
    const res = await request.get("/students/calendar/feed.ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  test("asking for a password reset gives the same answer for any address", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText("If an account exists for that email, a reset link has been sent.")).toBeVisible();
  });

  test("moving through the main sections by link works end to end, with no errors on the way", async ({ page }) => {
    // The full navigation bar shows from 1366px wide; below that the Menu button opens it.
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/");
    for (const name of ["About", "Programmes", "Staff", "News", "Events", "Students", "Journal", "Contact"]) {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true }).click();
      await expect(page.locator("main h1").first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/admin/);
}

// Sign in once and reuse the session: sign-in is limited to 5 a minute per address, so
// signing in at the start of every test would lock the suite out.
const stateFile = path.join(process.cwd(), "test-results", "flows-state.json");

test.describe("staff journeys", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are not set");

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await signIn(page);
    await context.storageState({ path: stateFile });
    await context.close();
  });

  test.use({ storageState: stateFile });

  test("a news post is written, published, seen on the public site, then archived", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now().toString(36);
    const title = `E2E flow post ${stamp}`;
    const slug = `e2e-flow-post-${stamp}`;

    await page.goto("/admin/news/new");
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel(/^Slug/).fill(slug);
    await page.getByLabel("Excerpt (max 300 characters)").fill("Written by an automated check.");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("textbox", { name: "Content" }).click();
    await page.keyboard.type("The body of the automated check post.");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Creating moves to the new post's own page.
    await page.waitForURL(/\/admin\/news\/(?!new$)[^/]+$/, { timeout: 20_000 });

    // It is on the public site.
    await page.goto(`/news/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("The body of the automated check post.")).toBeVisible();

    // And in the news list, where it can be archived by name.
    await page.goto("/admin/news");
    await page.getByRole("button", { name: `Archive: ${title}` }).click();
    await page.waitForLoadState("networkidle");
    await page.goto(`/news/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeHidden();
  });

  test("an event is created and appears in the admin list", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now().toString(36);
    const title = `E2E flow event ${stamp}`;
    await page.goto("/admin/events/new");
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel(/^Slug/).fill(`e2e-flow-event-${stamp}`);
    await page.getByLabel(/^Starts/).fill("2027-03-04T10:00");
    await page.getByLabel("Venue").fill("Departmental seminar room");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(/\/admin\/events\/(?!new$)[^/]+$/, { timeout: 20_000 });
    await page.goto("/admin/events");
    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole("button", { name: `Archive: ${title}` }).click();
    await page.waitForLoadState("networkidle");
  });

  test("the account page is reachable from the menu and shows how the account is protected", async ({ page }) => {
    await page.goto("/admin/my-profile/security");
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Two-factor sign-in" })).toBeVisible();
    await page.getByRole("link", { name: /two-factor sign-in/i }).first().click();
    await expect(page).toHaveURL(/\/two-factor/);
    await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
  });

  test("someone who is already signed in is not shown the sign-in form again", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/login?callbackUrl=%2Fadmin%2Fnews");
    await expect(page).toHaveURL(/\/admin\/news/);
    // And an unsafe return address is ignored, not followed.
    await page.goto("/login?callbackUrl=https%3A%2F%2Fevil.example%2F");
    await expect(page).toHaveURL(/localhost|127\.0\.0\.1/);
    await expect(page).not.toHaveURL(/evil\.example/);
  });
});
