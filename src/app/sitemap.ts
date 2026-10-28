import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

function url(path: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${path}`,
    lastModified: lastModified ?? new Date(),
    changeFrequency: "weekly",
    priority: 0.5,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push(
    { ...url("/"), priority: 1.0, changeFrequency: "daily" },
    url("/about"),
    url("/contact"),
    url("/privacy"),
    url("/programmes"),
    url("/research"),
    url("/staff"),
    url("/news"),
    url("/events"),
    url("/alumni"),
    url("/students"),
    url("/students/courses"),
    url("/students/handbook"),
    url("/students/downloads"),
    url("/students/calendar"),
    url("/journal"),
    url("/journal/about"),
    url("/journal/guidelines"),
    url("/journal/policies"),
    url("/journal/call-for-papers"),
    url("/journal/editorial-board"),
    url("/journal/issues"),
    url("/journal/articles"),
  );

  // Dynamic: news posts
  try {
    const posts = await db.newsPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    for (const p of posts) {
      entries.push({ ...url(`/news/${p.slug}`, p.updatedAt), priority: 0.7 });
    }
  } catch {
    /* skip on error */
  }

  // Dynamic: events
  try {
    const events = await db.event.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    for (const e of events) {
      entries.push({ ...url(`/events/${e.slug}`, e.updatedAt), priority: 0.6 });
    }
  } catch {
    /* skip */
  }

  // Dynamic: lecturers
  try {
    const lecturers = await db.lecturerProfile.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    for (const l of lecturers) {
      entries.push({ ...url(`/lecturer/${l.slug}`, l.updatedAt), priority: 0.6 });
    }
  } catch {
    /* skip */
  }

  // Dynamic: programmes
  try {
    const programmes = await db.programme.findMany({
      where: { status: "PUBLISHED" },
      select: { level: true, updatedAt: true },
    });
    for (const p of programmes) {
      entries.push({ ...url(`/programmes/${p.level.toLowerCase()}`, p.updatedAt) });
    }
  } catch {
    /* skip */
  }

  // Dynamic: research areas
  try {
    const areas = await db.researchArea.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    for (const a of areas) {
      entries.push({ ...url(`/research/${a.slug}`, a.updatedAt) });
    }
  } catch {
    /* skip */
  }

  // Dynamic: courses
  try {
    const courses = await db.course.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    for (const c of courses) {
      entries.push({ ...url(`/students/courses/${c.slug}`, c.updatedAt) });
    }
  } catch {
    /* skip */
  }

  // Dynamic: handbook pages
  try {
    const pages = await db.handbookPage.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    for (const p of pages) {
      entries.push({ ...url(`/students/handbook/${p.slug}`, p.updatedAt) });
    }
  } catch {
    /* skip */
  }

  // Dynamic: journal issues
  try {
    const issues = await db.journalIssue.findMany({
      where: { status: "PUBLISHED" },
      select: { volume: true, number: true, updatedAt: true },
    });
    for (const i of issues) {
      entries.push({ ...url(`/journal/issues/${i.volume}/${i.number}`, i.updatedAt) });
    }
  } catch {
    /* skip */
  }

  // Dynamic: journal articles (published + corrected; retracted still has a page)
  try {
    const articles = await db.article.findMany({
      where: {
        status: { in: ["PUBLISHED", "CORRECTED", "RETRACTED"] },
        OR: [
          { issueId: null },
          { issue: { status: "PUBLISHED" } },
        ],
      },
      select: { slug: true, updatedAt: true },
    });
    for (const a of articles) {
      entries.push({ ...url(`/journal/articles/${a.slug}`, a.updatedAt), priority: 0.7 });
    }
  } catch {
    /* skip */
  }

  return entries;
}
