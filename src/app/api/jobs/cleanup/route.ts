import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { cleanupStalePositions } from "@/lib/db/jobs";
import { redactError } from "@/lib/ai/redact";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const jobSyncSecret = process.env.JOB_SYNC_SECRET?.trim();
    const authHeader = req.headers.get("Authorization");
    const isJobSyncAuthorized = Boolean(
      jobSyncSecret &&
      authHeader &&
      authHeader.startsWith("Bearer ") &&
      (() => {
        const expected = `Bearer ${jobSyncSecret}`;
        const a = Buffer.from(authHeader);
        const b = Buffer.from(expected);
        return a.length === b.length && timingSafeEqual(a, b);
      })()
    );

    if (!isJobSyncAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let dryRun = true;
    try {
      const body = await req.json();
      if (typeof body?.dryRun === "boolean") dryRun = body.dryRun;
    } catch {
      // A missing body defaults to a dry-run.
    }
    const result = await cleanupStalePositions({ dryRun });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    console.error("[API jobs/cleanup] Error:", redactError(err));
    return NextResponse.json(
      { success: false, error: "Position cleanup failed" },
      { status: 500 }
    );
  }
}
