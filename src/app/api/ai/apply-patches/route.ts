import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/security/auth-request";
import { applyProposalBatch } from "@/lib/ai/patch-batches";

const ApplyPatchesRequestSchema = z.object({
  batchId: z.string().uuid(),
  revisionToken: z.string().length(64),
  acceptedPatchIds: z.array(z.string().uuid()).min(1).max(100),
  acknowledgedSkills: z.array(z.string().max(80)).max(100).default([]),
  variantTitle: z.string().trim().min(1).max(160),
}).strict();

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;
    const parsed = ApplyPatchesRequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid patch batch request." }, { status: 400 });
    const data = await applyProposalBatch({ userId, ...parsed.data });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const retryable = typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2034";
    const known = /^(Select unique patch proposals to apply\.|Proposal batch is unavailable or already applied\.|Proposal revision is stale\.|Master resume or job changed\. Generate proposals again\.|Cited evidence changed\. Generate proposals again\.|Unknown proposal ID\.|Patch citation is unavailable or unverified\.|Every patch needs verified evidence\.|Gap items cannot be accepted as patches\.|Freeze your master resume first\.|Selected job is unavailable\.|No evidence-backed proposals to save\.)$/.test(rawMessage);
    const isGuardrail = error instanceof Error && error.name === "GuardrailBlockError";
    const message = retryable ? "Proposal batch changed concurrently. Reload proposals and retry." : known || isGuardrail ? rawMessage : "Patch batch could not be applied.";
    const conflict = retryable || /changed|stale|already applied|unavailable|Unknown proposal|anchor|makes no change/i.test(message);
    return NextResponse.json({ success: false, error: message }, { status: conflict ? 409 : 422 });
  }
}
