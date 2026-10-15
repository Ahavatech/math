"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { recordDecision } from "@/server/services/editorial-decision";
import { recordDecisionSchema } from "@/lib/validators/review";
import type { EditorialDecisionType } from "@prisma/client";

function sessionUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return { id: user.id, roles: user.roles, isActive: user.isActive ?? true };
}

export async function recordDecisionAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = recordDecisionSchema.safeParse({
    manuscriptId: formData.get("manuscriptId"),
    decision: formData.get("decision"),
    letterHtml: formData.get("letterHtml"),
    allowOverride: formData.get("allowOverride") === "true",
    overrideReason: formData.get("overrideReason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await recordDecision(db, sessionUser(user), parsed.data.manuscriptId, {
      decision: parsed.data.decision as EditorialDecisionType,
      letterHtml: parsed.data.letterHtml,
      allowOverride: parsed.data.allowOverride,
      overrideReason: parsed.data.overrideReason,
    });
    revalidatePath(`/admin/journal/manuscripts/${parsed.data.manuscriptId}`);
    revalidatePath("/admin/journal/manuscripts");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record decision" };
  }
}
