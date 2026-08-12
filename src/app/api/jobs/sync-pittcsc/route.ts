import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePittCSCMarkdown } from "@/lib/ingestion/pittcsc-parser";
import { sanitizeError } from "@/lib/ai/redact";
import { isSafeHref } from "@/lib/security/safe-fetch";

export async function POST(req: Request) {
  try {
    const requiredSecret = process.env.JOB_SYNC_SECRET?.trim();
    if (!requiredSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader !== `Bearer ${requiredSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { rawMarkdown, jobType = "Internship" } = await req.json();
    if (!rawMarkdown || typeof rawMarkdown !== "string") {
      return NextResponse.json({ error: "rawMarkdown is required" }, { status: 400 });
    }

    const parsedJobs = parsePittCSCMarkdown(rawMarkdown);

    let upsertCount = 0;

    for (const job of parsedJobs) {
      const applyUrl = isSafeHref(job.applyUrl) ? job.applyUrl : "";
      await prisma.discoveredJob.upsert({
        where: { externalId: job.externalId },
        update: {
          company: job.company,
          roleTitle: job.roleTitle,
          location: job.location,
          applyUrl,
          datePosted: job.datePosted,
          isClosed: job.isClosed,
          updatedAt: new Date(),
        },
        create: {
          externalId: job.externalId,
          company: job.company,
          roleTitle: job.roleTitle,
          location: job.location,
          applyUrl,
          datePosted: job.datePosted,
          jobType,
          isClosed: job.isClosed,
        },
      });
      upsertCount++;
    }

    return NextResponse.json({ success: true, processed: upsertCount });
  } catch (err) {
    console.error("Pitt CSC Sync error:", sanitizeError(err));
    return NextResponse.json(
      { success: false, error: "Failed to sync Pitt CSC jobs", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
