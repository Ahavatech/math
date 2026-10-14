import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listContactMessagesAdmin } from "@/server/services/contact";
import { getSetting } from "@/server/services/site-settings";
import { Badge } from "@/components/ui/badge";
import { NotificationSettingsForm } from "./notification-settings-form";

const STATUSES = ["NEW", "READ", "REPLIED", "ARCHIVED"] as const;
const TYPES = ["ADMISSIONS", "RESEARCH", "COLLABORATION", "ALUMNI", "GENERAL"] as const;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "contact.manage")) {
    redirect("/403");
  }

  const params = await searchParams;
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number]) ? (params.status as (typeof STATUSES)[number]) : undefined;
  const type = TYPES.includes(params.type as (typeof TYPES)[number]) ? (params.type as (typeof TYPES)[number]) : undefined;

  const [messages, notificationEmail] = await Promise.all([
    listContactMessagesAdmin(db, { status, type, q: params.q }),
    getSetting(db, "contact.notificationEmail"),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Messages</h1>

      <NotificationSettingsForm currentValue={notificationEmail} />

      <form method="get" className="flex flex-wrap gap-2">
        <input type="search" name="q" defaultValue={params.q} placeholder="Search name, email or subject" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <select name="status" defaultValue={params.status ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="type" defaultValue={params.type ?? ""} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-md border border-input px-3 text-sm">Filter</button>
      </form>

      <ul className="space-y-2">
        {messages.map((message) => (
          <li key={message.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div>
              <Link href={`/admin/messages/${message.id}`} className="font-medium hover:underline">
                {message.subject}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{message.status}</Badge>
                <Badge variant="outline">{message.type}</Badge>
                <span>{message.name}</span>
                <span>{message.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          </li>
        ))}
        {messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages match.</p> : null}
      </ul>
    </div>
  );
}
