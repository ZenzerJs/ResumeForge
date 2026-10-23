import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { generatePatchProposals } from "@/lib/ai/gateway";
import { PatchResponseSchema, verifyEvidenceCitations } from "@/lib/ai/patch-schema";
import { getMasterResume } from "@/lib/db/resumes";
import { getEvidenceItems } from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";
import { captureProposalContext, createProposalBatch } from "@/lib/ai/patch-batches";

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

    const body = await request.json();
    const parseResult = GeneratePatchesRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const { providerConfig, jobRequirements, tailorFeedback, jobId } = parseResult.data;

    const masterResume = await getMasterResume(userId);
    if (!masterResume) {
      return NextResponse.json(
        { success: false, error: "Master resume not found. Save a master resume before generating patches." },
        { status: 404 }
      );
    }

    const context = jobId ? await captureProposalContext(userId, jobId, masterResume.id) : null;

    const allEvidence = await getEvidenceItems(undefined, userId);
    const activeEvidence = allEvidence
      .filter((e) => e.status === "verified")
      .map((e) => ({ ...e, bullets: e.bullets.filter((bullet) => bullet.verified) }));

    if (activeEvidence.length === 0) {
      return NextResponse.json(
        { success: false, error: "Add evidence first" },
        { status: 422 }
      );
    }

    // Build valid ID sets for citation verification
    const validEvidenceIds = new Set<string>(activeEvidence.map((e) => e.id));
    const validBulletIds = new Set<string>();
    for (const evidence of activeEvidence) {
      for (const bullet of evidence.bullets) {
        validBulletIds.add(bullet.id);
      }
    }

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
    const verificationResult = verifyEvidenceCitations(
      parsedResponse,
      validEvidenceIds,
      validBulletIds
    );

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

    return NextResponse.json({
      success: true,
      data: {
        verified: batchResult?.verified ?? verificationResult.verified,
        rejected: verificationResult.rejected,
        gaps: batchResult?.gaps ?? verificationResult.gaps,
        masterResumeId: masterResume.id,
        ...(batchResult ? { batch: batchResult.batch } : {}),
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const known = [
      "Freeze your master resume first.",
      "Selected job is unavailable.",
      "Source changed while proposals were generated. Generate again.",
    ].includes(raw);
    const changed = raw.startsWith("Source changed while proposals were generated.");
    return NextResponse.json(
      { success: false, error: known ? raw : "Patch generation failed. Verify selected job and try again." },
      { status: changed ? 409 : known ? 422 : 500 }
    );
  }
}
