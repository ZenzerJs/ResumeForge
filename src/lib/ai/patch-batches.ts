import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PatchProposalSchema, GapSchema, type PatchProposal } from "@/lib/ai/patch-schema";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import { assertCanApplyPatches, markDocumentAsPatched } from "@/lib/guardrail/policy";
import type { ResumeFacts } from "@/lib/facts/types";
import { applyDeterministicPatch } from "@/lib/diagnostics/deterministicPatcher";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const proposalList = (value: Prisma.JsonValue): PatchProposal[] =>
  PatchProposalSchema.array().parse(value);
const gapsList = (value: Prisma.JsonValue) => GapSchema.array().parse(value);

function masterHash(master: { id: string; typstSource: string; factSnapshot: Prisma.JsonValue | null; updatedAt: Date }) {
  return sha({ id: master.id, source: master.typstSource, facts: master.factSnapshot, updatedAt: master.updatedAt.toISOString() });
}
function jobHash(job: { id: string; userId: string | null; company: string | null; roleTitle: string | null; rawDescription: string; extractedRequirements: string }) {
  return sha(job);
}
type EvidenceSnapshot = { id: string; status: string; title: string; organization: string | null; dates: string | null; verifiedSummary: string; tags: string; bullets: Array<{ id: string; text: string; verified: boolean; orderIndex: number; technologies: string; roleAffinity: string }> };
function evidenceHash(rows: EvidenceSnapshot[], proposals: PatchProposal[]) {
  const evidenceIds = [...new Set(proposals.flatMap(p => p.evidenceIds))].sort();
  const map = new Map(rows.map(row => [row.id, row]));
  const refs = evidenceIds.map(id => {
    const ev = map.get(id);
    if (ev) return { id, status: ev.status, title: ev.title, organization: ev.organization, dates: ev.dates, summary: ev.verifiedSummary, tags: ev.tags, bullets: ev.bullets };
    for (const row of rows) {
      const bullet = row.bullets.find(b => b.id === id);
      if (bullet) return { id, evidenceId: row.id, status: row.status, title: row.title, organization: row.organization, dates: row.dates, summary: row.verifiedSummary, tags: row.tags, bullet };
    }
    return { id, missing: true };
  });
  return sha(refs);
}
function allEvidenceHash(rows: EvidenceSnapshot[]) {
  return sha(rows.map(row => ({ id: row.id, status: row.status, title: row.title, organization: row.organization, dates: row.dates, summary: row.verifiedSummary, tags: row.tags, bullets: [...row.bullets].sort((a,b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id)) })).sort((a,b) => a.id.localeCompare(b.id)));
}

export interface BatchPublic { batchId: string; revisionToken: string; baseTypstSource: string; jobId: string }
export interface CreateBatchInput { userId: string; masterResumeId: string; jobId: string; proposals: PatchProposal[]; gaps: unknown[]; expectedMasterFingerprint?: string; expectedJobFingerprint?: string; expectedCitationFingerprint?: string }

export async function captureProposalContext(userId: string, jobId: string, masterResumeId?: string) {
  const [master, job, evidence] = await Promise.all([
    prisma.resume.findFirst({ where: { ...(masterResumeId ? { id: masterResumeId } : {}), userId, isMaster: true, isProtected: true } }),
    prisma.job.findFirst({ where: { id: jobId, OR: [{ userId }, { userId: null }] } }),
    prisma.evidenceItem.findMany({ where: { userId }, include: { bullets: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } } }),
  ]);
  if (!master?.factSnapshot) throw new Error("Freeze your master resume first.");
  if (!job) throw new Error("Selected job is unavailable.");
  return { master, job, evidence, masterFingerprint: masterHash(master), jobFingerprint: jobHash(job), evidenceFingerprint: allEvidenceHash(evidence) };
}

export async function createDiagnosticProposalBatch(input: {
  userId: string; jobId: string; descriptors: Array<{ evidenceId: string; targetBulletId: string }>;
}) {
  const context = await captureProposalContext(input.userId, input.jobId);
  const source = context.master.typstSource;
  const proposals: PatchProposal[] = [];
  for (const descriptor of input.descriptors) {
    const evidence = context.evidence.find(item => item.id === descriptor.evidenceId && item.status === "verified");
    const bullet = context.evidence.flatMap(item => item.bullets).find(item => item.id === descriptor.targetBulletId && item.verified);
    if (!evidence || !bullet || bullet.evidenceId !== evidence.id) throw new Error("Diagnostic evidence or bullet is unavailable.");
    const anchor = `// RF_BULLET:${bullet.id}`;
    if (source.split(anchor).length !== 2) throw new Error("Diagnostic target anchor is missing or ambiguous.");
    const result = applyDeterministicPatch(source, evidence.id, bullet.id, [{ id: evidence.id, content: evidence.verifiedSummary, extractedTechnologies: [] }]);
    if (!result.applied) throw new Error(result.error || "Diagnostic proposal could not be reconstructed.");
    const nextSource = result.patchedTypstAst.replace(/^\/\/ @resumeforge-patched: true\r?\n/m, "");
    if (nextSource === source) throw new Error("Diagnostic proposal makes no change.");
    let prefixLength = 0;
    while (prefixLength < source.length && prefixLength < nextSource.length && source[prefixLength] === nextSource[prefixLength]) prefixLength += 1;
    const anchorLineStart = source.lastIndexOf("\n", source.indexOf(anchor)) + 1;
    prefixLength = Math.min(prefixLength, anchorLineStart);
    let suffixLength = 0;
    while (suffixLength < source.length - prefixLength && suffixLength < nextSource.length - prefixLength && source[source.length - suffixLength - 1] === nextSource[nextSource.length - suffixLength - 1]) suffixLength += 1;
    const before = source.slice(prefixLength, source.length - suffixLength);
    const after = nextSource.slice(prefixLength, nextSource.length - suffixLength);
    if (!before.trim()) throw new Error("Diagnostic proposal has no unique source fragment.");
    proposals.push(PatchProposalSchema.parse({
      id: randomUUID(), operation: "MODIFY_BULLET", targetSection: "experience", targetId: bullet.id,
      before, after, evidenceIds: [evidence.id, bullet.id],
      rationale: "Reconstructed from verified Evidence Bank summary.", confidence: 1,
    }));
  }
  return createProposalBatch({
    userId: input.userId, masterResumeId: context.master.id, jobId: input.jobId, proposals, gaps: [],
    expectedMasterFingerprint: context.masterFingerprint, expectedJobFingerprint: context.jobFingerprint,
    expectedCitationFingerprint: context.evidenceFingerprint,
  });
}

export async function createProposalBatch(input: CreateBatchInput): Promise<{ batch: BatchPublic; verified: PatchProposal[]; gaps: ReturnType<typeof gapsList> }> {
  const proposals = PatchProposalSchema.array().parse(input.proposals).map(p => ({ ...p, id: randomUUID() }));
  const gaps = GapSchema.array().parse(input.gaps);
  if (!proposals.length) throw new Error("No evidence-backed proposals to save.");
  return prisma.$transaction(async tx => {
    const [master, job, evidence] = await Promise.all([
      tx.resume.findFirst({ where: { id: input.masterResumeId, userId: input.userId, isMaster: true, isProtected: true } }),
      tx.job.findFirst({ where: { id: input.jobId, OR: [{ userId: input.userId }, { userId: null }] } }),
      tx.evidenceItem.findMany({ where: { userId: input.userId }, include: { bullets: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } } }),
    ]);
    if (!master || !master.factSnapshot) throw new Error("Freeze your master resume first.");
    if (!job) throw new Error("Selected job is unavailable.");
    const mHash = masterHash(master);
    const jHash = jobHash(job);
    const cHash = evidenceHash(evidence, proposals);
    if ((input.expectedMasterFingerprint && input.expectedMasterFingerprint !== mHash) ||
        (input.expectedJobFingerprint && input.expectedJobFingerprint !== jHash) ||
        (input.expectedCitationFingerprint && input.expectedCitationFingerprint !== allEvidenceHash(evidence))) {
      throw new Error("Source changed while proposals were generated. Generate again.");
    }
    validateProposalCitations(proposals, evidence);
    const revisionToken = sha({ mHash, jHash, cHash, proposals });
    const batch = await tx.patchProposalBatch.create({ data: {
      userId: input.userId, masterResumeId: master.id, jobId: job.id, revisionToken,
      masterFingerprint: mHash, jobFingerprint: jHash, citationFingerprint: cHash,
      proposals: proposals as unknown as Prisma.InputJsonValue, gaps: gaps as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    } });
    return {
      batch: { batchId: batch.id, revisionToken, baseTypstSource: master.typstSource, jobId: job.id },
      verified: proposals,
      gaps,
    };
  });
}

function validateProposalCitations(proposals: PatchProposal[], evidence: Array<{id:string;status:string;bullets:Array<{id:string;verified:boolean}>}>) {
  const byEvidence = new Map(evidence.map(item => [item.id, item]));
  const byBullet = new Map(evidence.flatMap(item => item.bullets.map(b => [b.id, { item, bullet: b }] as const)));
  for (const proposal of proposals) {
    if (proposal.operation === "REPORT_GAP") throw new Error("Gap items cannot be accepted as patches.");
    if (!proposal.evidenceIds.length) throw new Error("Every patch needs verified evidence.");
    for (const ref of proposal.evidenceIds) {
      const item = byEvidence.get(ref) ?? byBullet.get(ref)?.item;
      const bullet = byBullet.get(ref)?.bullet;
      if (!item || item.status !== "verified" || (bullet && !bullet.verified)) throw new Error("Patch citation is unavailable or unverified.");
    }
  }
}

export interface ApplyBatchInput { userId: string; batchId: string; revisionToken: string; acceptedPatchIds: string[]; acknowledgedSkills: string[]; variantTitle: string }
export async function applyProposalBatch(input: ApplyBatchInput) {
  if (!input.acceptedPatchIds.length || new Set(input.acceptedPatchIds).size !== input.acceptedPatchIds.length) throw new Error("Select unique patch proposals to apply.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "PatchProposalBatch" WHERE "id" = ${input.batchId} AND "userId" = ${input.userId} FOR UPDATE`;
    const batch = await tx.patchProposalBatch.findFirst({ where: { id: input.batchId, userId: input.userId } });
    if (!batch || batch.status !== "OPEN" || batch.expiresAt <= new Date()) throw new Error("Proposal batch is unavailable or already applied.");
    if (batch.revisionToken !== input.revisionToken) throw new Error("Proposal revision is stale.");
    await tx.$queryRaw`SELECT "id" FROM "Resume" WHERE "id" = ${batch.masterResumeId} FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = ${batch.jobId} FOR SHARE`;
    await tx.$queryRaw`SELECT "id" FROM "EvidenceItem" WHERE "userId" = ${input.userId} FOR SHARE`;
    await tx.$queryRaw`SELECT b."id" FROM "Bullet" b JOIN "EvidenceItem" e ON e."id" = b."evidenceId" WHERE e."userId" = ${input.userId} FOR SHARE OF b`;
    const [master, job, evidence] = await Promise.all([
      tx.resume.findFirst({ where: { id: batch.masterResumeId, userId: input.userId, isMaster: true, isProtected: true } }),
      tx.job.findFirst({ where: { id: batch.jobId, OR: [{ userId: input.userId }, { userId: null }] } }),
      tx.evidenceItem.findMany({ where: { userId: input.userId }, include: { bullets: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } } }),
    ]);
    if (!master?.factSnapshot || !job || masterHash(master) !== batch.masterFingerprint || jobHash(job) !== batch.jobFingerprint) throw new Error("Master resume or job changed. Generate proposals again.");
    const proposals = proposalList(batch.proposals);
    validateProposalCitations(proposals, evidence);
    if (evidenceHash(evidence, proposals) !== batch.citationFingerprint) throw new Error("Cited evidence changed. Generate proposals again.");
    const selectedSet = new Set(input.acceptedPatchIds);
    if (proposals.some(p => !p.id) || selectedSet.size !== proposals.filter(p => selectedSet.has(p.id)).length) throw new Error("Unknown proposal ID.");
    const selected = proposals.filter(p => selectedSet.has(p.id));
    if (selected.length !== selectedSet.size) throw new Error("Unknown proposal ID.");
    const reconstructed = applyPatchProposals(master.typstSource, selected);
    const guardrailPatches = selected.map(proposal => ({
      ...proposal,
      evidenceIds: proposal.evidenceIds.map(ref => evidence.find(item => item.id === ref)?.id ?? evidence.find(item => item.bullets.some(bullet => bullet.id === ref))?.id ?? ref),
    }));
    assertCanApplyPatches(reconstructed.typstSource, master.factSnapshot as unknown as ResumeFacts, guardrailPatches, { acknowledgedSkills: input.acknowledgedSkills });
    const variant = await tx.resumeVariant.create({ data: {
      masterResumeId: master.id, jobId: job.id, variantTitle: input.variantTitle.trim().slice(0, 160) || "Tailored Resume",
      typstContent: markDocumentAsPatched(reconstructed.typstSource), factSnapshot: master.factSnapshot as Prisma.InputJsonValue,
      patches: { create: selected.map(p => ({
        operation: p.operation, targetSection: p.targetSection, targetId: p.targetId,
        beforeContent: p.before, afterContent: p.after, evidenceCitations: JSON.stringify(p.evidenceIds),
        rationale: p.rationale, confidence: p.confidence, status: "ACCEPTED",
        citations: { create: p.evidenceIds.map(ref => ({
          ...(evidence.some(e => e.id === ref) ? { evidenceId: ref } : { bulletId: ref, evidenceId: evidence.find(e => e.bullets.some(b => b.id === ref))?.id }),
        })) },
      })) },
    }, include: { patches: { include: { citations: true } } } });
    await tx.patchProposalBatch.update({ where: { id: batch.id }, data: { status: "CONSUMED", consumedAt: new Date() } });
    return { variantId: variant.id, variantTitle: variant.variantTitle, status: variant.status, typstContent: variant.typstContent };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
