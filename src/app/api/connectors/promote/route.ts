import { NextRequest, NextResponse } from "next/server";
import { promoteIngestedJobToTrackedJob } from "@/lib/connectors/orchestrator";
import { requireUserId } from "@/lib/security/auth-request";
import { redactError } from "@/lib/ai/redact";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserId(req);
    if (auth instanceof Response) return auth;
    const userId = auth;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { ingestedJobId } = body || {};

    if (!ingestedJobId || typeof ingestedJobId !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid ingestedJobId" },
        { status: 400 }
      );
    }

    const job = await promoteIngestedJobToTrackedJob(ingestedJobId, userId);

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (err: any) {
    console.error("[API connectors/promote] Error:", redactError(err));
    if (err?.message?.includes("not found")) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to promote job" },
      { status: 500 }
    );
  }
}
