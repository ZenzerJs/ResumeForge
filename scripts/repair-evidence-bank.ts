/**
 * Safe, approval-gated Evidence Bank repair CLI.
 *
 * Usage:
 *   1. Dry-run audit (read-only):
 *      npx tsx scripts/repair-evidence-bank.ts --dry-run [--user-id <id>] [--out <dir>]
 *   2. Backup first:
 *      pg_dump -t evidence_items -t bullets -t patch_citations "$DATABASE_URL" > evidence-backup.sql
 *   3. Apply approved UPDATE_TEXT diffs only (zero deletes, optimistic updatedAt lock):
 *      npx tsx scripts/repair-evidence-bank.ts --apply --approval-manifest <path-to-manifest.json>
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  buildEvidenceRepairManifest,
  renderRepairManifestMarkdown,
  verifyRepairManifestIntegrity,
  type EvidenceItemSnapshot,
  type EvidenceRepairManifest,
} from "@/lib/evidence/repair-audit";

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function getFlagValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

async function runDryRun(userId?: string, outDir = "."): Promise<void> {
  const rows = await prisma.evidenceItem.findMany({
    where: userId ? { userId } : undefined,
    include: {
      bullets: { orderBy: { orderIndex: "asc" } },
      _count: { select: { patchCitations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const snapshots: EvidenceItemSnapshot[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    organization: row.organization,
    verifiedSummary: row.verifiedSummary,
    tags: parseJsonStringArray(row.tags),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    citationCount: row._count.patchCitations,
    bullets: row.bullets.map((b) => ({
      id: b.id,
      text: b.text,
      technologies: parseJsonStringArray(b.technologies),
      verified: b.verified,
    })),
  }));

  const manifest = buildEvidenceRepairManifest(snapshots);
  const stamp = manifest.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.resolve(outDir, `evidence-repair-dry-run-${stamp}.json`);
  const mdPath = path.resolve(outDir, `evidence-repair-dry-run-${stamp}.md`);

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderRepairManifestMarkdown(manifest), "utf8");

  console.log(`Scanned ${manifest.scannedCount} EvidenceItem rows.`);
  console.log(
    `Found ${manifest.affectedCount} affected (${manifest.autoRepairCount} UPDATE_TEXT, ${manifest.manualReviewCount} FLAG_FOR_MANUAL_REVIEW).`
  );
  console.log(`Manifest JSON: ${jsonPath}`);
  console.log(`Dry-run report: ${mdPath}`);
  console.log(`Manifest SHA-256: ${manifest.manifestSha256}`);
}

async function runApply(manifestPath: string): Promise<void> {
  const raw = fs.readFileSync(path.resolve(manifestPath), "utf8");
  const manifest = JSON.parse(raw) as EvidenceRepairManifest;

  if (!verifyRepairManifestIntegrity(manifest)) {
    throw new Error(
      "Approval manifest failed SHA-256 integrity verification. Re-run --dry-run and review the fresh manifest."
    );
  }

  const actionable = manifest.candidates.filter((c) => c.repairAction === "UPDATE_TEXT");
  if (actionable.length === 0) {
    console.log("No UPDATE_TEXT items in manifest. Zero database mutations performed.");
    return;
  }

  const byUser = new Map<string, typeof actionable>();
  for (const c of actionable) {
    const key = c.userId ?? "__unowned__";
    const list = byUser.get(key) ?? [];
    list.push(c);
    byUser.set(key, list);
  }

  const rollbackRecords: Array<{ itemId: string; before: unknown }> = [];

  for (const [ownerKey, group] of byUser.entries()) {
    await prisma.$transaction(async (tx) => {
      for (const candidate of group) {
        const current = await tx.evidenceItem.findUnique({
          where: { id: candidate.itemId },
          include: { bullets: true },
        });
        if (!current) {
          throw new Error(`Aborting transaction for ${ownerKey}: EvidenceItem ${candidate.itemId} no longer exists.`);
        }
        if (current.updatedAt.toISOString() !== candidate.updatedAt) {
          throw new Error(
            `Aborting transaction for ${ownerKey}: EvidenceItem ${candidate.itemId} changed since dry-run (expected ${candidate.updatedAt}, got ${current.updatedAt.toISOString()}).`
          );
        }

        rollbackRecords.push({
          itemId: candidate.itemId,
          before: candidate.before,
        });

        await tx.evidenceItem.update({
          where: { id: candidate.itemId },
          data: {
            title: candidate.proposedAfter.title,
            organization: candidate.proposedAfter.organization,
            verifiedSummary: candidate.proposedAfter.verifiedSummary,
            tags: JSON.stringify(candidate.proposedAfter.tags),
          },
        });

        for (let i = 0; i < candidate.proposedAfter.bullets.length; i++) {
          const nextBullet = candidate.proposedAfter.bullets[i];
          const prevBullet = candidate.before.bullets[i];
          if (prevBullet && nextBullet.text !== prevBullet.text) {
            await tx.bullet.update({
              where: { id: nextBullet.id },
              data: { text: nextBullet.text },
            });
          }
        }
      }
    });
  }

  const rollbackPath = path.resolve(
    path.dirname(manifestPath),
    `evidence-repair-rollback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(
    rollbackPath,
    JSON.stringify({ appliedAt: new Date().toISOString(), manifestSha256: manifest.manifestSha256, rollbackRecords }, null, 2),
    "utf8"
  );
  console.log(`Applied ${actionable.length} approved UPDATE_TEXT repairs (0 deletes).`);
  console.log(`Pre-image rollback log written to: ${rollbackPath}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const isDryRun = argv.includes("--dry-run");
  const isApply = argv.includes("--apply");

  if (isDryRun === isApply) {
    console.error("Specify exactly one of --dry-run or --apply.");
    process.exit(1);
  }

  try {
    if (isDryRun) {
      await runDryRun(getFlagValue(argv, "--user-id"), getFlagValue(argv, "--out") || ".");
    } else {
      const manifestPath = getFlagValue(argv, "--approval-manifest");
      if (!manifestPath) {
        console.error("--apply requires --approval-manifest <path>.");
        process.exit(1);
      }
      await runApply(manifestPath);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
