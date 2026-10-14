import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getTestDb } from "../../database/test-db";

// Must mock email before importing the service that uses it
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendAlreadyRegisteredEmail: vi.fn().mockResolvedValue(undefined),
}));

import { registerAuthor, verifyEmail } from "@/server/services/author-registration";
import { sendVerificationEmail, sendAlreadyRegisteredEmail } from "@/lib/email";

const db = await getTestDb();

if (db === null) {
  console.warn("[author-registration.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

const createdUserEmails: string[] = [];

describe.skipIf(db === null)("author registration service", () => {
  afterEach(async () => {
    if (createdUserEmails.length > 0) {
      await db!.userToken.deleteMany({ where: { user: { email: { in: createdUserEmails } } } });
      await db!.user.deleteMany({ where: { email: { in: createdUserEmails } } });
      createdUserEmails.length = 0;
    }
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("creates User with AUTHOR role and emailVerifiedAt null", async () => {
    const email = "newauthor-reg@example.com";
    createdUserEmails.push(email);

    await registerAuthor(db!, { name: "New Author", email, passwordPlaintext: "password12345", ip: "1.2.3.4" });

    const user = await db!.user.findUnique({ where: { email }, include: { roles: true } });
    expect(user).not.toBeNull();
    expect(user!.roles.map((r) => r.role)).toContain("AUTHOR");
    expect(user!.emailVerifiedAt).toBeNull();
    expect(user!.passwordHash).not.toBeNull();
    expect(user!.passwordHash).not.toBe("password12345");
  });

  it("sends verification email, not already-registered email, for new address", async () => {
    const email = "newauthor-email@example.com";
    createdUserEmails.push(email);

    await registerAuthor(db!, { name: "Email Author", email, passwordPlaintext: "password12345", ip: "1.2.3.4" });

    expect(sendVerificationEmail).toHaveBeenCalledOnce();
    expect(sendAlreadyRegisteredEmail).not.toHaveBeenCalled();
    const call = vi.mocked(sendVerificationEmail).mock.calls[0][0];
    expect(call.to).toBe(email);
    expect(typeof call.token).toBe("string");
  });

  it("sends already-registered email for existing address, same response shape", async () => {
    const email = "existing-author@example.com";
    createdUserEmails.push(email);

    // First registration
    await registerAuthor(db!, { name: "Existing Author", email, passwordPlaintext: "password12345", ip: "1.2.3.4" });
    vi.clearAllMocks();

    // Second registration with same email
    const result = await registerAuthor(db!, { name: "Existing Again", email, passwordPlaintext: "different99", ip: "1.2.3.5" });

    expect(result).toEqual({ sent: true });
    expect(sendAlreadyRegisteredEmail).toHaveBeenCalledOnce();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("always returns { sent: true }", async () => {
    const email = "sentshape@example.com";
    createdUserEmails.push(email);
    const result = await registerAuthor(db!, { name: "Shape Test", email, passwordPlaintext: "password12345", ip: "1.2.3.4" });
    expect(result).toEqual({ sent: true });
  });
});

describe.skipIf(db === null)("verifyEmail", () => {
  afterEach(async () => {
    if (createdUserEmails.length > 0) {
      await db!.userToken.deleteMany({ where: { user: { email: { in: createdUserEmails } } } });
      await db!.user.deleteMany({ where: { email: { in: createdUserEmails } } });
      createdUserEmails.length = 0;
    }
  });

  afterAll(async () => {
    // already disconnected by outer block; ignore
  });

  async function makeUnverifiedUser(email: string) {
    createdUserEmails.push(email);
    const user = await db!.user.create({
      data: { email, name: "Verify Test", roles: { create: [{ role: "AUTHOR" }] } },
    });
    return user;
  }

  it("sets emailVerifiedAt and returns userId", async () => {
    const { issueToken } = await import("@/server/services/tokens");
    const user = await makeUnverifiedUser("verify-ok@example.com");
    const { token } = await issueToken(db!, user.id, "EMAIL_VERIFY");

    const result = await verifyEmail(db!, token);
    expect(result).toEqual({ userId: user.id });

    const updated = await db!.user.findUnique({ where: { id: user.id } });
    expect(updated!.emailVerifiedAt).not.toBeNull();
  });

  it("invalid token returns null", async () => {
    const result = await verifyEmail(db!, "totally-invalid-token");
    expect(result).toBeNull();
  });

  it("expired token returns null", async () => {
    const { issueToken } = await import("@/server/services/tokens");
    const user = await makeUnverifiedUser("verify-expired@example.com");
    const { token, id } = await issueToken(db!, user.id, "EMAIL_VERIFY");
    await db!.userToken.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const result = await verifyEmail(db!, token);
    expect(result).toBeNull();
  });

  it("used token returns null", async () => {
    const { issueToken } = await import("@/server/services/tokens");
    const user = await makeUnverifiedUser("verify-used@example.com");
    const { token } = await issueToken(db!, user.id, "EMAIL_VERIFY");

    await verifyEmail(db!, token); // consume once
    const second = await verifyEmail(db!, token);
    expect(second).toBeNull();
  });
});

describe("validator: password min length", () => {
  it("registerAuthorSchema rejects password shorter than 10 chars", async () => {
    const { registerAuthorSchema } = await import("@/lib/validators/manuscript");
    const result = registerAuthorSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "short",
      privacyConsent: true,
      honeypot: "",
      formToken: "tok",
      formRenderedAt: Date.now() - 5000,
    });
    expect(result.success).toBe(false);
  });

  it("registerAuthorSchema accepts password of 10+ chars", async () => {
    const { registerAuthorSchema } = await import("@/lib/validators/manuscript");
    const result = registerAuthorSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "longenough99",
      privacyConsent: true,
      honeypot: "",
      formToken: "tok",
      formRenderedAt: Date.now() - 5000,
    });
    // Only fails on schema fields, not on honeypot/timing checks (those happen server-side)
    const passwordError = result.error?.errors.find((e) => e.path.includes("password"));
    expect(passwordError).toBeUndefined();
  });
});

describe("next param validation: open redirect prevention", () => {
  it("validateNextParam allows same-origin relative paths", async () => {
    const { validateNextParam } = await import("@/server/services/author-registration");
    expect(validateNextParam("/journal/dashboard")).toBe("/journal/dashboard");
    expect(validateNextParam("/journal/submit")).toBe("/journal/submit");
  });

  it("validateNextParam rejects absolute URLs", async () => {
    const { validateNextParam } = await import("@/server/services/author-registration");
    expect(validateNextParam("https://evil.com/phish")).toBe("/journal/dashboard");
    expect(validateNextParam("http://evil.com")).toBe("/journal/dashboard");
  });

  it("validateNextParam rejects protocol-relative URLs", async () => {
    const { validateNextParam } = await import("@/server/services/author-registration");
    expect(validateNextParam("//evil.com/phish")).toBe("/journal/dashboard");
  });

  it("validateNextParam falls back to /journal/dashboard on empty/null", async () => {
    const { validateNextParam } = await import("@/server/services/author-registration");
    expect(validateNextParam(null)).toBe("/journal/dashboard");
    expect(validateNextParam("")).toBe("/journal/dashboard");
  });
});
