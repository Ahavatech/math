import { describe, expect, it } from "vitest";
import {
  loginSchema,
  acceptInviteSchema,
  resetPasswordSchema,
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "../auth";

const ok = "a-reasonable-passphrase";
const tooLong = "x".repeat(PASSWORD_MAX_LENGTH + 1);

describe("password length limits", () => {
  it("keeps the minimum of 10 and a sane maximum", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it("accepts new passwords between the limits", () => {
    expect(acceptInviteSchema.safeParse({ token: "t", password: ok }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token: "t", password: ok }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: ok }).success).toBe(true);
  });

  it("rejects new passwords that are too short", () => {
    const short = "x".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(acceptInviteSchema.safeParse({ token: "t", password: short }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "t", password: short }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: short }).success).toBe(false);
  });

  it("rejects new passwords that are absurdly long, so hashing cannot be used to tie up the server", () => {
    expect(acceptInviteSchema.safeParse({ token: "t", password: tooLong }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "t", password: tooLong }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: tooLong }).success).toBe(false);
  });

  it("caps the password a login attempt may submit, and the current password when changing it", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x".repeat(300) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@example.com", password: ok }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "x".repeat(300), newPassword: ok }).success).toBe(false);
  });
});
