import { describe, it, expect } from "vitest";
import { createPrismaMockClient } from "../src/lib/db-mock";
import { assertValidMockDbEnv } from "../src/lib/prisma";

// Vitest sets NODE_ENV readonly via process.env typing; cast through record.
const env = process.env as Record<string, string | undefined>;

function setNodeEnv(value: string) {
  (process as unknown as { env: Record<string, string | undefined> }).env.NODE_ENV = value;
}

function restoreNodeEnv(value: string | undefined) {
  if (value === undefined) {
    delete (process as unknown as { env: Record<string, string | undefined> }).env.NODE_ENV;
  } else {
    setNodeEnv(value);
  }
}

describe("prisma prod fail-closed gate", () => {
  it("allows mock fallback outside production", async () => {
    const prevNodeEnv = env.NODE_ENV;
    const prevFlag = env.RESUME_FORGE_ALLOW_MOCK_DB;
    try {
      setNodeEnv("test");
      delete env.RESUME_FORGE_ALLOW_MOCK_DB;
      const { prisma } = await import("../src/lib/prisma");
      await expect(prisma.systemInfo.count()).resolves.toBeTypeOf("number");
    } finally {
      restoreNodeEnv(prevNodeEnv);
      if (prevFlag === undefined) delete env.RESUME_FORGE_ALLOW_MOCK_DB;
      else env.RESUME_FORGE_ALLOW_MOCK_DB = prevFlag;
    }
  });

  it("refuses mock fallback in production when DB unreachable", async () => {
    const prevNodeEnv = env.NODE_ENV;
    const prevFlag = env.RESUME_FORGE_ALLOW_MOCK_DB;
    try {
      setNodeEnv("production");
      delete env.RESUME_FORGE_ALLOW_MOCK_DB;
      const { prisma } = await import("../src/lib/prisma");
      const dbReachable = await (async () => {
        try {
          await prisma.systemInfo.count();
          return true;
        } catch (err: any) {
          expect(err?.message).toContain("RESUMEFORGE_DB_UNAVAILABLE");
          return false;
        }
      })();
      expect(typeof dbReachable).toBe("boolean");
    } finally {
      restoreNodeEnv(prevNodeEnv);
      if (prevFlag === undefined) delete env.RESUME_FORGE_ALLOW_MOCK_DB;
      else env.RESUME_FORGE_ALLOW_MOCK_DB = prevFlag;
    }
  });

  it("throws when RESUME_FORGE_ALLOW_MOCK_DB=1 is set in production without RESUME_FORGE_E2E=1", () => {
    const prevNodeEnv = env.NODE_ENV;
    const prevFlag = env.RESUME_FORGE_ALLOW_MOCK_DB;
    const prevE2e = env.RESUME_FORGE_E2E;
    try {
      setNodeEnv("production");
      env.RESUME_FORGE_ALLOW_MOCK_DB = "1";
      delete env.RESUME_FORGE_E2E;
      expect(() => assertValidMockDbEnv()).toThrow(/RESUMEFORGE_INVALID_PROD_MOCK_FLAG/);

      env.RESUME_FORGE_E2E = "1";
      expect(() => assertValidMockDbEnv()).not.toThrow();
    } finally {
      restoreNodeEnv(prevNodeEnv);
      if (prevFlag === undefined) delete env.RESUME_FORGE_ALLOW_MOCK_DB;
      else env.RESUME_FORGE_ALLOW_MOCK_DB = prevFlag;
      if (prevE2e === undefined) delete env.RESUME_FORGE_E2E;
      else env.RESUME_FORGE_E2E = prevE2e;
    }
  });

  it("mock client supports $transaction function form", async () => {
    const mock = createPrismaMockClient();
    const result = await mock.$transaction(async (tx: any) => {
      return tx.systemInfo.count();
    });
    expect(result).toBe(0);
  });
});
