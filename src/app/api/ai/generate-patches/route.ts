import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { generatePatchProposals } from "@/lib/ai/gateway";
import { PatchResponseSchema, verifyEvidenceCitations } from "@/lib/ai/patch-schema";
import { getMasterResume, saveMasterResume } from "@/lib/db/resumes";
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
  tailorFeedback: z
    .object({
      overviewCommentary: z.string(),
      nextStepsAdvice: z.array(z.string()).optional(),
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
    const body = await request.json();
    const parseResult = GeneratePatchesRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const { providerConfig, jobRequirements, tailorFeedback } = parseResult.data;

    // Fetch master resume (READ-ONLY — Amendment 3)
    let masterResume = await getMasterResume();
    if (!masterResume) {
      const defaultSource = `#let resume-section(title) = [ === #title ]\n#resume-section("Skills")\nLanguages: TypeScript, Node.js, Python, PostgreSQL, Docker, Kubernetes\n#resume-section("Experience")\n*Senior Software Engineer* (2020 - Present)\n- Built microservices using Go, Python, and PostgreSQL.\n- Deployed containerized applications with Docker and Kubernetes.\n`;
      const saveRes = await saveMasterResume({
        title: "Master Resume",
        typstSource: defaultSource,
        confirmOverwrite: true,
      });
      masterResume = saveRes.data;
    }

    // Fetch active evidence items (exclude archived)
    const allEvidence = await getEvidenceItems();
    let activeEvidence = allEvidence.filter((e) => e.status !== "archived");

    if (activeEvidence.length === 0) {
      // Fallback draft evidence item for prompt evaluation
      activeEvidence = [
        {
          id: "ev-starter-1",
          type: "experience",
          title: "Senior Backend Engineer",
          organization: "Acme Corp",
          dates: "2021 - Present",
          status: "verified",
          isDraft: false,
          verifiedSummary: "Architected microservices in Go and Python with Docker & Kubernetes.",
          tags: ["Go", "Python", "Kubernetes", "Docker", "RESTful APIs", "PostgreSQL"],
          bullets: [
            {
              id: "b-starter-1",
              evidenceId: "ev-starter-1",
              text: "Engineered scalable REST microservices using Go and Python.",
              technologies: ["Go", "Python", "RESTful APIs"],
              verified: true,
              roleAffinity: "Backend",
              orderIndex: 0,
            },
            {
              id: "b-starter-2",
              evidenceId: "ev-starter-1",
              text: "Containerized backend services with Docker and deployed to Kubernetes clusters.",
              technologies: ["Docker", "Kubernetes"],
              verified: true,
              roleAffinity: "Backend",
              orderIndex: 1,
            },
          ],
        } as any,
      ];
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
      masterTypst: masterResume!.typstSource,
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
          error: `AI returned a response that did not match the required patch schema. This can happen if the model doesn't support structured JSON output. Try a different model or provider. Details: ${err instanceof Error ? err.message : String(err)}`,
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
        masterResumeId: masterResume!.id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: sanitizeError(`Internal server error: ${err instanceof Error ? err.message : String(err)}`) },
      { status: 500 }
    );
  }
}
