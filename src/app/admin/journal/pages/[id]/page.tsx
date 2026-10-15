import { redirect, notFound } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { getJournalPageAdmin } from "@/server/services/journal-pages";
import { JournalPageForm } from "./journal-page-form";

export default async function JournalPageEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.manage")) {
    redirect("/403");
  }

  const { id } = await params;
  let page;
  try {
    page = await getJournalPageAdmin(id);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="font-heading text-lg font-semibold">{page.title}</h1>
      <JournalPageForm page={page} />
    </div>
  );
}
