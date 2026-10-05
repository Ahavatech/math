import "dotenv/config";
import { execFileSync } from "node:child_process";

/**
 * Drops, re-migrates and re-seeds the dev database (DATABASE_URL).
 * Refuses outright in production, since `prisma migrate reset` is
 * destructive by design.
 */
if (process.env.NODE_ENV === "production") {
  console.error("db:reset refuses to run when NODE_ENV=production.");
  process.exit(1);
}

const options = {
  stdio: "inherit" as const,
  // Static, hardcoded args only (no interpolation), so shell:true here
  // carries none of the injection risk Node's deprecation warning is
  // about; it's required on Windows to resolve npx's .cmd shim.
  shell: true,
};

// This Prisma version's `migrate reset` does not seed on its own (no
// --skip-seed flag exists, and it does not run prisma/seed.ts), so the
// seed step is run explicitly rather than assumed.
execFileSync("npx", ["prisma", "migrate", "reset", "--force"], options);
execFileSync("npx", ["prisma", "db", "seed"], options);
