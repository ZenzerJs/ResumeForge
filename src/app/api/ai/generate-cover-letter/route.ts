import { NextResponse } from "next/server";
import { GenerateCoverLetterInputSchema, CoverLetterResponseSchema } from "@/lib/ai/cover-letter-schema";
import { generateCoverLetter } from "@/lib/ai/gateway";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";
import { extractJsonObject, normalizeCoverLetterPayload } from "@/lib/ai/json-response";
import { getEvidenceItems } from "@/lib/db/evidence";
import { getMasterResume } from "@/lib/db/resumes";
import { sanitizeError } from "@/lib/ai/redact";
import { ProviderConfig } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parseResult = GenerateCoverLetterInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input payload for cover letter generation.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const providerConfig: ProviderConfig = body.providerConfig || {};

    if (!providerConfig.provider || !providerConfig.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }

    // Fetch active evidence items from database
    const evidenceItems = await getEvidenceItems();
    const activeEvidenceItems = evidenceItems.filter((e) => e.status !== "archived");

    // Collect all active evidence item and bullet IDs
    const activeEvidenceIds: string[] = [];
    for (const item of activeEvidenceItems) {
      activeEvidenceIds.push(item.id);
      if (Array.isArray(item.bullets)) {
        for (const bullet of item.bullets) {
          activeEvidenceIds.push(bullet.id);
        }
      }
    }

    const master = await getMasterResume();

    // Invoke BYOK AI Gateway
    const gatewayResult = await generateCoverLetter(
      providerConfig,
      input,
      activeEvidenceItems,
      master?.typstSource
    );

    if (!gatewayResult.success || !gatewayResult.rawJson) {
      return NextResponse.json(
        {
          success: false,
          error: gatewayResult.error || "Failed to generate cover letter from AI provider.",
        },
        { status: 500 }
      );
    }

    // Parse + normalize AI JSON (fences, length floors, etc.)
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

    const normalized = normalizeCoverLetterPayload(parsedResponse, input.candidateName);
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

    const coverLetter = schemaValidation.data;

    // Verify Evidence Grounding Contract
    const groundingVerification = verifyCoverLetterGrounding(coverLetter, activeEvidenceIds);
    if (!groundingVerification.verified) {
      return NextResponse.json(
        {
          success: false,
          error: "SECURITY CONTRACT REJECTION: Generated cover letter contained unverified or hallucinated evidence citations.",
          reason: groundingVerification.reason,
          invalidCitations: groundingVerification.invalidCitations,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: coverLetter,
    });
  } catch (err) {
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
