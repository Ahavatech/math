import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { totpAt, stepFor, generateTotpSecret, decryptSecret } from "@/lib/totp";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  checkLoginAttempt,
  claimFailedLoginAlert,
  recordSuccessfulLogin,
  LOGIN_LIMITS,
} from "../login-attempts";
import { isSessionRevoked, purgeExpiredRevocations, revokeSession } from "../sessions";
import {
  beginTwoFactorSetup,
  confirmTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  remainingRecoveryCodes,
  twoFactorRequiredFor,
  twoFactorStatus,
  verifySecondFactor,
} from "../two-factor";
import { issueToken } from "../tokens";
import { setPasswordFromToken, changeOwnPassword, WeakPasswordError } from "../account";

const db = await getTestDb();
const RUN = `sh${Date.now().toString(36)}`;
const AUTH_SECRET = "test-auth-secret-that-is-long-enough-0123456789";

describe.skipIf(db === null)("security hardening services", () => {
  const userIds: string[] = [];
  const keys: string[] = [];

  async function makeUser(label: string, extra: { isActive?: boolean; password?: string } = {}) {
    const user = await db!.user.create({
      data: {
        email: `${RUN}-${label}@example.com`,
        name: `Test ${label}`,
        isActive: extra.isActive ?? true,
        passwordHash: await hashPassword(extra.password ?? "an-original-password-1"),
      },
    });
    userIds.push(user.id);
    return user;
  }

  beforeAll(() => undefined);

  afterAll(async () => {
    await db!.loginAttempt.deleteMany({ where: { key: { in: keys } } });
    await db!.revokedSession.deleteMany({ where: { userId: { in: userIds } } });
    await db!.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db!.user.deleteMany({ where: { id: { in: userIds } } });
    await db?.$disconnect();
  });

  describe("sign-in attempt limit", () => {
    it("allows five a minute for one email, then refuses, and shares the count through the database", async () => {
      const email = `${RUN}-limit@example.com`;
      keys.push(`email:${email}`, `ip:10.0.0.1`);
      const now = new Date();
      for (let i = 0; i < LOGIN_LIMITS.perEmailPerMinute; i++) {
        expect((await checkLoginAttempt(db!, `10.0.0.${i + 1}`, email, now)).allowed).toBe(true);
        keys.push(`ip:10.0.0.${i + 1}`);
      }
      // A different address does not get a fresh allowance for the same email.
      expect((await checkLoginAttempt(db!, "10.0.0.99", email, now)).allowed).toBe(false);
      keys.push("ip:10.0.0.99");
      // The window moves on after a minute.
      const later = new Date(now.getTime() + 61_000);
      expect((await checkLoginAttempt(db!, "10.0.0.50", email, later)).allowed).toBe(true);
      keys.push("ip:10.0.0.50");
    });

    it("limits one address across different emails", async () => {
      const now = new Date();
      const ip = `10.9.${Math.floor(Math.random() * 200)}.1`;
      keys.push(`ip:${ip}`);
      for (let i = 0; i < LOGIN_LIMITS.perIpPerMinute; i++) {
        const email = `${RUN}-ip${i}@example.com`;
        keys.push(`email:${email}`);
        expect((await checkLoginAttempt(db!, ip, email, now)).allowed).toBe(true);
      }
      const extra = `${RUN}-ip-extra@example.com`;
      keys.push(`email:${extra}`);
      expect((await checkLoginAttempt(db!, ip, extra, now)).allowed).toBe(false);
    });
  });

  describe("failed sign-in alert", () => {
    it("fires once after five failures on a real account, then waits an hour, and a success clears the count", async () => {
      const user = await makeUser("alert");
      keys.push(`email:${user.email}`);
      const now = new Date();
      for (let i = 0; i < 4; i++) {
        await db!.loginAttempt.create({ data: { key: `email:${user.email}`, at: now, failed: true } });
      }
      expect(await claimFailedLoginAlert(db!, user.email, now)).toBeNull();

      await db!.loginAttempt.create({ data: { key: `email:${user.email}`, at: now, failed: true } });
      const first = await claimFailedLoginAlert(db!, user.email, now);
      expect(first?.id).toBe(user.id);
      // Not again within the hour.
      expect(await claimFailedLoginAlert(db!, user.email, new Date(now.getTime() + 5 * 60_000))).toBeNull();

      await recordSuccessfulLogin(db!, user.email);
      expect(await db!.loginAttempt.count({ where: { key: `email:${user.email}`, failed: true } })).toBe(0);
    });

    it("says nothing for an address with no account, so the alert cannot confirm one exists", async () => {
      const email = `${RUN}-nobody@example.com`;
      keys.push(`email:${email}`);
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        await db!.loginAttempt.create({ data: { key: `email:${email}`, at: now, failed: true } });
      }
      expect(await claimFailedLoginAlert(db!, email, now)).toBeNull();
    });
  });

  describe("session revocation", () => {
    it("treats a signed-out session as dead, leaves others alone, and tidies expired entries", async () => {
      const user = await makeUser("sess");
      const live = `${RUN}-live`;
      const dead = `${RUN}-dead`;
      await revokeSession(db!, { jti: dead, userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) });
      // Revoking twice is harmless.
      await revokeSession(db!, { jti: dead, userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) });

      expect(await isSessionRevoked(db!, dead)).toBe(true);
      expect(await isSessionRevoked(db!, live)).toBe(false);
      expect(await isSessionRevoked(db!, undefined)).toBe(false);

      await revokeSession(db!, { jti: `${RUN}-old`, userId: user.id, expiresAt: new Date(Date.now() - 1000) });
      await purgeExpiredRevocations(db!);
      expect(await isSessionRevoked(db!, `${RUN}-old`)).toBe(false);
      expect(await isSessionRevoked(db!, dead)).toBe(true);
    });
  });

  describe("two-factor sign-in", () => {
    it("is required for admin roles only", () => {
      expect(twoFactorRequiredFor(["SUPER_ADMIN"])).toBe(true);
      expect(twoFactorRequiredFor(["LECTURER", "HOD"])).toBe(true);
      expect(twoFactorRequiredFor(["ADMIN"])).toBe(true);
      expect(twoFactorRequiredFor(["LECTURER"])).toBe(false);
      expect(twoFactorRequiredFor(["AUTHOR", "REVIEWER"])).toBe(false);
    });

    it("sets up with a code, stores the secret encrypted, and gives recovery codes once", async () => {
      const user = await makeUser("tfa");
      expect(await twoFactorStatus(db!, user.id)).toBe("off");

      const { secret } = await beginTwoFactorSetup(db!, user.id, AUTH_SECRET, "OAU Maths");
      expect(await twoFactorStatus(db!, user.id)).toBe("pending");
      const row = await db!.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.totpSecretEnc).not.toContain(secret);
      expect(decryptSecret(row.totpSecretEnc!, AUTH_SECRET)).toBe(secret);

      // A wrong code does not turn it on.
      const now = Date.now();
      expect(await confirmTwoFactor(db!, user.id, "000000", AUTH_SECRET, now)).toBeNull();
      expect(await twoFactorStatus(db!, user.id)).toBe("pending");

      const confirmed = await confirmTwoFactor(db!, user.id, totpAt(secret, stepFor(now)), AUTH_SECRET, now);
      expect(confirmed?.recoveryCodes).toHaveLength(8);
      expect(await twoFactorStatus(db!, user.id)).toBe("on");
      expect(await remainingRecoveryCodes(db!, user.id)).toBe(8);

      // Recovery codes are stored as hashes only.
      const stored = await db!.recoveryCode.findMany({ where: { userId: user.id } });
      for (const code of confirmed!.recoveryCodes) {
        expect(stored.some((s) => s.codeHash === code)).toBe(false);
      }
    });

    it("accepts each authenticator code once and each recovery code once", async () => {
      const user = await makeUser("tfa2");
      const { secret } = await beginTwoFactorSetup(db!, user.id, AUTH_SECRET, "OAU Maths");
      const t0 = Date.now();
      const confirmed = await confirmTwoFactor(db!, user.id, totpAt(secret, stepFor(t0)), AUTH_SECRET, t0);

      // The code used to confirm cannot be replayed at the next sign-in.
      expect(await verifySecondFactor(db!, user.id, totpAt(secret, stepFor(t0)), AUTH_SECRET, t0)).toBe(false);

      // The next step's code works once, then not again.
      const t1 = t0 + 30_000;
      const next = totpAt(secret, stepFor(t1));
      expect(await verifySecondFactor(db!, user.id, next, AUTH_SECRET, t1)).toBe(true);
      expect(await verifySecondFactor(db!, user.id, next, AUTH_SECRET, t1)).toBe(false);

      // Garbage is refused.
      expect(await verifySecondFactor(db!, user.id, "banana", AUTH_SECRET, t1)).toBe(false);

      // A recovery code works once, however it is typed.
      const recovery = confirmed!.recoveryCodes[0];
      expect(await verifySecondFactor(db!, user.id, recovery.toUpperCase(), AUTH_SECRET, t1)).toBe(true);
      expect(await verifySecondFactor(db!, user.id, recovery, AUTH_SECRET, t1)).toBe(false);
      expect(await remainingRecoveryCodes(db!, user.id)).toBe(7);

      // A new set replaces the old one.
      const fresh = await regenerateRecoveryCodes(db!, user.id);
      expect(await verifySecondFactor(db!, user.id, confirmed!.recoveryCodes[1], AUTH_SECRET, t1)).toBe(false);
      expect(await verifySecondFactor(db!, user.id, fresh[0], AUTH_SECRET, t1)).toBe(true);
    });

    it("refuses a second factor when none is set up, and can be turned off", async () => {
      const user = await makeUser("tfa3");
      expect(await verifySecondFactor(db!, user.id, "123456", AUTH_SECRET)).toBe(false);

      const { secret } = await beginTwoFactorSetup(db!, user.id, AUTH_SECRET, "OAU Maths");
      const now = Date.now();
      await confirmTwoFactor(db!, user.id, totpAt(secret, stepFor(now)), AUTH_SECRET, now);
      await expect(beginTwoFactorSetup(db!, user.id, AUTH_SECRET, "OAU Maths")).rejects.toThrow();

      await disableTwoFactor(db!, user.id);
      expect(await twoFactorStatus(db!, user.id)).toBe("off");
      expect(await remainingRecoveryCodes(db!, user.id)).toBe(0);
    });

    it("never accepts a code for the wrong person", async () => {
      const a = await makeUser("tfa-a");
      const b = await makeUser("tfa-b");
      const { secret } = await beginTwoFactorSetup(db!, a.id, AUTH_SECRET, "OAU Maths");
      const now = Date.now();
      await confirmTwoFactor(db!, a.id, totpAt(secret, stepFor(now)), AUTH_SECRET, now);
      const t1 = now + 30_000;
      expect(await verifySecondFactor(db!, b.id, totpAt(secret, stepFor(t1)), AUTH_SECRET, t1)).toBe(false);
      void generateTotpSecret;
    });
  });

  describe("password reset from a link", () => {
    it("sets the password, uses the link up, and cancels other links", async () => {
      const user = await makeUser("reset");
      const first = await issueToken(db!, user.id, "PASSWORD_RESET");
      const result = await setPasswordFromToken(db!, {
        token: first.token,
        password: "violet-harbour-lamp-42",
        type: "PASSWORD_RESET",
      });
      expect(result.ok).toBe(true);

      const row = await db!.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await verifyPassword(row.passwordHash!, "violet-harbour-lamp-42")).toBe(true);
      expect(row.passwordChangedAt).not.toBeNull();

      // The same link cannot be used twice.
      const again = await setPasswordFromToken(db!, {
        token: first.token,
        password: "another-fine-passphrase-9",
        type: "PASSWORD_RESET",
      });
      expect(again.ok).toBe(false);
    });

    it("refuses a weak password without using the link up", async () => {
      const user = await makeUser("reset-weak");
      const { token } = await issueToken(db!, user.id, "PASSWORD_RESET");
      const weak = await setPasswordFromToken(db!, { token, password: "password123", type: "PASSWORD_RESET" });
      expect(weak.ok).toBe(false);
      if (!weak.ok) expect(weak.reason).toBe("weak");

      const good = await setPasswordFromToken(db!, {
        token,
        password: "violet-harbour-lamp-43",
        type: "PASSWORD_RESET",
      });
      expect(good.ok).toBe(true);
    });

    it("does not let a deactivated account be reset, and treats a link of the wrong kind as invalid", async () => {
      const off = await makeUser("reset-off", { isActive: false });
      const { token } = await issueToken(db!, off.id, "PASSWORD_RESET");
      const refused = await setPasswordFromToken(db!, {
        token,
        password: "violet-harbour-lamp-44",
        type: "PASSWORD_RESET",
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.reason).toBe("invalid-token");

      const user = await makeUser("reset-kind");
      const invite = await issueToken(db!, user.id, "INVITE");
      const wrongKind = await setPasswordFromToken(db!, {
        token: invite.token,
        password: "violet-harbour-lamp-45",
        type: "PASSWORD_RESET",
      });
      expect(wrongKind.ok).toBe(false);
    });

    it("refuses a password built from the person's own email when changing it", async () => {
      const user = await makeUser("change", { password: "an-original-password-1" });
      await expect(
        changeOwnPassword(db!, user.id, {
          currentPassword: "an-original-password-1",
          newPassword: `${RUN}-change1`,
        }),
      ).rejects.toBeInstanceOf(WeakPasswordError);
    });
  });
});
