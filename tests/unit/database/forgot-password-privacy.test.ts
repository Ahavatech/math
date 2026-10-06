import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getTestDb } from "./test-db";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/email", () => ({
  sendInviteEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const db = await getTestDb();

if (db === null) {
  console.warn(
    "[tests/unit/database/forgot-password-privacy.test.ts] skipped: no reachable TEST_DATABASE_URL",
  );
}

let createdUserIds: string[] = [];

describe.skipIf(db === null)("forgotPasswordAction does not leak account existence", () => {
  afterEach(async () => {
    await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds = [];
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("returns the same response for an existing active user whose email send fails and for a nonexistent email", async () => {
    const { forgotPasswordAction } = await import("@/server/actions/auth");
    const { sendPasswordResetEmail } = await import("@/lib/email");
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error("Resend is down"));

    const user = await db!.user.create({
      data: {
        email: "forgot-privacy-exists@example.com",
        name: "Exists",
        isActive: true,
      },
    });
    createdUserIds.push(user.id);

    const existingForm = new FormData();
    existingForm.set("email", "forgot-privacy-exists@example.com");
    const existingResult = await forgotPasswordAction(undefined, existingForm);

    const nonexistentForm = new FormData();
    nonexistentForm.set("email", "forgot-privacy-does-not-exist@example.com");
    const nonexistentResult = await forgotPasswordAction(undefined, nonexistentForm);

    expect(existingResult).toEqual(nonexistentResult);
    expect(existingResult.message).toBeDefined();
    expect(existingResult.error).toBeUndefined();
  });
});
