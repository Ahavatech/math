"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, getCurrentUser } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  inviteUser,
  resendInvite,
  editUserRoles,
  setUserActive,
  SelfActionError,
} from "@/server/services/users";
import {
  inviteUserSchema,
  editUserRolesSchema,
  setUserActiveSchema,
  resendInviteSchema,
} from "@/lib/validators/auth";

type ActionResult = { error?: string };

async function requireUsersManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "users.manage");
}

export async function inviteUserAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireUsersManage();
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    roles: formData.getAll("roles"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await inviteUser(db, actor.id, parsed.data, contextFromHeaders(await headers()));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { error: "A user with that email already exists." };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  return {};
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  const actor = await requireUsersManage();
  const parsed = resendInviteSchema.parse({ userId: formData.get("userId") });

  await resendInvite(db, actor.id, parsed.userId, contextFromHeaders(await headers()));
  revalidatePath("/admin/users");
}

export async function editUserRolesAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireUsersManage();
  const parsed = editUserRolesSchema.safeParse({
    userId: formData.get("userId"),
    roles: formData.getAll("roles"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await editUserRoles(
      db,
      actor.id,
      parsed.data.userId,
      parsed.data.roles,
      contextFromHeaders(await headers()),
    );
  } catch (error) {
    if (error instanceof SelfActionError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  return {};
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  const actor = await requireUsersManage();
  const parsed = setUserActiveSchema.parse({
    userId: formData.get("userId"),
    isActive: formData.get("isActive") === "true",
  });

  // SelfActionError (e.g. a SUPER_ADMIN trying to deactivate themselves)
  // is intentionally left to propagate: the button that submits this
  // form is already disabled for that exact case, so reaching this
  // guard means the disabled attribute was bypassed, which is fine to
  // surface as a hard error rather than a quiet no-op.
  await setUserActive(
    db,
    actor.id,
    parsed.userId,
    parsed.isActive,
    contextFromHeaders(await headers()),
  );

  revalidatePath("/admin/users");
}
