import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderConfigSchema, type EvidenceItemForPrompt } from "@/lib/ai/types";
import { generatePatchProposals } from "@/lib/ai/gateway";
import { PatchResponseSchema, verifyEvidenceCitations } from "@/lib/ai/patch-schema";
import { sanitizeError } from "@/lib/ai/redact";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

const DemoEvidenceSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().max(40),
  title: z.string().min(1).max(200),
  organization: z.string().max(200).nullable(),
  dates: z.string().max(100).nullable(),
  verifiedSummary: z.string().min(1).max(4000),
  tags: z.array(z.string().max(80)).max(50),
  status: z.literal("verified"),
  bullets: z.array(z.object({
    id: z.string().min(1).max(120),
    text: z.string().min(1).max(2000),
    technologies: z.array(z.string().max(80)),
    verified: z.literal(true),
  })).max(100),
});

const DemoPatchRequestSchema = z.object({
  providerConfig: ProviderConfigSchema.extend({ apiKey: z.string().min(1).max(500) }),
  masterTypst: z.string().min(1).max(50_000),
  evidenceItems: z.array(DemoEvidenceSchema).max(100),
  jobRequirements: z.object({
    requiredSkills: z.array(z.string().max(80)).max(40),
    preferredSkills: z.array(z.string().max(80)).max(40),
    domainTerms: z.array(z.string().max(80)).max(40),
    roleTitle: z.string().max(160).optional(),
    company: z.string().max(120).optional(),
  }),
  tailorFeedback: z.object({
    overviewCommentary: z.string().max(4000),
    nextStepsAdvice: z.array(z.string().max(500)).max(12).optional(),
  }).optional(),
});

const MAX_BODY_BYTES = 512 * 1024;

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ success: false, error: "This endpoint is only available in demo mode." }, { status: 404 });
  }
  if (!request.headers.get("origin") || !originAllowed(request)) {
    return NextResponse.json({ success: false, error: "Same-origin Origin header is required." }, { status: 403 });
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: "Demo request is too large." }, { status: 413 });
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Demo request is too large." }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400 });
    }
    const parsed = DemoPatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid demo tailoring payload." }, { status: 400 });
    }
    const input = parsed.data;
    const activeEvidence = input.evidenceItems;
    if (activeEvidence.length === 0) {
      return NextResponse.json({ success: false, error: "Add verified local evidence before generating patches." }, { status: 422 });
    }
    const result = await generatePatchProposals({
      providerConfig: input.providerConfig,
      masterTypst: input.masterTypst,
      jobRequirements: input.jobRequirements,
      evidenceItems: activeEvidence as EvidenceItemForPrompt[],
      tailorFeedback: input.tailorFeedback,
    });
    if (!result.success || !result.rawJson) {
      return NextResponse.json({ success: false, error: sanitizeError(result.error || "AI provider returned no content.") }, { status: 502 });
    }
    let response;
    try {
      const stripped = result.rawJson.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      response = PatchResponseSchema.parse(JSON.parse(stripped));
    } catch (error) {
      return NextResponse.json({ success: false, error: sanitizeError(`AI output did not match the Patch schema: ${error instanceof Error ? error.message : String(error)}`) }, { status: 422 });
    }
    const evidenceIds = new Set(activeEvidence.map((item) => item.id));
    const bulletIds = new Set(activeEvidence.flatMap((item) => item.bullets.map((bullet) => bullet.id)));
    const verified = verifyEvidenceCitations(response, evidenceIds, bulletIds);
    return NextResponse.json({
      success: true,
      data: {
        verified: verified.verified,
        rejected: verified.rejected,
        gaps: verified.gaps,
        masterResumeId: null,
        demo: true,
        sampleData: activeEvidence.some((item) => item.id.startsWith("demo-sample-")),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) || "Demo AI request failed." }, { status: 500 });
  }
}
