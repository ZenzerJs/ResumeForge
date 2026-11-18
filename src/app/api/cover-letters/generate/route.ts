import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CoverLetterResponseSchema } from "@/lib/ai/cover-letter-schema";
import { generateCoverLetter, resolveServerProviderConfig } from "@/lib/ai/gateway";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";
import { extractJsonObject, normalizeCoverLetterPayload } from "@/lib/ai/json-response";
import { getEvidenceItems } from "@/lib/db/evidence";
import { createCoverLetter } from "@/lib/db/cover-letters";
import { getMasterResume } from "@/lib/db/resumes";
import { extractCandidateNameFromTypst, replacePlaceholderSignature } from "@/lib/export/resume-text";
import { sanitizeError } from "@/lib/ai/redact";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { requireUserId } from "@/lib/security/auth-request";

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    if (userId instanceof NextResponse) return userId;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;

    const { jobId, variantId, providerConfig: rawProviderConfig } = body;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid required parameter: jobId" },
        { status: 400 }
      );
    }

    // Verify job exists
    const job = await prisma.job.findFirst({
      where: { id: jobId, OR: [{ userId }, { userId: null }] },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job record not found: ${jobId}` },
        { status: 404 }
      );
    }

    // Verify variant exists if provided
    if (variantId && typeof variantId === "string") {
      const variant = await prisma.resumeVariant.findFirst({
        where: { id: variantId, jobId, masterResume: { userId } },
      });
      if (!variant) {
        return NextResponse.json(
          { success: false, error: `ResumeVariant record not found: ${variantId}` },
          { status: 404 }
        );
      }
    }

    const parsedConfig = ProviderConfigSchema.safeParse(rawProviderConfig || body.provider);
    if (!parsedConfig.success || !parsedConfig.data.provider) {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }
    const resolvedConfig = resolveServerProviderConfig(parsedConfig.data);
    if (
      !resolvedConfig.apiKey &&
      resolvedConfig.provider !== "custom" &&
      resolvedConfig.provider !== "ollama"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }
    const providerConfig = resolvedConfig;

    // Gather active evidence items
    const evidenceItems = await getEvidenceItems(undefined, userId);
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

    const master = await getMasterResume(userId);
    const providedName = typeof body.candidateName === "string" ? body.candidateName.trim() : "";
    const resolvedCandidateName =
      providedName && providedName.toLowerCase() !== "candidate"
        ? providedName
        : extractCandidateNameFromTypst(master?.typstSource) || "Candidate";

    const inputPayload = {
      jobId: job.id,
      variantId: typeof variantId === "string" ? variantId : undefined,
      company: job.company || "Hiring Organization",
      roleTitle: job.roleTitle || "Target Position",
      rawDescription: job.rawDescription,
      extractedRequirements: extractedReqs,
      candidateName: resolvedCandidateName,
      activeRoleProfile: typeof body.activeRoleProfile === "string" && body.activeRoleProfile ? body.activeRoleProfile : "Full-stack",
    };

    // Call BYOK AI Gateway
    const gatewayResult = await generateCoverLetter(
      providerConfig,
      inputPayload,
      activeEvidenceItems,
      master?.typstSource
    );

    if (!gatewayResult.success || !gatewayResult.rawJson) {
      return NextResponse.json(
        {
          success: false,
          error: sanitizeError(gatewayResult.error || "Failed to generate cover letter from AI provider."),
        },
        { status: 502 }
      );
    }

    // Parse + normalize AI JSON
    let parsedResponse: unknown;
    try {
      parsedResponse = extractJsonObject(gatewayResult.rawJson);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "AI provider returned malformed non-JSON output for cover letter.",
          rawOutput: sanitizeError(gatewayResult.rawJson.slice(0, 300)),
        },
        { status: 422 }
      );
    }

    const normalized = normalizeCoverLetterPayload(
      parsedResponse,
      resolvedCandidateName
    );
    if (normalized && typeof normalized === "object" && "fullMarkdown" in normalized) {
      const record = normalized as Record<string, unknown>;
      if (typeof record.fullMarkdown === "string") {
        record.fullMarkdown = replacePlaceholderSignature(record.fullMarkdown, resolvedCandidateName);
      }
    }
    const schemaValidation = CoverLetterResponseSchema.safeParse(normalized);
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
      variantId: typeof variantId === "string" ? variantId : undefined,
      title: coverLetterData.title || `Cover Letter — ${job.company || "Company"} ${job.roleTitle || "Role"}`,
      salutation: coverLetterData.salutation,
      openingParagraph: coverLetterData.openingParagraph,
      bodyParagraphs: coverLetterData.bodyParagraphs,
      closingParagraph: coverLetterData.closingParagraph,
      fullMarkdown: coverLetterData.fullMarkdown,
      evidenceCitations: coverLetterData.evidenceCitations,
      status: "DRAFT",
      userId,
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
