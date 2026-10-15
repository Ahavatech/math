import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listAlumniEntriesAdmin, findPossibleDuplicates } from "@/server/services/alumni-entries";
import { Badge } from "@/components/ui/badge";
import { EntryRow } from "./entry-row";
import { BulkApproveBar } from "./bulk-approve-bar";

const TABS = ["pending", "approved", "rejected", "withdrawn"] as const;
type Tab = (typeof TABS)[number];

const STATUS_FOR_TAB: Record<Tab, "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN"> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  withdrawn: "WITHDRAWN",
};

export default async function AdminAlumniPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "alumni.review")) {
    redirect("/403");
  }

  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "pending";
  const entries = await listAlumniEntriesAdmin(db, STATUS_FOR_TAB[tab]);

  const flagged = new Map<string, boolean>();
  if (tab === "pending") {
    await Promise.all(
      entries.map(async (entry) => {
        const dupes = await findPossibleDuplicates(db, entry.dedupeKey, entry.id);
        flagged.set(entry.id, dupes.length > 0);
      }),
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Alumni</h1>
        <Link href="/admin/alumni/links" className="text-sm text-primary underline">
          Links
        </Link>
      </div>

      <div className="flex gap-4 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/alumni?tab=${t}`}
            className={t === tab ? "font-semibold underline" : "text-muted-foreground"}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>

      {tab === "pending" && entries.length > 0 ? (
        <BulkApproveBar unflaggedIds={entries.filter((e) => !flagged.get(e.id)).map((e) => e.id)} />
      ) : null}

      <ul className="space-y-2">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} isDuplicateFlagged={Boolean(flagged.get(entry.id))} tab={tab} />
        ))}
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No entries here.</p> : null}
      </ul>

      {tab === "pending" ? (
        <p className="text-xs text-muted-foreground">
          <Badge variant="outline">Possible duplicate</Badge> means another pending or approved entry shares a
          similar name and the same graduation year. Review it individually before approving.
        </p>
      ) : null}
    </div>
  );
}
