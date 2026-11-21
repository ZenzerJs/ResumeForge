import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

function walkTsxFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsxFiles(fullPath, out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("Form controls accessibility guard (id and name attributes)", () => {
  it("ensures every native input, select, and textarea across src/components and src/app declares id and name", () => {
    const files = [
      ...walkTsxFiles(path.join(repoRoot, "src", "components")),
      ...walkTsxFiles(path.join(repoRoot, "src", "app")),
    ];

    const violations: string[] = [];
    const tagRe = /<(input|select|textarea)\b([\s\S]*?)(\/?>)/g;

    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      tagRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = tagRe.exec(src))) {
        const tag = match[1];
        const attrs = match[2];
        const hasSpread = /\.\.\./.test(attrs);
        const hasId = hasSpread || /\bid\s*=/.test(attrs);
        const hasName = hasSpread || /\bname\s*=/.test(attrs);
        if (!hasId || !hasName) {
          const line = src.slice(0, match.index).split("\n").length;
          const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
          const missing = [!hasId ? "id" : null, !hasName ? "name" : null].filter(Boolean).join("+");
          violations.push(`${rel}:${line} <${tag}> missing ${missing}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
