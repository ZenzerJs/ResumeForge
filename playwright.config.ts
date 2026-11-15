import { defineConfig, devices } from "@playwright/test";

// Pin the deterministic E2E secret instead of inheriting the developer's real
// shell secret: the middleware grants a 100/min auth rate limit only for the
// canonical "playwright-test-secret" value, so inheriting the real secret made
// the auth suite trip the production 10/min limiter and fail with 429s.
const testSecret = "playwright-test-secret";

const DEMO_SPECS = [
  "contrast-logos-verification.spec.ts",
  "jobs-polish-verification.spec.ts",
  "mobile-tablet-verification.spec.ts",
  "resume-layout-v2-verification.spec.ts",
  "suggestion-preview-verification.spec.ts",
  "tailor-polish-verification.spec.ts",
  "workspace-wave-verification.spec.ts",
];

const SCREENSHOT_SPECS = [
  "screenshots-gallery.spec.ts",
  "user-requested-screenshots.spec.ts",
  "with-ai-screenshots-gallery.spec.ts",
];

const includeScreenshots =
  process.env.PLAYWRIGHT_SCREENSHOTS === "1" ||
  process.env.PLAYWRIGHT_SCREENSHOTS === "true" ||
  process.argv.some((arg) => arg === "--project=screenshots" || arg === "screenshots");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/persistent-run",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3005",
    trace: "on-first-retry",
    storageState: "e2e/.auth/user.json",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [...DEMO_SPECS, ...SCREENSHOT_SPECS, "release/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    ...(includeScreenshots
      ? [
          {
            name: "screenshots",
            testMatch: SCREENSHOT_SPECS,
            timeout: 60_000,
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1440, height: 900 },
              trace: "off" as const,
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3005",
    url: "http://127.0.0.1:3005",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      DEMO_MODE: "false",
      APP_ACCESS_SECRET: testSecret,
      APP_ACCESS_PASSWORD: testSecret,
      JOB_SYNC_SECRET: process.env.JOB_SYNC_SECRET || "playwright-sync-secret",
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge",
    },
  },
});
