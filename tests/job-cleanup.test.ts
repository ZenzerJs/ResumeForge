import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetMockStore } from "@/lib/db-mock";
import { cleanupStalePositions } from "@/lib/db/jobs";
import { POST as cleanupPost } from "@/app/api/jobs/cleanup/route";
import { createTestUser } from "./helpers/auth";

describe("DB Stale Position Cleanup (> 1 month / 30 days)", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const originalSyncSecret = process.env.JOB_SYNC_SECRET;
  const originalAccessSecret = process.env.APP_ACCESS_SECRET;

  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    if (originalSyncSecret === undefined) {
      delete process.env.JOB_SYNC_SECRET;
    } else {
      process.env.JOB_SYNC_SECRET = originalSyncSecret;
    }
    if (originalAccessSecret === undefined) {
      delete process.env.APP_ACCESS_SECRET;
    } else {
      process.env.APP_ACCESS_SECRET = originalAccessSecret;
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

    // 3. Stale catalog job with no history vs jobs with legacy state/history.
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
        id: "job-stale-rejected",
        company: "RejectedCo",
        roleTitle: "Engineer",
        rawDescription: "Some description",
        status: "REJECTED",
        notes: "Posted: 45 days ago",
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
    expect(remainingJobs.map((r) => r.id).sort()).toEqual([
      "job-fresh-saved", "job-stale-applied", "job-stale-rejected",
    ]);
  });

  it("denies guests and normal signed-in users when maintenance secret is missing or invalid", async () => {
    process.env.APP_ACCESS_SECRET = "test-app-access-secret";
    delete process.env.JOB_SYNC_SECRET;
    const { cookie } = await createTestUser();
    const guestRes = await cleanupPost(new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
    }));
    const signedInRes = await cleanupPost(new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
      headers: { Cookie: cookie },
    }));
    expect(guestRes.status).toBe(401);
    expect(signedInRes.status).toBe(401);

    process.env.JOB_SYNC_SECRET = "test-cleanup-secret";
    const configuredSecretRes = await cleanupPost(new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer test-cleanup-secret" },
    }));
    const signedInWithSecretRes = await cleanupPost(new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
      headers: { Cookie: cookie },
    }));
    expect(configuredSecretRes.status).toBe(200);
    expect(signedInWithSecretRes.status).toBe(401);
    const invalidRes = await cleanupPost(new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    }));
    expect(invalidRes.status).toBe(401);
  });

  it("accepts maintenance bearer and ignores false preservation compatibility flag", async () => {
    process.env.JOB_SYNC_SECRET = "test-cleanup-secret";
    process.env.APP_ACCESS_SECRET = "test-app-access-secret";
    const { user } = await createTestUser("cleanup-flag-owner@test");
    await prisma.job.create({
      data: {
        id: "job-api-preserved",
        rawDescription: "Stale job with user history",
        status: "SAVED",
        createdAt: fortyDaysAgo,
      },
    });
    await prisma.jobApplication.create({
      data: { id: "app-api-preserved", jobId: "job-api-preserved", userId: user.id, status: "OFFER" },
    });
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

    const authReq = new NextRequest("http://localhost:3000/api/jobs/cleanup", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-cleanup-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxAgeDays: 30, preserveActiveApplications: false }),
    });
    const authRes = await cleanupPost(authReq);
    expect(authRes.status).toBe(200);
    const json = await authRes.json();
    expect(json.success).toBe(true);
    expect(json.data.deletedIngestedJobs).toBe(1);
    expect(json.data.deletedJobs).toBe(0);
    expect(await prisma.job.findUnique({ where: { id: "job-api-preserved" } })).toMatchObject({ id: "job-api-preserved" });
    expect(await prisma.jobApplication.findUnique({ where: { id: "app-api-preserved" } })).toMatchObject({ status: "OFFER" });
  });

  it("preserves applications of every status, variants, cover letters, and private jobs", async () => {
    process.env.APP_ACCESS_SECRET = "test-app-access-secret";
    const { user } = await createTestUser("cleanup-owner@test");
    const resume = await prisma.resume.create({
      data: { userId: user.id, title: "Master Resume", typstSource: "resume" },
    });
    for (const status of ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "ARCHIVED"]) {
      const job = await prisma.job.create({ data: {
        id: `job-app-${status}`, rawDescription: "desc", status: "SAVED", createdAt: fortyDaysAgo,
      } });
      if (status === "SAVED") {
        await prisma.ingestedJob.create({
          data: {
            id: "ing-linked-protected",
            fingerprint: "fp-linked-protected",
            externalId: "ext-linked-protected",
            source: "GREENHOUSE" as any,
            companyName: "ProtectedCo",
            title: "Protected Engineer",
            location: "Remote",
            description: "Desc",
            descriptionHtml: "<p>Desc</p>",
            applyUrl: "https://example.com/protected",
            postedAt: fortyDaysAgo,
            createdAt: fortyDaysAgo,
            trackedJobId: job.id,
          },
        });
      }
      await prisma.jobApplication.create({
        data: { id: `app-${status}`, jobId: job.id, userId: user.id, status },
      });
    }
    const variantJob = await prisma.job.create({ data: {
      id: "job-with-variant", rawDescription: "desc", createdAt: fortyDaysAgo,
    } });
    await prisma.resumeVariant.create({ data: {
      id: "variant-protected", jobId: variantJob.id, masterResumeId: resume.id,
      variantTitle: "Variant", typstContent: "resume",
    } });
    const letterJob = await prisma.job.create({ data: {
      id: "job-with-letter", rawDescription: "desc", createdAt: fortyDaysAgo,
    } });
    await prisma.coverLetter.create({ data: {
      id: "letter-protected", jobId: letterJob.id, title: "Letter", openingParagraph: "Hi",
      bodyParagraphs: "[]", closingParagraph: "Bye", fullMarkdown: "Hi",
    } });
    await prisma.job.create({ data: {
      id: "job-private", userId: user.id, rawDescription: "desc", createdAt: fortyDaysAgo,
    } });

    const result = await cleanupStalePositions({ now });
    expect(result.deletedJobs).toBe(0);
    expect((await prisma.job.findMany({})).map((job) => job.id)).toHaveLength(9);
    expect((await prisma.jobApplication.findMany({})).map((app) => app.status).sort()).toEqual(
      ["APPLIED", "ARCHIVED", "INTERVIEWING", "OFFER", "REJECTED", "SAVED"].sort()
    );
    expect((await prisma.resumeVariant.findMany({})).map((row) => row.id)).toEqual(["variant-protected"]);
    expect((await prisma.coverLetter.findMany({})).map((row) => row.id)).toEqual(["letter-protected"]);
    expect(await prisma.ingestedJob.findUnique({ where: { id: "ing-linked-protected" } })).toMatchObject({
      id: "ing-linked-protected",
      trackedJobId: "job-app-SAVED",
    });
  });

  it("conditional delete preserves a stale job with application history", async () => {
    process.env.APP_ACCESS_SECRET = "test-app-access-secret";
    const { user } = await createTestUser("cleanup-race-owner@test");
    const job = await prisma.job.create({ data: {
      id: "job-raced", rawDescription: "desc", createdAt: fortyDaysAgo,
    } });
    await prisma.jobApplication.create({
      data: { id: "app-raced", jobId: job.id, userId: user.id, status: "SAVED" },
    });
    const result = await cleanupStalePositions({ now });
    expect(result.deletedJobs).toBe(0);
    expect(await prisma.job.findUnique({ where: { id: job.id } })).toMatchObject({ id: job.id });
    expect(await prisma.jobApplication.findUnique({ where: { id: "app-raced" } })).not.toBeNull();
  });
});
