"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, hasRole, requirePermission, UnauthorizedError } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import {
  approveAlumniEntry,
  rejectAlumniEntry,
  withdrawAlumniEntry,
  restoreWithdrawnAlumniEntry,
  eraseAlumniEntry,
  markDuplicate,
  bulkApprove,
  updateAlumniEntry,
  setFeatured,
} from "@/server/services/alumni-entries";
import { sendAlumniApprovalEmail } from "@/server/services/alumni-email";

type ActionResult = { error?: string; success?: boolean };

async function requireAlumniReview() {
  const user = await getCurrentUser();
  return requirePermission(user, "alumni.review");
}

function revalidateAlumniPaths() {
  revalidatePath("/admin/alumni");
  revalidatePath("/alumni");
  revalidatePath("/");
}

export async function approveAlumniEntryAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  const feature = formData.get("feature") === "true";
  try {
    const entry = await approveAlumniEntry(db, id, actor.id, { feature }, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    await sendAlumniApprovalEmail(entry);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not approve" };
  }
}

export async function rejectAlumniEntryAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "A reason is required" };
  try {
    await rejectAlumniEntry(db, id, reason, actor.id, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not reject" };
  }
}

export async function withdrawAlumniEntryAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  try {
    await withdrawAlumniEntry(db, id, actor.id, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not withdraw" };
  }
}

export async function restoreAlumniEntryAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  try {
    await restoreWithdrawnAlumniEntry(db, id, actor.id, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not restore" };
  }
}

/** HOD or SUPER_ADMIN only - checked here in addition to the UI gating the button. */
export async function eraseAlumniEntryAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    requirePermission(user, "alumni.review");
  } catch (error) {
    if (error instanceof UnauthorizedError) return { error: "Not signed in" };
    throw error;
  }
  if (!user || !hasRole(user, ["HOD", "SUPER_ADMIN"])) {
    return { error: "Only the HOD or a super admin can erase an alumni entry" };
  }

  const id = String(formData.get("id") ?? "");
  try {
    await eraseAlumniEntry(db, id, user.id, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not erase" };
  }
}

export async function markDuplicateAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  const existingId = String(formData.get("existingId") ?? "");
  const action = formData.get("action");
  if (action !== "separate" && action !== "replace" && action !== "reject") {
    return { error: "Invalid action" };
  }
  try {
    await markDuplicate(db, id, existingId, action, actor.id, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function bulkApproveAlumniEntriesAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const ids = formData.getAll("ids").map(String);
  try {
    await bulkApprove(db, ids, actor.id, contextFromHeaders(await headers()));
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not bulk approve" };
  }
}

export async function updateAlumniEntryAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  try {
    await updateAlumniEntry(
      db,
      id,
      {
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
        organisation: String(formData.get("organisation") ?? ""),
        roleOrField: String(formData.get("roleOrField") ?? ""),
        city: String(formData.get("city") ?? ""),
        country: String(formData.get("country") ?? ""),
        note: String(formData.get("note") ?? ""),
        industry: String(formData.get("industry") ?? ""),
        linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
      },
      actor.id,
      contextFromHeaders(await headers()),
    );
    revalidateAlumniPaths();
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}

export async function setAlumniFeaturedAction(formData: FormData): Promise<void> {
  const actor = await requireAlumniReview();
  const id = String(formData.get("id") ?? "");
  const isFeatured = formData.get("isFeatured") === "true";
  await setFeatured(db, id, isFeatured, actor.id, contextFromHeaders(await headers()));
  revalidateAlumniPaths();
}
