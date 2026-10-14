import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { listBoardMembersAdmin } from "@/server/services/journal-board";
import { BoardMemberRow } from "./board-member-row";
import { BoardMemberForm } from "./board-member-form";

export default async function JournalBoardPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.manage")) {
    redirect("/403");
  }

  const [members, lecturers] = await Promise.all([
    listBoardMembersAdmin(),
    db.lecturerProfile.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Editorial board</h1>
      <BoardMemberForm lecturers={lecturers} />
      <ul className="divide-y divide-border rounded-md border border-border">
        {members.map((member) => (
          <BoardMemberRow key={member.id} member={member} lecturers={lecturers} />
        ))}
      </ul>
    </div>
  );
}
