"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { registerAuthorSchema } from "@/lib/validators/manuscript";
import { registerAuthor } from "@/server/services/author-registration";
import { checkHoneypot, verifyMinFillTime } from "@/lib/form-spam";
import { journalRegisterIpRateLimiter } from "@/lib/rate-limit";

type ActionResult = { error?: string; success?: boolean };

export async function registerAuthorAction(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  if (!journalRegisterIpRateLimiter.check(ip).allowed) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    privacyConsent: formData.get("privacyConsent") === "true" ? true : formData.get("privacyConsent"),
    honeypot: String(formData.get("website") ?? ""),
    formToken: String(formData.get("formToken") ?? ""),
    formRenderedAt: Number(formData.get("formRenderedAt") ?? 0),
  };

  if (!checkHoneypot(raw.honeypot)) {
    return { success: true };
  }

  if (!verifyMinFillTime(raw.formToken, raw.formRenderedAt, env.AUTH_SECRET)) {
    return { error: "Form submitted too quickly. Please try again." };
  }

  const parsed = registerAuthorSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { error: first?.message ?? "Invalid input." };
  }

  await registerAuthor(db, {
    name: parsed.data.name,
    email: parsed.data.email,
    passwordPlaintext: parsed.data.password,
    ip,
  });

  return { success: true };
}
