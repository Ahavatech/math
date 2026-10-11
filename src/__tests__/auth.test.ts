import { describe, expect, it, vi } from "vitest";
import { refreshTokenRoles, ROLES_RECHECK_INTERVAL_MS } from "@/auth";
import type { db as DbType } from "@/lib/db";

function makeDb(user: { isActive: boolean; roles: { role: string }[]; passwordChangedAt: Date | null } | null) {
  return { user: { findUnique: vi.fn().mockResolvedValue(user) } } as unknown as typeof DbType;
}

describe("refreshTokenRoles", () => {
  it("skips the database read inside the recheck interval", async () => {
    const db = makeDb({ isActive: true, roles: [], passwordChangedAt: null });
    const token = { id: "u1", rolesCheckedAt: Date.now() };

    const result = await refreshTokenRoles(token, db);

    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(result).toBe(token);
  });

  it("re-reads isActive and roles once the interval has passed", async () => {
    const db = makeDb({ isActive: true, roles: [{ role: "LECTURER" }], passwordChangedAt: null });
    const token = { id: "u1", rolesCheckedAt: Date.now() - ROLES_RECHECK_INTERVAL_MS - 1 };

    const result = await refreshTokenRoles(token, db);

    expect(result.isActive).toBe(true);
    expect(result.roles).toEqual(["LECTURER"]);
  });

  it("marks the token inactive when the password changed after login", async () => {
    const changedAt = new Date();
    const db = makeDb({ isActive: true, roles: [], passwordChangedAt: changedAt });
    const token = {
      id: "u1",
      rolesCheckedAt: Date.now() - ROLES_RECHECK_INTERVAL_MS - 1,
      passwordChangedAt: changedAt.getTime() - 60_000, // the value stamped at a now-stale login
    };

    const result = await refreshTokenRoles(token, db);

    expect(result.isActive).toBe(false);
  });

  it("stays active when passwordChangedAt matches what was stamped at login", async () => {
    const changedAt = new Date();
    const db = makeDb({ isActive: true, roles: [], passwordChangedAt: changedAt });
    const token = {
      id: "u1",
      rolesCheckedAt: Date.now() - ROLES_RECHECK_INTERVAL_MS - 1,
      passwordChangedAt: changedAt.getTime(),
    };

    const result = await refreshTokenRoles(token, db);

    expect(result.isActive).toBe(true);
  });
});
