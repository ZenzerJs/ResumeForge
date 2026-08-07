import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePittCSCMarkdown } from "@/lib/ingestion/pittcsc-parser";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    const requiredSecret = process.env.JOB_SYNC_SECRET;

    // Security check: If secret is configured in env, require matching Bearer token
    if (requiredSecret && authHeader !== `Bearer ${requiredSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rawMarkdown, jobType = "Internship" } = await req.json();
    if (!rawMarkdown) {
      return NextResponse.json({ error: "rawMarkdown is required" }, { status: 400 });
    }

    const parsedJobs = parsePittCSCMarkdown(rawMarkdown);

    let upsertCount = 0;

    for (const job of parsedJobs) {
      await prisma.discoveredJob.upsert({
        where: { externalId: job.externalId },
        update: {
          company: job.company,
          roleTitle: job.roleTitle,
          location: job.location,
          isClosed: job.isClosed,
          updatedAt: new Date(),
        },
        create: {
          externalId: job.externalId,
          company: job.company,
          roleTitle: job.roleTitle,
          location: job.location,
          applyUrl: job.applyUrl,
          datePosted: job.datePosted,
          jobType,
          isClosed: job.isClosed,
        },
      });
      upsertCount++;
    }

    return NextResponse.json({ success: true, processed: upsertCount });
  } catch (err) {
    console.error("Pitt CSC Sync error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to sync Pitt CSC jobs", message: String(err) },
      { status: 500 }
    );
  }
}
