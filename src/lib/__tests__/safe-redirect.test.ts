import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "../safe-redirect";

describe("safeCallbackPath", () => {
  it("allows the places a signed-in user is sent back to", () => {
    expect(safeCallbackPath("/admin")).toBe("/admin");
    expect(safeCallbackPath("/admin/news/new")).toBe("/admin/news/new");
    expect(safeCallbackPath("/journal/dashboard")).toBe("/journal/dashboard");
    expect(safeCallbackPath("/journal/reviewer")).toBe("/journal/reviewer");
    expect(safeCallbackPath("/journal/submit/step2?draft=abc")).toBe("/journal/submit/step2?draft=abc");
    expect(safeCallbackPath("/journal/reviewer/invitation/tok_123?action=accept")).toBe(
      "/journal/reviewer/invitation/tok_123?action=accept",
    );
  });

  it("returns null for anything that is not a plain path on this site", () => {
    for (const bad of [
      "https://evil.example/admin",
      "//evil.example/admin",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "admin",
      "",
      "/admin\nSet-Cookie: x=1",
      "/admin\r\n",
      "/admin\u0000",
    ]) {
      expect(safeCallbackPath(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("returns null for paths outside the allowed areas", () => {
    expect(safeCallbackPath("/")).toBeNull();
    expect(safeCallbackPath("/login")).toBeNull();
    expect(safeCallbackPath("/api/auth/signout")).toBeNull();
    expect(safeCallbackPath("/adminx")).toBeNull();
    expect(safeCallbackPath("/journal")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(safeCallbackPath(undefined)).toBeNull();
    expect(safeCallbackPath(null)).toBeNull();
    expect(safeCallbackPath(["/admin"] as unknown as string)).toBeNull();
  });

  it("does not let an encoded sequence smuggle a host past the check", () => {
    expect(safeCallbackPath("/admin/../../evil")).toBeNull();
    expect(safeCallbackPath("/%2F%2Fevil.example")).toBeNull();
  });
});
