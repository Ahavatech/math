import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Removes short-lived security records once they are of no use: sign-in and
 * rate-limit attempts older than two hours (the privacy notice says "about two
 * hours"), signed-out session records whose session would have expired anyway,
 * and passkey challenges past their five minutes. The app also tidies these up
 * as it runs, but only when it is busy; this makes it certain.
 * Dry run by default; pass --apply to delete.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const now = Date.now();
  const where = {
    attempts: { at: { lt: new Date(now - 2 * 60 * 60_000) } },
    sessions: { expiresAt: { lt: new Date(now) } },
    challenges: { expiresAt: { lt: new Date(now) } },
  };

  const [attempts, sessions, challenges] = await Promise.all([
    db.loginAttempt.count({ where: where.attempts }),
    db.revokedSession.count({ where: where.sessions }),
    db.webAuthnChallenge.count({ where: where.challenges }),
  ]);
  console.log(`Sign-in and rate-limit records past two hours: ${attempts}`);
  console.log(`Signed-out session records past their expiry: ${sessions}`);
  console.log(`Expired passkey challenges: ${challenges}`);

  if (apply) {
    await db.loginAttempt.deleteMany({ where: where.attempts });
    await db.revokedSession.deleteMany({ where: where.sessions });
    await db.webAuthnChallenge.deleteMany({ where: where.challenges });
    console.log("Deleted.");
  } else if (attempts + sessions + challenges > 0) {
    console.log("Dry run only. Re-run with --apply to delete.");
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
