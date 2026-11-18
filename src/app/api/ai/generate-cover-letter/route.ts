import { NextResponse } from "next/server";
import { GenerateCoverLetterInputSchema } from "@/lib/ai/cover-letter-schema";
import { generateCoverLetter, resolveServerProviderConfig } from "@/lib/ai/gateway";
import { parseAndVerifyCoverLetterOutput } from "@/lib/ai/cover-letter-verifier";
import { getEvidenceItems } from "@/lib/db/evidence";
import { getMasterResume } from "@/lib/db/resumes";
import { extractCandidateNameFromTypst } from "@/lib/export/resume-text";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";

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
    const providerConfig = input.providerConfig;

    if (!providerConfig?.provider) {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }

    const resolvedConfig = resolveServerProviderConfig(providerConfig);
    if (!resolvedConfig.apiKey && resolvedConfig.provider !== "custom" && resolvedConfig.provider !== "ollama") {
      return NextResponse.json(
        {
          success: false,
          error: "No AI provider configured. Please configure your API key in Settings.",
        },
        { status: 400 }
      );
    }

    // Fetch active evidence items from database
    const evidenceItems = await getEvidenceItems(undefined, userId);
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

    const master = await getMasterResume(userId);
    const providedName = input.candidateName?.trim() || "";
    const resolvedCandidateName =
      providedName && providedName.toLowerCase() !== "candidate"
        ? providedName
        : extractCandidateNameFromTypst(master?.typstSource) || "Candidate";

    // Invoke BYOK AI Gateway
    const gatewayResult = await generateCoverLetter(
      resolvedConfig,
      { ...input, candidateName: resolvedCandidateName },
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

    const validated = parseAndVerifyCoverLetterOutput(
      gatewayResult.rawJson,
      resolvedCandidateName,
      activeEvidenceIds
    );
    if (!validated.ok) {
      return NextResponse.json(validated.body, { status: validated.status });
    }

    return NextResponse.json({
      success: true,
      data: validated.data,
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
