import type { Permission } from "@/lib/rbac";

/**
 * Which permission a caller needs to upload into a given media folder
 * (oau-maths/{entity}/). Shared by the signing route and the register
 * action so both enforce the same rule. "site" covers identity, hero,
 * HOD, announcement, contact and footer settings.
 */
export const MEDIA_FOLDERS = [
  "site",
  "lecturers",
  "news",
  "events",
  "alumni",
  "research",
  "journal",
] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

const FOLDER_PERMISSIONS: Record<MediaFolder, Permission> = {
  site: "site.edit",
  lecturers: "lecturers.manage",
  news: "news.manage",
  events: "events.manage",
  alumni: "alumni.review",
  research: "site.edit",
  journal: "journal.edit",
};

export function isMediaFolder(value: string): value is MediaFolder {
  return (MEDIA_FOLDERS as readonly string[]).includes(value);
}

export function permissionForFolder(folder: MediaFolder): Permission {
  return FOLDER_PERMISSIONS[folder];
}

export function cloudinaryFolder(folder: MediaFolder): string {
  return `oau-maths/${folder}`;
}
