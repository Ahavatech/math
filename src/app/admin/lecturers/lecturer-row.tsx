"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Ellipsis } from "lucide-react";
import { rankLabel } from "@/lib/lecturer-rank";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  sendLecturerInviteAction,
  publishLecturerAction,
  unpublishLecturerAction,
  archiveLecturerAction,
  restoreLecturerAction,
  setLecturerAccountActiveAction,
  reorderLecturerAction,
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
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

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

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", lecturer.id);
      fd.set("direction", direction);
      await reorderLecturerAction(fd);
      window.location.reload();
    });
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={`/admin/lecturers/${lecturer.id}`} className="font-medium hover:underline">
            {lecturer.fullName}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{rankLabel(lecturer.rank as never)}</Badge>
            <StatusBadge status={lecturer.status} />
            <Badge variant="outline">{INVITE_LABELS[lecturer.inviteState] ?? lecturer.inviteState}</Badge>
            <span>{completeness}% complete</span>
            {lecturer.publishRequestedAt && lecturer.status !== "PUBLISHED" ? (
              <Badge>Publishing requested</Badge>
            ) : null}
            {!lecturer.user.isActive ? <Badge variant="destructive">Deactivated</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The one thing most often done here stays on the row; the rest is in the menu. */}
          {lecturer.status === "PUBLISHED" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => runAction(unpublishLecturerAction)} disabled={pending} aria-label={`Unpublish: ${lecturer.fullName}`}>
              Unpublish
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => runAction(publishLecturerAction)} disabled={pending} aria-label={`Publish: ${lecturer.fullName}`}>
              Publish
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" size="icon" variant="outline" aria-label={`More actions: ${lecturer.fullName}`} disabled={pending} />}
            >
              <Ellipsis aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={sendInvite}>
                {lecturer.inviteState === "not_invited" ? "Send invite" : "Resend invite"}
              </DropdownMenuItem>
              {lecturer.status === "PUBLISHED" ? (
                <DropdownMenuItem onClick={() => window.open(`/lecturer/${lecturer.slug}`, "_blank", "noopener,noreferrer")}>
                  View public page
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => move("up")}>Move up in the list</DropdownMenuItem>
              <DropdownMenuItem onClick={() => move("down")}>Move down in the list</DropdownMenuItem>
              <DropdownMenuSeparator />
              {lecturer.status === "ARCHIVED" ? (
                <DropdownMenuItem onClick={() => runAction(restoreLecturerAction)}>Restore</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => runAction(archiveLecturerAction)}>Archive</DropdownMenuItem>
              )}
              {lecturer.user.isActive ? (
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeactivate(true)}>
                  Deactivate account
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={toggleActive}>Reactivate account</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            open={confirmDeactivate}
            onOpenChange={setConfirmDeactivate}
            title={`Deactivate ${lecturer.fullName}'s account?`}
            description="They are signed out within a minute and cannot sign in until you reactivate the account. Their public profile is not changed."
            confirmLabel="Deactivate"
            onConfirm={toggleActive}
          />
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
