"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePermission } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  createBoardMember,
  updateBoardMember,
  removeBoardMember,
  reorderBoardMember,
} from "@/server/services/journal-board";

type ActionResult = { error?: string; success?: boolean };

function parseInput(formData: FormData) {
  return {
    lecturerProfileId: (formData.get("lecturerProfileId") as string) || null,
    name: String(formData.get("name") ?? ""),
    affiliation: String(formData.get("affiliation") ?? ""),
    affiliationCountry: String(formData.get("affiliationCountry") ?? ""),
    orcid: String(formData.get("orcid") ?? ""),
    externalUrl: String(formData.get("externalUrl") ?? ""),
    roleTitle: String(formData.get("roleTitle") ?? ""),
    order: 0,
    isActive: formData.get("isActive") === "on",
  };
}

export async function createBoardMemberAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.manage");
  try {
    await createBoardMember(parseInput(formData), actor.id, contextFromHeaders(await headers()));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
  revalidatePath("/admin/journal/board");
  revalidatePath("/journal/editorial-board");
  return { success: true };
}

export async function updateBoardMemberAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.manage");
  const id = String(formData.get("id") ?? "");
  try {
    await updateBoardMember(id, parseInput(formData), actor.id, contextFromHeaders(await headers()));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
  revalidatePath("/admin/journal/board");
  revalidatePath("/journal/editorial-board");
  return { success: true };
}

export async function removeBoardMemberAction(id: string): Promise<void> {
  const user = await getCurrentUser();
  const actor = requirePermission(user, "journal.manage");
  await removeBoardMember(id, actor.id, contextFromHeaders(await headers()));
  revalidatePath("/admin/journal/board");
  revalidatePath("/journal/editorial-board");
}

export async function reorderBoardMemberAction(id: string, direction: "up" | "down"): Promise<void> {
  const user = await getCurrentUser();
  requirePermission(user, "journal.manage");
  await reorderBoardMember(id, direction);
  revalidatePath("/admin/journal/board");
  revalidatePath("/journal/editorial-board");
}
