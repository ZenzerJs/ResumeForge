import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncAllConnectors } from "@/lib/connectors/orchestrator";
import { SourceConnector } from "@/lib/connectors/types";
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

    let sources: SourceConnector[] | undefined;
    try {
      const body = await req.json();
      if (Array.isArray(body?.sources)) {
        sources = body.sources;
      }
    } catch {
      // Body is optional
    }

    const results = await syncAllConnectors({ sources });
    const totalFound = results.reduce((acc, r) => acc + r.jobsFound, 0);
    const totalInserted = results.reduce((acc, r) => acc + r.jobsInserted, 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalFound,
          totalInserted,
          providerCount: results.length,
        },
        results,
      },
    });
  } catch (err: any) {
    console.error("[API connectors/sync] Error:", redactError(err));
    return NextResponse.json(
      { success: false, error: "Connector sync failed" },
      { status: 500 }
    );
  }
}
