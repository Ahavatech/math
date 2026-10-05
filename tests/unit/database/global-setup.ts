import "dotenv/config";
import { execFileSync } from "node:child_process";

/**
 * Vitest globalSetup: applies the committed migrations to
 * TEST_DATABASE_URL before any database test runs, so the suites in
 * this folder see real tables rather than an empty database. Runs
 * once per `vitest run`, skipped entirely when TEST_DATABASE_URL is
 * not configured (the per-file describe.skipIf guards then apply).
 */
export default function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) return;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
    // Static, hardcoded args only (no interpolation), so shell:true here
    // carries none of the injection risk Node's deprecation warning is
    // about; it's required on Windows to resolve npx's .cmd shim.
    shell: true,
  });
}
