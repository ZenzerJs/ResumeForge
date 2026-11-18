import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PatchProposalSchema,
  GapSchema,
  InvalidPatchCitationError,
  createVerifiedEvidenceRegistry,
  resolvePatchCitationReferences,
  getPatchRecoveryAction,
  type PatchProposal,
  type PatchErrorCategory,
  type PatchApplicationErrorDetails,
  type ResolvedEvidenceRegistry,
} from "@/lib/ai/patch-schema";
import { validateAndBuildPatchCitations } from "@/lib/ai/patch-citations";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import {
  assertCanApplyPatches,
  GuardrailBlockError,
  markDocumentAsPatched,
} from "@/lib/guardrail/policy";
import { buildTailoringValidationContext } from "@/lib/facts/extract";
import type { ResumeFacts, TailoringValidationContext } from "@/lib/facts/types";
import { applyDeterministicPatch } from "@/lib/diagnostics/deterministicPatcher";

export class PatchBatchError extends Error {
  public readonly category: PatchErrorCategory;
  public readonly recoveryAction: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    category: PatchErrorCategory,
    message: string,
    options?: {
      recoveryAction?: string;
      httpStatus?: number;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "PatchBatchError";
    this.category = category;
    this.recoveryAction = options?.recoveryAction ?? getPatchRecoveryAction(category);
    this.httpStatus =
      options?.httpStatus ??
      (category === "evidence_changed" ||
      category === "stale_resume_or_job" ||
      category === "missing_patch_anchor"
        ? 409
        : category === "save_failed"
          ? 500
          : 422);
    this.details = options?.details;
  }
}

export function classifyPatchApplicationError(
  error: unknown
): PatchApplicationErrorDetails {
  if (error instanceof PatchBatchError) {
    return {
      category: error.category,
      message: error.message,
      recoveryAction: error.recoveryAction,
      httpStatus: error.httpStatus,
      ...(error.details ? { details: error.details } : {}),
    };
  }
  if (
    error instanceof GuardrailBlockError ||
    (error instanceof Error && error.name === "GuardrailBlockError")
  ) {
    const guardrailErr = error as GuardrailBlockError;
    const category = guardrailErr.errorCategory ?? "evidence_unavailable";
    return {
      category,
      message: guardrailErr.message,
      recoveryAction: getPatchRecoveryAction(category),
      httpStatus: category === "stale_resume_or_job" ? 422 : 422,
      ...(guardrailErr.result
        ? { details: { violations: guardrailErr.result.violations } }
        : {}),
    };
  }
  if (
    error instanceof InvalidPatchCitationError ||
    (error instanceof Error && error.name === "InvalidPatchCitationError")
  ) {
    return {
      category: "evidence_unavailable",
      message: error.message,
      recoveryAction: getPatchRecoveryAction("evidence_unavailable"),
      httpStatus: 422,
    };
  }
  const retryable =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034";
  if (retryable) {
    return {
      category: "save_failed",
      message: "Proposal batch changed concurrently. Reload proposals and retry.",
      recoveryAction: getPatchRecoveryAction("save_failed"),
      httpStatus: 409,
    };
  }
  const rawMessage = error instanceof Error ? error.message : "";
  if (/anchor|makes no change/i.test(rawMessage)) {
    return {
      category: "missing_patch_anchor",
      message: rawMessage,
      recoveryAction: getPatchRecoveryAction("missing_patch_anchor"),
      httpStatus: 409,
    };
  }
  if (/compile/i.test(rawMessage)) {
    return {
      category: "compile_failed",
      message: rawMessage,
      recoveryAction: getPatchRecoveryAction("compile_failed"),
      httpStatus: 422,
    };
  }
  return {
    category: "save_failed",
    message: "Patch batch could not be applied.",
    recoveryAction: getPatchRecoveryAction("save_failed"),
    httpStatus: 500,
  };
}

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
type EvidenceSnapshot = { id: string; userId?: string | null; type?: string; status: string; title: string; organization: string | null; dates: string | null; verifiedSummary: string; tags: string; bullets: Array<{ id: string; evidenceId?: string; text: string; verified: boolean; orderIndex: number; technologies: string; roleAffinity: string }> };
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

function buildServerValidationContext(
  master: { id: string; factSnapshot: Prisma.JsonValue | null; updatedAt: Date },
  evidence: EvidenceSnapshot[],
  ownerId: string
): TailoringValidationContext {
  const baseline = master.factSnapshot as unknown as ResumeFacts;
  const revision = sha({
    masterId: master.id,
    masterUpdatedAt: master.updatedAt.toISOString(),
    masterSnapshot: baseline,
    evidenceHash: allEvidenceHash(evidence),
  });
  return buildTailoringValidationContext(
    baseline,
    evidence.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type ?? "experience",
      title: row.title,
      organization: row.organization,
      dates: row.dates,
      verifiedSummary: row.verifiedSummary,
      tags: row.tags,
      status: row.status,
      bullets: row.bullets.map((b) => ({
        id: b.id,
        evidenceId: b.evidenceId ?? row.id,
        text: b.text,
        technologies: b.technologies,
        verified: b.verified,
      })),
    })),
    {
      ownerId,
      revision,
      authoritativeEvidence: true,
    }
  );
}

export interface BatchPublic { batchId: string; revisionToken: string; baseTypstSource: string; jobId: string; evidenceRevision?: string }
export interface CreateBatchInput { userId: string; masterResumeId: string; jobId: string; proposals: PatchProposal[]; gaps: unknown[]; expectedMasterFingerprint?: string; expectedJobFingerprint?: string; expectedCitationFingerprint?: string }

export async function captureProposalContext(userId: string, jobId: string, masterResumeId?: string) {
  const [master, job, evidence] = await Promise.all([
    prisma.resume.findFirst({ where: { ...(masterResumeId ? { id: masterResumeId } : {}), userId, isMaster: true, isProtected: true } }),
    prisma.job.findFirst({ where: { id: jobId, OR: [{ userId }, { userId: null }] } }),
    prisma.evidenceItem.findMany({ where: { userId }, include: { bullets: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } } }),
  ]);
  if (!master?.factSnapshot) {
    throw new PatchBatchError("stale_resume_or_job", "Freeze your master resume first.", {
      httpStatus: 422,
      recoveryAction: "Open the Editor and freeze your Master Resume before generating or applying patches.",
    });
  }
  if (!job) {
    throw new PatchBatchError("stale_resume_or_job", "Selected job is unavailable.", { httpStatus: 422 });
  }
  const validationContext = buildServerValidationContext(master, evidence, userId);
  return {
    master,
    job,
    evidence,
    masterFingerprint: masterHash(master),
    jobFingerprint: jobHash(job),
    evidenceFingerprint: allEvidenceHash(evidence),
    validationContext,
  };
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
    if (!evidence || !bullet || bullet.evidenceId !== evidence.id) {
      throw new PatchBatchError("evidence_unavailable", "Diagnostic evidence or bullet is unavailable.", { httpStatus: 422 });
    }
    const anchor = `// RF_BULLET:${bullet.id}`;
    if (source.split(anchor).length !== 2) {
      throw new PatchBatchError("missing_patch_anchor", "Diagnostic target anchor is missing or ambiguous.", { httpStatus: 409 });
    }
    const result = applyDeterministicPatch(source, evidence.id, bullet.id, [{ id: evidence.id, content: evidence.verifiedSummary, extractedTechnologies: [] }]);
    if (!result.applied) {
      throw new PatchBatchError("missing_patch_anchor", result.error || "Diagnostic proposal could not be reconstructed.", { httpStatus: 409 });
    }
    const nextSource = result.patchedTypstAst.replace(/^\/\/ @resumeforge-patched: true\r?\n/m, "");
    if (nextSource === source) {
      throw new PatchBatchError("missing_patch_anchor", "Diagnostic proposal makes no change.", { httpStatus: 409 });
    }
    let prefixLength = 0;
    while (prefixLength < source.length && prefixLength < nextSource.length && source[prefixLength] === nextSource[prefixLength]) prefixLength += 1;
    const anchorLineStart = source.lastIndexOf("\n", source.indexOf(anchor)) + 1;
    prefixLength = Math.min(prefixLength, anchorLineStart);
    let suffixLength = 0;
    while (suffixLength < source.length - prefixLength && suffixLength < nextSource.length - prefixLength && source[source.length - suffixLength - 1] === nextSource[nextSource.length - suffixLength - 1]) suffixLength += 1;
    const before = source.slice(prefixLength, source.length - suffixLength);
    const after = nextSource.slice(prefixLength, nextSource.length - suffixLength);
    if (!before.trim()) {
      throw new PatchBatchError("missing_patch_anchor", "Diagnostic proposal has no unique source fragment.", { httpStatus: 409 });
    }
    proposals.push(PatchProposalSchema.parse({
      id: randomUUID(), operation: "MODIFY_BULLET", targetSection: "experience", targetId: bullet.id,
      before, after, evidenceIds: [evidence.id, bullet.id],
      citations: [{ evidenceId: evidence.id, bulletId: bullet.id }],
      rationale: "Reconstructed from verified Evidence Bank summary.", confidence: 1,
    }));
  }
  return createProposalBatch({
    userId: input.userId, masterResumeId: context.master.id, jobId: input.jobId, proposals, gaps: [],
    expectedMasterFingerprint: context.masterFingerprint, expectedJobFingerprint: context.jobFingerprint,
    expectedCitationFingerprint: context.evidenceFingerprint,
  });
}

export async function createProposalBatch(input: CreateBatchInput): Promise<{ batch: BatchPublic; verified: PatchProposal[]; gaps: ReturnType<typeof gapsList>; validationContext: TailoringValidationContext }> {
  const proposals = PatchProposalSchema.array().parse(input.proposals).map(p => ({ ...p, id: randomUUID() }));
  const gaps = GapSchema.array().parse(input.gaps);
  if (!proposals.length) {
    throw new PatchBatchError("evidence_unavailable", "No evidence-backed proposals to save.", { httpStatus: 422 });
  }
  return prisma.$transaction(async tx => {
    const [master, job, evidence] = await Promise.all([
      tx.resume.findFirst({ where: { id: input.masterResumeId, userId: input.userId, isMaster: true, isProtected: true } }),
      tx.job.findFirst({ where: { id: input.jobId, OR: [{ userId: input.userId }, { userId: null }] } }),
      tx.evidenceItem.findMany({ where: { userId: input.userId }, include: { bullets: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } } }),
    ]);
    if (!master || !master.factSnapshot) {
      throw new PatchBatchError("stale_resume_or_job", "Freeze your master resume first.", { httpStatus: 422 });
    }
    if (!job) {
      throw new PatchBatchError("stale_resume_or_job", "Selected job is unavailable.", { httpStatus: 422 });
    }
    const mHash = masterHash(master);
    const jHash = jobHash(job);
    const cHash = evidenceHash(evidence, proposals);
    if ((input.expectedMasterFingerprint && input.expectedMasterFingerprint !== mHash) ||
        (input.expectedJobFingerprint && input.expectedJobFingerprint !== jHash)) {
      throw new PatchBatchError("stale_resume_or_job", "Source changed while proposals were generated. Generate again.", { httpStatus: 409 });
    }
    if (input.expectedCitationFingerprint && input.expectedCitationFingerprint !== allEvidenceHash(evidence)) {
      throw new PatchBatchError("evidence_changed", "Source changed while proposals were generated. Generate again.", { httpStatus: 409 });
    }
    validateProposalCitations(proposals, evidence, input.userId);
    const validationContext = buildServerValidationContext(master, evidence, input.userId);
    const revisionToken = sha({ mHash, jHash, cHash, proposals });
    const batch = await tx.patchProposalBatch.create({ data: {
      userId: input.userId, masterResumeId: master.id, jobId: job.id, revisionToken,
      masterFingerprint: mHash, jobFingerprint: jHash, citationFingerprint: cHash,
      proposals: proposals as unknown as Prisma.InputJsonValue, gaps: gaps as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    } });
    return {
      batch: { batchId: batch.id, revisionToken, baseTypstSource: master.typstSource, jobId: job.id, evidenceRevision: validationContext.revision },
      verified: proposals,
      gaps,
      validationContext,
    };
  });
}

function validateProposalCitations(
  proposals: PatchProposal[],
  evidence: Array<{ id: string; userId?: string | null; status: string; bullets: Array<{ id: string; evidenceId?: string; verified: boolean }> }>,
  ownerId: string
): ResolvedEvidenceRegistry {
  const registry = createVerifiedEvidenceRegistry(evidence, ownerId);
  for (const proposal of proposals) {
    if (proposal.operation === "REPORT_GAP") {
      throw new PatchBatchError("evidence_unavailable", "Gap items cannot be accepted as patches.", { httpStatus: 422 });
    }
    if (!proposal.evidenceIds.length && !(proposal.citations?.length)) {
      throw new PatchBatchError("evidence_unavailable", "Every patch needs verified evidence.", { httpStatus: 422 });
    }
    try {
      if (proposal.evidenceIds.length) {
        resolvePatchCitationReferences(proposal.evidenceIds, registry);
      }
      if (proposal.citations?.length) {
        resolvePatchCitationReferences(proposal.citations, registry);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("does not belong")) {
        throw new PatchBatchError("evidence_unavailable", msg, { httpStatus: 422 });
      }
      throw new PatchBatchError("evidence_unavailable", "Patch citation is unavailable or unverified.", { httpStatus: 422 });
    }
  }
  return registry;
}

export interface ApplyBatchInput { userId: string; batchId: string; revisionToken: string; acceptedPatchIds: string[]; acknowledgedSkills: string[]; variantTitle: string; expectedEvidenceRevision?: string }
export async function applyProposalBatch(input: ApplyBatchInput) {
  if (!input.acceptedPatchIds.length || new Set(input.acceptedPatchIds).size !== input.acceptedPatchIds.length) {
    throw new PatchBatchError("stale_resume_or_job", "Select unique patch proposals to apply.", { httpStatus: 422 });
  }
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "PatchProposalBatch" WHERE "id" = ${input.batchId} AND "userId" = ${input.userId} FOR UPDATE`;
    const batch = await tx.patchProposalBatch.findFirst({ where: { id: input.batchId, userId: input.userId } });
    if (!batch || batch.status !== "OPEN" || batch.expiresAt <= new Date()) {
      throw new PatchBatchError("stale_resume_or_job", "Proposal batch is unavailable or already applied.", { httpStatus: 409 });
    }
    if (batch.revisionToken !== input.revisionToken) {
      throw new PatchBatchError("stale_resume_or_job", "Proposal revision is stale.", { httpStatus: 409 });
    }
    await Promise.all([
      tx.$queryRaw`SELECT "id" FROM "Resume" WHERE "id" = ${batch.masterResumeId} FOR SHARE`,
      tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = ${batch.jobId} FOR SHARE`,
      tx.$queryRaw`SELECT "id" FROM "EvidenceItem" WHERE "userId" = ${input.userId} FOR SHARE`,
      tx.$queryRaw`SELECT b."id" FROM "Bullet" b JOIN "EvidenceItem" e ON e."id" = b."evidenceId" WHERE e."userId" = ${input.userId} FOR SHARE OF b`,
    ]);
    const [master, job, evidence] = await Promise.all([
      tx.resume.findFirst({ where: { id: batch.masterResumeId, userId: input.userId, isMaster: true, isProtected: true } }),
      tx.job.findFirst({ where: { id: batch.jobId, OR: [{ userId: input.userId }, { userId: null }] } }),
      tx.evidenceItem.findMany({ where: { userId: input.userId }, include: { bullets: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } } }),
    ]);
    if (!master?.factSnapshot || !job || masterHash(master) !== batch.masterFingerprint || jobHash(job) !== batch.jobFingerprint) {
      throw new PatchBatchError("stale_resume_or_job", "Master resume or job changed. Generate proposals again.", { httpStatus: 409 });
    }
    const proposals = proposalList(batch.proposals);
    const registry = validateProposalCitations(proposals, evidence, input.userId);
    if (evidenceHash(evidence, proposals) !== batch.citationFingerprint) {
      throw new PatchBatchError("evidence_changed", "Cited evidence changed. Generate proposals again.", { httpStatus: 409 });
    }
    const validationContext = buildServerValidationContext(master, evidence, input.userId);
    if (input.expectedEvidenceRevision && input.expectedEvidenceRevision !== validationContext.revision) {
      throw new PatchBatchError("evidence_changed", "Evidence Bank changed since these patches were generated. Generate proposals again.", { httpStatus: 409 });
    }
    const selectedSet = new Set(input.acceptedPatchIds);
    if (proposals.some(p => !p.id) || selectedSet.size !== proposals.filter(p => selectedSet.has(p.id)).length) {
      throw new PatchBatchError("stale_resume_or_job", "Unknown proposal ID.", { httpStatus: 409 });
    }
    const selected = proposals.filter(p => selectedSet.has(p.id));
    if (selected.length !== selectedSet.size) {
      throw new PatchBatchError("stale_resume_or_job", "Unknown proposal ID.", { httpStatus: 409 });
    }
    let reconstructed;
    try {
      reconstructed = applyPatchProposals(master.typstSource, selected);
    } catch (err) {
      throw new PatchBatchError(
        "missing_patch_anchor",
        err instanceof Error ? err.message : "Patch source anchor is missing or ambiguous.",
        { httpStatus: 409 }
      );
    }
    assertCanApplyPatches(reconstructed.typstSource, validationContext, selected, { acknowledgedSkills: input.acknowledgedSkills });
    const variant = await tx.resumeVariant.create({ data: {
      masterResumeId: master.id, jobId: job.id, variantTitle: input.variantTitle.trim().slice(0, 160) || "Tailored Resume",
      typstContent: markDocumentAsPatched(reconstructed.typstSource), factSnapshot: validationContext.facts as unknown as Prisma.InputJsonValue,
      patches: { create: selected.map(p => ({
        operation: p.operation, targetSection: p.targetSection, targetId: p.targetId,
        beforeContent: p.before, afterContent: p.after, evidenceCitations: JSON.stringify(p.evidenceIds),
        rationale: p.rationale, confidence: p.confidence, status: "ACCEPTED",
        citations: { create: validateAndBuildPatchCitations(p, registry) },
      })) },
    }, include: { patches: { include: { citations: true } } } });
    await tx.patchProposalBatch.update({ where: { id: batch.id }, data: { status: "CONSUMED", consumedAt: new Date() } });
    return {
      variantId: variant.id,
      variantTitle: variant.variantTitle,
      status: variant.status,
      typstContent: variant.typstContent,
      factSnapshot: validationContext.facts,
      validationContext,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
