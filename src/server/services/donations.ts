import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getSetting } from "@/server/services/site-settings";

/**
 * The public view of the donations setting: null unless an admin has
 * switched the page on (the setting's own validation guarantees the
 * account name, bank and account number are present when it is on).
 * `updatedAt` is shown to visitors so they can see how recent the bank
 * details are.
 */
export async function getDonationsPublic(db: PrismaClient) {
  const details = await getSetting(db, "donations.details");
  if (!details.enabled || !details.accountName || !details.bankName || !details.accountNumber) {
    return null;
  }
  const row = await db.siteSetting.findUnique({
    where: { key: "donations.details" },
    select: { updatedAt: true },
  });
  return { details, updatedAt: row?.updatedAt ?? null };
}
