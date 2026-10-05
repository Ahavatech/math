import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Duplicates src/server/services/tokens.ts's issuing logic rather than
 * importing it: that module starts with `import "server-only"`, which
 * throws unconditionally outside a Next.js build (this script runs
 * under plain tsx), not just when actually imported into client code.
 */
async function issueInviteToken(db: PrismaClient, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.$transaction(async (tx) => {
    await tx.userToken.updateMany({
      where: { userId, type: "INVITE", usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.userToken.create({
      data: { userId, type: "INVITE", tokenHash, expiresAt },
    });
  });

  return token;
}

/**
 * Creates (or reuses) the SUPER_ADMIN user for SEED_ADMIN_EMAIL and
 * prints a fresh invite URL. Refuses in production, since printing an
 * invite link to a terminal is a development-only convenience.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("admin:invite refuses to run when NODE_ENV=production.");
    process.exit(1);
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("SEED_ADMIN_EMAIL is not set.");
    process.exit(1);
  }

  const authUrl = process.env.AUTH_URL;
  if (!authUrl) {
    console.error("AUTH_URL is not set.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  try {
    const user = await db.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: "Super Admin", isActive: true },
      update: {},
    });

    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role: "SUPER_ADMIN" } },
      create: { userId: user.id, role: "SUPER_ADMIN" },
      update: {},
    });

    const token = await issueInviteToken(db, user.id);
    const acceptUrl = new URL(`/accept-invite/${token}`, authUrl).toString();

    console.log(`\nInvite URL for ${adminEmail}:\n${acceptUrl}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
