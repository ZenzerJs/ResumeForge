import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Encoding guard (mojibake regression)", () => {
  it("forbids double-encoded UTF-8 mojibake sequences across src/**/*.{ts,tsx}", () => {
    const mojibakeRe = /â€|Â·|âœ/g;
    const files = collectTsFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].match(mojibakeRe);
        if (matches) {
          const rel = path.relative(ROOT, file).replace(/\\/g, "/");
          violations.push(`${rel}:${i + 1}: ${matches.join(", ")}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
