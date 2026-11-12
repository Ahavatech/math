import { defineConfig, devices } from "@playwright/test";

// E2E needs a running app against a seeded database:
//   npm run build && npm run start   (or E2E_BASE_URL pointing at staging)
//   npm run test:e2e
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        // The browser tests sign in as an admin without an authenticator app.
        env: { ADMIN_2FA_REQUIRED: "false" },
      },
});
