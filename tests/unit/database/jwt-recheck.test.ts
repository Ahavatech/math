import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getTestDb } from "./test-db";

const db = await getTestDb();

if (db === null) {
  console.warn("[tests/unit/database/jwt-recheck.test.ts] skipped: no reachable TEST_DATABASE_URL");
}

let createdUserIds: string[] = [];

describe.skipIf(db === null)("refreshTokenRoles (jwt recheck gate)", () => {
  afterEach(async () => {
    await db!.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db!.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds = [];
    vi.useRealTimers();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("does not hit the database before the 5-minute interval has elapsed", async () => {
    const { refreshTokenRoles, ROLES_RECHECK_INTERVAL_MS } = await import("@/auth");
    const user = await db!.user.create({
      data: { email: "jwt-recheck-early@example.com", name: "Early", isActive: true },
    });
    createdUserIds.push(user.id);

    const spy = vi.spyOn(db!.user, "findUnique");
    const token = {
      id: user.id,
      roles: ["LECTURER" as const],
      isActive: true,
      rolesCheckedAt: Date.now() - (ROLES_RECHECK_INTERVAL_MS - 1000),
    };

    const result = await refreshTokenRoles(token, db!);

    expect(spy).not.toHaveBeenCalled();
    expect(result).toEqual(token);
    spy.mockRestore();
  });

  it("re-reads isActive and roles from the database once the interval has elapsed", async () => {
    const { refreshTokenRoles, ROLES_RECHECK_INTERVAL_MS } = await import("@/auth");
    const user = await db!.user.create({
      data: { email: "jwt-recheck-stale@example.com", name: "Stale", isActive: true },
    });
    await db!.userRole.create({ data: { userId: user.id, role: "ADMIN" } });
    createdUserIds.push(user.id);

    const token = {
      id: user.id,
      roles: ["LECTURER" as const],
      isActive: true,
      rolesCheckedAt: Date.now() - (ROLES_RECHECK_INTERVAL_MS + 1000),
    };

    const result = await refreshTokenRoles(token, db!);

    expect(result.roles).toEqual(["ADMIN"]);
    expect(result.isActive).toBe(true);
    expect(result.rolesCheckedAt).toBeGreaterThan(token.rolesCheckedAt!);
  });

  it("a deactivated user's token stops reporting isActive after the recheck fires", async () => {
    const { refreshTokenRoles, ROLES_RECHECK_INTERVAL_MS } = await import("@/auth");
    const user = await db!.user.create({
      data: { email: "jwt-recheck-deactivated@example.com", name: "Deactivated", isActive: true },
    });
    createdUserIds.push(user.id);

    const staleToken = {
      id: user.id,
      roles: [],
      isActive: true,
      rolesCheckedAt: Date.now() - (ROLES_RECHECK_INTERVAL_MS + 1000),
    };

    // Within the window: still reports active (stale session, as designed).
    const freshToken = { ...staleToken, rolesCheckedAt: Date.now() };
    const withinWindow = await refreshTokenRoles(freshToken, db!);
    expect(withinWindow.isActive).toBe(true);

    await db!.user.update({ where: { id: user.id }, data: { isActive: false } });

    const afterRecheck = await refreshTokenRoles(staleToken, db!);
    expect(afterRecheck.isActive).toBe(false);
  });
});
