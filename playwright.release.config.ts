import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.RELEASE_E2E_BASE_URL;
if (!baseURL || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) {
  throw new Error("Release E2E requires an owned loopback server via RELEASE_E2E_BASE_URL.");
}

export default defineConfig({
  testDir: "./e2e/release",
  outputDir: `./test-results/release-${process.env.RELEASE_E2E_MODE || "run"}`,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
