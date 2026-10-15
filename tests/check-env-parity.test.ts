import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectDeclaredEnvNames,
  collectUsedEnvNames,
  missingEnvNames,
} from "../scripts/check-env-parity";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("check-env-parity", () => {
  it("counts a commented assignment as declared", () => {
    const declared = collectDeclaredEnvNames("# OPENAI_API_KEY=\nDATABASE_URL=\n");
    expect(declared.has("OPENAI_API_KEY")).toBe(true);
    expect(declared.has("DATABASE_URL")).toBe(true);
  });

  it("reports a name read in src and absent from the example", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-parity-"));
    fs.mkdirSync(path.join(dir, "src"));
    const name = "ZZZ_PARITY_FIXTURE";
    fs.writeFileSync(path.join(dir, "src", "read.ts"), `export const value = process.env.${name};\n`);
    const missing = missingEnvNames(collectUsedEnvNames(dir), collectDeclaredEnvNames("DATABASE_URL=\n"));
    expect(missing).toContain(name);
  });

  it("matches this repo to .env.example", () => {
    const example = fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8");
    const missing = missingEnvNames(
      collectUsedEnvNames(repoRoot),
      collectDeclaredEnvNames(example),
    );
    expect(missing).toEqual([]);
  });
});
