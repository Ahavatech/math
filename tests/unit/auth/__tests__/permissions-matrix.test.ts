import { describe, expect, it } from "vitest";
import { hasPermission, type SessionUser } from "@/lib/rbac";

function user(roles: SessionUser["roles"]): SessionUser {
  return { id: "u", roles, isActive: true };
}

describe("journal.editorial permission", () => {
  it("SUPER_ADMIN has journal.editorial", () => {
    expect(hasPermission(user(["SUPER_ADMIN"]), "journal.editorial")).toBe(true);
  });
  it("JOURNAL_EDITOR_IN_CHIEF has journal.editorial", () => {
    expect(hasPermission(user(["JOURNAL_EDITOR_IN_CHIEF"]), "journal.editorial")).toBe(true);
  });
  it("JOURNAL_EDITOR has journal.editorial", () => {
    expect(hasPermission(user(["JOURNAL_EDITOR"]), "journal.editorial")).toBe(true);
  });
  it("HOD does NOT have journal.editorial", () => {
    expect(hasPermission(user(["HOD"]), "journal.editorial")).toBe(false);
  });
  it("ADMIN does NOT have journal.editorial", () => {
    expect(hasPermission(user(["ADMIN"]), "journal.editorial")).toBe(false);
  });
  it("AUTHOR does NOT have journal.editorial", () => {
    expect(hasPermission(user(["AUTHOR"]), "journal.editorial")).toBe(false);
  });
  it("REVIEWER does NOT have journal.editorial", () => {
    expect(hasPermission(user(["REVIEWER"]), "journal.editorial")).toBe(false);
  });
  it("LECTURER does NOT have journal.editorial", () => {
    expect(hasPermission(user(["LECTURER"]), "journal.editorial")).toBe(false);
  });
});

describe("journal.manuscripts.read permission", () => {
  it("SUPER_ADMIN has journal.manuscripts.read", () => {
    expect(hasPermission(user(["SUPER_ADMIN"]), "journal.manuscripts.read")).toBe(true);
  });
  it("HOD has journal.manuscripts.read", () => {
    expect(hasPermission(user(["HOD"]), "journal.manuscripts.read")).toBe(true);
  });
  it("JOURNAL_EDITOR_IN_CHIEF has journal.manuscripts.read", () => {
    expect(hasPermission(user(["JOURNAL_EDITOR_IN_CHIEF"]), "journal.manuscripts.read")).toBe(true);
  });
  it("JOURNAL_EDITOR has journal.manuscripts.read", () => {
    expect(hasPermission(user(["JOURNAL_EDITOR"]), "journal.manuscripts.read")).toBe(true);
  });
  it("ADMIN does NOT have journal.manuscripts.read", () => {
    expect(hasPermission(user(["ADMIN"]), "journal.manuscripts.read")).toBe(false);
  });
  it("AUTHOR does NOT have journal.manuscripts.read", () => {
    expect(hasPermission(user(["AUTHOR"]), "journal.manuscripts.read")).toBe(false);
  });
});
