"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { NavLocation } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  createNavItem,
  updateNavItem,
  deleteNavItem,
  setNavItemVisibility,
  reorderNavItem,
} from "@/server/services/navigation";

type ActionResult = { error?: string; success?: boolean };

async function requireSiteEdit() {
  return requirePermission(await getCurrentUser(), "site.edit");
}

function revalidateNav() {
  revalidatePath("/admin/navigation");
  revalidatePath("/");
}

export async function createNavItemAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireSiteEdit();
    await createNavItem(
      db,
      actor.id,
      {
        label: String(formData.get("label") ?? ""),
        href: String(formData.get("href") ?? ""),
        location: String(formData.get("location") ?? "HEADER") as NavLocation,
        parentId: String(formData.get("parentId") ?? "") || null,
      },
      contextFromHeaders(await headers()),
    );
    revalidateNav();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add item" };
  }
}

export async function updateNavItemAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const actor = await requireSiteEdit();
    await updateNavItem(
      db,
      actor.id,
      String(formData.get("id") ?? ""),
      { label: String(formData.get("label") ?? ""), href: String(formData.get("href") ?? "") },
      contextFromHeaders(await headers()),
    );
    revalidateNav();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function deleteNavItemAction(formData: FormData): Promise<void> {
  const actor = await requireSiteEdit();
  await deleteNavItem(
    db,
    actor.id,
    String(formData.get("id") ?? ""),
    contextFromHeaders(await headers()),
  );
  revalidateNav();
}

export async function toggleNavItemVisibilityAction(formData: FormData): Promise<void> {
  const actor = await requireSiteEdit();
  await setNavItemVisibility(
    db,
    actor.id,
    String(formData.get("id") ?? ""),
    formData.get("isVisible") === "true",
    contextFromHeaders(await headers()),
  );
  revalidateNav();
}

export async function reorderNavItemAction(formData: FormData): Promise<void> {
  await requireSiteEdit();
  await reorderNavItem(
    db,
    String(formData.get("id") ?? ""),
    (String(formData.get("direction") ?? "up") as "up" | "down"),
  );
  revalidateNav();
}
