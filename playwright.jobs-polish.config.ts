import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "jobs-polish-verification.spec.ts", workers: 1,
  timeout: 90000, reporter: "list", outputDir: "test-results/jobs-polish-run",
  use: { baseURL: "http://127.0.0.1:3148", ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: { command: "npm run start -- -H 127.0.0.1 -p 3148", url: "http://127.0.0.1:3148", reuseExistingServer: false, timeout: 120000,
    env: { ...process.env, DEMO_MODE: "true", APP_ACCESS_SECRET: "playwright-test-secret", APP_ACCESS_PASSWORD: "playwright-test-secret" } },
});
