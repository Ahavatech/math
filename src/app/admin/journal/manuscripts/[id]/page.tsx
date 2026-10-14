import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db as prisma } from "@/lib/db";
import { getManuscriptDetail } from "@/server/services/manuscript-screening";
import {
  assignHandlingEditorAction,
  deskRejectAction,
  returnToAuthorAction,
  approveForReviewAction,
  addInternalNoteAction,
} from "@/server/actions/manuscript-screening";

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
        </section>
      )}
    </div>
  );
}
