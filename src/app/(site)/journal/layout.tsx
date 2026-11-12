import type { ReactNode } from "react";
import { getJournalSettingsPublic, journalDisplayName } from "@/server/services/journal-settings";
import { JournalNav } from "./journal-nav";

export default async function JournalLayout({ children }: { children: ReactNode }) {
  let name = "Journal";
  let submissionsOpen = false;
  try {
    const settings = await getJournalSettingsPublic();
    name = journalDisplayName(settings);
    submissionsOpen = settings.submissionsOpen;
  } catch {
    // The journal still renders, with a plain name, if settings cannot be read.
  }

  return (
    <>
      <JournalNav name={name} submissionsOpen={submissionsOpen} />
      {children}
    </>
  );
}
