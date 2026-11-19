"use server";

import { notifyReviewerInvited, notifyReviewerResponded } from "@/server/services/journal-notifications";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  inviteReviewer,
  revokeInvitation,
  acceptInvitation,
  declineInvitation,
} from "@/server/services/reviewer-invitation";
import { inviteReviewerSchema } from "@/lib/validators/review";
import { z } from "zod";

function sessionUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return { id: user.id, roles: user.roles, isActive: user.isActive ?? true };
}

export async function inviteReviewerAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = inviteReviewerSchema.safeParse({
    manuscriptId: formData.get("manuscriptId"),
    roundId: formData.get("roundId"),
    reviewerUserId: formData.get("reviewerUserId"),
  });
  if (!parsed.success) return;

  try {
    const { rawToken } = await inviteReviewer(db, sessionUser(user), parsed.data.manuscriptId, parsed.data.roundId, parsed.data.reviewerUserId);

    // Email the reviewer their accept and decline links, once the response has gone.
    // (The link holds the only copy of the token: only its hash is stored.)
    after(() =>
      notifyReviewerInvited(db, {
        manuscriptId: parsed.data.manuscriptId,
        reviewerUserId: parsed.data.reviewerUserId,
        rawToken,
      }),
    );

    revalidatePath(`/admin/journal/manuscripts/${parsed.data.manuscriptId}`);
  } catch {
    // errors surfaced via revalidatePath re-render; UI shows current state
  }
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const assignmentId = z.string().min(1).parse(formData.get("assignmentId"));
  const manuscriptId = z.string().min(1).parse(formData.get("manuscriptId"));

  try {
    await revokeInvitation(db, sessionUser(user), assignmentId);
    revalidatePath(`/admin/journal/manuscripts/${manuscriptId}`);
  } catch {
    // silent
  }
}

export async function acceptInvitationAction(rawToken: string): Promise<{ error?: string; manuscriptId?: string; roundId?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await acceptInvitation(db, sessionUser(user), rawToken);
  if (!result) return { error: "This invitation link is invalid, has already been used, or has expired." };

  after(() => notifyReviewerResponded(db, { manuscriptId: result.manuscriptId, accepted: true }));
  revalidatePath("/journal/reviewer");
  return { manuscriptId: result.manuscriptId, roundId: result.roundId };
}

export async function declineInvitationAction(rawToken: string, reason?: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await declineInvitation(db, sessionUser(user), rawToken, reason);
  if (!result) return { error: "This invitation link is invalid, has already been used, or has expired." };

  after(() => notifyReviewerResponded(db, { manuscriptId: result.manuscriptId, accepted: false }));
  return {};
}
