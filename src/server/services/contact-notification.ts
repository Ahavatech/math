import "server-only";
import type { ContactMessage, PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { sendContactNotificationEmail } from "@/lib/email";
import { getSetting } from "./site-settings";

function siteOrigin(): string {
  return env.NEXT_PUBLIC_SITE_URL ?? env.AUTH_URL;
}

/**
 * Fire-and-forget: a send failure must never block the submission that
 * triggered it. Sends nothing when no notification address is set
 * (the default). Deliberately never includes the message body in the
 * notification, only who sent it, the type and a link to read it in
 * the admin inbox - see docs/prompts/10-student-resources.md section 0.
 */
export async function sendContactNotification(db: PrismaClient, message: ContactMessage): Promise<void> {
  try {
    const to = await getSetting(db, "contact.notificationEmail");
    if (!to) return;

    await sendContactNotificationEmail({
      to,
      senderName: message.name,
      type: message.type,
      adminUrl: new URL(`/admin/messages/${message.id}`, siteOrigin()).toString(),
    });
  } catch (error) {
    console.error("Failed to send contact notification email", error);
  }
}
