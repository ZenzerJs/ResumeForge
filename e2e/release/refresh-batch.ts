import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { createProposalBatch } from "@/lib/ai/patch-batches";
import { PatchProposalSchema } from "@/lib/ai/patch-schema";

const runDir = process.env.RELEASE_E2E_RUN_DIR;
let expectedSchema: string | null;
try {
  expectedSchema = new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema");
} catch {
  throw new Error("Release batch refresh requires a runner-owned PostgreSQL URL.");
}
if (!runDir || !process.env.DATABASE_URL || !expectedSchema || !/^rf_it_[a-z0-9_]+$/.test(expectedSchema)) {
  throw new Error("Release batch refresh requires the runner-owned rf_it_* database.");
}
const safeRunDir = runDir;

async function main() {
  const current = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
  if (current[0]?.schema !== expectedSchema) throw new Error("Release batch refresh connected outside its assigned schema.");
  const fixture = JSON.parse(await readFile(path.join(safeRunDir, "persistent.json"), "utf8")) as {
    userId: string;
    jobId: string;
    masterResumeId: string;
    batch: { batch: { batchId: string } };
  };
  const prior = await prisma.patchProposalBatch.findFirst({ where: { id: fixture.batch.batch.batchId, userId: fixture.userId } });
  if (!prior) throw new Error("Release fixture proposal batch is unavailable.");
  const proposals = PatchProposalSchema.array().parse(prior.proposals);
  const fresh = await createProposalBatch({ userId: fixture.userId, jobId: fixture.jobId, masterResumeId: fixture.masterResumeId, proposals, gaps: [] });
  process.stdout.write(JSON.stringify({ ...fresh, masterResumeId: fixture.masterResumeId }));
}

main().finally(() => prisma.$disconnect());
