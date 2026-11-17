import { redirect } from "next/navigation";
import { AdminEmpty } from "@/components/admin/admin-bits";
import { revalidatePath } from "next/cache";
import { getCurrentUser, hasPermission, hasRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PageNav } from "@/components/ui/filter-links";
import { StatusBadge } from "@/components/admin/status-badge";

const PER_PAGE = 25;

export function generateMetadata() {
  return { title: "Reviewers" };
}

async function updateReviewerProfile(formData: FormData): Promise<void> {
  "use server";
  const session = await import("@/auth").then((m) => m.auth());
  if (!session?.user) return;
  const actor = { id: session.user.id, roles: session.user.roles, isActive: session.user.isActive ?? true };
  if (!hasPermission(actor, "journal.editorial") || hasRole(actor, "HOD")) return;

  const userId = formData.get("userId") as string;
  const expertiseTags = (formData.get("expertiseTags") as string)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const isActive = formData.get("isActive") === "1";
  const notes = (formData.get("notes") as string) || null;

  await db.reviewerProfile.upsert({
    where: { userId },
    create: { userId, expertiseTags, isActive, notes },
    update: { expertiseTags, isActive, notes },
  });

  revalidatePath("/admin/journal/reviewers");
}

export default async function AdminJournalReviewersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasPermission(user, "journal.editorial") || hasRole(user, "HOD")) {
    redirect("/admin");
  }

  const requested = Number((await searchParams).page);
  const total = await db.userRole.count({ where: { role: "REVIEWER" } });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Number.isFinite(requested) && requested >= 1 ? Math.min(Math.floor(requested), totalPages) : 1;

  const reviewers = await db.userRole.findMany({
    where: { role: "REVIEWER" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          reviewerProfile: true,
          _count: { select: { reviewAssignments: true } },
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Reviewers</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Users with the REVIEWER role ({total} in all). Edit expertise, active status and notes below.
      </p>
      {reviewers.length === 0 ? (
        <AdminEmpty title="No reviewers found">Reviewers are added when an editor invites them from a manuscript, and are listed here once they have an account.</AdminEmpty>
      ) : (
        <div className="space-y-6">
          {reviewers.map(({ user: u }) => {
            const profile = u.reviewerProfile;
            return (
              <div key={u.id} className="rounded border p-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{u.name ?? "-"}</p>
                    <p className="text-muted-foreground">{u.email}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {u._count.reviewAssignments} assignment(s) &middot;{" "}
                      {u.emailVerifiedAt ? (
                        <span className="font-medium text-foreground">verified</span>
                      ) : (
                        <span>unverified</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={profile?.isActive !== false ? "ACTIVE" : "ARCHIVED"} />
                </div>

                <form action={updateReviewerProfile} className="mt-3 space-y-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <div>
                    <label htmlFor={`tags-${u.id}`} className="mb-0.5 block text-sm font-medium">
                      Expertise tags (comma-separated)
                    </label>
                    <input
                      id={`tags-${u.id}`}
                      name="expertiseTags"
                      defaultValue={profile?.expertiseTags.join(", ") ?? ""}
                      className="w-full rounded border px-2 py-1 text-sm"
                      placeholder="e.g. analysis, topology, number theory"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      value="1"
                      id={`active-${u.id}`}
                      defaultChecked={profile?.isActive !== false}
                    />
                    <label htmlFor={`active-${u.id}`} className="text-sm">
                      Available for new assignments
                    </label>
                  </div>
                  <div>
                    <label htmlFor={`notes-${u.id}`} className="mb-0.5 block text-sm font-medium">
                      Editor notes (confidential)
                    </label>
                    <textarea
                      id={`notes-${u.id}`}
                      name="notes"
                      defaultValue={profile?.notes ?? ""}
                      rows={2}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded bg-primary text-primary-foreground px-3 py-1 text-xs font-medium"
                  >
                    Save
                  </button>
                </form>
              </div>
            );
          })}
          {totalPages > 1 ? (
            <PageNav page={page} totalPages={totalPages} hrefFor={(target) => `/admin/journal/reviewers?page=${target}`} />
          ) : null}
        </div>
      )}
    </div>
  );
}
