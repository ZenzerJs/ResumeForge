import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "resume-layout-v2-verification.spec.ts",
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3005", ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3005",
    url: "http://127.0.0.1:3005",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      DEMO_MODE: "true",
      APP_ACCESS_SECRET: "playwright-test-secret",
      APP_ACCESS_PASSWORD: "playwright-test-secret",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge",
    },
  },
});
