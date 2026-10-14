import "server-only";
import { db } from "@/lib/db";
import { editorialBoardMemberInputSchema } from "@/lib/validators/journal";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

export async function listBoardMembersAdmin() {
  return db.editorialBoardMember.findMany({
    orderBy: { order: "asc" },
    include: { lecturerProfile: { select: { fullName: true, status: true } }, photo: true },
  });
}

export async function createBoardMember(input: unknown, actorId: string, context?: AuditRequestContext) {
  const parsed = editorialBoardMemberInputSchema.parse(input);
  const max = await db.editorialBoardMember.aggregate({ _max: { order: true } });

  return db.$transaction(async (tx) => {
    const created = await tx.editorialBoardMember.create({
      data: { ...parsed, order: (max._max.order ?? -1) + 1 },
    });
    await logAction(
      tx,
      { actorId, action: "journal.board.create", entityType: "EditorialBoardMember", entityId: created.id, summary: `Added board member ${created.name}` },
      context,
    );
    return created;
  });
}

export async function updateBoardMember(id: string, input: unknown, actorId: string, context?: AuditRequestContext) {
  const parsed = editorialBoardMemberInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.editorialBoardMember.update({ where: { id }, data: parsed });
    await logAction(
      tx,
      { actorId, action: "journal.board.update", entityType: "EditorialBoardMember", entityId: id, summary: `Updated board member ${updated.name}` },
      context,
    );
    return updated;
  });
}

export async function removeBoardMember(id: string, actorId: string, context?: AuditRequestContext) {
  return db.$transaction(async (tx) => {
    const removed = await tx.editorialBoardMember.delete({ where: { id } });
    await logAction(
      tx,
      { actorId, action: "journal.board.remove", entityType: "EditorialBoardMember", entityId: id, summary: `Removed board member ${removed.name}` },
      context,
    );
    return removed;
  });
}

/** Swaps `order` with the adjacent sibling, globally (the board has no sub-scope to reorder within). */
export async function reorderBoardMember(id: string, direction: "up" | "down"): Promise<void> {
  const siblings = await db.editorialBoardMember.findMany({ orderBy: { order: "asc" } });
  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const target = siblings[index];
  const swapWith = siblings[swapIndex];
  await db.$transaction([
    db.editorialBoardMember.update({ where: { id: target.id }, data: { order: swapWith.order } }),
    db.editorialBoardMember.update({ where: { id: swapWith.id }, data: { order: target.order } }),
  ]);
}

export type PublicBoardMember = {
  id: string;
  name: string;
  roleTitle: string;
  affiliation: string | null;
  affiliationCountry: string | null;
  orcid: string | null;
  externalUrl: string | null;
  order: number;
  photo: { url: string; alt: string | null } | null;
};

/**
 * Active members only. A member linked to a lecturer profile disappears
 * the moment that profile is unpublished or its account deactivated -
 * this is computed at read time, never a stored flag, so it can't drift.
 */
export async function listBoardMembersPublic(): Promise<PublicBoardMember[]> {
  try {
    const members = await db.editorialBoardMember.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        roleTitle: true,
        affiliation: true,
        affiliationCountry: true,
        orcid: true,
        externalUrl: true,
        order: true,
        photo: { select: { url: true, alt: true } },
        lecturerProfile: {
          select: {
            status: true,
            fullName: true,
            photo: { select: { url: true, alt: true } },
            user: { select: { isActive: true } },
          },
        },
      },
    });

    return members
      .filter((m) => {
        if (!m.lecturerProfile) return true;
        return m.lecturerProfile.status === "PUBLISHED" && m.lecturerProfile.user.isActive;
      })
      .map((m) => ({
        id: m.id,
        name: m.lecturerProfile ? m.lecturerProfile.fullName : m.name,
        roleTitle: m.roleTitle,
        affiliation: m.affiliation,
        affiliationCountry: m.affiliationCountry,
        orcid: m.orcid,
        externalUrl: m.externalUrl,
        order: m.order,
        photo: m.lecturerProfile ? m.lecturerProfile.photo : m.photo,
      }));
  } catch {
    return [];
  }
}
