import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/rbac";
import { getJournalSettingsAdmin, journalNeedsSetup } from "@/server/services/journal-settings";
import { JOURNAL_LICENSES } from "@/lib/validators/journal";
import { SettingsForm } from "./settings-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function JournalSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || !hasPermission(user, "journal.manage")) {
    redirect("/403");
  }

  const settings = await getJournalSettingsAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-heading text-lg font-semibold">Journal settings</h1>
      {journalNeedsSetup(settings) ? (
        <Alert>
          <AlertDescription>
            Set the journal name, ISSN and licence before announcing the journal.
          </AlertDescription>
        </Alert>
      ) : null}
      <SettingsForm settings={settings} licenses={JOURNAL_LICENSES} />
    </div>
  );
}
