import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Next.js preserves JSX; the test runner must compile it before import analysis.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    setupFiles: ["./tests/setup-db-mock.ts"],
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "tests/integration/**",
      ".next/**",
      "dist/**",
    ],
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge",
      APP_ACCESS_SECRET: process.env.APP_ACCESS_SECRET || "vitest-local-secret",
      JOB_SYNC_SECRET: process.env.JOB_SYNC_SECRET || "vitest-sync-secret",
    },
    alias: {
      "@": path.resolve(rootDir, "./src"),
      "@packages/schema": path.resolve(rootDir, "./packages/schema/src"),
      "@packages/core": path.resolve(rootDir, "./packages/core/src"),
    },
  },
});
