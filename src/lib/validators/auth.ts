import { z } from "zod";
import { Role } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10, "Password must be at least 10 characters"),
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
