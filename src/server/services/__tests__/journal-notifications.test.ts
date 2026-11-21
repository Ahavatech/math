import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({
  sendSubmissionReceivedEmail: vi.fn(),
  sendNewSubmissionToEditorsEmail: vi.fn(),
  sendReturnedToAuthorEmail: vi.fn(),
  sendMovedToReviewEmail: vi.fn(),
  sendReviewerInvitationEmail: vi.fn(),
  sendReviewerAcceptedEmail: vi.fn(),
  sendReviewerDeclinedEmail: vi.fn(),
  sendReviewSubmittedEmail: vi.fn(),
  sendReviewerThankYouEmail: vi.fn(),
  sendDecisionAvailableEmail: vi.fn(),
}));
vi.mock("@/lib/email", () => mail);

import { getTestDb } from "../../../../tests/unit/database/test-db";
import {
  notifyDecision,
  notifyMovedToReview,
  notifyReturnedToAuthor,
  notifyReviewSubmitted,
  notifyReviewerInvited,
  notifyReviewerResponded,
  notifySubmitted,
} from "../journal-notifications";

const db = await getTestDb();
const RUN = `jn${Date.now().toString(36)}`;

describe.skipIf(db === null)("journal notifications", () => {
  const userIds: string[] = [];
  const manuscriptIds: string[] = [];
  let authorId = "";
  let msId = "";
  let ref = "";

  async function makeUser(label: string, roles: Array<"AUTHOR" | "REVIEWER" | "JOURNAL_EDITOR" | "JOURNAL_EDITOR_IN_CHIEF">, isActive = true) {
    const u = await db!.user.create({
      data: {
        email: `${RUN}-${label}@example.com`,
        name: label,
        isActive,
        roles: { create: roles.map((role) => ({ role })) },
      },
    });
    userIds.push(u.id);
    return u;
  }

  beforeAll(async () => {
    const author = await makeUser("author", ["AUTHOR"]);
    authorId = author.id;
    ref = `MS-${RUN}`;
    const ms = await db!.manuscript.create({
      data: { title: "Test", abstract: "Test", keywords: [], reference: ref, submittedById: authorId, status: "SUBMITTED" },
    });
    msId = ms.id;
    manuscriptIds.push(ms.id);
  });

  beforeEach(() => {
    for (const fn of Object.values(mail)) fn.mockReset();
  });

  afterAll(async () => {
    await db!.manuscript.deleteMany({ where: { id: { in: manuscriptIds } } });
    await db!.user.deleteMany({ where: { id: { in: userIds } } });
    await db?.$disconnect();
  });

  it("confirms a submission to the author and alerts every active editor (and nobody else)", async () => {
    const chief = await makeUser("chief", ["JOURNAL_EDITOR_IN_CHIEF"]);
    const editor = await makeUser("editor", ["JOURNAL_EDITOR"]);
    const gone = await makeUser("gone-editor", ["JOURNAL_EDITOR"], false);
    await notifySubmitted(db!, msId);

    expect(mail.sendSubmissionReceivedEmail).toHaveBeenCalledWith({ to: `${RUN}-author@example.com`, reference: ref });
    const sent = mail.sendNewSubmissionToEditorsEmail.mock.calls[0][0];
    expect(sent.emails).toEqual(expect.arrayContaining([chief.email, editor.email]));
    expect(sent.emails).not.toContain(gone.email);
    expect(sent.emails).not.toContain(`${RUN}-author@example.com`);
    expect(sent.reference).toBe(ref);
    expect(sent.manuscriptUrl).toContain(`/admin/journal/manuscripts/${msId}`);
  });

  it("tells the author about screening and the decision", async () => {
    await notifyReturnedToAuthor(db!, msId);
    await notifyMovedToReview(db!, msId);
    await notifyDecision(db!, msId);
    expect(mail.sendReturnedToAuthorEmail).toHaveBeenCalledWith({ to: `${RUN}-author@example.com`, reference: ref });
    expect(mail.sendMovedToReviewEmail).toHaveBeenCalledWith({ to: `${RUN}-author@example.com`, reference: ref });
    expect(mail.sendDecisionAvailableEmail).toHaveBeenCalledWith({ to: `${RUN}-author@example.com`, reference: ref });
  });

  it("sends nothing to an author whose account is no longer active", async () => {
    const off = await makeUser("off-author", ["AUTHOR"], false);
    const ms = await db!.manuscript.create({
      data: { title: "T", abstract: "A", keywords: [], reference: `${ref}-off`, submittedById: off.id, status: "SUBMITTED" },
    });
    manuscriptIds.push(ms.id);
    await notifyDecision(db!, ms.id);
    expect(mail.sendDecisionAvailableEmail).not.toHaveBeenCalled();
  });

  it("invites a reviewer with their one-time link, and not an inactive one", async () => {
    const reviewer = await makeUser("reviewer", ["REVIEWER"]);
    await notifyReviewerInvited(db!, { manuscriptId: msId, reviewerUserId: reviewer.id, rawToken: "tok-123" });
    const call = mail.sendReviewerInvitationEmail.mock.calls[0][0];
    expect(call).toMatchObject({ to: reviewer.email, reference: ref, rawToken: "tok-123" });
    expect(call.dueDays).toBeGreaterThan(0);

    mail.sendReviewerInvitationEmail.mockReset();
    const off = await makeUser("off-reviewer", ["REVIEWER"], false);
    await notifyReviewerInvited(db!, { manuscriptId: msId, reviewerUserId: off.id, rawToken: "tok-456" });
    expect(mail.sendReviewerInvitationEmail).not.toHaveBeenCalled();
  });

  it("tells only the handling editor when a reviewer answers, once one is assigned", async () => {
    const handler = await makeUser("handler", ["JOURNAL_EDITOR"]);
    const ms = await db!.manuscript.create({
      data: { title: "T", abstract: "A", keywords: [], reference: `${ref}-h`, submittedById: authorId, handlingEditorId: handler.id, status: "UNDER_REVIEW" },
    });
    manuscriptIds.push(ms.id);

    await notifyReviewerResponded(db!, { manuscriptId: ms.id, accepted: true });
    expect(mail.sendReviewerAcceptedEmail.mock.calls[0][0].emails).toEqual([handler.email]);
    await notifyReviewerResponded(db!, { manuscriptId: ms.id, accepted: false });
    expect(mail.sendReviewerDeclinedEmail.mock.calls[0][0].emails).toEqual([handler.email]);
  });

  it("an email outage never throws into the workflow", async () => {
    mail.sendDecisionAvailableEmail.mockRejectedValueOnce(new Error("mail service down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(notifyDecision(db!, msId)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does nothing for a review assignment that does not exist", async () => {
    await expect(notifyReviewSubmitted(db!, "no-such-assignment")).resolves.toBeUndefined();
    expect(mail.sendReviewSubmittedEmail).not.toHaveBeenCalled();
  });
});
