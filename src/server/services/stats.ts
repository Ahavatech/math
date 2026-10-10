import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getSetting } from "@/server/services/site-settings";

export type StatValue = { mode: "auto" | "manual"; value: number };
export type HomepageStats = {
  staff: StatValue;
  alumni: StatValue;
  programmes: StatValue;
  researchAreas: StatValue;
};

async function computeAutoValues(db: PrismaClient) {
  const [staff, alumni, programmes, researchAreas] = await Promise.all([
    db.lecturerProfile.count({ where: { status: "PUBLISHED", isEmeritus: false } }),
    db.alumniEntry.count({ where: { status: "APPROVED" } }),
    db.programme.count({ where: { status: "PUBLISHED" } }),
    db.researchArea.count({ where: { status: "PUBLISHED" } }),
  ]);
  return { staff, alumni, programmes, researchAreas };
}

function resolve(
  config: { mode: "auto" | "manual"; manualValue: number | null },
  autoValue: number,
): StatValue {
  const value = config.mode === "manual" && config.manualValue !== null ? config.manualValue : autoValue;
  return { mode: config.mode, value };
}

/** Safe fallback (all zeros, mode "auto") if the database is unreachable. */
export async function getHomepageStats(db: PrismaClient): Promise<HomepageStats> {
  try {
    const [settings, auto] = await Promise.all([
      getSetting(db, "homepage.stats"),
      computeAutoValues(db),
    ]);

    return {
      staff: resolve(settings.staff, auto.staff),
      alumni: resolve(settings.alumni, auto.alumni),
      programmes: resolve(settings.programmes, auto.programmes),
      researchAreas: resolve(settings.researchAreas, auto.researchAreas),
    };
  } catch {
    return {
      staff: { mode: "auto", value: 0 },
      alumni: { mode: "auto", value: 0 },
      programmes: { mode: "auto", value: 0 },
      researchAreas: { mode: "auto", value: 0 },
    };
  }
}
