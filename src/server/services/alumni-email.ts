import "server-only";
import type { AlumniEntry } from "@prisma/client";
import { env } from "@/lib/env";
import { sendAlumniApprovedEmail } from "@/lib/email";
import { alumniPublicReference } from "@/lib/alumni-reference";

function siteOrigin(): string {
  // env.ts already sanitizes an empty-string env var to undefined
  // (see src/lib/env.ts), so `env.NEXT_PUBLIC_SITE_URL` is safe to
  // nullish-coalesce here, unlike raw `process.env.NEXT_PUBLIC_SITE_URL`.
  return env.NEXT_PUBLIC_SITE_URL ?? env.AUTH_URL;
}

/**
 * Fire-and-forget: a send failure must never block the approval that
 * triggered it, and is never surfaced to anyone outside a server log -
 * the approval itself already succeeded in the database by the time
 * this runs.
 */
export async function sendAlumniApprovalEmail(entry: AlumniEntry): Promise<void> {
  try {
    const ref = alumniPublicReference(entry.id);
    await sendAlumniApprovedEmail({
      to: entry.email,
      name: entry.fullName,
      directoryUrl: new URL("/alumni", siteOrigin()).toString(),
      contactUrl: new URL(`/contact?type=ALUMNI&ref=${ref}`, siteOrigin()).toString(),
    });
  } catch (error) {
    console.error("Failed to send alumni approval email", error);
  }
}
