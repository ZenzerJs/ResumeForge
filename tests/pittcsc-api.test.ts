import { describe, it, expect, beforeAll } from "vitest";
import { POST as syncHandler } from "@/app/api/jobs/sync-pittcsc/route";
import { POST as promoteHandler } from "@/app/api/jobs/promote-discovered/route";
import { GET as getDiscoveredHandler } from "@/app/api/jobs/discovered/route";
import { prisma } from "@/lib/prisma";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("Pitt CSC / Simplify Ingestion & Promotion API", () => {
  beforeAll(async () => {
    await prisma.discoveredJob.deleteMany({ where: { company: "Stripe" } });
  });

  it("syncs GFM markdown table into DiscoveredJob records", async () => {
    const sampleMarkdown = `
| Company | Role | Location | Application Link | Date Posted |
| :--- | :--- | :--- | :--- | :--- |
| **[Stripe](https://stripe.com)** | Backend Intern | Seattle, WA | [Apply](https://simplify.jobs/p/stripe1) | 12 hours ago |
`;

    const req = new Request("http://localhost/api/jobs/sync-pittcsc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.JOB_SYNC_SECRET}`,
      },
      body: JSON.stringify({ rawMarkdown: sampleMarkdown }),
    });

    const res = await syncHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.processed).toBe(1);

    // Verify in DB
    const discovered = await prisma.discoveredJob.findFirst({
      where: { company: "Stripe" },
    });
    expect(discovered).not.toBeNull();
    expect(discovered?.roleTitle).toBe("Backend Intern");
  });

  it("retains source age across repeated relative and missing dates, and accepts a later-discovered original date", async () => {
    const secret = process.env.JOB_SYNC_SECRET;
    process.env.JOB_SYNC_SECRET = "expiry-test";
    const sync = async (date: string) => syncHandler(new Request("http://localhost/api/jobs/sync-pittcsc", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer expiry-test" },
      body: JSON.stringify({ rawMarkdown: `| Company | Role | Location | Application Link | Date Posted |\n| --- | --- | --- | --- | --- |\n| Expiry fixture | Engineer | Remote | [Apply](https://example.com/expiry-fixture) | ${date} |` }),
    }));
    try {
      expect((await sync("3 days ago")).status).toBe(200);
      const first = await prisma.discoveredJob.findFirst({ where: { company: "Expiry fixture" } });
      expect(first).not.toBeNull();
      await sync("1 day ago");
      await sync("");
      const repeated = await prisma.discoveredJob.findUnique({ where: { id: first!.id } });
      expect(repeated?.datePosted).toBe("3 days ago");
      await prisma.discoveredJob.update({ where: { id: first!.id }, data: { datePosted: null } });
      const original = new Date(Date.now() - 80 * 86_400_000).toISOString();
      await sync(original);
      const learned = await prisma.discoveredJob.findUnique({ where: { id: first!.id } });
      expect(learned?.datePosted).toBe(original);
    } finally {
      if (secret === undefined) delete process.env.JOB_SYNC_SECRET; else process.env.JOB_SYNC_SECRET = secret;
      await prisma.discoveredJob.deleteMany({ where: { company: "Expiry fixture" } });
    }
  });

  it("fetches discovered jobs via GET /api/jobs/discovered", async () => {
    const req = new Request("http://localhost/api/jobs/discovered?search=Stripe");
    const res = await getDiscoveredHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });

  it("filters discovered jobs by postedWithin", async () => {
    const req = new Request(
      "http://localhost/api/jobs/discovered?search=Stripe&postedWithin=1d",
    );
    const res = await getDiscoveredHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.meta.postedWithin).toBe("1d");
    // Stripe sample is "12 hours ago" — should remain in 1d window
    expect(json.data.some((j: { company: string }) => j.company === "Stripe")).toBe(true);
  });

  it("promotes a discovered job into active Job tracker with status SAVED", async () => {
    const discovered = await prisma.discoveredJob.findFirst({
      where: { company: "Stripe" },
    });
    expect(discovered).not.toBeNull();

    const { cookie } = await createTestUser();
    const req = authedRequest(
      "http://localhost/api/jobs/promote-discovered",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveredJobId: discovered!.id }),
      },
      cookie
    );

    const res = await promoteHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.jobId).toBeTruthy();

    // Verify in active Job table
    const activeJob = await prisma.job.findUnique({
      where: { id: json.jobId },
    });
    expect(activeJob).not.toBeNull();
    expect(activeJob?.company).toBe("Stripe");
    expect(activeJob?.status).toBe("SAVED");
  });

  it("returns 401 when JOB_SYNC_SECRET is missing", async () => {
    const previous = process.env.JOB_SYNC_SECRET;
    delete process.env.JOB_SYNC_SECRET;
    try {
      const req = new Request("http://localhost/api/jobs/sync-pittcsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawMarkdown: "| Company | Role |\n| x | y |" }),
      });
      const res = await syncHandler(req);
      expect(res.status).toBe(401);
    } finally {
      if (previous) process.env.JOB_SYNC_SECRET = previous;
    }
  });
});
