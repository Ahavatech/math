import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getTestDb } from "./test-db";
import { issueToken, consumeToken } from "../../../src/server/services/tokens";

const db = await getTestDb();

if (db === null) {
  console.warn("[tests/unit/database/tokens.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

let createdUserIds: string[] = [];

describe.skipIf(db === null)("tokens service", () => {
  afterEach(async () => {
    await db!.userToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds = [];
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  async function makeUser(email: string) {
    const user = await db!.user.create({ data: { email, name: "Token Test User" } });
    createdUserIds.push(user.id);
    return user;
  }

  it("stores only a sha256 hash of the token, never the plaintext", async () => {
    const user = await makeUser("tokens-hash-only@example.com");
    const { token } = await issueToken(db!, user.id, "INVITE");

    const rows = await db!.userToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sets INVITE tokens to expire in 7 days and PASSWORD_RESET tokens in 1 hour", async () => {
    const user = await makeUser("tokens-expiry@example.com");
    const before = Date.now();

    const invite = await issueToken(db!, user.id, "INVITE");
    const inviteRow = await db!.userToken.findUniqueOrThrow({ where: { id: invite.id } });
    const inviteDays = (inviteRow.expiresAt.getTime() - before) / 86_400_000;
    expect(inviteDays).toBeGreaterThan(6.9);
    expect(inviteDays).toBeLessThan(7.1);

    const reset = await issueToken(db!, user.id, "PASSWORD_RESET");
    const resetRow = await db!.userToken.findUniqueOrThrow({ where: { id: reset.id } });
    const resetHours = (resetRow.expiresAt.getTime() - before) / 3_600_000;
    expect(resetHours).toBeGreaterThan(0.9);
    expect(resetHours).toBeLessThan(1.1);
  });

  it("consumes a valid token exactly once", async () => {
    const user = await makeUser("tokens-single-use@example.com");
    const { token } = await issueToken(db!, user.id, "PASSWORD_RESET");

    const first = await consumeToken(db!, token, "PASSWORD_RESET");
    expect(first?.userId).toBe(user.id);

    const second = await consumeToken(db!, token, "PASSWORD_RESET");
    expect(second).toBeNull();
  });

  it("rejects an expired token", async () => {
    const user = await makeUser("tokens-expired@example.com");
    const { token, id } = await issueToken(db!, user.id, "PASSWORD_RESET");
    await db!.userToken.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await consumeToken(db!, token, "PASSWORD_RESET");
    expect(result).toBeNull();
  });

  it("rejects a token of the wrong type", async () => {
    const user = await makeUser("tokens-wrong-type@example.com");
    const { token } = await issueToken(db!, user.id, "INVITE");

    const result = await consumeToken(db!, token, "PASSWORD_RESET");
    expect(result).toBeNull();
  });

  it("invalidates earlier unused tokens of the same type when a new one is issued", async () => {
    const user = await makeUser("tokens-invalidate@example.com");
    const older = await issueToken(db!, user.id, "INVITE");
    const newer = await issueToken(db!, user.id, "INVITE");

    const olderResult = await consumeToken(db!, older.token, "INVITE");
    expect(olderResult).toBeNull();

    const newerResult = await consumeToken(db!, newer.token, "INVITE");
    expect(newerResult?.userId).toBe(user.id);
  });
});
