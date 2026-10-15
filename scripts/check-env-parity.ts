/**
 * Fail when scanned code reads an env name that .env.example does not
 * declare. Commented assignments count as declared.
 *
 *   npx tsx scripts/check-env-parity.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENV_DOT = /process\.env\.([A-Z][A-Z0-9_]*)/g;
const ENV_INDEX = /process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g;
const DECLARED = /^\s*(?:#\s*)?(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/;

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", ".git"]);
const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const SCAN_RELATIVE_ROOTS = ["src", "scripts", "packages", "prisma", "tests", "e2e"];
const SCAN_RELATIVE_FILES = ["next.config.ts", "vitest.config.ts", "playwright.config.ts"];

export function collectDeclaredEnvNames(exampleText: string): Set<string> {
  const declared = new Set<string>();
  for (const line of exampleText.split(/\r?\n/)) {
    const match = line.match(DECLARED);
    if (match) declared.add(match[1]);
  }
  return declared;
}

export function collectUsedEnvNames(root: string): string[] {
  const found = new Set<string>();
  for (const rel of SCAN_RELATIVE_ROOTS) {
    const dir = path.join(root, rel);
    if (fs.existsSync(dir)) walk(dir, found);
  }
  for (const rel of SCAN_RELATIVE_FILES) {
    const file = path.join(root, rel);
    if (fs.existsSync(file)) scanFile(file, found);
  }
  return [...found].sort();
}

export function missingEnvNames(used: readonly string[], declared: ReadonlySet<string>): string[] {
  return used.filter((name) => !declared.has(name));
}

function walk(dir: string, found: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), found);
      continue;
    }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue;
    scanFile(path.join(dir, entry.name), found);
  }
}

function scanFile(file: string, found: Set<string>): void {
  const text = fs.readFileSync(file, "utf8");
  for (const re of [ENV_DOT, ENV_INDEX]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) found.add(match[1]);
  }
}

function report(): number {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const examplePath = path.join(root, ".env.example");
  const example = fs.readFileSync(examplePath, "utf8");
  const used = collectUsedEnvNames(root);
  const missing = missingEnvNames(used, collectDeclaredEnvNames(example));
  if (missing.length > 0) {
    console.error("check-env-parity: .env.example is missing:");
    for (const name of missing) console.error(`  ${name}`);
    return 1;
  }
  console.log(`check-env-parity: ${used.length} env names declared`);
  return 0;
}

const entry = process.argv[1];
if (entry && fileURLToPath(import.meta.url) === path.resolve(entry)) {
  process.exit(report());
}
