import type { LecturerRank } from "@prisma/client";
import { rankSeniorityIndex } from "@/lib/lecturer-rank";

function familyName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

/**
 * Public listing order: rank seniority, then the admin-set `order`, then
 * family name. Deliberately does not special-case any role (e.g. the
 * HOD) - if a specific profile should show first, that is what `order`
 * is for.
 */
export function sortLecturersForDirectory<T extends { rank: LecturerRank; order: number; fullName: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const rankDiff = rankSeniorityIndex(a.rank) - rankSeniorityIndex(b.rank);
    if (rankDiff !== 0) return rankDiff;
    if (a.order !== b.order) return a.order - b.order;
    return familyName(a.fullName).localeCompare(familyName(b.fullName));
  });
}
