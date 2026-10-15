import { createHash } from "node:crypto";

/**
 * An opaque, short, non-reversible reference for an alumni entry, safe
 * to put in a public URL (e.g. /contact?ref=...). Deliberately not the
 * database id itself (a cuid id would otherwise leak directly into a
 * query string that gets logged/cached), and not reversible back to
 * the id without looking it up in the database - findAlumniEntryByReference
 * does that lookup by recomputing this same hash for each candidate.
 */
export function alumniPublicReference(id: string): string {
  return createHash("sha256").update(`alumni-ref:${id}`).digest("base64url").slice(0, 10);
}

const REF_SHAPE = "[A-Za-z0-9_-]{10}";
const MESSAGE_REF_PATTERN = new RegExp(`Reference:\\s*(${REF_SHAPE})`);
const SUBJECT_REF_PATTERN = new RegExp(`Alumni entry (${REF_SHAPE})`);

/**
 * Pulls an alumni reference back out of a contact message's subject or
 * body - the exact shapes the public alumni card's "Request correction
 * or removal" link prefills (src/app/(site)/contact/contact-form.tsx):
 * subject "Alumni entry X", message starting "Reference: X". Checked
 * against both since either could be edited or removed by the sender.
 */
export function extractAlumniRef(subject: string, message: string): string | null {
  return message.match(MESSAGE_REF_PATTERN)?.[1] ?? subject.match(SUBJECT_REF_PATTERN)?.[1] ?? null;
}
