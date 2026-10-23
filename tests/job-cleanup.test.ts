import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetMockStore } from "@/lib/db-mock";
import { cleanupStalePositions } from "@/lib/db/jobs";
import { POST as cleanupPost } from "@/app/api/jobs/cleanup/route";

describe("DB Stale Position Cleanup (> 1 month / 30 days)", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const originalSyncSecret = process.env.JOB_SYNC_SECRET;

  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    if (originalSyncSecret === undefined) {
      delete process.env.JOB_SYNC_SECRET;
    } else {
      process.env.JOB_SYNC_SECRET = originalSyncSecret;
    }
  });

  it("purges IngestedJob, DiscoveredJob, and untracked SAVED Job records older than 30 days while keeping recent & applied positions", async () => {
    // 1. Stale vs recent IngestedJob
    await prisma.ingestedJob.create({
      data: {
        id: "ing-stale",
        fingerprint: "fp-stale",
        externalId: "ext-stale",
        source: "GREENHOUSE" as any,
        companyName: "OldCorp",
        title: "Legacy Engineer",
        location: "Remote",
        description: "Desc",
        descriptionHtml: "<p>Desc</p>",
        applyUrl: "https://example.com/old",
        postedAt: fortyDaysAgo,
        createdAt: fortyDaysAgo,
      },
    });
    await prisma.ingestedJob.create({
      data: {
        id: "ing-fresh",
        fingerprint: "fp-fresh",
        externalId: "ext-fresh",
        source: "GREENHOUSE" as any,
        companyName: "FreshCorp",
        title: "Modern Engineer",
        location: "Remote",
        description: "Desc",
        descriptionHtml: "<p>Desc</p>",
        applyUrl: "https://example.com/fresh",
        postedAt: tenDaysAgo,
        createdAt: tenDaysAgo,
      },
    });

    // 2. Stale vs recent DiscoveredJob
    await prisma.discoveredJob.create({
      data: {
        id: "disc-stale",
        externalId: "d-stale",
        company: "OldStartup",
        roleTitle: "Intern",
        location: "NYC",
        applyUrl: "https://example.com/d-old",
        datePosted: "45 days ago",
        createdAt: fortyDaysAgo,
      },
    });
    await prisma.discoveredJob.create({
      data: {
        id: "disc-fresh",
        externalId: "d-fresh",
        company: "NewStartup",
        roleTitle: "Intern",
        location: "SF",
        applyUrl: "https://example.com/d-new",
        datePosted: "5 days ago",
        createdAt: tenDaysAgo,
      },
    });

    // 3. Stale SAVED Job vs Stale APPLIED Job vs Recent SAVED Job
    await prisma.job.create({
      data: {
        id: "job-stale-saved",
        company: "StaleCo",
        roleTitle: "Backend Dev",
        rawDescription: "Some description",
        status: "SAVED",
        notes: "Posted: 40 days ago",
        createdAt: fortyDaysAgo,
      },
    });
    await prisma.job.create({
      data: {
        id: "job-stale-applied",
        company: "AppliedCo",
        roleTitle: "Staff Dev",
        rawDescription: "Some description",
        status: "APPLIED",
        notes: "Posted: 45 days ago",
        createdAt: fortyDaysAgo,
      },
    });
    await prisma.job.create({
      data: {
        id: "job-fresh-saved",
        company: "RecentCo",
        roleTitle: "Frontend Dev",
        rawDescription: "Some description",
        status: "SAVED",
        notes: "Posted: 3 days ago",
        createdAt: tenDaysAgo,
      },
    });

    const res = await cleanupStalePositions({ maxAgeDays: 30, now });

    expect(res.deletedIngestedJobs).toBe(1);
    expect(res.deletedDiscoveredJobs).toBe(1);
    expect(res.deletedJobs).toBe(1);
    expect(res.totalDeleted).toBe(3);

    const remainingIngested = await prisma.ingestedJob.findMany({});
    expect(remainingIngested.map((r) => r.id)).toEqual(["ing-fresh"]);

    const remainingDiscovered = await prisma.discoveredJob.findMany({});
    expect(remainingDiscovered.map((r) => r.id)).toEqual(["disc-fresh"]);

    const remainingJobs = await prisma.job.findMany({});
    expect(remainingJobs.map((r) => r.id).sort()).toEqual(["job-fresh-saved", "job-stale-applied"]);
  });

  it("exposes POST /api/jobs/cleanup protected by JOB_SYNC_SECRET", async () => {
    process.env.JOB_SYNC_SECRET = "test-cleanup-secret";
    await prisma.ingestedJob.create({
      data: {
        id: "ing-api-stale",
        fingerprint: "fp-api-stale",
        externalId: "ext-api-stale",
        source: "LEVER" as any,
        companyName: "StaleAPI",
        title: "SWE",
        location: "Remote",
        description: "Desc",
        descriptionHtml: "<p>Desc</p>",
        applyUrl: "https://example.com/stale",
        postedAt: fortyDaysAgo,
        createdAt: fortyDaysAgo,
      },
    });

    const unauthReq = new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
    });
    const unauthRes = await cleanupPost(unauthReq);
    expect(unauthRes.status).toBe(401);

    const authReq = new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-cleanup-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxAgeDays: 30 }),
    });
    const authRes = await cleanupPost(authReq);
    expect(authRes.status).toBe(200);
    const json = await authRes.json();
    expect(json.success).toBe(true);
    expect(json.data.deletedIngestedJobs).toBe(1);
  });
});
