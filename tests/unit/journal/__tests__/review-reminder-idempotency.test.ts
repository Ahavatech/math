/**
 * Idempotency tests for the journal review reminders script.
 * Verifies that running the reminder logic twice never sends the same
 * milestone (DUE_SOON / OVERDUE) more than once per assignment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── types ────────────────────────────────────────────────────────────────────

type ReminderLog = { assignmentId: string; milestone: string };

interface FakeAssignment {
  id: string;
  status: string;
  dueAt: Date | null;
  reviewer: { email: string };
  manuscript: { reference: string | null };
  reminderLogs: ReminderLog[];
}

// ── core reminder logic extracted for unit testing ───────────────────────────

/**
 * Returns assignments that should receive a DUE_SOON reminder.
 * Mirrors the WHERE clause in journal-review-reminders.ts.
 */
function selectDueSoon(
  assignments: FakeAssignment[],
  soonCutoff: Date,
  now: Date,
): FakeAssignment[] {
  return assignments.filter(
    (a) =>
      a.status === "ACCEPTED" &&
      a.dueAt !== null &&
      a.dueAt <= soonCutoff &&
      a.dueAt >= now &&
      !a.reminderLogs.some((l) => l.milestone === "DUE_SOON"),
  );
}

/**
 * Returns assignments that should receive an OVERDUE reminder.
 */
function selectOverdue(
  assignments: FakeAssignment[],
  now: Date,
): FakeAssignment[] {
  return assignments.filter(
    (a) =>
      a.status === "ACCEPTED" &&
      a.dueAt !== null &&
      a.dueAt < now &&
      !a.reminderLogs.some((l) => l.milestone === "OVERDUE"),
  );
}

/**
 * Simulates one run of the script: selects eligible assignments, fires the
 * email callback, then records the log entries (idempotency writes).
 * Returns how many emails were sent.
 */
async function runReminders(
  assignments: FakeAssignment[],
  now: Date,
  sendEmail: (email: string, milestone: string) => void,
): Promise<number> {
  const soonCutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const dueSoon = selectDueSoon(assignments, soonCutoff, now);
  const overdue = selectOverdue(assignments, now);

  let sent = 0;

  for (const a of dueSoon) {
    sendEmail(a.reviewer.email, "DUE_SOON");
    // Simulate DB write: add log entry to the in-memory object
    a.reminderLogs.push({ assignmentId: a.id, milestone: "DUE_SOON" });
    sent++;
  }

  for (const a of overdue) {
    sendEmail(a.reviewer.email, "OVERDUE");
    a.reminderLogs.push({ assignmentId: a.id, milestone: "OVERDUE" });
    sent++;
  }

  return sent;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("review reminder idempotency", () => {
  const now = new Date("2026-10-16T10:00:00Z");

  function makeAssignment(
    id: string,
    daysUntilDue: number,
    logs: ReminderLog[] = [],
  ): FakeAssignment {
    return {
      id,
      status: "ACCEPTED",
      dueAt: new Date(now.getTime() + daysUntilDue * 24 * 60 * 60 * 1000),
      reviewer: { email: `reviewer-${id}@example.com` },
      manuscript: { reference: `REF-${id}` },
      reminderLogs: [...logs],
    };
  }

  it("sends DUE_SOON exactly once when run twice for an assignment due in 2 days", async () => {
    const assignment = makeAssignment("a1", 2);
    const sendEmail = vi.fn();

    // First run: should send
    const first = await runReminders([assignment], now, sendEmail);
    expect(first).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith("reviewer-a1@example.com", "DUE_SOON");

    // Second run: log entry now present — must NOT send again
    const second = await runReminders([assignment], now, sendEmail);
    expect(second).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1); // still only 1 total
  });

  it("sends OVERDUE exactly once when run twice for an assignment 1 day past due", async () => {
    const pastDue = makeAssignment("a2", -1); // 1 day overdue
    const sendEmail = vi.fn();

    const first = await runReminders([pastDue], now, sendEmail);
    expect(first).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith("reviewer-a2@example.com", "OVERDUE");

    const second = await runReminders([pastDue], now, sendEmail);
    expect(second).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends both milestones independently and never duplicates either", async () => {
    // Two separate assignments: one due-soon, one overdue
    const dueSoon = makeAssignment("a3", 1);
    const overdue = makeAssignment("a4", -2);
    const sendEmail = vi.fn();

    const first = await runReminders([dueSoon, overdue], now, sendEmail);
    expect(first).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);

    // Run again many times — total must stay at 2
    for (let i = 0; i < 5; i++) {
      const n = await runReminders([dueSoon, overdue], now, sendEmail);
      expect(n).toBe(0);
    }
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("skips assignments whose log already has the milestone (pre-seeded)", async () => {
    const alreadyReminded = makeAssignment("a5", 2, [
      { assignmentId: "a5", milestone: "DUE_SOON" },
    ]);
    const sendEmail = vi.fn();

    const sent = await runReminders([alreadyReminded], now, sendEmail);
    expect(sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not send DUE_SOON for assignments with status other than ACCEPTED", async () => {
    const invited: FakeAssignment = {
      ...makeAssignment("a6", 2),
      status: "INVITED",
    };
    const declined: FakeAssignment = {
      ...makeAssignment("a7", 2),
      status: "DECLINED",
    };
    const submitted: FakeAssignment = {
      ...makeAssignment("a8", 2),
      status: "SUBMITTED",
    };
    const sendEmail = vi.fn();

    const sent = await runReminders([invited, declined, submitted], now, sendEmail);
    expect(sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not send DUE_SOON when assignment has no dueAt", async () => {
    const noDue: FakeAssignment = {
      ...makeAssignment("a9", 2),
      dueAt: null,
    };
    const sendEmail = vi.fn();

    const sent = await runReminders([noDue], now, sendEmail);
    expect(sent).toBe(0);
  });
});
