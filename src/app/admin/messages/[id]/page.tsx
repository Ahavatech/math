import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { getContactMessageAdmin, resolveAlumniRefForMessage } from "@/server/services/contact";
import { contextFromHeaders } from "@/server/services/audit";
import { headers } from "next/headers";
import { StatusActions } from "./status-actions";

export default async function AdminMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "contact.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let message;
  try {
    message = await getContactMessageAdmin(db, id, user.id, contextFromHeaders(await headers()));
  } catch {
    notFound();
  }

  const alumniEntry = await resolveAlumniRefForMessage(db, message);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/messages" className="text-sm text-primary underline">
        Back to messages
      </Link>
      <h1 className="font-heading text-lg font-semibold">{message.subject}</h1>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">From</dt>
          <dd>{message.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{message.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd>{message.type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Received</dt>
          <dd>{message.createdAt.toLocaleString()}</dd>
        </div>
      </dl>

      {alumniEntry ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm">
          <p className="font-medium">Alumni entry found: {alumniEntry.fullName}</p>
          <p className="text-muted-foreground">
            Entry email: {alumniEntry.email} - {alumniEntry.email === message.email ? "matches the sender" : "does not match the sender, verify before acting"}
          </p>
          <Link href={`/admin/alumni/${alumniEntry.id}`} className="text-primary underline">
            Open this entry to withdraw or erase it
          </Link>
        </div>
      ) : null}

      <div className="whitespace-pre-wrap rounded-md border border-border p-4 text-sm">{message.message}</div>

      <a
        href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}
        className="inline-block text-sm text-primary underline"
      >
        Reply by email
      </a>

      <StatusActions id={message.id} status={message.status} />
    </div>
  );
}
