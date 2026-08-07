import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    exclude: ["node_modules", "e2e/**"],
    fileParallelism: false,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
