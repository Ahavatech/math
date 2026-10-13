"use server";

import { db } from "@/lib/db";
import { createContactMessage } from "@/server/services/contact";

type ActionResult = { error?: string; success?: boolean };

export async function submitContactMessageAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createContactMessage(db, {
      name: formData.get("name"),
      email: formData.get("email"),
      type: formData.get("type"),
      subject: formData.get("subject"),
      message: formData.get("message"),
    });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send message" };
  }
}
