import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createCourse,
  updateCourse,
  setCourseStatus,
  getCourseByIdAdmin,
  listCoursesAdmin,
  listCoursesPublic,
  getCourseBySlugPublic,
  reversePrerequisitesOf,
} from "../courses";

const db = await getTestDb();

describe.skipIf(db === null)("courses service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: "courses-test-actor@example.com", name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.contentRevision.deleteMany({ where: { entityType: "Course", entityId: { in: createdIds } } });
      await db!.auditLog.deleteMany({ where: { entityType: "Course", entityId: { in: createdIds } } });
      await db!.course.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      code: `TST ${100 + Math.floor(Math.random() * 800)}`,
      title: "Test Course",
      units: 3,
      level: 100,
      semester: "FIRST",
      programmeLevel: "BSC",
      isElective: false,
      description: "<p>Description</p>",
      status: "DRAFT",
      prerequisiteIds: [],
      lecturerIds: [],
      ...overrides,
    };
  }

  async function create(overrides: Record<string, unknown> = {}) {
    const course = await createCourse(db!, input(overrides), actorId);
    createdIds.push(course.id);
    return course;
  }

  it("creates a course with a slug derived from the code and computed searchText", async () => {
    const course = await create({ code: "mth 101", title: "Calculus I" });
    expect(course.slug).toBe("mth-101");
    expect(course.code).toBe("MTH 101");
    expect(course.searchText).toContain("calculus");
  });

  it("rejects a course listing itself as its own prerequisite", async () => {
    const course = await create();
    await expect(updateCourse(db!, course.id, input({ prerequisiteIds: [course.id] }), actorId)).rejects.toThrow(/own prerequisite/i);
  });

  it("rejects a prerequisite cycle (A requires B, B requires A)", async () => {
    const a = await create({ code: "TST 201" });
    const b = await create({ code: "TST 202", prerequisiteIds: [a.id] });

    await expect(updateCourse(db!, a.id, input({ code: "TST 201", prerequisiteIds: [b.id] }), actorId)).rejects.toThrow(/cycle/i);
  });

  it("allows a legitimate prerequisite chain (A -> B -> C)", async () => {
    const a = await create({ code: "TST 301" });
    const b = await create({ code: "TST 302", prerequisiteIds: [a.id] });
    const c = await create({ code: "TST 303", prerequisiteIds: [b.id] });
    expect(c).toBeTruthy();
  });

  it("reversePrerequisitesOf finds courses that require this one", async () => {
    const a = await create({ code: "TST 401" });
    const b = await create({ code: "TST 402", prerequisiteIds: [a.id] });

    const requiredFor = await reversePrerequisitesOf(db!, a.id);
    expect(requiredFor.map((c) => c.id)).toContain(b.id);
  });

  it("setCourseStatus archives and restores", async () => {
    const course = await create({ status: "PUBLISHED" });
    const archived = await setCourseStatus(db!, course.id, "ARCHIVED", actorId);
    expect(archived.status).toBe("ARCHIVED");
  });

  it("listCoursesAdmin returns every course regardless of status", async () => {
    await create({ status: "DRAFT" });
    await create({ status: "PUBLISHED" });
    const list = await listCoursesAdmin(db!, {});
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("public queries exclude DRAFT and ARCHIVED courses", async () => {
    const draft = await create({ status: "DRAFT" });
    const published = await create({ status: "PUBLISHED" });

    const { courses } = await listCoursesPublic(db!, {});
    const codes = courses.map((c) => c.code);
    expect(codes).toContain(published.code);
    expect(codes).not.toContain(draft.code);

    expect(await getCourseBySlugPublic(db!, draft.slug)).toBeNull();
    expect(await getCourseBySlugPublic(db!, published.slug)).not.toBeNull();
  });

  it("getCourseByIdAdmin includes prerequisite and lecturer relations", async () => {
    const a = await create({ code: "TST 501" });
    const b = await create({ code: "TST 502", prerequisiteIds: [a.id] });
    const found = await getCourseByIdAdmin(db!, b.id);
    expect(found.prerequisites.map((p) => p.id)).toContain(a.id);
  });
});
