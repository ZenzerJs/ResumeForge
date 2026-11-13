import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createPrismaMockClient } from "../src/lib/db-mock";

describe("runtime Prisma direct Postgres connection (PERF-04)", () => {
  afterEach(() => {
    vi.doUnmock("@prisma/client");
    vi.resetModules();
    delete (globalThis as { prisma?: unknown }).prisma;
  });

  it("exports an HMR-safe PrismaClient singleton directly without db-mock import", async () => {
    const prismaSource = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "prisma.ts"),
      "utf8"
    );
    expect(prismaSource).not.toContain("db-mock");
    expect(prismaSource).not.toContain("probePostgresPort");
    expect(prismaSource).not.toContain("new Proxy");

    vi.resetModules();
    delete (globalThis as { prisma?: unknown }).prisma;
    const mockedMod = await import("../src/lib/prisma");
    const mod = await vi.importActual<typeof import("../src/lib/prisma")>("../src/lib/prisma");

    expect(mod.prisma !== mockedMod.prisma).toBe(true);
    expect(typeof mod.prisma.$extends).toBe("function");
    expect(typeof mod.prisma.$transaction).toBe("function");
    expect(typeof mod.prisma.$queryRaw).toBe("function");
    expect(typeof mod.prisma.$executeRaw).toBe("function");
    expect((globalThis as { prisma?: unknown }).prisma === mod.prisma).toBe(true);
  });

  it("propagates transient database failures without false-success fallback and recovers on next query", async () => {
    const systemInfoCount = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Can't reach database server"), { code: "P1001" }))
      .mockResolvedValue(7);
    const transactionMock = vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)({ systemInfo: { count: systemInfoCount } });
      return Promise.all(arg as Promise<unknown>[]);
    });

    class MockPrismaClient {
      systemInfo = { count: systemInfoCount };
      $transaction = transactionMock;
      $queryRaw = vi.fn(async () => [{ ok: 1 }]);
      $executeRaw = vi.fn(async () => 1);
      $connect = vi.fn(async () => undefined);
      $disconnect = vi.fn(async () => undefined);
    }

    vi.resetModules();
    delete (globalThis as { prisma?: unknown }).prisma;
    vi.doMock("@prisma/client", () => ({
      PrismaClient: MockPrismaClient,
    }));

    const { prisma } = await vi.importActual<typeof import("../src/lib/prisma")>("../src/lib/prisma");

    // Transient failure must reject directly (never return mock 0 / false success)
    await expect(prisma.systemInfo.count()).rejects.toThrow(/Can't reach database server/);

    // Next query recovers cleanly without sticky fallback state
    await expect(prisma.systemInfo.count()).resolves.toBe(7);

    // Transaction semantics preserved
    await expect(
      prisma.$transaction(async (tx: any) => tx.systemInfo.count())
    ).resolves.toBe(7);
  });

  it("mock client used in unit setup preserves $transaction function form", async () => {
    const mock = createPrismaMockClient();
    const result = await mock.$transaction(async (tx: any) => {
      return tx.systemInfo.count();
    });
    expect(result).toBe(0);
  });
});
