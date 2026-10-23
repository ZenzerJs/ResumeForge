import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerateCoverLetterInputSchema, CoverLetterResponseSchema } from "@/lib/ai/cover-letter-schema";
import { ProviderConfigSchema, type EvidenceItemForPrompt } from "@/lib/ai/types";
import { generateCoverLetter } from "@/lib/ai/gateway";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";
import { extractJsonObject, normalizeCoverLetterPayload } from "@/lib/ai/json-response";
import { sanitizeError } from "@/lib/ai/redact";
import { isDemoMode } from "@/lib/demo-mode";
import { originAllowed } from "@/lib/security/session";

const EvidenceSchema = z.object({
  id: z.string().min(1).max(120), type: z.string().max(40), title: z.string().min(1).max(200),
  organization: z.string().max(200).nullable(), dates: z.string().max(100).nullable(),
  verifiedSummary: z.string().min(1).max(4000), tags: z.array(z.string().max(80)).max(50),
  status: z.literal("verified"),
  bullets: z.array(z.object({ id: z.string().min(1).max(120), text: z.string().min(1).max(2000), technologies: z.array(z.string().max(80)), verified: z.literal(true) })).max(100),
});

const RequestSchema = GenerateCoverLetterInputSchema.extend({
  providerConfig: ProviderConfigSchema.extend({ apiKey: z.string().min(1).max(500) }),
  evidenceItems: z.array(EvidenceSchema).max(100),
  masterTypst: z.string().max(50_000).optional(),
});

export async function POST(request: Request) {
  if (!isDemoMode()) return NextResponse.json({ success: false, error: "Demo mode is disabled." }, { status: 404 });
  if (!request.headers.get("origin") || !originAllowed(request)) {
    return NextResponse.json({ success: false, error: "Same-origin Origin header is required." }, { status: 403 });
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 512 * 1024) {
    return NextResponse.json({ success: false, error: "Demo request is too large." }, { status: 413 });
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 512 * 1024) {
      return NextResponse.json({ success: false, error: "Demo request is too large." }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400 });
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid demo cover letter payload." }, { status: 400 });
    const { evidenceItems, masterTypst, providerConfig, ...input } = parsed.data;
    if (evidenceItems.length === 0) {
      return NextResponse.json({ success: false, error: "Add verified local evidence before generating a cover letter." }, { status: 422 });
    }
    const activeEvidenceIds = evidenceItems.flatMap((item) => [item.id, ...item.bullets.map((bullet) => bullet.id)]);
    const result = await generateCoverLetter(providerConfig, input, evidenceItems as EvidenceItemForPrompt[], masterTypst);
    if (!result.success || !result.rawJson) {
      return NextResponse.json({ success: false, error: sanitizeError(result.error || "Provider returned no content.") }, { status: 502 });
    }
    let coverLetter;
    try {
      const normalized = normalizeCoverLetterPayload(extractJsonObject(result.rawJson), input.candidateName);
      coverLetter = CoverLetterResponseSchema.parse(normalized);
    } catch (error) {
      return NextResponse.json({ success: false, error: sanitizeError(`Cover letter output failed schema validation: ${error instanceof Error ? error.message : String(error)}`) }, { status: 422 });
    }
    const grounding = verifyCoverLetterGrounding(coverLetter, activeEvidenceIds);
    if (!grounding.verified) {
      return NextResponse.json({ success: false, error: "Generated cover letter failed evidence grounding.", reason: grounding.reason }, { status: 422 });
    }
    return NextResponse.json({ success: true, data: coverLetter, demo: true, sampleData: evidenceItems.some((item) => item.id.startsWith("demo-sample-")) });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) || "Demo cover letter request failed." }, { status: 500 });
  }
}
