import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONNECTORS } from "@/lib/connectors/orchestrator";
import { SourceConnector } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const totalJobs = await prisma.ingestedJob.count();
    const canadianJobs = await prisma.ingestedJob.count({
      where: { isCanadianEligible: true },
    });
    const remoteJobs = await prisma.ingestedJob.count({
      where: { workplaceType: "REMOTE" },
    });

    // Get latest sync log per source
    const logs = await prisma.connectorSyncLog.findMany({
      orderBy: { executedAt: "desc" },
      take: 20,
    });

    // Check connector health
    const providers = await Promise.all(
      (Object.keys(CONNECTORS) as SourceConnector[]).map(async (key) => {
        const client = CONNECTORS[key];
        const latestLog = logs.find((l) => l.source.toLowerCase() === key);
        let status = latestLog?.status || "NEVER_RUN";
        if (key === "adzuna_ca" && !process.env.ADZUNA_APP_ID && !latestLog) {
          status = "UNCONFIGURED";
        }
        return {
          id: client.id,
          name: client.name,
          lastSyncAt: latestLog?.executedAt || null,
          lastStatus: status,
          lastJobsFound: latestLog?.jobsFound ?? 0,
          lastJobsInserted: latestLog?.jobsInserted ?? 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalJobs,
          canadianJobs,
          remoteJobs,
        },
        providers,
        recentLogs: logs.slice(0, 10),
      },
    });
  } catch (err: any) {
    console.error("[API connectors/status] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch status" },
      { status: 500 }
    );
  }
}
