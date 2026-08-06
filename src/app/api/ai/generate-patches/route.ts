import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { generatePatchProposals } from "@/lib/ai/gateway";
import { PatchResponseSchema, verifyEvidenceCitations } from "@/lib/ai/patch-schema";
import { getMasterResume } from "@/lib/db/resumes";
import { getEvidenceItems } from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";

const GeneratePatchesRequestSchema = z.object({
  providerConfig: ProviderConfigSchema,
  jobId: z.string().optional(),
  jobRequirements: z.object({
    requiredSkills: z.array(z.string()),
    preferredSkills: z.array(z.string()),
    domainTerms: z.array(z.string()),
    roleTitle: z.string().optional(),
    company: z.string().optional(),
  }),
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
    const body = await request.json();
    const parseResult = GeneratePatchesRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const { providerConfig, jobRequirements } = parseResult.data;

    // Fetch master resume (READ-ONLY — Amendment 3)
    const masterResume = await getMasterResume();
    if (!masterResume) {
      return NextResponse.json(
        { success: false, error: "No master resume found. Please save a master resume first." },
        { status: 404 }
      );
    }

    // Fetch active evidence items (exclude archived)
    const allEvidence = await getEvidenceItems();
    const activeEvidence = allEvidence.filter((e) => e.status !== "archived");

    if (activeEvidence.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active evidence items found. Please add verified evidence to the Evidence Bank." },
        { status: 404 }
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
      masterTypst: masterResume.typstSource,
      jobRequirements,
      evidenceItems: activeEvidence,
    });

    if (!result.success || !result.rawJson) {
      return NextResponse.json(
        { success: false, error: sanitizeError(result.error || "AI provider returned no content.") },
        { status: 502 }
      );
    }

    // Parse and validate AI response against PatchResponseSchema
    let parsedResponse;
    try {
      const rawParsed = JSON.parse(result.rawJson);
      parsedResponse = PatchResponseSchema.parse(rawParsed);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: `AI response failed schema validation: ${err instanceof Error ? err.message : String(err)}`,
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

    return NextResponse.json({
      success: true,
      data: {
        verified: verificationResult.verified,
        rejected: verificationResult.rejected,
        gaps: verificationResult.gaps,
        masterResumeId: masterResume.id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeError(`Internal server error: ${err instanceof Error ? err.message : String(err)}`) },
      { status: 500 }
    );
  }
}
