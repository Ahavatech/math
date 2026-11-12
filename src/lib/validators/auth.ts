import { z } from "zod";
import { Role } from "@prisma/client";

export const PASSWORD_MIN_LENGTH = 10;
// Argon2 hashing cost grows with input size, so an unbounded password field
// is a way to tie up the server. 128 is far beyond any real passphrase.
export const PASSWORD_MAX_LENGTH = 128;
const LOGIN_PASSWORD_MAX_LENGTH = 256;

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(LOGIN_PASSWORD_MAX_LENGTH),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: newPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: newPassword,
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  roles: z.array(z.enum(Role)).min(1, "Select at least one role"),
});

export const editUserRolesSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(Role)).min(1, "Select at least one role"),
});

export const setUserActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
});

export const resendInviteSchema = z.object({
  userId: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(LOGIN_PASSWORD_MAX_LENGTH),
  newPassword,
});
