import "server-only";
import { db } from "@/lib/db";
import { journalIssueInputSchema } from "@/lib/validators/journal";
import { createRevision, listRevisions } from "@/server/services/revisions";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

export async function listIssuesAdmin() {
  const issues = await db.journalIssue.findMany({
    orderBy: [{ year: "desc" }, { volume: "desc" }, { number: "desc" }],
    include: { cover: true, _count: { select: { articles: true } } },
  });
  return issues;
}

export async function getIssueAdmin(id: string) {
  return db.journalIssue.findUniqueOrThrow({ where: { id }, include: { cover: true } });
}

export async function createIssue(
  input: unknown,
  coverId: string | null,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = journalIssueInputSchema.parse(input);
  const clash = await db.journalIssue.findUnique({ where: { volume_number: { volume: parsed.volume, number: parsed.number } } });
  if (clash) throw new Error(`Volume ${parsed.volume}, number ${parsed.number} already exists`);

  return db.$transaction(async (tx) => {
    const created = await tx.journalIssue.create({
      data: {
        ...parsed,
        coverId,
        publishedAt: parsed.status === "PUBLISHED" ? new Date() : null,
      },
    });
    await createRevision(tx, { entityType: "JournalIssue", entityId: created.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "journal.issue.create", entityType: "JournalIssue", entityId: created.id, summary: `Created issue vol. ${created.volume} no. ${created.number}` },
      context,
    );
    return created;
  });
}

export async function updateIssue(
  id: string,
  input: unknown,
  coverId: string | null,
  actorId: string,
  context?: AuditRequestContext,
) {
  const parsed = journalIssueInputSchema.parse(input);
  const existing = await db.journalIssue.findUniqueOrThrow({ where: { id } });

  if (parsed.volume !== existing.volume || parsed.number !== existing.number) {
    const clash = await db.journalIssue.findUnique({ where: { volume_number: { volume: parsed.volume, number: parsed.number } } });
    if (clash && clash.id !== id) throw new Error(`Volume ${parsed.volume}, number ${parsed.number} already exists`);
  }

  const becomingPublished = parsed.status === "PUBLISHED" && existing.status !== "PUBLISHED";

  return db.$transaction(async (tx) => {
    const updated = await tx.journalIssue.update({
      where: { id },
      data: {
        ...parsed,
        coverId,
        publishedAt: becomingPublished ? new Date() : existing.publishedAt,
      },
    });
    await createRevision(tx, { entityType: "JournalIssue", entityId: updated.id, snapshot: parsed, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "journal.issue.update", entityType: "JournalIssue", entityId: updated.id, summary: `Updated issue vol. ${updated.volume} no. ${updated.number}` },
      context,
    );
    return updated;
  });
}

export async function archiveIssue(id: string, actorId: string, context?: AuditRequestContext) {
  return db.$transaction(async (tx) => {
    const updated = await tx.journalIssue.update({ where: { id }, data: { status: "ARCHIVED" } });
    await logAction(
      tx,
      { actorId, action: "journal.issue.archive", entityType: "JournalIssue", entityId: id, summary: `Archived issue vol. ${updated.volume} no. ${updated.number}` },
      context,
    );
    return updated;
  });
}

export async function listIssueRevisions(id: string) {
  return listRevisions(db, "JournalIssue", id);
}

export type PublicIssueSummary = {
  id: string;
  volume: number;
  number: number;
  year: number;
  title: string | null;
  publishedAt: Date | null;
  cover: { url: string; alt: string | null } | null;
  articleCount: number;
};

export async function listIssuesPublic(): Promise<PublicIssueSummary[]> {
  try {
    const issues = await db.journalIssue.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ year: "desc" }, { volume: "desc" }, { number: "desc" }],
      select: {
        id: true,
        volume: true,
        number: true,
        year: true,
        title: true,
        publishedAt: true,
        cover: { select: { url: true, alt: true } },
        _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
      },
    });
    return issues.map((i) => ({
      id: i.id,
      volume: i.volume,
      number: i.number,
      year: i.year,
      title: i.title,
      publishedAt: i.publishedAt,
      cover: i.cover,
      articleCount: i._count.articles,
    }));
  } catch {
    return [];
  }
}

export async function getLatestPublicIssue(): Promise<PublicIssueSummary | null> {
  const issues = await listIssuesPublic();
  return issues[0] ?? null;
}

export async function getPublicIssueByVolumeNumber(volume: number, number: number) {
  try {
    return await db.journalIssue.findFirst({
      where: { volume, number, status: "PUBLISHED" },
      select: {
        id: true,
        volume: true,
        number: true,
        year: true,
        title: true,
        description: true,
        publishedAt: true,
        cover: { select: { url: true, alt: true } },
      },
    });
  } catch {
    return null;
  }
}
