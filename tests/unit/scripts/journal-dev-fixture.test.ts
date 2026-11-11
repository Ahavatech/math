import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getTestDb } from "../database/test-db";

const db = await getTestDb();

function runFixture(args: string[], storageDir: string) {
  return execFileSync("npx", ["tsx", "scripts/journal-dev-fixture.ts", ...args], {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      PRIVATE_STORAGE_DIR: storageDir,
    },
  });
}

async function counts() {
  return {
    manuscripts: await db!.manuscript.count({ where: { title: { startsWith: "[DEV FIXTURE]" } } }),
    users: await db!.user.count({ where: { email: { startsWith: "dev-fixture-" } } }),
    files: await db!.manuscriptFile.count({ where: { manuscript: { title: { startsWith: "[DEV FIXTURE]" } } } }),
  };
}

describe.skipIf(db === null)("journal-dev-fixture script", () => {
  it("create adds the fixture rows and file, --remove deletes all of them", async () => {
    const storage = mkdtempSync(path.join(tmpdir(), "fixture-"));
    try {
      runFixture(["--remove"], storage); // start clean
      const before = await counts();
      expect(before).toEqual({ manuscripts: 0, users: 0, files: 0 });

      runFixture([], storage);
      const created = await counts();
      expect(created.manuscripts).toBe(1);
      expect(created.users).toBe(4);
      expect(created.files).toBe(1);
      expect(readdirSync(storage).length).toBeGreaterThan(0);

      runFixture(["--remove"], storage);
      expect(await counts()).toEqual({ manuscripts: 0, users: 0, files: 0 });
      expect(readdirSync(storage)).toEqual([]);
    } finally {
      rmSync(storage, { recursive: true, force: true });
    }
  }, 120_000);
});
