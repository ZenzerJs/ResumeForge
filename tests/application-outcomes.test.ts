import { afterAll, describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/jobs/[id]/route";
import { createJob, deleteJob, getJobsList } from "@/lib/db/jobs";
import { createResume } from "@/lib/db/resumes";
import { createVariant } from "@/lib/db/variants";
import { getDashboardStats, getOutcomeStats } from "@/lib/db/stats";
import { prisma } from "@/lib/prisma";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("per-user application outcomes", () => {
  const userIds: string[] = [];
  const jobIds: string[] = [];

  afterAll(async () => {
    await prisma.resumeVariant.deleteMany({ where: { jobId: { in: jobIds } } });
    await Promise.all(jobIds.map((id) => deleteJob(id).catch(() => null)));
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("keeps status private, logs one event, and rejects another user's variant", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    userIds.push(userA.user.id, userB.user.id);
    const job = await createJob({
      company: "Outcome Co",
      roleTitle: "Engineer",
      rawDescription: "TypeScript required for the outcome test.",
    });
    jobIds.push(job.id);

    const masterA = await createResume({
      title: "Master A",
      typstSource: "= A",
      isMaster: true,
      userId: userA.user.id,
    });
    const masterB = await createResume({
      title: "Master B",
      typstSource: "= B",
      isMaster: true,
      userId: userB.user.id,
    });
    const variantA = await createVariant({
      masterResumeId: masterA.id,
      jobId: job.id,
      variantTitle: "Backend cut",
      typstContent: "= A tailored",
      userId: userA.user.id,
    });
    const variantB = await createVariant({
      masterResumeId: masterB.id,
      jobId: job.id,
      variantTitle: "Other user",
      typstContent: "= B tailored",
      userId: userB.user.id,
    });

    const applied = await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPLIED" }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job.id }) }
    );
    expect(applied.status).toBe(200);
    const appliedJson = await applied.json();
    expect(appliedJson.data.status).toBe("APPLIED");
    expect(appliedJson.data.appliedAt).toBeTruthy();

    const again = await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPLIED" }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job.id }) }
    );
    expect(again.status).toBe(200);
    const application = await prisma.jobApplication.findFirst({ where: { userId: userA.user.id, jobId: job.id } });
    const events = await prisma.applicationEvent.findMany({ where: { applicationId: application?.id } });
    expect(events).toHaveLength(1);

    const forB = await getJobsList({ userId: userB.user.id, q: "Outcome Co", status: "APPLIED" });
    expect(forB.data).toHaveLength(0);
    const forA = await getJobsList({ userId: userA.user.id, q: "Outcome Co", status: "APPLIED" });
    expect(forA.data.map((row) => row.id)).toContain(job.id);

    const stolen = await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: variantB.id }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job.id }) }
    );
    expect(stolen.status).toBe(400);

    const owned = await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: variantA.id, status: "INTERVIEWING" }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job.id }) }
    );
    expect(owned.status).toBe(200);

    const appliedEvent = events[0];
    const responseAt = new Date(new Date(appliedEvent.at).getTime() + 2 * 86_400_000);
    const interviewEvent = await prisma.applicationEvent.findFirst({
      where: { applicationId: application?.id, toStatus: "INTERVIEWING" },
    });
    await prisma.applicationEvent.update({ where: { id: interviewEvent!.id }, data: { at: responseAt } });

    const stats = await getOutcomeStats(userA.user.id);
    expect(stats.funnel.INTERVIEWING).toBe(1);
    expect(stats.interviewRate).toBe(1);
    expect(stats.medianResponseDays).toBeCloseTo(2, 5);
    expect(stats.variants[0]).toMatchObject({
      variantId: variantA.id,
      variantTitle: "Backend cut",
      applications: 1,
      interviews: 1,
    });

    const dashA = await getDashboardStats(userA.user.id);
    const dashB = await getDashboardStats(userB.user.id);
    expect(dashA.jobsCount).toBeGreaterThanOrEqual(1);
    expect(dashB.appliedJobsCount).toBe(0);

    const job2 = await createJob({
      company: "Second Co",
      roleTitle: "Frontend",
      rawDescription: "React required.",
    });
    jobIds.push(job2.id);
    await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job2.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPLIED" }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job2.id }) }
    );
    const statsWithNone = await getOutcomeStats(userA.user.id);
    const noneGroup = statsWithNone.variants.find((v) => v.variantId === null);
    expect(noneGroup).toBeDefined();
    expect(noneGroup?.company).toBeNull();
    expect(noneGroup?.roleTitle).toBeNull();
    expect(noneGroup?.applications).toBe(1);

    // Multi-job unvarianted collapse
    const job3 = await createJob({
      company: "Third Co",
      roleTitle: "DevOps",
      rawDescription: "Docker required.",
    });
    jobIds.push(job3.id);
    await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job3.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPLIED" }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job3.id }) }
    );
    const statsMultiNone = await getOutcomeStats(userA.user.id);
    const multiNoneGroup = statsMultiNone.variants.find((v) => v.variantId === null);
    expect(multiNoneGroup).toBeDefined();
    expect(multiNoneGroup?.applications).toBe(2);
    expect(multiNoneGroup?.company).toBeNull();
    expect(multiNoneGroup?.roleTitle).toBeNull();

    // Variant cannot be attached to a different job
    const mismatchRes = await PATCH(
      authedRequest(
        `http://localhost/api/jobs/${job3.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: variantA.id, status: "APPLIED" }) },
        userA.cookie
      ),
      { params: Promise.resolve({ id: job3.id }) }
    );
    expect(mismatchRes.status).toBe(400);

    // getJobsList edge cases: status array with "ALL", empty array, and multiple statuses
    const listAllArray = await getJobsList({ userId: userA.user.id, q: "Outcome Co", status: ["ALL"] as any });
    expect(listAllArray.data.length).toBeGreaterThanOrEqual(1);

    const listEmptyArray = await getJobsList({ userId: userA.user.id, q: "Outcome Co", status: [] as any });
    expect(listEmptyArray.data.length).toBeGreaterThanOrEqual(1);

    const listMultiStatus = await getJobsList({ userId: userA.user.id, status: ["APPLIED", "INTERVIEWING"] });
    expect(listMultiStatus.data.some((j) => j.id === job.id)).toBe(true);
    expect(listMultiStatus.data.some((j) => j.id === job2.id)).toBe(true);
  });
});
