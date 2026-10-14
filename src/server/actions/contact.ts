"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requirePermission, getCurrentUser } from "@/lib/rbac";
import { contextFromHeaders } from "@/server/services/audit";
import { contactSubmissionSchema } from "@/lib/validators/contact";
import { createContactMessage, setContactMessageStatus } from "@/server/services/contact";
import { sendContactNotification } from "@/server/services/contact-notification";
import { setSetting } from "@/server/services/site-settings";
import {
  checkHoneypot,
  verifyMinFillTime,
  contactIpRateLimiter,
  checkRecentDuplicateContact,
} from "@/server/services/contact-spam";

type ActionResult = { error?: string; success?: boolean };

const CALM_SUCCESS: ActionResult = { success: true };

/**
 * Handles the public contact form. Any spam signal (honeypot, a
 * tampered or too-fast fill timestamp, a tripped rate limit, or a
 * same-email-and-subject repeat within an hour) returns the exact same
 * success response as a genuine submission, without creating a row -
 * so a bot probing the form gets no signal of which check it failed,
 * or that it failed at all. Only a real input problem (bad email,
 * empty field) returns an actual error, since a human fixing a typo
 * needs to see it.
 */
export async function submitContactMessageAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  if (!contactIpRateLimiter.check(ip).allowed) {
    return CALM_SUCCESS;
  }

  if (!checkHoneypot(String(formData.get("website") ?? ""))) {
    return CALM_SUCCESS;
  }

  const formToken = String(formData.get("formToken") ?? "");
  const formRenderedAt = Number(formData.get("formRenderedAt") ?? 0);
  if (!verifyMinFillTime(formToken, formRenderedAt, env.AUTH_SECRET)) {
    return CALM_SUCCESS;
  }

  const parsed = contactSubmissionSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    type: formData.get("type"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    honeypot: formData.get("website") ?? "",
    formToken,
    formRenderedAt,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not send message" };
  }

  const isDuplicate = await checkRecentDuplicateContact(db, parsed.data.email, parsed.data.subject);
  if (isDuplicate) {
    return CALM_SUCCESS;
  }

  try {
    const message = await createContactMessage(db, parsed.data);
    revalidatePath("/admin/messages");
    await sendContactNotification(db, message);
    return CALM_SUCCESS;
  } catch {
    return CALM_SUCCESS;
  }
}

async function requireContactManage() {
  const user = await getCurrentUser();
  return requirePermission(user, "contact.manage");
}

export async function setContactMessageStatusAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireContactManage();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (status !== "NEW" && status !== "READ" && status !== "REPLIED" && status !== "ARCHIVED") {
    return { error: "Invalid status" };
  }
  try {
    await setContactMessageStatus(db, id, status, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/messages");
    revalidatePath(`/admin/messages/${id}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update" };
  }
}

export async function setContactNotificationEmailAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireContactManage();
  const value = String(formData.get("notificationEmail") ?? "").trim();
  try {
    await setSetting(db, "contact.notificationEmail", value, actor.id, contextFromHeaders(await headers()));
    revalidatePath("/admin/messages");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }
}
