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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }
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
    const code = typeof err === "object" && err !== null && "code" in err ? (err as { code?: unknown }).code : undefined;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "P2025" || message.toLowerCase().includes("not found")) {
      return NextResponse.json(
        {
          success: false,
          error: "Snapshot not found",
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to undo Master Resume overwrite",
        message: sanitizeError(message),
      },
      { status: 500 }
    );
  }
}
