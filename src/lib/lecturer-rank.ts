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
