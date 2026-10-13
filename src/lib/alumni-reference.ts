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
