import { NextResponse } from "next/server";
import {
  EvidenceExtractResponseSchema,
  ExtractEvidenceRequestSchema,
} from "@/lib/ai/evidence-extract-schema";
import { extractEvidenceFromMaster } from "@/lib/ai/gateway";
import { persistDraftEvidenceFromExtract } from "@/lib/ai/evidence-persist";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = await request.json();
    const parseResult = ExtractEvidenceRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input payload for evidence extract.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { typstSource, providerConfig } = parseResult.data;

    if (!providerConfig?.provider || (!providerConfig.apiKey && providerConfig.provider !== "custom")) {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }

    const gatewayResult = await extractEvidenceFromMaster(providerConfig, typstSource);

    if (!gatewayResult.success || !gatewayResult.rawJson) {
      return NextResponse.json(
        {
          success: false,
          error: gatewayResult.error || "Failed to extract evidence from AI provider.",
        },
        { status: 500 }
      );
    }

    let cleanedJson = gatewayResult.rawJson.trim();
    if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(cleanedJson);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "AI provider returned malformed non-JSON output for evidence extract.",
          rawOutput: sanitizeError(cleanedJson.slice(0, 300)),
        },
        { status: 422 }
      );
    }

    const schemaValidation = EvidenceExtractResponseSchema.safeParse(parsedResponse);
    if (!schemaValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Extracted evidence output failed schema validation.",
          details: schemaValidation.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const persistResult = await persistDraftEvidenceFromExtract(schemaValidation.data, userId);

    return NextResponse.json({
      success: true,
      data: {
        extract: schemaValidation.data,
        persist: persistResult,
      },
      message: `Created ${persistResult.createdCount} draft evidence item(s). Review in Library.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during evidence extract.",
        message: sanitizeError(err),
      },
      { status: 500 }
    );
  }
}
