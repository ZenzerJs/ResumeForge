import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  throw new Error("PostgreSQL integration tests require DATABASE_URL.");
}

const schema = `rf_it_${process.pid}_${crypto.randomUUID().replaceAll("-", "")}`;
const schemaNamePattern = /^rf_it_[0-9]+_[a-f0-9]{32}$/;
if (!schemaNamePattern.test(schema)) throw new Error("Generated invalid integration schema name.");

let isolated: URL;
let admin: PrismaClient;
try {
  const base = new URL(baseUrl);
  if (base.protocol !== "postgresql:" && base.protocol !== "postgres:") throw new Error();
  isolated = new URL(base);
  isolated.searchParams.set("schema", schema);
  admin = new PrismaClient({ datasources: { db: { url: base.toString() } } });
} catch {
  throw new Error("PostgreSQL integration runner requires a valid PostgreSQL DATABASE_URL.");
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;
let schemaCreated = false;
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;

  const env = {
    ...process.env,
    DATABASE_URL: isolated.toString(),
    VITEST_POSTGRES_INTEGRATION: "1",
  };
  const pushCode = await run("npx", ["prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], env);
  if (pushCode !== 0) throw new Error(`Prisma schema setup failed with exit code ${pushCode}.`);

  exitCode = await run("npx", ["vitest", "run", "--config", "vitest.integration.config.ts"], env);
} catch {
  console.error("PostgreSQL integration runner failed; details omitted to protect database credentials.");
  exitCode = 1;
} finally {
  try {
    if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  } catch {
    console.error("Failed to remove the isolated PostgreSQL integration schema.");
    exitCode = 1;
  }
  await admin.$disconnect();
}

process.exitCode = exitCode;
