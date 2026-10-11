"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rankLabel } from "@/lib/lecturer-rank";
import {
  sendLecturerInviteAction,
  publishLecturerAction,
  unpublishLecturerAction,
  archiveLecturerAction,
  restoreLecturerAction,
  setLecturerAccountActiveAction,
} from "@/server/actions/lecturers";

const INVITE_LABELS: Record<string, string> = {
  not_invited: "Not invited",
  invited: "Invited",
  accepted: "Accepted",
  expired: "Expired",
};

type LecturerRowData = {
  id: string;
  fullName: string;
  rank: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  slug: string;
  publishRequestedAt: Date | null;
  inviteState: string;
  user: { id: string; isActive: boolean };
};

export function LecturerRow({ lecturer, completeness }: { lecturer: LecturerRowData; completeness: number }) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function sendInvite() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", lecturer.user.id);
      const res = await sendLecturerInviteAction(fd);
      if (res.inviteUrl) setInviteUrl(res.inviteUrl);
    });
  }

  function runAction(action: (fd: FormData) => Promise<void>) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", lecturer.id);
      await action(fd);
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", lecturer.user.id);
      fd.set("isActive", lecturer.user.isActive ? "false" : "true");
      await setLecturerAccountActiveAction(fd);
    });
  }

  return (
    <li className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={`/admin/lecturers/${lecturer.id}`} className="font-medium hover:underline">
            {lecturer.fullName}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{rankLabel(lecturer.rank as never)}</Badge>
            <Badge variant="secondary">{lecturer.status}</Badge>
            <Badge variant="outline">{INVITE_LABELS[lecturer.inviteState] ?? lecturer.inviteState}</Badge>
            <span>{completeness}% complete</span>
            {lecturer.publishRequestedAt && lecturer.status !== "PUBLISHED" ? (
              <Badge>Publishing requested</Badge>
            ) : null}
            {!lecturer.user.isActive ? <Badge variant="destructive">Deactivated</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="button" size="sm" variant="outline" onClick={sendInvite} disabled={pending}>
            {lecturer.inviteState === "not_invited" ? "Send invite" : "Resend invite"}
          </Button>
          {lecturer.status === "PUBLISHED" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => runAction(unpublishLecturerAction)} disabled={pending}>
              Unpublish
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => runAction(publishLecturerAction)} disabled={pending}>
              Publish
            </Button>
          )}
          {lecturer.status === "ARCHIVED" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => runAction(restoreLecturerAction)} disabled={pending}>
              Restore
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => runAction(archiveLecturerAction)} disabled={pending}>
              Archive
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={toggleActive} disabled={pending}>
            {lecturer.user.isActive ? "Deactivate" : "Reactivate"}
          </Button>
          {lecturer.status === "PUBLISHED" ? (
            <a href={`/lecturer/${lecturer.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
              View public
            </a>
          ) : null}
        </div>
      </div>
      {inviteUrl ? (
        <div className="rounded-md bg-muted p-2 text-xs">
          <p className="mb-1 text-muted-foreground">Invite link (copy now, shown once):</p>
          <code className="break-all">{inviteUrl}</code>
        </div>
      ) : null}
    </li>
  );
}
