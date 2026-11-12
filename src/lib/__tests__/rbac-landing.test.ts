import { describe, expect, it } from "vitest";
import { defaultLandingPath } from "../rbac";

describe("defaultLandingPath", () => {
  it("sends admins, editors and lecturers to the admin area", () => {
    for (const role of ["SUPER_ADMIN", "HOD", "ADMIN", "LECTURER", "JOURNAL_EDITOR_IN_CHIEF", "JOURNAL_EDITOR"] as const) {
      expect(defaultLandingPath([role]), role).toBe("/admin");
    }
  });

  it("sends a reviewer to the reviewer dashboard and an author to their submissions", () => {
    expect(defaultLandingPath(["REVIEWER"])).toBe("/journal/reviewer");
    expect(defaultLandingPath(["AUTHOR"])).toBe("/journal/dashboard");
  });

  it("prefers the reviewer dashboard for someone who is both, and the admin area for staff who also author", () => {
    expect(defaultLandingPath(["AUTHOR", "REVIEWER"])).toBe("/journal/reviewer");
    expect(defaultLandingPath(["AUTHOR", "ADMIN"])).toBe("/admin");
    expect(defaultLandingPath(["REVIEWER", "LECTURER"])).toBe("/admin");
  });

  it("falls back to the admin area, which shows a minimal shell, when there are no roles", () => {
    expect(defaultLandingPath([])).toBe("/admin");
  });
});
