#!/usr/bin/env npx tsx
/**
 * One-time copy of local SQLite `prisma/dev.db` (or ./dev.db) into Postgres.
 * Requires sqlite3 CLI and a reachable DATABASE_URL postgres instance.
 *
 * Usage:
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts
 */
import { existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const sqlitePath = existsSync(path.join("prisma", "dev.db"))
  ? path.join("prisma", "dev.db")
  : existsSync("dev.db")
    ? "dev.db"
    : null;

if (!sqlitePath) {
  console.log("No SQLite file found (prisma/dev.db or ./dev.db). Nothing to copy. Use `npx prisma db seed` on Postgres.");
  process.exit(0);
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) {
  console.error("Set DATABASE_URL to a postgresql:// connection string before running this script.");
  process.exit(1);
}

try {
  execSync("sqlite3 -version", { stdio: "ignore" });
} catch {
  console.error(
    `Found ${sqlitePath} but sqlite3 CLI is not installed. Backup that file, then seed Postgres with \`npx prisma db seed\`.`
  );
  process.exit(1);
}

console.log(`SQLite source: ${sqlitePath}`);
console.log("Dumping schema+data via sqlite3 .dump is not auto-applied (types differ).");
console.log("Recommended:");
console.log("  1. Keep a copy of the SQLite file.");
console.log("  2. npx prisma migrate deploy");
console.log("  3. Re-seed or re-import jobs/evidence in the hosted app.");
process.exit(0);
