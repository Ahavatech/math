import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  getReviewerAcknowledgementOptIn,
  setReviewerAcknowledgementOptIn,
} from "@/server/services/reviewer-dashboard";
import type { SessionUser } from "@/lib/rbac";
import { randomUUID } from "node:crypto";

const db = await getTestDb();

function makeReviewer(id: string): SessionUser {
  return { id, name: "Reviewer", email: `${id}@test.com`, roles: ["REVIEWER"], isActive: true };
}
function makeNonReviewer(id: string): SessionUser {
  return { id, name: "Author", email: `${id}@test.com`, roles: ["AUTHOR"], isActive: true };
}

describe.skipIf(db === null)("reviewer acknowledgement opt-in", () => {
  let runId: string;

  beforeEach(() => {
    runId = randomUUID().slice(0, 8);
  });

  it("getReviewerAcknowledgementOptIn returns false when no profile exists", async () => {
    const user = await db!.user.create({
      data: { id: `u-oi-${runId}`, email: `u-oi-${runId}@test.com`, name: "R" },
    });
    await db!.userRole.create({ data: { userId: user.id, role: "REVIEWER" } });

    const result = await getReviewerAcknowledgementOptIn(db!, makeReviewer(user.id));
    expect(result).toBe(false);
  });

  it("setReviewerAcknowledgementOptIn creates profile with optIn=true", async () => {
    const user = await db!.user.create({
      data: { id: `u-oi2-${runId}`, email: `u-oi2-${runId}@test.com`, name: "R2" },
    });
    await db!.userRole.create({ data: { userId: user.id, role: "REVIEWER" } });
    const actor = makeReviewer(user.id);

    await setReviewerAcknowledgementOptIn(db!, actor, true);
    const result = await getReviewerAcknowledgementOptIn(db!, actor);
    expect(result).toBe(true);
  });

  it("setReviewerAcknowledgementOptIn can toggle off", async () => {
    const user = await db!.user.create({
      data: { id: `u-oi3-${runId}`, email: `u-oi3-${runId}@test.com`, name: "R3" },
    });
    await db!.userRole.create({ data: { userId: user.id, role: "REVIEWER" } });
    const actor = makeReviewer(user.id);

    await setReviewerAcknowledgementOptIn(db!, actor, true);
    await setReviewerAcknowledgementOptIn(db!, actor, false);
    const result = await getReviewerAcknowledgementOptIn(db!, actor);
    expect(result).toBe(false);
  });

  it("non-REVIEWER role cannot set opt-in", async () => {
    const user = await db!.user.create({
      data: { id: `u-oi4-${runId}`, email: `u-oi4-${runId}@test.com`, name: "A" },
    });
    await expect(
      setReviewerAcknowledgementOptIn(db!, makeNonReviewer(user.id), true),
    ).rejects.toThrow("Unauthorized");
  });

  it("getReviewerAcknowledgementOptIn returns false for non-REVIEWER", async () => {
    const user = await db!.user.create({
      data: { id: `u-oi5-${runId}`, email: `u-oi5-${runId}@test.com`, name: "A2" },
    });
    const result = await getReviewerAcknowledgementOptIn(db!, makeNonReviewer(user.id));
    expect(result).toBe(false);
  });
});
