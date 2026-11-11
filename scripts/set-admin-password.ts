/**
 * Sets a password for an existing user. For demos where email (invites and
 * password reset) is not configured. Refuses to run with NODE_ENV=production.
 *
 *   npx tsx scripts/set-admin-password.ts <email> <password>
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run with NODE_ENV=production.");
    process.exit(1);
  }
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 10) {
    console.error("Usage: npx tsx scripts/set-admin-password.ts <email> <password of 10+ characters>");
    process.exit(1);
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await db.user.update({
      where: { email },
      data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
    });
    console.log(`Password set for ${email}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.code === "P2025" ? "No user with that email." : e);
  process.exit(1);
});
