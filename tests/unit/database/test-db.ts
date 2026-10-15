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

  // Safety guard: refuse to connect unless the database name ends in _test.
  // This prevents accidental connection to the dev or production database when
  // TEST_DATABASE_URL is misconfigured.
  const dbName = url.split("/").pop()?.split("?")[0] ?? "";
  if (!dbName.endsWith("_test")) {
    console.error(
      `[test-db.ts] Refusing to connect: database "${dbName}" does not end in "_test". ` +
        `Set TEST_DATABASE_URL to a database whose name ends in "_test".`,
    );
    return null;
  }

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
