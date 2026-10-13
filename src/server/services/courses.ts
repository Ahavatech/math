import "server-only";
import type { ContentStatus, Course, PrismaClient } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slugify";
import { normalizeSearchText } from "@/lib/search-text";
import { matchesSearch } from "@/lib/text-search";
import { courseInputSchema, type CourseInput } from "@/lib/validators/course";
import { createRevision } from "./revisions";
import { logAction, type AuditRequestContext } from "./audit";

export type CourseWithLinks = CourseInput & { prerequisiteIds: string[]; lecturerIds: string[] };

function computeSearchText(code: string, title: string, description: string): string {
  return normalizeSearchText(`${code} ${title} ${description}`);
}

/**
 * Rejects a course listing itself, and rejects any cycle the proposed
 * prerequisite list would create: walks the prerequisite graph from
 * each proposed prerequisite and fails if it ever reaches `courseId`
 * back again.
 */
async function assertNoCycle(db: PrismaClient, courseId: string | null, prerequisiteIds: string[]) {
  if (courseId && prerequisiteIds.includes(courseId)) {
    throw new Error("A course cannot be its own prerequisite");
  }
  if (!courseId) return;

  const visited = new Set<string>();
  async function walk(id: string): Promise<boolean> {
    if (id === courseId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const course = await db.course.findUnique({ where: { id }, select: { prerequisites: { select: { id: true } } } });
    for (const prereq of course?.prerequisites ?? []) {
      if (await walk(prereq.id)) return true;
    }
    return false;
  }

  for (const prereqId of prerequisiteIds) {
    if (await walk(prereqId)) {
      throw new Error("That prerequisite list would create a cycle");
    }
  }
}

export async function createCourse(
  db: PrismaClient,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<Course> {
  const { prerequisiteIds = [], lecturerIds = [], ...rest } = input as Record<string, unknown>;
  const parsed = courseInputSchema.parse(rest);
  await assertNoCycle(db, null, prerequisiteIds as string[]);

  const slug = await generateUniqueSlug(parsed.code, async (candidate) => {
    const existing = await db.course.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  return db.$transaction(async (tx) => {
    const created = await tx.course.create({
      data: {
        ...parsed,
        slug,
        searchText: computeSearchText(parsed.code, parsed.title, parsed.description),
        prerequisites: { connect: (prerequisiteIds as string[]).map((id) => ({ id })) },
        lecturers: { connect: (lecturerIds as string[]).map((id) => ({ id })) },
      },
    });
    await createRevision(tx, { entityType: "Course", entityId: created.id, snapshot: { ...parsed, slug, prerequisiteIds, lecturerIds }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "course.create", entityType: "Course", entityId: created.id, summary: `Created ${created.code}` },
      context,
    );
    return created;
  });
}

export async function updateCourse(
  db: PrismaClient,
  id: string,
  input: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<Course> {
  const { prerequisiteIds = [], lecturerIds = [], ...rest } = input as Record<string, unknown>;
  const parsed = courseInputSchema.parse(rest);
  await assertNoCycle(db, id, prerequisiteIds as string[]);

  const existing = await db.course.findUniqueOrThrow({ where: { id } });
  const slug = parsed.code === existing.code ? existing.slug : await generateUniqueSlug(parsed.code, async (candidate) => {
    const found = await db.course.findUnique({ where: { slug: candidate } });
    return found !== null && found.id !== id;
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.course.update({
      where: { id },
      data: {
        ...parsed,
        slug,
        searchText: computeSearchText(parsed.code, parsed.title, parsed.description),
        prerequisites: { set: (prerequisiteIds as string[]).map((pid) => ({ id: pid })) },
        lecturers: { set: (lecturerIds as string[]).map((lid) => ({ id: lid })) },
      },
    });
    await createRevision(tx, { entityType: "Course", entityId: id, snapshot: { ...parsed, slug, prerequisiteIds, lecturerIds }, createdById: actorId });
    await logAction(
      tx,
      { actorId, action: "course.update", entityType: "Course", entityId: id, summary: `Updated ${updated.code}` },
      context,
    );
    return updated;
  });
}

export async function setCourseStatus(
  db: PrismaClient,
  id: string,
  status: ContentStatus,
  actorId: string,
  context?: AuditRequestContext,
): Promise<Course> {
  return db.$transaction(async (tx) => {
    const updated = await tx.course.update({ where: { id }, data: { status } });
    await logAction(
      tx,
      { actorId, action: "course.set_status", entityType: "Course", entityId: id, summary: `Set ${updated.code} to ${status}` },
      context,
    );
    return updated;
  });
}

export async function getCourseByIdAdmin(db: PrismaClient, id: string) {
  return db.course.findUniqueOrThrow({
    where: { id },
    include: { prerequisites: true, requiredFor: true, lecturers: true },
  });
}

export async function listCoursesAdmin(
  db: PrismaClient,
  filters: { programmeLevel?: "BSC" | "MSC" | "PHD"; level?: number; semester?: "FIRST" | "SECOND"; status?: ContentStatus },
) {
  return db.course.findMany({
    where: {
      ...(filters.programmeLevel ? { programmeLevel: filters.programmeLevel } : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.semester ? { semester: filters.semester } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: [{ level: "asc" }, { code: "asc" }],
  });
}

export async function reversePrerequisitesOf(db: PrismaClient, courseId: string) {
  return db.course.findMany({ where: { prerequisites: { some: { id: courseId } } } });
}

const PUBLIC_SELECT = {
  id: true,
  code: true,
  slug: true,
  title: true,
  units: true,
  level: true,
  semester: true,
  programmeLevel: true,
  isElective: true,
  description: true,
} as const;

export async function listCoursesPublic(
  db: PrismaClient,
  filters: { programmeLevel?: "BSC" | "MSC" | "PHD"; level?: number; semester?: "FIRST" | "SECOND"; q?: string },
) {
  try {
    const where = {
      status: "PUBLISHED" as const,
      ...(filters.programmeLevel ? { programmeLevel: filters.programmeLevel } : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.semester ? { semester: filters.semester } : {}),
    };
    const all = await db.course.findMany({ where, select: PUBLIC_SELECT, orderBy: [{ level: "asc" }, { code: "asc" }] });
    const courses = filters.q ? all.filter((c) => matchesSearch(c.code, filters.q!) || matchesSearch(c.title, filters.q!)) : all;
    return { courses };
  } catch {
    return { courses: [] };
  }
}

export async function getCourseBySlugPublic(db: PrismaClient, slug: string) {
  try {
    const course = await db.course.findUnique({
      where: { slug },
      select: {
        ...PUBLIC_SELECT,
        status: true,
        prerequisites: { where: { status: "PUBLISHED" }, select: { id: true, code: true, slug: true, title: true } },
        requiredFor: { where: { status: "PUBLISHED" }, select: { id: true, code: true, slug: true, title: true } },
        lecturers: {
          where: { status: "PUBLISHED", user: { isActive: true } },
          select: { id: true, slug: true, fullName: true },
        },
      },
    });
    if (!course || course.status !== "PUBLISHED") return null;
    const { status: _status, ...publicFields } = course;
    return publicFields;
  } catch {
    return null;
  }
}
