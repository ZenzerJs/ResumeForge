import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderConfigSchema, type EvidenceItemForPrompt } from "@/lib/ai/types";
import { generatePatchProposals } from "@/lib/ai/gateway";
import {
  PatchResponseSchema,
  createVerifiedEvidenceRegistry,
  verifyEvidenceCitations,
  getPatchRecoveryAction,
} from "@/lib/ai/patch-schema";
import { getMasterResume } from "@/lib/db/resumes";
import { getEvidenceItems } from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";
import {
  captureProposalContext,
  classifyPatchApplicationError,
  createProposalBatch,
  PatchBatchError,
} from "@/lib/ai/patch-batches";
import { buildTailoringValidationContext } from "@/lib/facts/extract";
import type { ResumeFacts } from "@/lib/facts/types";

function parseJsonStringArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const GeneratePatchesRequestSchema = z.object({
  providerConfig: ProviderConfigSchema,
  jobId: z.string().optional(),
  jobRequirements: z.object({
    requiredSkills: z.array(z.string().max(80)).max(40),
    preferredSkills: z.array(z.string().max(80)).max(40),
    domainTerms: z.array(z.string().max(80)).max(40),
    roleTitle: z.string().max(160).optional(),
    company: z.string().max(120).optional(),
  }),
  tailorFeedback: z
    .object({
      overviewCommentary: z.string().max(4000),
      nextStepsAdvice: z.array(z.string().max(500)).max(12).optional(),
    })
    .optional(),
});

/**
 * POST /api/ai/generate-patches
 *
 * Generates structured AI patch proposals for tailoring the master resume
 * to a target job posting's requirements.
 *
 * Amendment 1: Applies strict whole-patch rejection for invalid evidence citations.
 * Amendment 3: Master resume is read-only input; no writes to Resume records.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }
    const parseResult = GeneratePatchesRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const { providerConfig, jobRequirements, tailorFeedback, jobId } = parseResult.data;

    const contextPromise = jobId
      ? captureProposalContext(userId, jobId).then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error })
        )
      : Promise.resolve(null);

    const [masterResume, contextOutcome, fallbackEvidence] = await Promise.all([
      getMasterResume(userId),
      contextPromise,
      jobId ? Promise.resolve(null) : getEvidenceItems(undefined, userId),
    ]);
    if (!masterResume) {
      return NextResponse.json(
        { success: false, error: "Master resume not found. Save a master resume before generating patches." },
        { status: 404 }
      );
    }

    if (contextOutcome && !contextOutcome.ok) {
      throw contextOutcome.error;
    }
    const context = contextOutcome ? contextOutcome.value : null;

    const activeEvidence: Array<
      EvidenceItemForPrompt & {
        userId?: string | null;
        status: string;
        bullets: Array<{ id: string; evidenceId?: string; text: string; technologies: string[]; verified: boolean }>;
      }
    > = context
      ? context.evidence
          .filter((e) => e.status === "verified")
          .map((e) => ({
            id: e.id,
            userId: e.userId,
            type: e.type,
            title: e.title,
            organization: e.organization,
            dates: e.dates,
            verifiedSummary: e.verifiedSummary,
            tags: parseJsonStringArray(e.tags),
            status: e.status,
            bullets: e.bullets
              .filter((bullet) => bullet.verified)
              .map((bullet) => ({
                id: bullet.id,
                evidenceId: bullet.evidenceId ?? e.id,
                text: bullet.text,
                technologies: parseJsonStringArray(bullet.technologies),
                verified: bullet.verified,
              })),
          }))
      : (fallbackEvidence ?? [])
          .filter((e) => e.status === "verified")
          .map((e) => ({
            ...e,
            bullets: e.bullets.filter((bullet) => bullet.verified),
          }));

    if (activeEvidence.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Add evidence first",
          errorCategory: "evidence_unavailable",
          recoveryAction: getPatchRecoveryAction("evidence_unavailable"),
        },
        { status: 422 }
      );
    }

    // Build unified verified evidence + bullet registry for citation verification
    const registry = createVerifiedEvidenceRegistry(activeEvidence, userId);

    // Generate patches via BYOK AI Gateway
    const result = await generatePatchProposals({
      providerConfig,
      masterTypst: context?.master.typstSource ?? masterResume.typstSource,
      jobRequirements,
      evidenceItems: activeEvidence,
      tailorFeedback,
    });

    if (!result.success || !result.rawJson) {
      return NextResponse.json(
        { success: false, error: sanitizeError(result.error || "AI provider returned no content.") },
        { status: 502 }
      );
    }

    // Parse and validate AI response against PatchResponseSchema.
    // Strip markdown fences that some models wrap around JSON output (e.g. ```json ... ```)
    let parsedResponse;
    try {
      const stripped = result.rawJson
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const rawParsed = JSON.parse(stripped);
      parsedResponse = PatchResponseSchema.parse(rawParsed);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: sanitizeError(
            `AI returned a response that did not match the required patch schema. This can happen if the model doesn't support structured JSON output. Try a different model or provider. Details: ${err instanceof Error ? err.message : String(err)}`
          ),
        },
        { status: 422 }
      );
    }

    // Apply evidence citation verification (Amendment 1: whole-patch rejection)
    const verificationResult = verifyEvidenceCitations(parsedResponse, registry);

    const batchResult = context && verificationResult.verified.length > 0 ? await createProposalBatch({
      userId,
      masterResumeId: masterResume.id,
      jobId: context.job.id,
      proposals: verificationResult.verified,
      gaps: verificationResult.gaps,
      expectedMasterFingerprint: context.masterFingerprint,
      expectedJobFingerprint: context.jobFingerprint,
      expectedCitationFingerprint: context.evidenceFingerprint,
    }) : undefined;

    const validationContext =
      batchResult?.validationContext ??
      context?.validationContext ??
      (masterResume.factSnapshot
        ? buildTailoringValidationContext(
            masterResume.factSnapshot as unknown as ResumeFacts,
            activeEvidence,
            { ownerId: userId, authoritativeEvidence: true }
          )
        : undefined);

    return NextResponse.json({
      success: true,
      data: {
        verified: batchResult?.verified ?? verificationResult.verified,
        rejected: verificationResult.rejected,
        gaps: batchResult?.gaps ?? verificationResult.gaps,
        masterResumeId: masterResume.id,
        ...(batchResult ? { batch: batchResult.batch } : {}),
        ...(validationContext ? { validationContext } : {}),
      },
    });
  } catch (err) {
    if (err instanceof PatchBatchError) {
      const classified = classifyPatchApplicationError(err);
      return NextResponse.json(
        {
          success: false,
          error: classified.message,
          errorCategory: classified.category,
          recoveryAction: classified.recoveryAction,
        },
        { status: classified.httpStatus }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Patch generation failed. Verify selected job and try again.",
        errorCategory: "save_failed",
        recoveryAction: getPatchRecoveryAction("save_failed"),
      },
      { status: 500 }
    );
  }
}
