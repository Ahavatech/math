"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeBoardMemberAction, reorderBoardMemberAction } from "@/server/actions/journal-board";

type Member = {
  id: string;
  name: string;
  roleTitle: string;
  isActive: boolean;
  lecturerProfile: { fullName: string; status: string } | null;
};

export function BoardMemberRow({ member }: { member: Member; lecturers: { id: string; fullName: string }[] }) {
  const [pending, startTransition] = useTransition();
  const displayName = member.lecturerProfile?.fullName ?? member.name;

  return (
    <li className="flex items-center justify-between gap-4 p-3 text-sm">
      <div>
        <p className="font-medium">{displayName}</p>
        <p className="text-muted-foreground">
          {member.roleTitle}
          {!member.isActive ? " - inactive" : ""}
          {member.lecturerProfile && member.lecturerProfile.status !== "PUBLISHED" ? " - lecturer profile not published" : ""}
        </p>
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => reorderBoardMemberAction(member.id, "up"))}>Up</Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => reorderBoardMemberAction(member.id, "down"))}>Down</Button>
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => startTransition(() => removeBoardMemberAction(member.id))}>Remove</Button>
      </div>
    </li>
  );
}
