"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { saveDraftReview, submitReview } from "@/server/services/review-submission";
import { setReviewerAcknowledgementOptIn } from "@/server/services/reviewer-dashboard";
import { saveDraftReviewSchema, submitReviewSchema } from "@/lib/validators/review";
import type { ReviewRecommendation } from "@prisma/client";

function sessionUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return { id: user.id, roles: user.roles, isActive: user.isActive ?? true };
}

export async function saveDraftReviewAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = saveDraftReviewSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    recommendation: formData.get("recommendation") || undefined,
    commentsToAuthor: formData.get("commentsToAuthor") || undefined,
    commentsToEditor: formData.get("commentsToEditor") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await saveDraftReview(db, sessionUser(user), parsed.data.assignmentId, {
      recommendation: parsed.data.recommendation as ReviewRecommendation | undefined,
      commentsToAuthor: parsed.data.commentsToAuthor,
      commentsToEditor: parsed.data.commentsToEditor,
    });
    revalidatePath(`/journal/reviewer/assignments/${parsed.data.assignmentId}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save draft" };
  }
}

export async function submitReviewAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = submitReviewSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    recommendation: formData.get("recommendation"),
    commentsToAuthor: formData.get("commentsToAuthor"),
    commentsToEditor: formData.get("commentsToEditor") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await submitReview(db, sessionUser(user), parsed.data.assignmentId, {
      recommendation: parsed.data.recommendation as ReviewRecommendation,
      commentsToAuthor: parsed.data.commentsToAuthor,
      commentsToEditor: parsed.data.commentsToEditor,
    });
    revalidatePath(`/journal/reviewer/assignments/${parsed.data.assignmentId}`);
    revalidatePath("/journal/reviewer");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit review" };
  }
}

export async function setAcknowledgementOptInAction(optIn: boolean): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    await setReviewerAcknowledgementOptIn(db, { id: user.id, roles: user.roles, isActive: user.isActive ?? true }, optIn);
    revalidatePath("/journal/reviewer");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update preference" };
  }
}
