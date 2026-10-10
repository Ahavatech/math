import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { logAction, type AuditRequestContext } from "@/server/services/audit";

const identitySchema = z.object({
  name: z.string().min(1),
  tagline: z.string(),
  logoId: z.string().nullable(),
});

const hodSchema = z.object({
  name: z.string().min(1),
  title: z.string(),
  photoId: z.string().nullable(),
  message: z.string(), // sanitised rich-text HTML
});

const heroSchema = z.object({
  heading: z.string(),
  subheading: z.string(),
  imageId: z.string().nullable(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
});

const announcementSchema = z.object({
  enabled: z.boolean(),
  message: z.string(),
  href: z.string().nullable(),
});

const statModeSchema = z.object({
  mode: z.enum(["auto", "manual"]),
  manualValue: z.number().int().nonnegative().nullable(),
});

const statsSchema = z.object({
  staff: statModeSchema,
  alumni: statModeSchema,
  programmes: statModeSchema,
  researchAreas: statModeSchema,
});

const contactSchema = z.object({
  address: z.string(),
  phones: z.array(z.string()),
  email: z.string(),
  officeHours: z.string(),
  mapLat: z.number().nullable(),
  mapLng: z.number().nullable(),
});

const socialLinksSchema = z.record(z.string(), z.string());

const footerSchema = z.object({
  text: z.string(),
});

/**
 * Every settings key the admin UI can write, with its schema, default
 * and a human label. /admin/site is driven entirely from this map — no
 * ad hoc SiteSetting key is ever written outside it.
 */
export const SETTINGS_REGISTRY = {
  identity: {
    schema: identitySchema,
    default: { name: "Department of Mathematics", tagline: "", logoId: null },
    label: "Identity",
    section: "Identity",
  },
  "hod.welcomeAddress": {
    schema: hodSchema,
    default: { name: "", title: "", photoId: null, message: "" },
    label: "HOD",
    section: "HOD",
  },
  "homepage.hero": {
    schema: heroSchema,
    default: { heading: "", subheading: "", imageId: null, ctaLabel: "", ctaHref: "" },
    label: "Homepage hero",
    section: "Homepage hero",
  },
  "site.announcement": {
    schema: announcementSchema,
    default: { enabled: false, message: "", href: null },
    label: "Announcement bar",
    section: "Announcement bar",
  },
  "homepage.stats": {
    schema: statsSchema,
    default: {
      staff: { mode: "auto", manualValue: null },
      alumni: { mode: "auto", manualValue: null },
      programmes: { mode: "auto", manualValue: null },
      researchAreas: { mode: "auto", manualValue: null },
    },
    label: "Stats",
    section: "Stats",
  },
  "contact.details": {
    schema: contactSchema,
    default: { address: "", phones: [], email: "", officeHours: "", mapLat: null, mapLng: null },
    label: "Contact",
    section: "Contact",
  },
  "social.links": {
    schema: socialLinksSchema,
    default: {},
    label: "Social links",
    section: "Social links",
  },
  "footer.text": {
    schema: footerSchema,
    default: { text: "" },
    label: "Footer text",
    section: "Footer text",
  },
  // Admin-only marker for which Page slugs were auto-imported from the
  // old site and still need HOD review - never read by any public
  // route. Cleared for a slug the moment that page is saved.
  "pages.importFlags": {
    schema: z.record(z.string(), z.boolean()),
    default: {},
    label: "Page import flags",
    section: "Pages",
  },
  // Same pattern as pages.importFlags, keyed by slug, for the two
  // Stage 06 content types seeded from the live site.
  "programmes.importFlags": {
    schema: z.record(z.string(), z.boolean()),
    default: {},
    label: "Programme import flags",
    section: "Programmes",
  },
  "research.importFlags": {
    schema: z.record(z.string(), z.boolean()),
    default: {},
    label: "Research area import flags",
    section: "Research areas",
  },
} as const;

export type SettingsKey = keyof typeof SETTINGS_REGISTRY;
export type SettingValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_REGISTRY)[K]["schema"]>;

const PUBLIC_REVALIDATE_PATHS: Partial<Record<SettingsKey, string[]>> = {
  identity: ["/", "/about"],
  "hod.welcomeAddress": ["/", "/about"],
  "homepage.hero": ["/"],
  "site.announcement": ["/"],
  "homepage.stats": ["/"],
  "contact.details": ["/", "/contact"],
  "social.links": ["/"],
  "footer.text": ["/"],
};

export function revalidatePathsFor(key: SettingsKey): string[] {
  return PUBLIC_REVALIDATE_PATHS[key] ?? [];
}

export async function getSetting<K extends SettingsKey>(
  db: PrismaClient,
  key: K,
): Promise<SettingValue<K>> {
  const entry = SETTINGS_REGISTRY[key];
  const row = await db.siteSetting.findUnique({ where: { key } });
  if (!row) return entry.default as SettingValue<K>;

  const parsed = entry.schema.safeParse(row.value);
  return (parsed.success ? parsed.data : entry.default) as SettingValue<K>;
}

export async function setSetting<K extends SettingsKey>(
  db: PrismaClient,
  key: K,
  value: unknown,
  actorId: string | null,
  context?: AuditRequestContext,
): Promise<void> {
  const entry = SETTINGS_REGISTRY[key as SettingsKey];
  if (!entry) {
    throw new Error(`Unknown settings key: ${String(key)}`);
  }

  const parsed = entry.schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid value for ${String(key)}: ${parsed.error.message}`);
  }

  await db.$transaction(async (tx) => {
    await tx.siteSetting.upsert({
      where: { key },
      create: { key, value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
      update: { value: parsed.data as Prisma.InputJsonValue, updatedById: actorId },
    });

    await tx.contentRevision.create({
      data: {
        entityType: "SiteSetting",
        entityId: key,
        snapshot: parsed.data as Prisma.InputJsonValue,
        createdById: actorId,
      },
    });

    await logAction(
      tx,
      {
        actorId,
        action: "settings.save",
        entityType: "SiteSetting",
        entityId: key,
        summary: `Saved ${entry.label}`,
      },
      context,
    );
  });
}

export async function listRevisions(db: PrismaClient, key: SettingsKey) {
  return db.contentRevision.findMany({
    where: { entityType: "SiteSetting", entityId: key },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
}

export async function restoreSetting(
  db: PrismaClient,
  key: SettingsKey,
  revisionId: string,
  actorId: string | null,
  context?: AuditRequestContext,
): Promise<void> {
  const revision = await db.contentRevision.findUniqueOrThrow({ where: { id: revisionId } });
  if (revision.entityType !== "SiteSetting" || revision.entityId !== key) {
    throw new Error("Revision does not belong to this settings key");
  }

  await setSetting(db, key, revision.snapshot, actorId, context);
}
