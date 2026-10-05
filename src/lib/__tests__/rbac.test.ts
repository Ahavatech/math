import { describe, expect, it } from "vitest";
import {
  hasPermission,
  hasRole,
  requireRole,
  requirePermission,
  canEditLecturerProfile,
  ROLE_PERMISSIONS,
  type SessionUser,
} from "../rbac";

function user(roles: SessionUser["roles"]): SessionUser {
  return { id: "user-1", roles, isActive: true };
}

describe("rbac permission matrix", () => {
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      it(`${role} has ${permission}`, () => {
        expect(hasPermission(user([role as SessionUser["roles"][number]]), permission)).toBe(
          true,
        );
      });
    }
  }

  it("SUPER_ADMIN has every permission (admin of everything)", () => {
    const allPermissions = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const permission of allPermissions) {
      expect(hasPermission(user(["SUPER_ADMIN"]), permission)).toBe(true);
    }
  });

  it("users.manage belongs only to SUPER_ADMIN", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as SessionUser["roles"][number][]) {
      if (role === "SUPER_ADMIN") continue;
      expect(hasPermission(user([role]), "users.manage")).toBe(false);
    }
  });

  it("LECTURER has no permission beyond own_profile.edit", () => {
    const u = user(["LECTURER"]);
    for (const permission of Object.values(ROLE_PERMISSIONS).flat()) {
      if (permission === "own_profile.edit") continue;
      expect(hasPermission(u, permission)).toBe(false);
    }
  });

  it("a user with multiple roles has the union of their permissions", () => {
    const u = user(["LECTURER", "REVIEWER"]);
    expect(hasPermission(u, "own_profile.edit")).toBe(true);
    expect(hasPermission(u, "journal.review")).toBe(true);
    expect(hasPermission(u, "journal.submit")).toBe(false);
  });
});

describe("hasRole / requireRole", () => {
  it("hasRole matches any of several roles", () => {
    expect(hasRole(user(["ADMIN"]), ["HOD", "ADMIN"])).toBe(true);
    expect(hasRole(user(["LECTURER"]), ["HOD", "ADMIN"])).toBe(false);
  });

  it("requireRole throws for a null user", () => {
    expect(() => requireRole(null, "ADMIN")).toThrow();
  });

  it("requireRole throws for an inactive user even with the right role", () => {
    const inactive: SessionUser = { id: "u", roles: ["SUPER_ADMIN"], isActive: false };
    expect(() => requireRole(inactive, "SUPER_ADMIN")).toThrow();
  });

  it("requireRole throws when the user lacks the role", () => {
    expect(() => requireRole(user(["LECTURER"]), "SUPER_ADMIN")).toThrow();
  });

  it("requireRole returns the user when authorized", () => {
    const u = user(["SUPER_ADMIN"]);
    expect(requireRole(u, "SUPER_ADMIN")).toBe(u);
  });
});

describe("requirePermission", () => {
  it("throws for a null user", () => {
    expect(() => requirePermission(null, "site.edit")).toThrow();
  });

  it("throws when the user lacks the permission", () => {
    expect(() => requirePermission(user(["LECTURER"]), "users.manage")).toThrow();
  });

  it("returns the user when authorized", () => {
    const u = user(["HOD"]);
    expect(requirePermission(u, "site.edit")).toBe(u);
  });
});

describe("canEditLecturerProfile", () => {
  it("allows the profile owner", () => {
    const u = user(["LECTURER"]);
    expect(canEditLecturerProfile(u, { userId: u.id })).toBe(true);
  });

  it("denies a lecturer editing someone else's profile", () => {
    const u = user(["LECTURER"]);
    expect(canEditLecturerProfile(u, { userId: "someone-else" })).toBe(false);
  });

  it("allows an admin with lecturers.manage to edit any profile", () => {
    const u = user(["ADMIN"]);
    expect(canEditLecturerProfile(u, { userId: "someone-else" })).toBe(true);
  });
});
