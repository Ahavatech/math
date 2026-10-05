import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Connects to TEST_DATABASE_URL and returns a ready client, or null if no
 * URL is configured or the database is unreachable. Tests in this folder
 * skip themselves (via describe.skipIf) rather than failing when this
 * returns null, so `npm run test` stays green with no database present.
 */
export async function getTestDb(): Promise<PrismaClient | null> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;

  const adapter = new PrismaPg({ connectionString: url });
  const client = new PrismaClient({ adapter });

  try {
    await client.$queryRaw`SELECT 1`;
    return client;
  } catch {
    await client.$disconnect();
    return null;
  }
}
