import type { PrismaClient } from "@prisma/client";
import {
  ABOUT_BODY,
  HANDBOOK_CHILDREN,
  HANDBOOK_PARENT,
  HISTORY_BODY,
  MISSION_VISION_BODY,
  STUDENT_ASSOCIATION_DEFAULT,
} from "./handbook-content";
import { normalizeSearchText } from "./search-text";

type Db = Pick<PrismaClient, "page" | "handbookPage" | "siteSetting" | "contentRevision">;

const FINAL_PAGES = [
  { slug: "about", title: "About", body: ABOUT_BODY },
  { slug: "mission-vision", title: "Mission and Vision", body: MISSION_VISION_BODY },
  { slug: "history", title: "History", body: HISTORY_BODY },
] as const;

/** True for the text the seed used to ship (a "[PLACEHOLDER ...]" note), which has never been edited. */
export function isOldPlaceholderBody(body: string): boolean {
  return body.includes("[PLACEHOLDER");
}

/**
 * Puts the handbook-based text into a database: the About, Mission and Vision
 * and History pages (published), the student handbook's introduction chapter,
 * and the student association link.
 *
 * It never overwrites the department's own work: a page is replaced only when
 * it still holds the old placeholder text (or `force` is set), a handbook page
 * is created only if its address is free, and the association link is set only
 * if none has been entered. Safe to run again and again.
 */
export async function applyHandbookContent(db: Db, options: { force?: boolean } = {}): Promise<string[]> {
  const log: string[] = [];

  // 1. The three department pages.
  for (const final of FINAL_PAGES) {
    const existing = await db.page.findUnique({ where: { slug: final.slug } });
    if (!existing) {
      await db.page.create({ data: { slug: final.slug, title: final.title, body: final.body, status: "PUBLISHED" } });
      log.push(`Created the ${final.title} page.`);
    } else if (existing.body === final.body && existing.status === "PUBLISHED") {
      log.push(`The ${final.title} page already has this text.`);
    } else if (options.force || isOldPlaceholderBody(existing.body)) {
      await db.contentRevision.create({
        data: { entityType: "Page", entityId: existing.id, snapshot: { title: existing.title, body: existing.body } },
      });
      await db.page.update({
        where: { slug: final.slug },
        data: { title: final.title, body: final.body, status: "PUBLISHED" },
      });
      log.push(`Replaced the ${final.title} page text and published it.`);
    } else {
      log.push(`The ${final.title} page has been edited; left alone (use --force to replace it).`);
    }
  }

  // The "imported, needs review" badges no longer apply to these pages.
  const flagRow = await db.siteSetting.findUnique({ where: { key: "pages.importFlags" } });
  if (flagRow) {
    const flags = { ...(flagRow.value as Record<string, boolean>) };
    let changed = false;
    for (const final of FINAL_PAGES) {
      if (flags[final.slug]) {
        delete flags[final.slug];
        changed = true;
      }
    }
    if (changed) {
      await db.siteSetting.update({ where: { key: "pages.importFlags" }, data: { value: flags } });
      log.push("Removed the review badges from these pages.");
    }
  }

  // 2. The handbook's introduction chapter, published.
  const make = (page: { title: string; summary: string; body: string }) => ({
    title: page.title,
    summary: page.summary,
    body: page.body,
    searchText: normalizeSearchText(`${page.title} ${page.summary} ${page.body}`),
    status: "PUBLISHED" as const,
  });

  let parent = await db.handbookPage.findUnique({ where: { slug: HANDBOOK_PARENT.slug } });
  if (!parent) {
    parent = await db.handbookPage.create({ data: { slug: HANDBOOK_PARENT.slug, order: 0, ...make(HANDBOOK_PARENT) } });
    log.push(`Created the handbook chapter "${HANDBOOK_PARENT.title}".`);
  } else {
    log.push(`The handbook chapter "${HANDBOOK_PARENT.title}" already exists; left alone.`);
  }
  for (const [index, child] of HANDBOOK_CHILDREN.entries()) {
    const exists = await db.handbookPage.findUnique({ where: { slug: child.slug } });
    if (exists) continue;
    await db.handbookPage.create({ data: { slug: child.slug, parentId: parent.id, order: index, ...make(child) } });
    log.push(`Created the handbook page "${child.title}".`);
  }

  // 3. The student association's website.
  const assoc = await db.siteSetting.findUnique({ where: { key: "students.association" } });
  const currentUrl = (assoc?.value as { url?: string } | undefined)?.url ?? "";
  if (!assoc) {
    await db.siteSetting.create({ data: { key: "students.association", value: STUDENT_ASSOCIATION_DEFAULT } });
    log.push("Added the student association link.");
  } else if (!currentUrl) {
    await db.siteSetting.update({ where: { key: "students.association" }, data: { value: STUDENT_ASSOCIATION_DEFAULT } });
    log.push("Added the student association link.");
  }
  return log;
}
