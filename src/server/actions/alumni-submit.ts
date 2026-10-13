"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { alumniSubmissionSchema } from "@/lib/validators/alumni";
import { validateAlumniLinkToken, consumeAlumniLinkOnSubmit } from "@/server/services/alumni-links";
import { registerPendingAlumniPhoto } from "@/server/services/alumni-photos";
import { submitAlumniEntry } from "@/server/services/alumni-entries";
import {
  checkHoneypot,
  verifyMinFillTime,
  checkRecentDuplicateSubmission,
  alumniIpRateLimiter,
  alumniLinkRateLimiter,
} from "@/server/services/alumni-spam";

type ActionResult = { error?: string; success?: boolean };

/**
 * Handles the public, no-session alumni submission form. Returns a
 * single generic success message regardless of whether a duplicate
 * was detected, and never reveals which specific check failed beyond
 * a generic "could not submit" message - this is the one server
 * action in the app that runs against unauthenticated, anonymous
 * internet traffic, so every failure path is deliberately vague.
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

  const parsed = alumniSubmissionSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    level: formData.get("level"),
    graduationYear: Number(formData.get("graduationYear")),
    organisation: formData.get("organisation") ?? "",
    roleTitle: formData.get("roleTitle") ?? "",
    city: formData.get("city") ?? "",
    country: formData.get("country") ?? "",
    industry: formData.get("industry") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
    consent: formData.get("consent") === "on" || formData.get("consent") === "true",
    honeypot: formData.get("website") ?? "",
    formToken,
    formRenderedAt,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const isDuplicate = await checkRecentDuplicateSubmission(db, parsed.data.email, parsed.data.graduationYear);
  void isDuplicate; // not revealed to the submitter; the admin's dedupeKey flag is the review-side signal

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

  await submitAlumniEntry(db, {
    linkId: validation.link.id,
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      level: parsed.data.level,
      graduationYear: parsed.data.graduationYear,
      organisation: parsed.data.organisation,
      roleTitle: parsed.data.roleTitle,
      city: parsed.data.city,
      country: parsed.data.country,
      industry: parsed.data.industry,
      linkedinUrl: parsed.data.linkedinUrl,
    },
    photoMediaId,
  });

  revalidatePath("/admin/alumni");
  return { success: true };
}
