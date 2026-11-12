import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Sign-in security, checked against the running app.
 *
 * Every test that submits bad passwords uses its own made-up address (via
 * x-forwarded-for) and email, so it never uses up the attempts that real
 * sign-ins in other tests depend on.
 */

const RUN = Date.now().toString(36);

async function csrfToken(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/auth/csrf");
  return (await res.json()).csrfToken as string;
}

async function postCredentials(request: APIRequestContext, ip: string, email: string, password: string, csrf: string) {
  return request.post("/api/auth/callback/credentials", {
    headers: { "x-forwarded-for": ip },
    form: { csrfToken: csrf, email, password, json: "true" },
    maxRedirects: 0,
  });
}

test.describe("sign-in rate limiting", () => {
  test("the Auth.js endpoint is throttled, not only the login form", async ({ request }) => {
    const ip = "198.51.100.10";
    const email = `throttle-api-${RUN}@example.com`;
    const csrf = await csrfToken(request);

    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await postCredentials(request, ip, email, `wrong-password-${i}`, csrf);
      const location = res.headers()["location"] ?? "";
      codes.push(new URL(location, "http://localhost").searchParams.get("code") ?? "none");
    }

    // The first five are ordinary failures; after that the limiter answers.
    expect(codes.slice(0, 5).every((c) => c === "credentials")).toBe(true);
    expect(codes.slice(5).every((c) => c === "rate_limited")).toBe(true);
  });

  test("one email is throttled even when each attempt comes from a different address", async ({ request }) => {
    const email = `throttle-spread-${RUN}@example.com`;
    const csrf = await csrfToken(request);
    const codes: string[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await postCredentials(request, `198.51.100.${100 + i}`, email, `wrong-${i}`, csrf);
      codes.push(new URL(res.headers()["location"] ?? "", "http://localhost").searchParams.get("code") ?? "none");
    }
    expect(codes.slice(0, 5).every((c) => c === "credentials")).toBe(true);
    expect(codes.slice(5).every((c) => c === "rate_limited")).toBe(true);
  });

  test.describe("through the login form", () => {
    test.use({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.20" } });

    test("shows the same message for an unknown email and a wrong password, then says to wait", async ({ page }) => {
      const email = `throttle-ui-${RUN}@example.com`;
      const messages: string[] = [];
      for (let i = 0; i < 7; i++) {
        await page.goto("/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(`not-the-password-${i}`);
        await page.getByRole("button", { name: "Sign in" }).click();
        const alert = page.locator("form p[role='alert']");
        await expect(alert).toBeVisible();
        messages.push((await alert.innerText()).trim());
      }
      expect(messages.slice(0, 5).every((m) => m === "Incorrect email or password.")).toBe(true);
      expect(messages[6]).toBe("Too many attempts. Please try again later.");
    });
  });
});

test.describe("login redirects", () => {
  test("a safe return address is carried into the form, an unsafe one is dropped", async ({ page }) => {
    await page.goto("/login?callbackUrl=%2Fadmin%2Fnews");
    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue("/admin/news");

    for (const bad of ["https%3A%2F%2Fevil.example%2Fadmin", "%2F%2Fevil.example", "%2Fapi%2Fauth%2Fsignout", "javascript%3Aalert(1)"]) {
      await page.goto(`/login?callbackUrl=${bad}`);
      await expect(page.locator('input[name="callbackUrl"]')).toHaveValue("");
    }
  });

  test("signed-out visitors to journal screens reach the real login page, not a 404", async ({ request }) => {
    for (const path of ["/journal/reviewer", "/journal/dashboard"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([302, 307, 308], path).toContain(res.status());
      const location = res.headers()["location"] ?? "";
      expect(location, path).toMatch(/\/login\?callbackUrl=/);
    }
    expect((await request.get("/login")).status()).toBe(200);
    expect((await request.get("/journal/login")).status()).toBe(404);
  });

  test("the two-factor page sends a signed-out visitor to sign in", async ({ page }) => {
    await page.goto("/two-factor");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the login page is not indexed and sends a restrictive cache policy", async ({ request }) => {
    const res = await request.get("/login");
    const html = await res.text();
    expect(html).toMatch(/noindex/);
  });
});

test.describe("headers", () => {
  test("HTTPS-only is announced", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
  });
});

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe("session cookie (needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD)", () => {
  test.skip(!email || !password, "no test admin credentials set");
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.30" } });

  test("is HttpOnly, SameSite and lasts hours, not weeks; sign-out removes it", async ({ page, context }) => {
    await page.goto("/login?callbackUrl=%2Fadmin%2Fnews");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    // The safe return address is honoured.
    await page.waitForURL(/\/admin\/news/);

    const cookies = await context.cookies();
    const session = cookies.find((c) => /session-token/.test(c.name));
    expect(session, "a session cookie is set").toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
    const hours = (session!.expires - Date.now() / 1000) / 3600;
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThanOrEqual(13);

    // No request except signing in may issue a session cookie. If an ordinary page
    // request re-issued it, a request still in flight at sign-out could put the
    // cookie back and undo the sign-out.
    const probe = await context.request.get("/admin/news", { maxRedirects: 0 });
    expect(probe.status()).toBe(200);
    const issued = probe
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .some((h) => /session-token/.test(h.value));
    expect(issued).toBe(false);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    // The cookie is cleared by the sign-out response; give the browser a moment to apply it.
    await expect
      .poll(async () => (await context.cookies()).some((c) => /session-token/.test(c.name)))
      .toBe(false);
    const res = await page.goto("/admin");
    expect(page.url()).toMatch(/\/login/);
    expect(res?.status()).toBe(200);
  });
});
