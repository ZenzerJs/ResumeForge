import { NextRequest, NextResponse } from "next/server";
import { promoteIngestedJobToTrackedJob } from "@/lib/connectors/orchestrator";
import { getRequestUserId } from "@/lib/security/auth-request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    const body = await req.json();
    const { ingestedJobId } = body;

    if (!ingestedJobId || typeof ingestedJobId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid ingestedJobId" },
        { status: 400 }
      );
    }

    const job = await promoteIngestedJobToTrackedJob(ingestedJobId, userId || undefined);

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (err: any) {
    console.error("[API connectors/promote] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Promotion failed" },
      { status: 500 }
    );
  }
}
