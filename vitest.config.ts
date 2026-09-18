import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    exclude: ["node_modules", "e2e/**"],
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge",
      APP_ACCESS_SECRET: process.env.APP_ACCESS_SECRET || "vitest-local-secret",
      JOB_SYNC_SECRET: process.env.JOB_SYNC_SECRET || "vitest-sync-secret",
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
