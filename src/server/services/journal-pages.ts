import "server-only";
import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { createRevision, listRevisions } from "@/server/services/revisions";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

export const JOURNAL_PAGE_SLUGS = [
  "journal-about",
  "journal-guidelines",
  "journal-call-for-papers",
  "journal-policies",
] as const;
export type JournalPageSlug = (typeof JOURNAL_PAGE_SLUGS)[number];

/** The exact sentinel the seed writes for an unreviewed journal page. Never shown publicly. */
export const JOURNAL_PAGE_PLACEHOLDER_BODY = "<p>Needs editor input.</p>";

export function isJournalPagePlaceholder(body: string): boolean {
  return body.trim() === JOURNAL_PAGE_PLACEHOLDER_BODY;
}

export async function listJournalPagesAdmin() {
  return db.page.findMany({
    where: { slug: { in: [...JOURNAL_PAGE_SLUGS] } },
    orderBy: { slug: "asc" },
  });
}

export async function getJournalPageAdmin(id: string) {
  return db.page.findUniqueOrThrow({ where: { id } });
}

export async function updateJournalPage(
  id: string,
  input: { title: string; body: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" },
  actorId: string,
  context?: AuditRequestContext,
) {
  const sanitizedBody = sanitizeRichText(input.body);
  return db.$transaction(async (tx) => {
    const updated = await tx.page.update({
      where: { id },
      data: { title: input.title, body: sanitizedBody, status: input.status },
    });
    await createRevision(tx, {
      entityType: "Page",
      entityId: updated.id,
      snapshot: { title: updated.title, body: updated.body, status: updated.status },
      createdById: actorId,
    });
    await logAction(
      tx,
      { actorId, action: "journal.page.save", entityType: "Page", entityId: updated.id, summary: `Saved journal page "${updated.title}"` },
      context,
    );
    return updated;
  });
}

export async function listJournalPageRevisions(id: string) {
  return listRevisions(db, "Page", id);
}

/** Never returns a page that is still empty or exactly the seeded placeholder sentinel. */
export async function getJournalPagePublic(slug: JournalPageSlug) {
  try {
    const page = await db.page.findFirst({ where: { slug, status: "PUBLISHED" } });
    if (!page) return null;
    if (!page.body.trim() || isJournalPagePlaceholder(page.body)) return null;
    return page;
  } catch {
    return null;
  }
}
