import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "contrast-logos-verification.spec.ts", workers: 1,
  timeout: 90000, reporter: "list", outputDir: "test-results/contrast-logos-run",
  use: { baseURL: "http://127.0.0.1:3149", ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: { command: "npm run start -- -H 127.0.0.1 -p 3149", url: "http://127.0.0.1:3149", reuseExistingServer: false, timeout: 120000,
    env: { ...process.env, DEMO_MODE: "true", APP_ACCESS_SECRET: "playwright-test-secret", APP_ACCESS_PASSWORD: "playwright-test-secret" } },
});
