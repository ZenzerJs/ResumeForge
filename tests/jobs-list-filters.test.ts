import { describe, it, expect, afterAll } from "vitest";
import { createJob, deleteJob, getJobsList } from "@/lib/db/jobs";
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

    const byCity = await getJobsList({ userId, location: "Chicago" });
    expect(byCity.data.map((j) => j.company)).toEqual(["LocFilter Chicago Co"]);

    const byRemote = await getJobsList({ userId, workplace: "remote" });
    expect(byRemote.data.map((j) => j.company)).toEqual(["LocFilter Remote Co"]);

    const byHybrid = await getJobsList({ userId, workplace: "hybrid" });
    expect(byHybrid.data.map((j) => j.company)).toEqual(["LocFilter Hybrid Co"]);

    const byOnsite = await getJobsList({ userId, workplace: "onsite" });
    expect(byOnsite.data.map((j) => j.company)).toEqual(["LocFilter Chicago Co"]);
  });

  afterAll(async () => {
    await Promise.all(createdIds.map((id) => deleteJob(id, userId)));
  });
});
