import { describe, expect, it, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { PersistentRateLimiter } from "@/lib/rate-limit";
import { CONTACT_IP_LIMIT, checkRecentDuplicateContact } from "../contact-spam";

const db = await getTestDb();

describe.skipIf(db === null)("contact address limit (counted in the database)", () => {
  it("allows 5 then blocks the 6th within an hour, and a different address is unaffected", async () => {
    const limiter = new PersistentRateLimiter({ ...CONTACT_IP_LIMIT, name: `${CONTACT_IP_LIMIT.name}-test`, db: db! });
    const key = `test-ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check(key)).allowed).toBe(true);
    }
    expect((await limiter.check(key)).allowed).toBe(false);
    expect((await limiter.check(`other-${key}`)).allowed).toBe(true);
    await db!.loginAttempt.deleteMany({ where: { key: { startsWith: `rl:${CONTACT_IP_LIMIT.name}-test:` } } });
  });

  it("keeps the limits the privacy-relevant forms rely on", () => {
    expect(CONTACT_IP_LIMIT.limit).toBe(5);
    expect(CONTACT_IP_LIMIT.windowMs).toBe(60 * 60 * 1000);
  });
});

describe.skipIf(db === null)("checkRecentDuplicateContact", () => {
  const email = "contact-dup-test@example.com";
  const subject = "Duplicate test subject";
  let messageId: string;

  afterAll(async () => {
    if (messageId) await db!.contactMessage.delete({ where: { id: messageId } });
    await db?.$disconnect();
  });

  it("detects a message with the same email and subject within 1 hour", async () => {
    const before = await checkRecentDuplicateContact(db!, email, subject);
    expect(before).toBe(false);

    const message = await db!.contactMessage.create({
      data: { name: "Dup Test", email, type: "GENERAL", subject, message: "Body" },
    });
    messageId = message.id;

    const after = await checkRecentDuplicateContact(db!, email, subject);
    expect(after).toBe(true);

    const differentSubject = await checkRecentDuplicateContact(db!, email, "Different subject");
    expect(differentSubject).toBe(false);
  });
});
