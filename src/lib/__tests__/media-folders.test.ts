import { describe, expect, it } from "vitest";
import { hasPermission, type SessionUser } from "../rbac";
import { permissionForFolder, MEDIA_FOLDERS } from "../media-folders";

function user(roles: SessionUser["roles"]): SessionUser {
  return { id: "user-1", roles, isActive: true };
}

describe("permissionForFolder", () => {
  it("maps every folder to a permission", () => {
    for (const folder of MEDIA_FOLDERS) {
      expect(typeof permissionForFolder(folder)).toBe("string");
    }
  });

  it("the site folder (identity, hero, HOD) requires site.edit", () => {
    expect(permissionForFolder("site")).toBe("site.edit");
  });

  it("the research folder requires academics.manage, not site.edit", () => {
    expect(permissionForFolder("research")).toBe("academics.manage");
  });
});

describe("media folder access per role", () => {
  it("ADMIN can upload to research but not to the site folder", () => {
    const admin = user(["ADMIN"]);
    expect(hasPermission(admin, permissionForFolder("research"))).toBe(true);
    expect(hasPermission(admin, permissionForFolder("site"))).toBe(false);
  });

  it("ADMIN can still upload to lecturers, news, events and alumni folders", () => {
    const admin = user(["ADMIN"]);
    expect(hasPermission(admin, permissionForFolder("lecturers"))).toBe(true);
    expect(hasPermission(admin, permissionForFolder("news"))).toBe(true);
    expect(hasPermission(admin, permissionForFolder("events"))).toBe(true);
    expect(hasPermission(admin, permissionForFolder("alumni"))).toBe(true);
  });

  it("HOD can upload to every folder, including site", () => {
    const hod = user(["HOD"]);
    for (const folder of MEDIA_FOLDERS) {
      if (folder === "journal") continue; // HOD has no journal.edit by design
      expect(hasPermission(hod, permissionForFolder(folder))).toBe(true);
    }
  });

  it("SUPER_ADMIN can upload to every folder", () => {
    const superAdmin = user(["SUPER_ADMIN"]);
    for (const folder of MEDIA_FOLDERS) {
      expect(hasPermission(superAdmin, permissionForFolder(folder))).toBe(true);
    }
  });

  it("LECTURER cannot upload to any admin-managed folder", () => {
    const lecturer = user(["LECTURER"]);
    for (const folder of MEDIA_FOLDERS) {
      expect(hasPermission(lecturer, permissionForFolder(folder))).toBe(false);
    }
  });
});
