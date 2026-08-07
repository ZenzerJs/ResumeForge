import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CoverLetterResponseSchema } from "@/lib/ai/cover-letter-schema";
import { generateCoverLetter } from "@/lib/ai/gateway";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";
import { getEvidenceItems } from "@/lib/db/evidence";
import { createCoverLetter } from "@/lib/db/cover-letters";
import { sanitizeError } from "@/lib/ai/redact";
import { ProviderConfig } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { jobId, variantId, providerConfig: rawProviderConfig } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid required parameter: jobId" },
        { status: 400 }
      );
    }

    // Verify job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job record not found: ${jobId}` },
        { status: 400 }
      );
    }

    // Verify variant exists if provided
    if (variantId && typeof variantId === "string") {
      const variant = await prisma.resumeVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) {
        return NextResponse.json(
          { success: false, error: `ResumeVariant record not found: ${variantId}` },
          { status: 400 }
        );
      }
    }

    // Validate provider configuration
    const providerConfig: ProviderConfig = rawProviderConfig || body.provider || {};
    if (!providerConfig.provider || !providerConfig.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }

    // Gather active evidence items
    const evidenceItems = await getEvidenceItems();
    const activeEvidenceItems = evidenceItems.filter((e) => e.status !== "archived");

    const activeEvidenceIds: string[] = [];
    for (const item of activeEvidenceItems) {
      activeEvidenceIds.push(item.id);
      if (Array.isArray(item.bullets)) {
        for (const bullet of item.bullets) {
          activeEvidenceIds.push(bullet.id);
        }
      }
    }

    // Extract requirements object if available
    let extractedReqs = {};
    try {
      extractedReqs = JSON.parse(job.extractedRequirements || "{}");
    } catch {
      // Non-fatal
    }

    const inputPayload = {
      jobId: job.id,
      variantId: variantId || undefined,
      company: job.company || "Hiring Organization",
      roleTitle: job.roleTitle || "Target Position",
      rawDescription: job.rawDescription,
      extractedRequirements: extractedReqs,
      candidateName: body.candidateName || "Candidate",
      activeRoleProfile: body.activeRoleProfile || "Full-stack",
    };

    // Call BYOK AI Gateway
    const gatewayResult = await generateCoverLetter(providerConfig, inputPayload, activeEvidenceItems);

    if (!gatewayResult.success || !gatewayResult.rawJson) {
      return NextResponse.json(
        {
          success: false,
          error: gatewayResult.error || "Failed to generate cover letter from AI provider.",
        },
        { status: 500 }
      );
    }

    // Strip markdown JSON fences if present
    let cleanedJson = gatewayResult.rawJson.trim();
    if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedJson);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "AI provider returned malformed non-JSON output for cover letter.",
          rawOutput: sanitizeError(cleanedJson.slice(0, 300)),
        },
        { status: 422 }
      );
    }

    const schemaValidation = CoverLetterResponseSchema.safeParse(parsedResponse);
    if (!schemaValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Generated cover letter output failed schema validation.",
          details: schemaValidation.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const coverLetterData = schemaValidation.data;

    // Verify evidence grounding contract
    const groundingVerification = verifyCoverLetterGrounding(coverLetterData, activeEvidenceIds);
    if (!groundingVerification.verified) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SECURITY CONTRACT REJECTION: Generated cover letter contained unverified or hallucinated evidence citations.",
          reason: groundingVerification.reason,
          invalidCitations: groundingVerification.invalidCitations,
        },
        { status: 422 }
      );
    }

    // Persist draft in database
    const persisted = await createCoverLetter({
      jobId: job.id,
      variantId: variantId || undefined,
      title: coverLetterData.title || `Cover Letter — ${job.company || "Company"} ${job.roleTitle || "Role"}`,
      salutation: coverLetterData.salutation,
      openingParagraph: coverLetterData.openingParagraph,
      bodyParagraphs: coverLetterData.bodyParagraphs,
      closingParagraph: coverLetterData.closingParagraph,
      fullMarkdown: coverLetterData.fullMarkdown,
      evidenceCitations: coverLetterData.evidenceCitations,
      status: "DRAFT",
    });

    return NextResponse.json({
      success: true,
      data: persisted,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during cover letter generation.",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
