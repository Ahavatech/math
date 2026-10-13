import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({ sendContactNotificationEmail: vi.fn() }));

import { sendContactNotificationEmail } from "@/lib/email";
import { sendContactNotification } from "../contact-notification";

function makeDb(notificationEmail: string) {
  return {
    siteSetting: {
      findUnique: vi.fn(async () => ({ value: notificationEmail })),
    },
  } as never;
}

const message = {
  id: "msg-1",
  name: "Sender Name",
  email: "sender@example.com",
  type: "GENERAL",
  subject: "Subject line",
  message: "This is the private message body and must never be emailed out.",
  status: "NEW",
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

describe("sendContactNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a notification with no message body when an address is configured", async () => {
    const db = makeDb("admin@example.com");
    await sendContactNotification(db, message);

    expect(sendContactNotificationEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendContactNotificationEmail).mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain("private message body");
    expect(call.to).toBe("admin@example.com");
  });

  it("sends nothing when no notification address is configured", async () => {
    const db = makeDb("");
    await sendContactNotification(db, message);
    expect(sendContactNotificationEmail).not.toHaveBeenCalled();
  });

  it("never throws when sending fails", async () => {
    vi.mocked(sendContactNotificationEmail).mockRejectedValue(new Error("Resend down"));
    const db = makeDb("admin@example.com");
    await expect(sendContactNotification(db, message)).resolves.toBeUndefined();
  });
});
