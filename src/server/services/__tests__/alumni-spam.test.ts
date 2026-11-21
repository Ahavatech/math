import { describe, expect, it, vi, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  signFormTimestamp,
  verifyMinFillTime,
  checkHoneypot,
  ALUMNI_IP_LIMIT,
  ALUMNI_LINK_LIMIT,
  checkRecentDuplicateSubmission,
} from "../alumni-spam";
import { PersistentRateLimiter } from "@/lib/rate-limit";

const db = await getTestDb();
const limiterDb = db;

const SECRET = "test-secret-at-least-16-chars";

describe("checkHoneypot", () => {
  it("passes when the honeypot field is empty", () => {
    expect(checkHoneypot("")).toBe(true);
  });

  it("fails when the honeypot field has any value", () => {
    expect(checkHoneypot("I am a bot")).toBe(false);
  });
});

describe("signFormTimestamp / verifyMinFillTime", () => {
  it("passes once the minimum fill time has elapsed", () => {
    const { formToken, formRenderedAt } = signFormTimestamp(SECRET);
    const fiveSecondsLater = formRenderedAt + 5000;
    vi.spyOn(Date, "now").mockReturnValue(fiveSecondsLater);
    expect(verifyMinFillTime(formToken, formRenderedAt, SECRET)).toBe(true);
    vi.restoreAllMocks();
  });

  it("fails when submitted before the minimum fill time", () => {
    const { formToken, formRenderedAt } = signFormTimestamp(SECRET);
    vi.spyOn(Date, "now").mockReturnValue(formRenderedAt + 1000);
    expect(verifyMinFillTime(formToken, formRenderedAt, SECRET)).toBe(false);
    vi.restoreAllMocks();
  });

  it("fails when formRenderedAt was tampered with to look older", () => {
    const { formToken, formRenderedAt } = signFormTimestamp(SECRET);
    const tamperedRenderedAt = formRenderedAt - 60_000;
    vi.spyOn(Date, "now").mockReturnValue(formRenderedAt + 1000);
    expect(verifyMinFillTime(formToken, tamperedRenderedAt, SECRET)).toBe(false);
    vi.restoreAllMocks();
  });

  it("fails with a token signed under a different secret", () => {
    const { formToken, formRenderedAt } = signFormTimestamp("a-different-secret-value");
    vi.spyOn(Date, "now").mockReturnValue(formRenderedAt + 5000);
    expect(verifyMinFillTime(formToken, formRenderedAt, SECRET)).toBe(false);
    vi.restoreAllMocks();
  });
});

describe.skipIf(limiterDb === null)("rate limiters (counted in the database)", () => {
  afterAll(async () => {
    await limiterDb!.loginAttempt.deleteMany({ where: { key: { startsWith: "rl:alumni-" } } });
  });

  it("the address limit allows 5 then blocks the 6th within an hour", async () => {
    const limiter = new PersistentRateLimiter({ ...ALUMNI_IP_LIMIT, name: "alumni-ip-test", db: limiterDb! });
    const key = `test-ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check(key)).allowed).toBe(true);
    }
    expect((await limiter.check(key)).allowed).toBe(false);
  });

  it("the link limit allows 30 then blocks the 31st within an hour", async () => {
    const limiter = new PersistentRateLimiter({ ...ALUMNI_LINK_LIMIT, name: "alumni-link-test", db: limiterDb! });
    const key = `test-link-${Math.random()}`;
    for (let i = 0; i < 30; i++) {
      expect((await limiter.check(key)).allowed).toBe(true);
    }
    expect((await limiter.check(key)).allowed).toBe(false);
  });
});

describe.skipIf(db === null)("checkRecentDuplicateSubmission", () => {
  const email = "spam-dup-test@example.com";
  let entryId: string;

  afterAll(async () => {
    if (entryId) await db!.alumniEntry.delete({ where: { id: entryId } });
    await db?.$disconnect();
  });

  it("detects a submission with the same email within 24 hours", async () => {
    const before = await checkRecentDuplicateSubmission(db!, email);
    expect(before).toBe(false);

    const entry = await db!.alumniEntry.create({
      data: {
        fullName: "Spam Dup Test",
        email,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: "spam dup test|2010",
        programmes: { create: [{ level: "BSC", graduationYear: 2010 }] },
      },
    });
    entryId = entry.id;

    const after = await checkRecentDuplicateSubmission(db!, email);
    expect(after).toBe(true);
  });
});
