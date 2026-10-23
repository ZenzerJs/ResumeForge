import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { cleanupStalePositions } from "@/lib/db/jobs";
import { requireUserId } from "@/lib/security/auth-request";
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
      const auth = await requireUserId(req);
      if (auth instanceof Response) return auth;
    }

    let maxAgeDays = 30;
    let preserveActiveApplications = true;
    try {
      const body = await req.json();
      if (typeof body?.maxAgeDays === "number" && Number.isFinite(body.maxAgeDays) && body.maxAgeDays >= 1) {
        maxAgeDays = Math.floor(body.maxAgeDays);
      }
      if (typeof body?.preserveActiveApplications === "boolean") {
        preserveActiveApplications = body.preserveActiveApplications;
      }
    } catch {
      // Optional JSON body
    }

    const result = await cleanupStalePositions({
      maxAgeDays,
      preserveActiveApplications,
    });

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
