import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { listUsersPage } from "../users";

const db = await getTestDb();
const RUN = `ulist${Date.now().toString(36)}`;

describe.skipIf(db === null)("listUsersPage", () => {
  const ids: string[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 7; i++) {
      const user = await db!.user.create({
        data: {
          email: `${RUN}-user-${i}@example.com`,
          name: i === 3 ? `Zebra ${RUN}` : `Person ${i} ${RUN}`,
          passwordHash: i % 2 === 0 ? "x-not-a-real-hash" : null,
        },
      });
      ids.push(user.id);
    }
  });

  afterAll(async () => {
    await db!.user.deleteMany({ where: { id: { in: ids } } });
    await db?.$disconnect();
  });

  it("returns one page at a time with the total and page count", async () => {
    const first = await listUsersPage(db!, { q: RUN, page: 1, perPage: 3 });
    expect(first.total).toBe(7);
    expect(first.users).toHaveLength(3);
    expect(first.totalPages).toBe(3);
    const third = await listUsersPage(db!, { q: RUN, page: 3, perPage: 3 });
    expect(third.users).toHaveLength(1);
  });

  it("does not repeat or skip anyone across pages", async () => {
    const seen = new Set<string>();
    for (const page of [1, 2, 3]) {
      for (const user of (await listUsersPage(db!, { q: RUN, page, perPage: 3 })).users) seen.add(user.id);
    }
    expect(seen.size).toBe(7);
  });

  it("searches name and email without regard to case", async () => {
    const byName = await listUsersPage(db!, { q: `zebra ${RUN.toUpperCase()}` });
    expect(byName.total).toBe(1);
    const byEmail = await listUsersPage(db!, { q: `${RUN}-USER-5@` });
    expect(byEmail.total).toBe(1);
    expect((await listUsersPage(db!, { q: `${RUN}-no-such-person` })).total).toBe(0);
  });

  it("never returns a password hash, only whether one is set", async () => {
    const { users } = await listUsersPage(db!, { q: RUN, perPage: 10 });
    for (const user of users) {
      expect(Object.keys(user)).not.toContain("passwordHash");
      expect(typeof user.hasPassword).toBe("boolean");
    }
    expect(users.filter((u) => u.hasPassword)).toHaveLength(4);
  });

  it("keeps the page size within sensible limits and treats a bad page as the first", async () => {
    const huge = await listUsersPage(db!, { q: RUN, perPage: 100000 });
    expect(huge.perPage).toBe(100);
    const bad = await listUsersPage(db!, { q: RUN, page: -4, perPage: 3 });
    expect(bad.page).toBe(1);
  });
});
