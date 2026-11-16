import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/security/auth-request";
import {
  applyProposalBatch,
  classifyPatchApplicationError,
} from "@/lib/ai/patch-batches";

const ApplyPatchesRequestSchema = z.object({
  batchId: z.string().uuid(),
  revisionToken: z.string().length(64),
  acceptedPatchIds: z.array(z.string().uuid()).min(1).max(100),
  acknowledgedSkills: z.array(z.string().max(80)).max(100).default([]),
  variantTitle: z.string().trim().min(1).max(160),
  expectedEvidenceRevision: z.string().min(1).max(128).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid patch batch request." }, { status: 400 });
    }
    const parsed = ApplyPatchesRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid patch batch request." }, { status: 400 });
    const data = await applyProposalBatch({ userId, ...parsed.data });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const classified = classifyPatchApplicationError(error);
    return NextResponse.json(
      {
        success: false,
        error: classified.message,
        errorCategory: classified.category,
        recoveryAction: classified.recoveryAction,
        ...(classified.details ? { details: classified.details } : {}),
      },
      { status: classified.httpStatus }
    );
  }
}
