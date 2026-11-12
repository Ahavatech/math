import { describe, expect, it } from "vitest";
import { passwordProblem } from "../weak-password";

describe("passwordProblem", () => {
  it("refuses common passwords whatever the case or punctuation", () => {
    expect(passwordProblem("Password123")).toBe("common");
    expect(passwordProblem("QWERTYUIOP")).toBe("common");
    expect(passwordProblem("pass-word-123")).toBe("common");
    expect(passwordProblem("Mathematics12")).toBe("common");
  });

  it("refuses repetition and simple runs", () => {
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("repetitive");
    expect(passwordProblem("abababababab")).toBe("repetitive");
    expect(passwordProblem("abcdefghijkl")).toBe("repetitive");
    expect(passwordProblem("9876543210")).toBe("repetitive");
  });

  it("refuses a password that is little more than the email or name", () => {
    const identity = { email: "adebanji.adelowo@example.com", name: "Adebanji Adelowo" };
    expect(passwordProblem("adebanjiadelowo1", identity)).toBe("contains-identity");
    expect(passwordProblem("Adelowo2026", identity)).toBe("contains-identity");
    expect(passwordProblem("river-lantern-ocean-77", identity)).toBeNull();
  });

  it("accepts a long passphrase of unrelated words", () => {
    expect(passwordProblem("correct horse battery staple")).toBeNull();
  });
});
