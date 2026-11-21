import { test, expect, type Page } from "@playwright/test";

/**
 * Passkeys, end to end, with Chromium's virtual authenticator standing in for a
 * phone or laptop fingerprint reader. Needs a real test account like the admin
 * checks do (E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD), and skips without one.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.skip(!email || !password, "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are not set");

async function signInWithPassword(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/admin|\/two-factor/);
}

/** An interrupted earlier run could leave a test passkey behind; take any away so this run starts clean. */
async function removeLeftovers(page: Page) {
  for (;;) {
    const row = page.locator("li", { hasText: "Test fingerprint" }).first();
    if ((await row.count()) === 0) return;
    await row.getByLabel("Your password, to remove it").fill(password!);
    await row.getByRole("button", { name: /Remove passkey/ }).click();
    await page.waitForLoadState("networkidle");
    await page.reload();
  }
}

test("a passkey can be added, used to sign in without a password, and removed", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  // 1. Sign in the ordinary way and add a passkey.
  await signInWithPassword(page);
  await page.goto("/two-factor");
  await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
  await removeLeftovers(page);
  await page.getByLabel("Name for this passkey").fill("Test fingerprint");
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText("Test fingerprint")).toBeVisible();

  // 2. Sign out, then sign in with only the passkey: no email, no password.
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL(/\/admin/, { timeout: 20_000 });
  await expect(page.locator("main h1").first()).toBeVisible();

  // The passkey session is as well protected as a password one: an HttpOnly,
  // same-site cookie that lasts hours, not weeks.
  const session = (await context.cookies()).find((c) => /session-token/.test(c.name))!;
  expect(session).toBeDefined();
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Lax");
  const hours = (session.expires - Date.now() / 1000) / 3600;
  expect(hours).toBeGreaterThan(10);
  expect(hours).toBeLessThanOrEqual(12.1);

  // A copy of that cookie works until the owner signs out, and not after.
  const thief = await browser.newContext();
  await thief.addCookies(await context.cookies());
  const thiefPage = await thief.newPage();
  await thiefPage.goto("/admin");
  await expect(thiefPage.locator("main h1").first()).toBeVisible();

  // Remove the passkey again (this needs the password), so the account is left as it was.
  await page.goto("/two-factor");
  const row = page.locator("li", { hasText: "Test fingerprint" });
  await row.getByLabel("Your password, to remove it").fill(password!);
  await row.getByRole("button", { name: /Remove passkey/ }).click();
  await expect(page.getByText("Test fingerprint")).toBeHidden();
  await expect(page.getByText("You have not added a passkey yet.")).toBeVisible();

  // The owner signs out; the copied cookie then stops working.
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await thiefPage.goto("/admin");
  await expect(thiefPage).toHaveURL(/\/login/);
  await thief.close();

  await context.close();
});

test("a wrong or missing passkey answer is refused and gives nothing away", async ({ page, request }) => {
  await page.goto("/login");
  // Without a passkey registered for this browser the prompt fails cleanly.
  await expect(page.getByRole("button", { name: "Sign in with a passkey" })).toBeVisible();
  const response = await request.post("/api/auth/callback/passkey", {
    form: { challengeId: "not-a-real-challenge", response: "{}", csrfToken: "x" },
    maxRedirects: 0,
  });
  // Refused: it never answers with a session cookie.
  expect(response.headers()["set-cookie"] ?? "").not.toContain("session-token");
});
