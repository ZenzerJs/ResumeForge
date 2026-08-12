import { defineConfig, devices } from "@playwright/test";

const testSecret = process.env.APP_ACCESS_SECRET || "playwright-test-secret";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3005",
    trace: "on-first-retry",
    storageState: "e2e/.auth/user.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start -- -p 3005",
    url: "http://localhost:3005",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      APP_ACCESS_SECRET: testSecret,
      APP_ACCESS_PASSWORD: testSecret,
      JOB_SYNC_SECRET: process.env.JOB_SYNC_SECRET || "playwright-sync-secret",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge",
    },
  },
});
