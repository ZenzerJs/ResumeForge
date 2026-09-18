import { NextRequest, NextResponse } from "next/server";
import { syncAllConnectors } from "@/lib/connectors/orchestrator";
import { SourceConnector } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
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
    console.error("[API connectors/sync] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
