"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { alumniSubmissionSchema } from "@/lib/validators/alumni";
import { validateAlumniLinkToken, consumeAlumniLinkOnSubmit } from "@/server/services/alumni-links";
import { registerPendingAlumniPhoto } from "@/server/services/alumni-photos";
import { submitAlumniEntry } from "@/server/services/alumni-entries";
import { createConfirmToken } from "@/lib/alumni-confirm-token";
import {
  checkHoneypot,
  verifyMinFillTime,
  checkRecentDuplicateSubmission,
  alumniIpRateLimiter,
  alumniLinkRateLimiter,
} from "@/server/services/alumni-spam";

type ActionResult = { error?: string; success?: boolean; confirmToken?: string; entryId?: string };

/**
 * Handles the public alumni submission form. Returns a single generic
 * success message regardless of whether a duplicate was detected.
 * On success, returns a short-lived HMAC confirmation token so the
 * confirmation page can show "people you might know".
 */
export async function submitAlumniEntryAction(
  token: string,
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  if (!alumniIpRateLimiter.check(ip).allowed) {
    return { error: "Too many submissions. Please try again later." };
  }

  const validation = await validateAlumniLinkToken(db, token);
  if (!validation.ok) {
    return { error: "This link is no longer valid. Please contact the department." };
  }

  if (!alumniLinkRateLimiter.check(validation.link.id).allowed) {
    return { error: "Too many submissions. Please try again later." };
  }

  if (!checkHoneypot(String(formData.get("website") ?? ""))) {
    return { error: "Could not submit. Please try again." };
  }

  const formToken = String(formData.get("formToken") ?? "");
  const formRenderedAt = Number(formData.get("formRenderedAt") ?? 0);
  if (!verifyMinFillTime(formToken, formRenderedAt, env.AUTH_SECRET)) {
    return { error: "Could not submit. Please try again." };
  }

  // Parse multi-programme data from form fields
  // programmes[0][level], programmes[0][graduationYear], programmes[0][entryYear], etc.
  const programmesRaw: { level: string; graduationYear: number; entryYear?: number }[] = [];
  let i = 0;
  while (formData.get(`programmes[${i}][level]`)) {
    const level = String(formData.get(`programmes[${i}][level]`));
    const graduationYear = Number(formData.get(`programmes[${i}][graduationYear]`));
    const entryYearRaw = formData.get(`programmes[${i}][entryYear]`);
    const entryYear = entryYearRaw ? Number(entryYearRaw) : undefined;
    programmesRaw.push({ level, graduationYear, entryYear });
    i++;
  }

  const parsed = alumniSubmissionSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    programmes: programmesRaw,
    organisation: formData.get("organisation") ?? "",
    roleOrField: formData.get("roleOrField") ?? "",
    city: formData.get("city") ?? "",
    country: formData.get("country") ?? "",
    note: formData.get("note") ?? "",
    industry: formData.get("industry") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
    consentPublicDisplay: formData.get("consentPublicDisplay") === "on" || formData.get("consentPublicDisplay") === "true",
    honeypot: formData.get("website") ?? "",
    formToken,
    formRenderedAt,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  void (await checkRecentDuplicateSubmission(db, parsed.data.email)); // side-effect handled inside submitAlumniEntry

  const publicId = formData.get("photoPublicId");
  let photoMediaId: string | null = null;
  if (publicId && String(publicId).trim()) {
    const asset = await registerPendingAlumniPhoto(db, { publicId: String(publicId) });
    photoMediaId = asset.id;
  }

  const consumed = await consumeAlumniLinkOnSubmit(db, validation.link.id);
  if (!consumed) {
    return { error: "This link is no longer valid. Please contact the department." };
  }

  const entry = await submitAlumniEntry(db, {
    linkId: validation.link.id,
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      programmes: parsed.data.programmes,
      organisation: parsed.data.organisation,
      roleOrField: parsed.data.roleOrField,
      city: parsed.data.city,
      country: parsed.data.country,
      note: parsed.data.note,
      industry: parsed.data.industry,
      linkedinUrl: parsed.data.linkedinUrl,
    },
    photoMediaId,
    consentPublicDisplay: parsed.data.consentPublicDisplay,
  });

  const confirmToken = await createConfirmToken(entry.id, env.AUTH_SECRET);

  revalidatePath("/admin/alumni");
  return { success: true, confirmToken, entryId: entry.id };
}
