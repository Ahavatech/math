import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: { api: { resource: vi.fn(), delete_resources: vi.fn() }, uploader: { rename: vi.fn() }, url: vi.fn() },
  ALLOWED_IMAGE_FORMATS: ["jpg", "jpeg", "png", "webp", "avif"],
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}));

import { alumniPublicReference } from "@/lib/alumni-reference";
import {
  createContactMessage,
  listContactMessagesAdmin,
  getContactMessageAdmin,
  setContactMessageStatus,
  resolveAlumniRefForMessage,
} from "../contact";

const db = await getTestDb();

describe.skipIf(db === null)("contact service", () => {
  let actorId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const actor = await db!.user.create({ data: { email: "contact-test-actor@example.com", name: "Actor" } });
    actorId = actor.id;
  });

  afterAll(async () => {
    await db!.auditLog.deleteMany({ where: { actorId } });
    await db!.user.delete({ where: { id: actorId } });
    await db?.$disconnect();
  });

  afterEach(async () => {
    if (createdIds.length) {
      await db!.auditLog.deleteMany({ where: { entityType: "ContactMessage", entityId: { in: createdIds } } });
      await db!.contactMessage.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function create(overrides: Record<string, unknown> = {}) {
    const message = await createContactMessage(db!, {
      name: "Test Sender",
      email: "sender@example.com",
      type: "GENERAL",
      subject: "Test subject",
      message: "Test body",
      ...overrides,
    });
    createdIds.push(message.id);
    return message;
  }

  it("creates a message with status NEW", async () => {
    const message = await create();
    expect(message.status).toBe("NEW");
  });

  it("getContactMessageAdmin marks a NEW message READ and logs the action", async () => {
    const message = await create();
    const read = await getContactMessageAdmin(db!, message.id, actorId);
    expect(read.status).toBe("READ");

    const logs = await db!.auditLog.findMany({ where: { entityType: "ContactMessage", entityId: message.id } });
    expect(logs.some((l) => l.action === "contact_message.read")).toBe(true);
  });

  it("getContactMessageAdmin does not re-mark an already-read message, and does not duplicate audit entries", async () => {
    const message = await create();
    await getContactMessageAdmin(db!, message.id, actorId);
    await getContactMessageAdmin(db!, message.id, actorId);

    const logs = await db!.auditLog.findMany({ where: { entityType: "ContactMessage", entityId: message.id, action: "contact_message.read" } });
    expect(logs.length).toBe(1);
  });

  it("setContactMessageStatus changes status and logs the actor", async () => {
    const message = await create();
    const updated = await setContactMessageStatus(db!, message.id, "ARCHIVED", actorId);
    expect(updated.status).toBe("ARCHIVED");

    const logs = await db!.auditLog.findMany({ where: { entityType: "ContactMessage", entityId: message.id, action: "contact_message.set_status" } });
    expect(logs.length).toBe(1);
  });

  it("listContactMessagesAdmin filters by status and type", async () => {
    await create({ type: "ALUMNI", subject: "Alumni thing" });
    await create({ type: "GENERAL", subject: "General thing" });

    const alumniOnly = await listContactMessagesAdmin(db!, { type: "ALUMNI" });
    expect(alumniOnly.every((m) => m.type === "ALUMNI")).toBe(true);

    const newOnly = await listContactMessagesAdmin(db!, { status: "NEW" });
    expect(newOnly.every((m) => m.status === "NEW")).toBe(true);
  });

  it("resolveAlumniRefForMessage finds the matching alumni entry for an ALUMNI-type message", async () => {
    const alumniEntry = await db!.alumniEntry.create({
      data: {
        fullName: "Ref Test Person",
        email: "ref-test@example.com",
        level: "BSC",
        graduationYear: 2010,
        consentAt: new Date(),
        consentVersion: "v1",
        dedupeKey: `ref test person ${Math.random()}|2010`,
        status: "APPROVED",
      },
    });
    const ref = alumniPublicReference(alumniEntry.id);
    const message = await create({ type: "ALUMNI", subject: `Alumni entry ${ref}`, message: `Reference: ${ref}\n\nPlease remove me.` });

    const resolved = await resolveAlumniRefForMessage(db!, message);
    expect(resolved?.id).toBe(alumniEntry.id);

    await db!.alumniEntry.delete({ where: { id: alumniEntry.id } });
  });

  it("resolveAlumniRefForMessage returns null for a non-ALUMNI message", async () => {
    const message = await create({ type: "GENERAL" });
    expect(await resolveAlumniRefForMessage(db!, message)).toBeNull();
  });
});
