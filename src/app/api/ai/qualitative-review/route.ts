import { NextRequest, NextResponse } from "next/server";
import { generateQualitativeReview } from "@/lib/ai/gateway";
import { AtsQualitativeReviewSchema } from "@/lib/ai/qualitative-schema";
import { extractJsonObject, normalizeQualitativeReviewPayload } from "@/lib/ai/json-response";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { sanitizeError } from "@/lib/ai/redact";
import { z } from "zod";
import { requireUserId } from "@/lib/security/auth-request";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

const QualitativeReviewApiInputSchema = z.object({
  providerConfig: ProviderConfigSchema,
  typstContent: z.string().min(1, "typstContent is required"),
  jobRequirements: z.object({
    requiredSkills: z.array(z.string()),
    preferredSkills: z.array(z.string()),
    domainTerms: z.array(z.string()),
    roleTitle: z.string().optional(),
    company: z.string().optional(),
  }),
  rawDescription: z.string().optional(),
  deterministicResult: z.object({
    overallScore: z.number(),
    baseHealth: z.any(),
    requiredMatch: z.any(),
    preferredMatch: z.any(),
    roleEvidence: z.any(),
    skillEvaluations: z.array(z.any()),
    gaps: z.array(z.string()),
    selectedProfile: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const demoMode = isDemoMode();
    if (demoMode) {
      if (!req.headers.get("origin") || !originAllowed(req)) {
        return NextResponse.json({ success: false, error: "Same-origin Origin header is required." }, { status: 403 });
      }
      const contentLength = Number(req.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
        return NextResponse.json({ success: false, error: "Demo request is too large." }, { status: 413 });
      }
    } else {
      const gated = await requireUserId(req);
      if (gated instanceof NextResponse) return gated;
    }

    const raw = await req.text();
    if (demoMode && new TextEncoder().encode(raw).byteLength > 256 * 1024) {
      return NextResponse.json({ success: false, error: "Demo request is too large." }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400 });
    }
    const parseResult = QualitativeReviewApiInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: sanitizeError(
            `Invalid input: ${parseResult.error.issues.map((i) => i.message).join(", ")}`
          ),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    if (demoMode) {
      if (!input.providerConfig.apiKey?.trim()) {
        return NextResponse.json({ success: false, error: "Provide your own AI provider key in Settings to use AI in the demo." }, { status: 400 });
      }
      const oversized = input.typstContent.length > 50_000 ||
        (input.rawDescription?.length || 0) > 100_000 ||
        input.jobRequirements.requiredSkills.length > 40 ||
        input.jobRequirements.preferredSkills.length > 40 ||
        input.jobRequirements.domainTerms.length > 40 ||
        [...input.jobRequirements.requiredSkills, ...input.jobRequirements.preferredSkills, ...input.jobRequirements.domainTerms].some((value) => value.length > 80);
      if (oversized) return NextResponse.json({ success: false, error: "Demo review input exceeds the supported size." }, { status: 413 });
    }

    const gatewayResult = await generateQualitativeReview({
      providerConfig: input.providerConfig,
      typstContent: input.typstContent,
      jobRequirements: input.jobRequirements,
      rawDescription: input.rawDescription,
      deterministicResult: input.deterministicResult as any,
    });

    if (!gatewayResult.success || !gatewayResult.rawJson) {
      return NextResponse.json(
        {
          success: false,
          error: gatewayResult.error || "Failed to generate qualitative review.",
        },
        { status: 500 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = extractJsonObject(gatewayResult.rawJson);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI provider returned malformed JSON payload. Please retry — the model must return a single raw JSON object.",
        },
        { status: 502 }
      );
    }

    const normalized = normalizeQualitativeReviewPayload(parsedJson);
    const schemaValidation = AtsQualitativeReviewSchema.safeParse(normalized);
    if (!schemaValidation.success) {
      const details = schemaValidation.error.issues
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; ");
      return NextResponse.json(
        {
          success: false,
          error: `AI qualitative output failed schema validation: ${details}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: schemaValidation.data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: sanitizeError(
          `Server error during qualitative review: ${err instanceof Error ? err.message : String(err)}`
        ),
      },
      { status: 500 }
    );
  }
}
