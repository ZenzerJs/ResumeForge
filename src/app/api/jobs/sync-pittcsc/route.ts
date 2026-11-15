import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { parsePittCSCMarkdown } from "@/lib/ingestion/pittcsc-parser";
import { sanitizeError } from "@/lib/ai/redact";
import { isSafeHref } from "@/lib/security/safe-fetch";
import { initialPostingDate, stablePostingDate } from "@/lib/jobs/expiry";

export async function POST(req: Request) {
  try {
    const requiredSecret = process.env.JOB_SYNC_SECRET?.trim();
    if (!requiredSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = req.headers.get("Authorization");
    const expectedHeader = `Bearer ${requiredSecret}`;
    const authBuf = Buffer.from(authHeader || "");
    const expBuf = Buffer.from(expectedHeader);

    if (
      !authHeader ||
      authBuf.length !== expBuf.length ||
      !timingSafeEqual(authBuf, expBuf)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsedBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const rawMarkdown = parsedBody.rawMarkdown;
    const jobType = typeof parsedBody.jobType === "string" && parsedBody.jobType ? parsedBody.jobType : "Internship";
    if (!rawMarkdown || typeof rawMarkdown !== "string") {
      return NextResponse.json({ error: "rawMarkdown is required" }, { status: 400 });
    }

    const parsedJobs = parsePittCSCMarkdown(rawMarkdown);
    const externalIds = parsedJobs.map((j) => j.externalId);
    const existingRows =
      externalIds.length > 0
        ? await prisma.discoveredJob.findMany({
            where: { externalId: { in: externalIds } },
            select: { externalId: true, datePosted: true, createdAt: true },
          })
        : [];
    const existingByExternalId = new Map(existingRows.map((row) => [row.externalId, row]));

    const capturedAt = new Date();
    const toCreate: Array<{
      externalId: string;
      company: string;
      roleTitle: string;
      location: string;
      applyUrl: string;
      datePosted: string | null;
      jobType: string;
      isClosed: boolean;
    }> = [];
    const toUpdate: Array<ReturnType<typeof prisma.discoveredJob.update>> = [];

    for (const job of parsedJobs) {
      const applyUrl = isSafeHref(job.applyUrl) ? job.applyUrl : "";
      const existing = existingByExternalId.get(job.externalId);
      if (existing) {
        toUpdate.push(
          prisma.discoveredJob.update({
            where: { externalId: job.externalId },
            data: {
              company: job.company,
              roleTitle: job.roleTitle,
              location: job.location,
              applyUrl,
              datePosted: stablePostingDate(
                existing.datePosted,
                job.datePosted,
                existing.createdAt,
                capturedAt,
              ),
              isClosed: job.isClosed,
              updatedAt: capturedAt,
            },
          }),
        );
      } else {
        toCreate.push({
          externalId: job.externalId,
          company: job.company,
          roleTitle: job.roleTitle,
          location: job.location,
          applyUrl,
          datePosted: initialPostingDate(job.datePosted, capturedAt),
          jobType,
          isClosed: job.isClosed,
        });
      }
    }

    if (toCreate.length > 0) {
      await prisma.discoveredJob.createMany({ data: toCreate, skipDuplicates: true });
    }
    const BATCH_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      await prisma.$transaction(toUpdate.slice(i, i + BATCH_SIZE));
    }

    const upsertCount = parsedJobs.length;


    return NextResponse.json({
      success: true,
      processed: upsertCount,
    });
  } catch (err) {
    console.error("Pitt CSC Sync error:", sanitizeError(err));
    return NextResponse.json(
      { success: false, error: "Failed to sync Pitt CSC jobs", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
