import { defineConfig, devices } from "@playwright/test";

export const DEMO_SPECS = [
  "contrast-logos-verification.spec.ts",
  "jobs-polish-verification.spec.ts",
  "mobile-tablet-verification.spec.ts",
  "resume-layout-v2-verification.spec.ts",
  "suggestion-preview-verification.spec.ts",
  "tailor-polish-verification.spec.ts",
  "workspace-wave-verification.spec.ts",
];

export default defineConfig({
  testDir: "./e2e",
  testMatch: DEMO_SPECS,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  outputDir: "test-results/demo-run",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3006",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3006",
    url: "http://127.0.0.1:3006",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DEMO_MODE: "true",
      APP_ACCESS_SECRET: "playwright-test-secret",
      APP_ACCESS_PASSWORD: "playwright-test-secret",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge",
    },
  },
});
