import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/security/passwords";
import { createProposalBatch } from "@/lib/ai/patch-batches";
import { extractResumeFacts } from "@/lib/facts/extract";

const runDir = process.env.RELEASE_E2E_RUN_DIR;
const databaseUrl = process.env.DATABASE_URL;
let expectedSchema: string | null = null;
try {
  if (databaseUrl) expectedSchema = new URL(databaseUrl).searchParams.get("schema");
} catch {
  throw new Error("Release fixtures require a valid runner-owned PostgreSQL URL.");
}
if (!runDir || !databaseUrl || !expectedSchema || !/^rf_it_[a-z0-9_]+$/.test(expectedSchema)) {
  throw new Error("Release fixture seeding requires the runner-owned rf_it_* database.");
}
const fixtureDir = runDir!;

const password = "Release-E2E-Only-Password-41!";
const email = `release-${crypto.randomUUID().slice(0, 8)}@resumeforge.test`;
const username = `release_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
const source = `#set page(margin: 1in)\n= Jordan Example\n\n== Experience\n\n- Prepared monthly project reports.\n- Coordinated weekly status updates.\n`;

async function main() {
  const current = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
  if (current[0]?.schema !== expectedSchema) throw new Error("Release fixtures connected outside their assigned schema.");
  const user = await prisma.user.create({ data: { email, username, passwordHash: await hashPassword(password) } });
  const evidence = await prisma.evidenceItem.create({ data: {
    userId: user.id, type: "experience", title: "Reporting Coordinator", organization: "Example Co",
    dates: "2021-2024", verifiedSummary: "Prepared monthly project reports.", status: "verified",
    bullets: { create: [{ text: "Prepared monthly project reports.", verified: true }, { text: "Coordinated weekly status updates.", verified: true }] },
  }, include: { bullets: true } });
  const job = await prisma.job.create({ data: { userId: user.id, company: "Release Fixture Inc", roleTitle: "Coordinator", rawDescription: "Prepare accurate monthly reports.", source: "manual" } });
  const foreign = await prisma.user.create({ data: { email: `foreign-${crypto.randomUUID().slice(0, 8)}@resumeforge.test`, username: `foreign_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`, passwordHash: await hashPassword(password) } });
  const foreignJob = await prisma.job.create({ data: { userId: foreign.id, company: "Viewer Outcome Catalog Sentinel", roleTitle: "Catalog Fixture Role", rawDescription: "Shared catalog fixture for viewer-scoped application outcomes.", source: "manual" } });
  await prisma.jobApplication.create({ data: { userId: foreign.id, jobId: foreignJob.id, status: "INTERVIEWING" } });
  const sharedJob = await prisma.job.create({ data: { company: "Shared Catalog Fixture", roleTitle: "Shared Release Role", rawDescription: "Shared catalog fixture for private application outcome isolation.", source: "manual" } });
  await prisma.jobApplication.createMany({ data: [
    { userId: user.id, jobId: sharedJob.id, status: "APPLIED" },
    { userId: foreign.id, jobId: sharedJob.id, status: "INTERVIEWING" },
  ] });
  const facts = extractResumeFacts(source, [evidence]);
  const master = await prisma.resume.create({ data: { userId: user.id, title: "Release Fixture Master", typstSource: source, isMaster: true, isProtected: true, factSnapshot: facts as unknown as Prisma.InputJsonValue } });
  const after = "Prepared project reports monthly.";
  const batch = await createProposalBatch({
    userId: user.id, masterResumeId: master.id, jobId: job.id,
    proposals: [
      { id: "fixture-proposal-one", operation: "MODIFY_BULLET", targetSection: "experience", before: "Prepared monthly project reports.", after, evidenceIds: [evidence.id, evidence.bullets[0].id], rationale: "Release test deterministic evidence-backed proposal.", confidence: 1 },
      { id: "fixture-proposal-two", operation: "MODIFY_BULLET", targetSection: "experience", before: "Coordinated weekly status updates.", after: "Coordinated status updates weekly.", evidenceIds: [evidence.id, evidence.bullets[1].id], rationale: "Release test deterministic evidence-backed proposal.", confidence: 1 },
    ], gaps: [],
  });
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(path.join(fixtureDir, "persistent.json"), JSON.stringify({ email, password, userId: user.id, jobId: job.id, masterResumeId: master.id, batch: { ...batch, masterResumeId: master.id }, foreignJobId: foreignJob.id, foreignEmail: foreign.email, sharedJobId: sharedJob.id }), "utf8");
}

main().finally(() => prisma.$disconnect());
