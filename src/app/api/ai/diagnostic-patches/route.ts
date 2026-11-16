import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/security/auth-request";
import {
  classifyPatchApplicationError,
  createDiagnosticProposalBatch,
  PatchBatchError,
} from "@/lib/ai/patch-batches";
import { getPatchRecoveryAction } from "@/lib/ai/patch-schema";

const RequestSchema = z.object({
  jobId: z.string().min(1),
  descriptors: z.array(z.object({ evidenceId: z.string().min(1), targetBulletId: z.string().min(1) })).min(1).max(20),
}).strict();

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid diagnostic proposal request." }, { status: 400 });
    const result = await createDiagnosticProposalBatch({ userId, ...parsed.data });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof PatchBatchError) {
      const classified = classifyPatchApplicationError(error);
      return NextResponse.json(
        {
          success: false,
          error: classified.message,
          errorCategory: classified.category,
          recoveryAction: classified.recoveryAction,
        },
        { status: classified.httpStatus }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Diagnostic proposal could not be created. Verify selected job and evidence.",
        errorCategory: "evidence_unavailable",
        recoveryAction: getPatchRecoveryAction("evidence_unavailable"),
      },
      { status: 422 }
    );
  }
}
