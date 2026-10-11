import { describe, expect, it, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { changeOwnPassword, WrongPasswordError } from "../account";
import { hashPassword } from "@/lib/password";

const db = await getTestDb();

describe.skipIf(db === null)("changeOwnPassword", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    if (createdUserIds.length) {
      await db!.auditLog.deleteMany({ where: { entityType: "User", entityId: { in: createdUserIds } } });
      await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  async function makeUser(email: string, password: string) {
    const passwordHash = await hashPassword(password);
    const user = await db!.user.create({ data: { email, name: "Test User", passwordHash } });
    createdUserIds.push(user.id);
    return user;
  }

  it("rejects when the current password is wrong", async () => {
    const user = await makeUser("change-pw-wrong@example.com", "correct-password-1");

    await expect(
      changeOwnPassword(db!, user.id, { currentPassword: "not-the-right-one", newPassword: "new-password-123" }),
    ).rejects.toThrow(WrongPasswordError);

    const unchanged = await db!.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged.passwordChangedAt).toBeNull();
  });

  it("changes the password and stamps passwordChangedAt on success", async () => {
    const user = await makeUser("change-pw-ok@example.com", "correct-password-1");

    await changeOwnPassword(db!, user.id, {
      currentPassword: "correct-password-1",
      newPassword: "brand-new-password-1",
    });

    const updated = await db!.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.passwordChangedAt).not.toBeNull();
    expect(updated.passwordHash).not.toBe(user.passwordHash);

    const log = await db!.auditLog.findFirst({ where: { entityType: "User", entityId: user.id } });
    expect(log?.action).toBe("user.change_password");
  });
});
