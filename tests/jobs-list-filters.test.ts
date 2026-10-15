import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob, deleteJob, getJobsList } from "@/lib/db/jobs";
import { upsertApplication } from "@/lib/db/applications";
import { matchesWorkplaceFilter } from "@/lib/ingestion/helpers";
import { createTestUser } from "./helpers/auth";

describe("matchesWorkplaceFilter", () => {
  it("classifies remote, hybrid, and on-site from notes", () => {
    expect(matchesWorkplaceFilter("Location: Remote | Date Posted: 1 day ago", "remote")).toBe(true);
    expect(matchesWorkplaceFilter("Location: Chicago, IL (Hybrid)", "hybrid")).toBe(true);
    expect(matchesWorkplaceFilter("Location: Austin, TX", "onsite")).toBe(true);
    expect(matchesWorkplaceFilter("Location: Remote", "onsite")).toBe(false);
    expect(matchesWorkplaceFilter("Location: Austin, TX", "remote")).toBe(false);
    expect(matchesWorkplaceFilter("Location: Remote", "all")).toBe(true);
  });
});

describe("getJobsList location and workplace filters", () => {
  const createdIds: string[] = [];
  let userId: string;

  it("filters by location substring and workplace type", async () => {
    const { user } = await createTestUser();
    userId = user.id;

    const chicago = await createJob({
      userId,
      company: "LocFilter Chicago Co",
      roleTitle: "Engineer",
      rawDescription: "TypeScript required.",
      notes: "Location: Chicago, IL | Date Posted: 1 day ago",
    });
    const remote = await createJob({
      userId,
      company: "LocFilter Remote Co",
      roleTitle: "Engineer",
      rawDescription: "TypeScript required.",
      notes: "Location: Remote | Date Posted: 1 day ago",
    });
    const hybrid = await createJob({
      userId,
      company: "LocFilter Hybrid Co",
      roleTitle: "Engineer",
      rawDescription: "TypeScript required.",
      notes: "Location: New York, NY (Hybrid) | Date Posted: 1 day ago",
    });
    createdIds.push(chicago.id, remote.id, hybrid.id);

    const byCity = await getJobsList({ q: "LocFilter", location: "Chicago" });
    expect(byCity.data.map((j) => j.company)).toEqual(["LocFilter Chicago Co"]);

    const byRemote = await getJobsList({ q: "LocFilter", workplace: "remote" });
    expect(byRemote.data.map((j) => j.company)).toEqual(["LocFilter Remote Co"]);

    const byHybrid = await getJobsList({ q: "LocFilter", workplace: "hybrid" });
    expect(byHybrid.data.map((j) => j.company)).toEqual(["LocFilter Hybrid Co"]);

    const byOnsite = await getJobsList({ q: "LocFilter", workplace: "onsite" });
    expect(byOnsite.data.map((j) => j.company)).toEqual(["LocFilter Chicago Co"]);
  });

  afterAll(async () => {
    await Promise.all(createdIds.map((id) => deleteJob(id)));
  });
});

describe("getJobsList beyond the old 200-row cap", () => {
  const token = `CapProbe${Date.now()}`;

  afterAll(async () => {
    await prisma.job.deleteMany({
      where: {
        OR: [{ company: { contains: "CapProbe" } }, { company: "CountProbe" }],
      },
    });
  });

  it("counts every matching job, not only the first 200", async () => {
    for (let i = 0; i < 201; i++) {
      await createJob({
        company: `${token} Co`,
        roleTitle: `${token} Role ${i}`,
        rawDescription: "TypeScript required.",
      });
    }

    const list = await getJobsList({ q: token, limit: 40 });
    expect(list.meta.total).toBe(201);
    expect(list.meta.totalPages).toBe(6);
    expect(list.data).toHaveLength(40);
  }, 120_000);

  it("counts applied and interviewing across the full set, not the current page", async () => {
    const { user } = await createTestUser();
    await createJob({
      company: "CountProbe",
      roleTitle: "Saved seat",
      rawDescription: "TypeScript required.",
    });
    const applied = await createJob({
      company: "CountProbe",
      roleTitle: "Applied seat",
      rawDescription: "TypeScript required.",
    });
    const interviewing = await createJob({
      company: "CountProbe",
      roleTitle: "Interview seat",
      rawDescription: "TypeScript required.",
    });
    await upsertApplication(user.id, applied.id, { status: "APPLIED" });
    await upsertApplication(user.id, interviewing.id, { status: "INTERVIEWING" });

    const page = await getJobsList({ q: "CountProbe", userId: user.id, limit: 1, page: 1 });
    expect(page.data).toHaveLength(1);
    expect(page.meta.total).toBe(3);
    expect(page.meta.counts).toEqual({ applied: 2, interviewing: 1 });
  });
});
