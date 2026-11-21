import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEED_SAMPLE_EVIDENCE_IDS } from "@/lib/seed-sample-ids";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

describe("local hosting & packaging configuration", () => {
  it("enables Next.js standalone output and preserves serverExternalPackages", () => {
    const nextConfig = readRepoFile("next.config.ts");
    expect(nextConfig).toContain('output: "standalone"');
    expect(nextConfig).toContain('serverExternalPackages: ["pdf-parse", "pdfjs-dist"]');
  });

  it("configures a slim multi-stage standalone Dockerfile with migrator and healthcheck", () => {
    const dockerfile = readRepoFile("Dockerfile");
    expect(dockerfile).toContain("AS migrator");
    expect(dockerfile).toContain("openssl");
    expect(dockerfile).toContain("/app/.next/standalone ./");
    expect(dockerfile).toContain("/app/.next/static ./.next/static");
    expect(dockerfile).toContain("/app/public ./public");
    expect(dockerfile).toContain("/app/prisma ./prisma");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("migrate deploy");
    expect(dockerfile).toContain("exec node server.js");
  });

  it("configures docker-compose.yml for prebuilt GHCR image with mandatory secret guards", () => {
    const compose = readRepoFile("docker-compose.yml");
    expect(compose).toContain("image: ${RESUMEFORGE_IMAGE:-ghcr.io/zenzerjs/resumeforge:latest}");
    expect(compose).toContain("pull_policy: missing");
    expect(compose).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}");
    expect(compose).toContain("APP_ACCESS_SECRET: ${APP_ACCESS_SECRET:?Set APP_ACCESS_SECRET in .env}");
    expect(compose).toContain("JOB_SYNC_SECRET: ${JOB_SYNC_SECRET:?Set JOB_SYNC_SECRET in .env}");
    expect(compose).toContain("POSTGRES_USER: ${POSTGRES_USER:-resumeforge}");
    expect(compose).toContain("POSTGRES_DB: ${POSTGRES_DB:-resumeforge}");
    expect(compose).toContain("healthcheck:");
  });

  it("implements BOM-free, idempotent, zero-node PowerShell 1-line installer", () => {
    const ps1 = readRepoFile("install.ps1");
    expect(ps1).toContain("function Invoke-ResumeForgeInstaller");
    expect(ps1).toContain("& docker @DockerArgs | Out-Host");
    expect(ps1).toContain("return [int]$LASTEXITCODE");
    expect(ps1).toContain("RandomNumberGenerator");
    expect(ps1).toContain("UTF8Encoding $false");
    expect(ps1).toContain("Test-PortFree");
    expect(ps1).toContain("if (-not (Test-Path -LiteralPath $envPath))");
    expect(ps1).toContain('"compose", "up", "-d", "--no-build"');
    expect(ps1.indexOf("prisma/seed.ts")).toBeGreaterThan(ps1.indexOf("if (-not $ready)"));
  });

  it("implements strict bash 1-line installer with safe permissions and entrypoint wrapper", () => {
    const sh = readRepoFile("install.sh");
    expect(sh.startsWith("#!/usr/bin/env bash")).toBe(true);
    expect(sh).toContain("set -euo pipefail");
    expect(sh).toContain("chmod 600");
    expect(sh).toContain("is_port_free");
    expect(sh).toContain("docker compose up -d --no-build");
    expect(sh.indexOf("prisma/seed.ts")).toBeGreaterThan(sh.indexOf('if [[ "$ready" -ne 1 ]]'));
    expect(sh.trimEnd().endsWith('main "$@"')).toBe(true);
  });

  it("publishes multi-arch GHCR images in docker-publish workflow", () => {
    const workflow = readRepoFile(".github/workflows/docker-publish.yml");
    expect(workflow).toContain("ghcr.io");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("linux/amd64,linux/arm64");
  });

  it("keeps prisma/seed.ts standalone with deterministic sample IDs and enforces LF for shell scripts", () => {
    const seed = readRepoFile("prisma/seed.ts");
    for (const id of SEED_SAMPLE_EVIDENCE_IDS) {
      expect(seed).toContain(id);
    }
    expect(seed).not.toContain('"@/');
    expect(seed).not.toContain("'@/");
    expect(seed).not.toMatch(/sqlite/i);

    const gitattributes = readRepoFile(".gitattributes");
    expect(gitattributes).toContain("*.sh text eol=lf");
  });
});
