import type { LecturerRank } from "@prisma/client";

export const RANK_LABELS: Record<LecturerRank, string> = {
  PROFESSOR: "Professor",
  ASSOCIATE_PROFESSOR: "Associate Professor",
  SENIOR_LECTURER: "Senior Lecturer",
  LECTURER_I: "Lecturer I",
  LECTURER_II: "Lecturer II",
  ASSISTANT_LECTURER: "Assistant Lecturer",
  GRADUATE_ASSISTANT: "Graduate Assistant",
  OTHER: "Staff",
};

export function rankLabel(rank: LecturerRank): string {
  return RANK_LABELS[rank] ?? rank;
}

const RANK_ALIASES: Record<string, LecturerRank> = {
  PROFESSOR: "PROFESSOR",
  PROF: "PROFESSOR",
  "ASSOCIATE PROFESSOR": "ASSOCIATE_PROFESSOR",
  "ASSOC PROFESSOR": "ASSOCIATE_PROFESSOR",
  "ASSOC. PROFESSOR": "ASSOCIATE_PROFESSOR",
  "SENIOR LECTURER": "SENIOR_LECTURER",
  "SNR LECTURER": "SENIOR_LECTURER",
  "SR LECTURER": "SENIOR_LECTURER",
  "SR. LECTURER": "SENIOR_LECTURER",
  "LECTURER I": "LECTURER_I",
  "LECTURER 1": "LECTURER_I",
  "LECTURER II": "LECTURER_II",
  "LECTURER 2": "LECTURER_II",
  "ASSISTANT LECTURER": "ASSISTANT_LECTURER",
  "GRADUATE ASSISTANT": "GRADUATE_ASSISTANT",
  OTHER: "OTHER",
};

/**
 * Tolerant human-input rank parser for the CSV bulk import: normalises
 * case, trailing full stops and repeated whitespace, then looks the
 * result up in a fixed alias table. Returns null rather than guessing
 * for anything ambiguous (bare "Lecturer" could be I or II) or
 * unrecognised, so the import's dry-run step can report it instead of
 * silently assigning the wrong rank.
 */
export function parseRank(input: string): LecturerRank | null {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/\.(?!$)/g, "")
    .replace(/\.$/, "")
    .replace(/\s+/g, " ");
  return RANK_ALIASES[normalized] ?? null;
}
