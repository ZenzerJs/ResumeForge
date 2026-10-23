import { defineConfig } from "vitest/config";
import path from "path";

const disposableSchemaPattern = /^rf_it_[0-9]+_[a-f0-9]{32}$/;
let configuredSchema = "";
try {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  configuredSchema = databaseUrl.searchParams.get("schema") ?? "";
} catch {
  throw new Error("PostgreSQL integration tests require a DATABASE_URL scoped to a disposable rf_it schema.");
}
if (!disposableSchemaPattern.test(configuredSchema)) {
  throw new Error("PostgreSQL integration tests refuse DATABASE_URL without a runner-created disposable schema.");
}

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    env: {
      VITEST_POSTGRES_INTEGRATION: "1",
      APP_ACCESS_SECRET: process.env.APP_ACCESS_SECRET || "integration-local-secret",
      JOB_SYNC_SECRET: process.env.JOB_SYNC_SECRET || "integration-sync-secret",
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@packages/schema": path.resolve(__dirname, "./packages/schema/src"),
      "@packages/core": path.resolve(__dirname, "./packages/core/src"),
    },
  },
});
