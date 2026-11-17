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

  // 3. Remove it again (this needs the password), so the account is left as it was.
  await page.goto("/two-factor");
  const row = page.locator("li", { hasText: "Test fingerprint" });
  await row.getByLabel("Your password, to remove it").fill(password!);
  await row.getByRole("button", { name: /Remove passkey/ }).click();
  await expect(page.getByText("Test fingerprint")).toBeHidden();
  await expect(page.getByText("You have not added a passkey yet.")).toBeVisible();

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
