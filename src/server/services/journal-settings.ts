import "server-only";
import { db } from "@/lib/db";
import { getSetting, setSetting, listRevisions as listSettingRevisions, restoreSetting } from "@/server/services/site-settings";
import type { AuditRequestContext } from "@/server/services/audit";
import type { JournalSettings } from "@/lib/validators/journal";

export const DEFAULT_JOURNAL_NAME = "Departmental Journal";

/** Public-safe journal settings read, with a neutral fallback name until the HOD sets a real one. */
export async function getJournalSettingsPublic(): Promise<JournalSettings> {
  try {
    return await getSetting(db, "journal.settings");
  } catch {
    return {
      name: "",
      shortName: "",
      issn: "",
      eissn: "",
      publisher: "",
      frequency: "",
      license: "All rights reserved",
      licenseUrl: "",
      customLicenseText: "",
      contactEmail: "",
      submissionsOpen: false,
      citeAsPublisher: "",
      reviewsRequired: 2,
      reviewDueDays: 21,
      invitationExpiryDays: 14,
    };
  }
}

export function journalDisplayName(settings: Pick<JournalSettings, "name">): string {
  return settings.name.trim() || DEFAULT_JOURNAL_NAME;
}

/** True until the HOD/editor-in-chief has set at least a name, ISSN or licence. */
export function journalNeedsSetup(settings: JournalSettings): boolean {
  return !settings.name.trim();
}

export async function getJournalSettingsAdmin() {
  return getSetting(db, "journal.settings");
}

export async function saveJournalSettings(
  value: unknown,
  actorId: string,
  context?: AuditRequestContext,
): Promise<void> {
  await setSetting(db, "journal.settings", value, actorId, context);
}

export async function listJournalSettingsRevisions() {
  return listSettingRevisions(db, "journal.settings");
}

export async function restoreJournalSettings(revisionId: string, actorId: string, context?: AuditRequestContext) {
  await restoreSetting(db, "journal.settings", revisionId, actorId, context);
}
