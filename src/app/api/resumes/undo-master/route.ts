import { NextResponse } from "next/server";
import { z } from "zod";
import { restoreMasterSnapshot } from "@/lib/db/resumes";
import { sanitizeError } from "@/lib/ai/redact";
import { requireUserId } from "@/lib/security/auth-request";

const UndoMasterSchema = z.object({
  snapshotId: z.string().min(1, "snapshotId is required"),
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = await request.json();
    const parseResult = UndoMasterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload for Undo Overwrite",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { snapshotId } = parseResult.data;
    const restoredMaster = await restoreMasterSnapshot(snapshotId, userId);

    return NextResponse.json({
      success: true,
      data: restoredMaster,
      message: "Master Resume successfully restored to pre-save snapshot.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to undo Master Resume overwrite",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
