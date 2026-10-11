import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { AlumniLink, Prisma, PrismaClient } from "@prisma/client";
import { logAction, type AuditRequestContext } from "./audit";

type Db = PrismaClient | Prisma.TransactionClient;

const DEFAULT_EXPIRY_DAYS = 90;
const MAX_COHORT_LINKS = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
}

export function alumniSubmitUrl(token: string): string {
  return `${siteOrigin()}/alumni/submit/${token}`;
}

export async function createAlumniLink(
  db: Db,
  input: { label: string; cohortYear?: number | null; expiresInDays?: number; maxUses?: number | null },
  actorId: string,
  context?: AuditRequestContext,
): Promise<{ link: AlumniLink; token: string }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000);

  const link = await db.alumniLink.create({
    data: {
      label: input.label,
      cohortYear: input.cohortYear ?? null,
      expiresAt,
      maxUses: input.maxUses ?? null,
      tokenHash,
      createdById: actorId,
    },
  });

  await logAction(
    db,
    { actorId, action: "alumni_link.create", entityType: "AlumniLink", entityId: link.id, summary: "Created alumni link" },
    context,
  );

  return { link, token };
}

export async function createCohortLinks(
  db: Db,
  years: number[],
  actorId: string,
  context?: AuditRequestContext,
): Promise<{ linkId: string; label: string; year: number; url: string }[]> {
  if (years.length > MAX_COHORT_LINKS) {
    throw new Error(`Cannot create more than ${MAX_COHORT_LINKS} links in one action`);
  }

  const results: { linkId: string; label: string; year: number; url: string }[] = [];
  for (const year of years) {
    const label = `Cohort ${year}`;
    const { link, token } = await createAlumniLink(db, { label, cohortYear: year }, actorId, context);
    results.push({ linkId: link.id, label, year, url: alumniSubmitUrl(token) });
  }
  return results;
}

export async function regenerateAlumniLinkToken(
  db: Db,
  id: string,
  actorId: string,
  context?: AuditRequestContext,
): Promise<{ token: string }> {
  const token = generateToken();
  const tokenHash = hashToken(token);

  await db.alumniLink.update({ where: { id }, data: { tokenHash } });
  await logAction(
    db,
    { actorId, action: "alumni_link.regenerate", entityType: "AlumniLink", entityId: id, summary: "Regenerated alumni link token" },
    context,
  );

  return { token };
}

export async function setAlumniLinkActive(
  db: Db,
  id: string,
  isActive: boolean,
  actorId: string,
  context?: AuditRequestContext,
): Promise<AlumniLink> {
  const updated = await db.alumniLink.update({ where: { id }, data: { isActive } });
  await logAction(
    db,
    {
      actorId,
      action: isActive ? "alumni_link.activate" : "alumni_link.deactivate",
      entityType: "AlumniLink",
      entityId: id,
      summary: isActive ? "Reactivated alumni link" : "Deactivated alumni link",
    },
    context,
  );
  return updated;
}

export async function listAlumniLinksAdmin(db: PrismaClient) {
  return db.alumniLink.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });
}

/**
 * Validates a raw token against the stored hash. Returns a uniform
 * `{ok:false}` for every failure reason (wrong token, expired,
 * inactive, exhausted) so a caller - and therefore an attacker probing
 * the form - can never distinguish one reason from another.
 */
export async function validateAlumniLinkToken(
  db: Db,
  rawToken: string,
): Promise<{ ok: true; link: AlumniLink } | { ok: false }> {
  const tokenHash = hashToken(rawToken);
  const link = await db.alumniLink.findUnique({ where: { tokenHash } });

  if (!link) return { ok: false };
  if (!link.isActive) return { ok: false };
  if (link.expiresAt.getTime() < Date.now()) return { ok: false };
  if (link.maxUses !== null && link.useCount >= link.maxUses) return { ok: false };

  return { ok: true, link };
}

/**
 * Atomically increments useCount and stamps lastUsedAt, enforcing
 * maxUses inside the same SQL statement so two concurrent submissions
 * against a link with maxUses:1 cannot both succeed. Returns whether
 * the increment actually happened.
 */
export async function consumeAlumniLinkOnSubmit(db: Db, linkId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "AlumniLink"
    SET "useCount" = "useCount" + 1, "lastUsedAt" = now()
    WHERE id = ${linkId}
      AND "isActive" = true
      AND "expiresAt" > now()
      AND ("maxUses" IS NULL OR "useCount" < "maxUses")
    RETURNING id
  `;
  return rows.length > 0;
}
