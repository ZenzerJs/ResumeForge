import { PrismaClient } from "@prisma/client";
import { createPrismaMockClient } from "./db-mock";
import net from "net";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let realClient: PrismaClient | null = null;
let mockClient: any = null;
let dbAvailable: boolean | null = null;
let probePromise: Promise<boolean> | null = null;

function probePostgresPort(urlStr?: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const dbUrl = urlStr || process.env.DATABASE_URL || "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge";
      const url = new URL(dbUrl);
      const port = Number(url.port) || 5432;
      const host = url.hostname || "localhost";
      const socket = new net.Socket();
      socket.setTimeout(250);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });
}

async function getActiveClient(): Promise<any> {
  if (dbAvailable === null) {
    if (!probePromise) {
      probePromise = probePostgresPort();
    }
    dbAvailable = await probePromise;
  }

  if (dbAvailable) {
    if (!realClient) {
      realClient = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });
    }
    return realClient;
  } else {
    if (!mockClient) {
      mockClient = createPrismaMockClient();
    }
    return mockClient;
  }
}

export const prisma: PrismaClient = new Proxy({} as any, {
  get(_target, prop: string) {
    if (prop === "$transaction") {
      return async (arg: any) => {
        const client = await getActiveClient();
        try {
          return await client.$transaction(arg);
        } catch (err: any) {
          if (dbAvailable && (err?.message?.includes("Can't reach database") || err?.code === "P1001")) {
            dbAvailable = false;
            mockClient = mockClient || createPrismaMockClient();
            return await mockClient.$transaction(arg);
          }
          throw err;
        }
      };
    }
    if (prop === "$connect" || prop === "$disconnect") {
      return async () => {
        const client = await getActiveClient();
        return await client[prop]();
      };
    }

    // Return model proxy
    return new Proxy({}, {
      get(_modelTarget, method: string) {
        return async (...args: any[]) => {
          const client = await getActiveClient();
          try {
            return await client[prop][method](...args);
          } catch (err: any) {
            if (dbAvailable && (err?.message?.includes("Can't reach database") || err?.code === "P1001")) {
              dbAvailable = false;
              mockClient = mockClient || createPrismaMockClient();
              return await mockClient[prop][method](...args);
            }
            throw err;
          }
        };
      },
    });
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
