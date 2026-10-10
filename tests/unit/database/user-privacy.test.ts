import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getTestDb } from "./test-db";

vi.mock("@/lib/email", () => ({
  sendInviteEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const db = await getTestDb();

if (db === null) {
  console.warn(
    "[tests/unit/database/user-privacy.test.ts] skipped: no reachable TEST_DATABASE_URL",
  );
}

let createdUserIds: string[] = [];

describe.skipIf(db === null)("user privacy regressions", () => {
  afterEach(async () => {
    await db!.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
    await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db!.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds = [];
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("listUsers never returns passwordHash or any token hash on any row", async () => {
    const { listUsers } = await import("@/server/services/users");
    const { hashPassword } = await import("@/lib/password");

    const withPassword = await db!.user.create({
      data: {
        email: "privacy-with-password@example.com",
        name: "Has Password",
        passwordHash: await hashPassword("whatever-password-123"),
      },
    });
    const withoutPassword = await db!.user.create({
      data: { email: "privacy-no-password@example.com", name: "No Password" },
    });
    createdUserIds.push(withPassword.id, withoutPassword.id);

    const users = await listUsers(db!);
    const relevant = users.filter((u) => createdUserIds.includes(u.id));
    expect(relevant).toHaveLength(2);

    for (const user of relevant) {
      expect(user).not.toHaveProperty("passwordHash");
      expect(Object.keys(user)).not.toContain("tokenHash");
    }

    const found = relevant.find((u) => u.id === withPassword.id);
    const foundEmpty = relevant.find((u) => u.id === withoutPassword.id);
    expect(found?.hasPassword).toBe(true);
    expect(foundEmpty?.hasPassword).toBe(false);
  });

  it("issueToken never returns the token's hash, only the plaintext and metadata", async () => {
    const { issueToken } = await import("@/server/services/tokens");
    const user = await db!.user.create({
      data: { email: "privacy-token@example.com", name: "Token User" },
    });
    createdUserIds.push(user.id);

    const result = await issueToken(db!, user.id, "INVITE");
    expect(Object.keys(result).sort()).toEqual(["expiresAt", "id", "token"]);
    expect(result).not.toHaveProperty("tokenHash");
  });

  it("inviteUser succeeds even when sending the invite email fails", async () => {
    const { inviteUser } = await import("@/server/services/users");
    const { sendInviteEmail } = await import("@/lib/email");
    vi.mocked(sendInviteEmail).mockRejectedValueOnce(new Error("Resend is down"));

    const actor = await db!.user.create({
      data: { email: "privacy-invite-fail-actor@example.com", name: "Actor" },
    });
    createdUserIds.push(actor.id);

    const user = await inviteUser(db!, actor.id, {
      email: "privacy-invite-fail@example.com",
      name: "Invite Fail",
      roles: ["LECTURER"],
    });
    createdUserIds.push(user.id);

    expect(user.email).toBe("privacy-invite-fail@example.com");
    const stored = await db!.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toBeTruthy();
  });

  it("resendInvite succeeds even when sending the invite email fails", async () => {
    const { resendInvite } = await import("@/server/services/users");
    const { sendInviteEmail } = await import("@/lib/email");

    const actor = await db!.user.create({
      data: { email: "privacy-resend-fail-actor@example.com", name: "Actor" },
    });
    const user = await db!.user.create({
      data: { email: "privacy-resend-fail@example.com", name: "Resend Fail" },
    });
    createdUserIds.push(actor.id, user.id);

    vi.mocked(sendInviteEmail).mockRejectedValueOnce(new Error("Resend is down"));

    await expect(resendInvite(db!, actor.id, user.id)).resolves.toBeUndefined();
  });
});
