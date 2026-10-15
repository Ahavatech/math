import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission, hasRole } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { getManuscriptDetail } from "@/server/services/manuscript-screening";
import { getReviewsForEditor } from "@/server/services/review-visibility";
import {
  assignHandlingEditorAction,
  deskRejectAction,
  returnToAuthorAction,
  approveForReviewAction,
  addInternalNoteAction,
} from "@/server/actions/manuscript-screening";
import { inviteReviewerAction, revokeInvitationAction } from "@/server/actions/reviewer-invitation";
import { recordDecisionAction } from "@/server/actions/editorial-decision";

export function generateMetadata() {
  return { title: "Manuscript detail" };
}

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Manuscript created",
  SUBMITTED: "Submission received",
  FILE_ADDED: "File uploaded",
  FILE_REMOVED: "File removed",
  EDITOR_ASSIGNED: "Editor assigned",
  RETURNED_TO_AUTHOR: "Returned to author",
  RESUBMITTED: "Resubmission received",
  DESK_REJECTED: "Desk rejected",
  APPROVED_FOR_REVIEW: "Approved for peer review",
  WITHDRAWN: "Withdrawn",
  INTERNAL_NOTE: "Internal note",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ManuscriptDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canRead =
    hasPermission(user, "journal.editorial") ||
    hasPermission(user, "journal.manuscripts.read");
  if (!canRead) redirect("/admin");

  const { id } = await params;
  const sessionUser = { id: user.id, roles: user.roles, isActive: user.isActive ?? true };

  let ms;
  try {
    ms = await getManuscriptDetail(prisma, sessionUser, id);
  } catch {
    notFound();
  }

  // Load editors for assignment dropdown (EiC / SUPER_ADMIN only)
  const canAssign =
    hasPermission(user, "journal.editorial") &&
    (user.roles.includes("JOURNAL_EDITOR_IN_CHIEF") || user.roles.includes("SUPER_ADMIN"));

  let editors: Array<{ id: string; name: string; email: string }> = [];
  if (canAssign) {
    const editorRoles = await prisma.userRole.findMany({
      where: { role: "JOURNAL_EDITOR" },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    editors = editorRoles.map((r) => r.user);
  }

  const isEditorial = hasPermission(user, "journal.editorial");
  const isHOD = hasRole(user, "HOD");

  // Reviewer invitations (editorial only; not HOD)
  let reviewAssignments: Array<{
    id: string;
    reviewerId: string;
    status: string;
    reviewer: { name: string | null; email: string };
    dueAt: Date | null;
    review: { isDraft: boolean; submittedAt: Date | null } | null;
  }> = [];
  let reviewerList: Array<{ id: string; name: string | null; email: string }> = [];
  let editorReviews: Awaited<ReturnType<typeof getReviewsForEditor>> = [];

  if (isEditorial && !isHOD && ms) {
    [reviewAssignments, reviewerList, editorReviews] = await Promise.all([
      prisma.reviewAssignment.findMany({
        where: { manuscriptId: id },
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
          review: { select: { isDraft: true, submittedAt: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userRole.findMany({
        where: { role: "REVIEWER" },
        select: { user: { select: { id: true, name: true, email: true } } },
      }).then((rows) => rows.map((r) => r.user)),
      getReviewsForEditor(prisma, sessionUser, id).catch(() => []),
    ]);
  }

  // Current round for decision form
  const currentRound = ms
    ? await prisma.manuscriptRound.findFirst({
        where: { manuscriptId: id },
        orderBy: { number: "desc" },
        select: { id: true, number: true },
      })
    : null;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/journal/manuscripts" className="text-sm text-muted-foreground underline">
        Back to manuscripts
      </Link>

      <div className="mt-4 mb-6">
        <p className="font-mono text-xs text-muted-foreground">{ms.reference ?? "No reference"}</p>
        <h1 className="text-2xl font-semibold mt-1">{ms.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Status: <strong>{ms.status}</strong>
          {ms.submittedAt && ` · Submitted ${new Date(ms.submittedAt).toLocaleDateString()}`}
        </p>
      </div>

      {/* Authors */}
      <section className="mb-6">
        <h2 className="font-semibold mb-2">Authors</h2>
        <ul className="space-y-1 text-sm">
          {ms.authors.map((a) => (
            <li key={a.id}>
              {a.name}
              {a.isCorresponding && " (corresponding)"}
              {a.affiliation && ` — ${a.affiliation}`}
            </li>
          ))}
        </ul>
      </section>

      {/* Abstract */}
      <section className="mb-6">
        <h2 className="font-semibold mb-2">Abstract</h2>
        <p className="text-sm whitespace-pre-wrap">{ms.abstract}</p>
      </section>

      {/* Files */}
      {ms.files.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold mb-2">Files</h2>
          <ul className="space-y-1 text-sm">
            {ms.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {f.kind}: {f.originalName} ({formatBytes(f.size)})
                </span>
                <a href={`/api/journal/files/${f.id}`} className="text-primary underline ml-4">
                  Download
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="mb-6">
        <h2 className="font-semibold mb-2">Timeline</h2>
        <ol className="space-y-2 text-sm">
          {ms.events.map((e) => (
            <li key={e.id}>
              <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
              <span className="text-muted-foreground ml-2">
                {new Date(e.createdAt).toLocaleString()}
              </span>
              {!e.visibleToAuthor && (
                <span className="ml-2 rounded bg-muted px-1 text-xs">internal</span>
              )}
              {e.note && <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{e.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      {/* Actions (editorial only) */}
      {isEditorial && ms.hasActions && (
        <section className="space-y-6">
          <h2 className="font-semibold">Actions</h2>

          {/* Assign handling editor */}
          {canAssign && ms.status !== "REJECTED" && ms.status !== "WITHDRAWN" && (
            <form action={assignHandlingEditorAction} className="space-y-2">
              <input type="hidden" name="manuscriptId" value={ms.id} />
              <label className="block text-sm font-medium">Assign handling editor</label>
              <div className="flex gap-2">
                <select
                  name="editorId"
                  className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                  defaultValue={ms.handlingEditorId ?? ""}
                >
                  <option value="">Select editor...</option>
                  {editors.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.email})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                >
                  Assign
                </button>
              </div>
            </form>
          )}

          {/* Return to author */}
          {(ms.status === "SUBMITTED" || ms.status === "SCREENING") && (
            <form action={returnToAuthorAction} className="space-y-2">
              <input type="hidden" name="manuscriptId" value={ms.id} />
              <label className="block text-sm font-medium">Return to author</label>
              <textarea
                name="message"
                rows={4}
                placeholder="Explain what needs to be corrected..."
                className="w-full rounded-md border px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Return to author
              </button>
            </form>
          )}

          {/* Desk reject */}
          {(ms.status === "SUBMITTED" || ms.status === "SCREENING") && (
            <form action={deskRejectAction} className="space-y-2">
              <input type="hidden" name="manuscriptId" value={ms.id} />
              <label className="block text-sm font-medium">Desk rejection</label>
              <textarea
                name="letter"
                rows={6}
                placeholder="Decision letter..."
                className="w-full rounded-md border px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="rounded-md border border-destructive text-destructive px-3 py-1.5 text-sm"
              >
                Desk reject
              </button>
            </form>
          )}

          {/* Approve for review */}
          {ms.status === "SCREENING" && (
            <form action={approveForReviewAction}>
              <input type="hidden" name="manuscriptId" value={ms.id} />
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Approve for peer review
              </button>
            </form>
          )}

          {/* Internal note */}
          <form action={addInternalNoteAction} className="space-y-2">
            <input type="hidden" name="manuscriptId" value={ms.id} />
            <label className="block text-sm font-medium">Internal note</label>
            <textarea
              name="note"
              rows={3}
              placeholder="Note visible only to editors..."
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              Add note
            </button>
          </form>

          {/* Invite reviewer */}
          {(ms.status === "UNDER_REVIEW" || ms.status === "REVISION_REQUESTED") && currentRound && (
            <form action={inviteReviewerAction} className="space-y-2">
              <input type="hidden" name="manuscriptId" value={ms.id} />
              <input type="hidden" name="roundId" value={currentRound.id} />
              <label className="block text-sm font-medium">Invite reviewer</label>
              <div className="flex gap-2">
                <select
                  name="reviewerUserId"
                  className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                  required
                >
                  <option value="">Select reviewer...</option>
                  {reviewerList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name ?? r.email} ({r.email})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                >
                  Invite
                </button>
              </div>
            </form>
          )}

          {/* Record editorial decision */}
          {(ms.status === "UNDER_REVIEW" || ms.status === "REVISION_REQUESTED") && currentRound && (
            <form action={recordDecisionAction} className="space-y-2">
              <input type="hidden" name="manuscriptId" value={ms.id} />
              <label className="block text-sm font-medium">Record decision</label>
              <select
                name="decision"
                className="block w-full rounded-md border px-3 py-1.5 text-sm"
                required
              >
                <option value="">Select decision...</option>
                <option value="ACCEPT">Accept</option>
                <option value="MINOR_REVISION">Minor revision</option>
                <option value="MAJOR_REVISION">Major revision</option>
                <option value="REJECT">Reject</option>
              </select>
              <textarea
                name="letterHtml"
                rows={6}
                placeholder="Decision letter (HTML allowed)..."
                className="w-full rounded-md border px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Record decision
              </button>
            </form>
          )}
        </section>
      )}

      {/* Reviewer assignments panel (editorial, not HOD) */}
      {isEditorial && !isHOD && reviewAssignments.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-3">Reviewer assignments</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-3">Reviewer</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Due</th>
                <th className="py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewAssignments.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-1.5 pr-3">
                    {a.reviewer.name ?? a.reviewer.email}
                  </td>
                  <td className="py-1.5 pr-3">{a.status}</td>
                  <td className="py-1.5 pr-3">
                    {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="py-1.5">
                    {(a.status === "INVITED" || a.status === "ACCEPTED") && (
                      <form action={revokeInvitationAction} className="inline">
                        <input type="hidden" name="assignmentId" value={a.id} />
                        <input type="hidden" name="manuscriptId" value={ms.id} />
                        <button
                          type="submit"
                          className="text-destructive text-xs underline"
                        >
                          Revoke
                        </button>
                      </form>
                    )}
                    {a.status === "SUBMITTED" && (
                      <span className="text-xs text-green-600">
                        Submitted {a.review?.submittedAt ? new Date(a.review.submittedAt).toLocaleDateString() : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Reviews panel (editorial, not HOD) */}
      {isEditorial && !isHOD && editorReviews.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-3">Submitted reviews</h2>
          <div className="space-y-6">
            {editorReviews.map((r) => (
              <div key={r.reviewId} className="rounded border p-4 text-sm">
                <p className="font-medium mb-2">{r.label} &mdash; {r.recommendation ?? "No recommendation"}</p>
                {r.commentsToAuthorHtml && (
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-1">Comments to author</p>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: r.commentsToAuthorHtml }}
                    />
                  </div>
                )}
                {r.commentsToEditorHtml && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Confidential to editor</p>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: r.commentsToEditorHtml }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
