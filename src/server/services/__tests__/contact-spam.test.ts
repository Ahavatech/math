import { describe, expect, it, afterAll } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import { contactIpRateLimiter, checkRecentDuplicateContact } from "../contact-spam";

const db = await getTestDb();

describe("contactIpRateLimiter", () => {
  it("allows 5 then blocks the 6th within an hour", () => {
    const key = `test-ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(contactIpRateLimiter.check(key).allowed).toBe(true);
    }
    expect(contactIpRateLimiter.check(key).allowed).toBe(false);
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
