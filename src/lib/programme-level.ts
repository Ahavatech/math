import type { ProgrammeLevel } from "@prisma/client";

const SLUG_TO_LEVEL: Record<string, ProgrammeLevel> = {
  bsc: "BSC",
  msc: "MSC",
  phd: "PHD",
};

const LEVEL_TO_SLUG: Record<ProgrammeLevel, string> = {
  BSC: "bsc",
  MSC: "msc",
  PHD: "phd",
};

export function levelSlugToEnum(slug: string): ProgrammeLevel | null {
  return SLUG_TO_LEVEL[slug] ?? null;
}

export function enumToLevelSlug(level: ProgrammeLevel): string {
  return LEVEL_TO_SLUG[level];
}
