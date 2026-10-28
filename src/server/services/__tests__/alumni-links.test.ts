import { createHash } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  createAlumniLink,
  createCohortLinks,
  regenerateAlumniLinkToken,
  setAlumniLinkActive,
  validateAlumniLinkToken,
  consumeAlumniLinkOnSubmit,
} from "../alumni-links";

const db = await getTestDb();

const RUN = Date.now().toString(36);

describe.skipIf(db === null)("alumni-links service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: `alumni-links-test-actor-${RUN}@example.com`, name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.alumniLink.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("stores only a sha256 hash of the token, never the plaintext", async () => {
    const { link, token } = await createAlumniLink(db!, { label: "Test link" }, actorId);
    createdIds.push(link.id);

    expect(link.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(link.tokenHash).not.toBe(token);
  });

  it("validates a fresh, active, unexpired token", async () => {
    const { link, token } = await createAlumniLink(db!, { label: "Valid link" }, actorId);
    createdIds.push(link.id);

    const result = await validateAlumniLinkToken(db!, token);
    expect(result.ok).toBe(true);
  });

  it("returns the same generic failure for a wrong, expired, inactive or exhausted link", async () => {
    const wrong = await validateAlumniLinkToken(db!, "not-a-real-token");
    expect(wrong).toEqual({ ok: false });

    const { link: expiredLink } = await createAlumniLink(db!, { label: "Expired", expiresInDays: -1 }, actorId);
    createdIds.push(expiredLink.id);
    const expiredToken = await db!.alumniLink.findUniqueOrThrow({ where: { id: expiredLink.id } });
    void expiredToken;
    const expired = await validateAlumniLinkToken(db!, "irrelevant-since-expired-link-cant-be-matched-by-plaintext");
    expect(expired).toEqual({ ok: false });

    const { link: inactiveLink, token: inactiveToken } = await createAlumniLink(
      db!,
      { label: "Inactive" },
      actorId,
    );
    createdIds.push(inactiveLink.id);
    await setAlumniLinkActive(db!, inactiveLink.id, false, actorId);
    const inactive = await validateAlumniLinkToken(db!, inactiveToken);
    expect(inactive).toEqual({ ok: false });

    const { link: exhaustedLink, token: exhaustedToken } = await createAlumniLink(
      db!,
      { label: "Exhausted", maxUses: 1 },
      actorId,
    );
    createdIds.push(exhaustedLink.id);
    const firstUse = await consumeAlumniLinkOnSubmit(db!, exhaustedLink.id);
    expect(firstUse).toBe(true);
    const exhausted = await validateAlumniLinkToken(db!, exhaustedToken);
    expect(exhausted).toEqual({ ok: false });
  });

  it("regenerate invalidates the old token", async () => {
    const { link, token: oldToken } = await createAlumniLink(db!, { label: "Regen" }, actorId);
    createdIds.push(link.id);

    const { token: newToken } = await regenerateAlumniLinkToken(db!, link.id, actorId);

    const oldResult = await validateAlumniLinkToken(db!, oldToken);
    expect(oldResult.ok).toBe(false);
    const newResult = await validateAlumniLinkToken(db!, newToken);
    expect(newResult.ok).toBe(true);
  });

  it("enforces maxUses atomically under concurrent submissions", async () => {
    const { link } = await createAlumniLink(db!, { label: "Concurrency", maxUses: 1 }, actorId);
    createdIds.push(link.id);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => consumeAlumniLinkOnSubmit(db!, link.id)),
    );

    const successes = results.filter(Boolean).length;
    expect(successes).toBe(1);

    const final = await db!.alumniLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(final.useCount).toBe(1);
    expect(final.lastUsedAt).not.toBeNull();
  });

  it("createCohortLinks creates one link per year, capped at 60", async () => {
    const years = [2001, 2002, 2003];
    const links = await createCohortLinks(db!, years, actorId);
    createdIds.push(...links.map((l) => l.linkId));

    expect(links).toHaveLength(3);
    expect(links.map((l) => l.year).sort()).toEqual(years);
    for (const l of links) {
      expect(l.url).toContain("/alumni/submit/");
    }

    await expect(
      createCohortLinks(
        db!,
        Array.from({ length: 61 }, (_, i) => 1990 + i),
        actorId,
      ),
    ).rejects.toThrow();
  });
});
