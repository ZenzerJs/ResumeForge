import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RawJobListingSchema } from "../types";
import { GreenhouseConnector } from "../providers/greenhouse";
import { LeverConnector } from "../providers/lever";
import { AshbyConnector } from "../providers/ashby";
import { AdzunaCaConnector } from "../providers/adzuna";
import { JobicyConnector } from "../providers/jobicy";
import { RemotiveConnector } from "../providers/remotive";
import { RemoteOkConnector } from "../providers/remoteok";

function loadFixture(filename: string) {
  const p = path.join(__dirname, "fixtures", filename);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

describe("Phase 12 Job Connectors — Parsing & Schema Validation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. Greenhouse connector parses boards and conforms to schema (with includeAllRoles)", async () => {
    const fixture = loadFixture("greenhouse.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new GreenhouseConnector();

    // Default filters out non-internship title ("Senior Backend Developer")
    const filteredJobs = await client.fetchJobs({ boards: ["figma"] });
    expect(filteredJobs.length).toBe(0);

    // With includeAllRoles: true, returns all jobs
    const jobs = await client.fetchJobs({ boards: ["figma"], includeAllRoles: true });
    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("greenhouse");
    expect(parsed.companyName).toBe("Figma");
    expect(parsed.title).toBe("Senior Backend Developer");
    expect(parsed.isCanadianEligible).toBe(true);
    expect(parsed.workplaceType).toBe("remote");
    expect(parsed.descriptionPlain).toContain("scale systems");
    expect(parsed.descriptionHtml).not.toContain("<script>");
  });

  it("1b. Greenhouse connector returns internship/co-op jobs under default filter", async () => {
    const fixture = loadFixture("greenhouse.json");
    const internFixture = {
      ...fixture,
      jobs: [
        {
          ...fixture.jobs[0],
          id: 999,
          title: "Software Engineering Intern - Summer 2026",
        },
      ],
    };
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(internFixture), { status: 200 }))
    );

    const client = new GreenhouseConnector();
    const jobs = await client.fetchJobs({ boards: ["figma"] });
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe("Software Engineering Intern - Summer 2026");
  });

  it("2. Lever connector parses postings and conforms to schema (with includeAllRoles)", async () => {
    const fixture = loadFixture("lever.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new LeverConnector();

    // Default filters out non-internship title ("Full Stack Engineer")
    const filteredJobs = await client.fetchJobs({ boards: ["spotify"] });
    expect(filteredJobs.length).toBe(0);

    // With includeAllRoles: true, returns all jobs
    const jobs = await client.fetchJobs({ boards: ["spotify"], includeAllRoles: true });
    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("lever");
    expect(parsed.companyName).toBe("Spotify");
    expect(parsed.title).toBe("Full Stack Engineer");
    expect(parsed.location).toContain("Vancouver");
    expect(parsed.isCanadianEligible).toBe(true);
    expect(parsed.workplaceType).toBe("remote");
    expect(parsed.descriptionPlain).toContain("Competitive benefits");
  });

  it("2b. Lever connector returns co-op jobs under default filter", async () => {
    const fixture = loadFixture("lever.json");
    const coopFixture = [
      {
        ...fixture[0],
        id: "lever-coop-1",
        text: "Software Developer Co-op (Fall 2026)",
      },
    ];
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(coopFixture), { status: 200 }))
    );

    const client = new LeverConnector();
    const jobs = await client.fetchJobs({ boards: ["spotify"] });
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe("Software Developer Co-op (Fall 2026)");
  });

  it("3. Ashby connector parses compensation and conforms to schema (with includeAllRoles)", async () => {
    const fixture = loadFixture("ashby.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new AshbyConnector();

    // Default filters out non-internship title ("Machine Learning Platform Engineer")
    const filteredJobs = await client.fetchJobs({ boards: ["cohere"] });
    expect(filteredJobs.length).toBe(0);

    // With includeAllRoles: true, returns all jobs
    const jobs = await client.fetchJobs({ boards: ["cohere"], includeAllRoles: true });
    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("ashby");
    expect(parsed.companyName).toBe("Cohere");
    expect(parsed.title).toBe("Machine Learning Platform Engineer");
    expect(parsed.compensation?.min).toBe(140000);
    expect(parsed.compensation?.max).toBe(185000);
    expect(parsed.compensation?.currency).toBe("CAD");
    expect(parsed.isCanadianEligible).toBe(true);
  });

  it("3b. Ashby connector returns intern jobs under default filter", async () => {
    const fixture = loadFixture("ashby.json");
    const internFixture = {
      ...fixture,
      jobs: [
        {
          ...fixture.jobs[0],
          id: "ashby-intern-1",
          title: "AI Research Intern",
        },
      ],
    };
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(internFixture), { status: 200 }))
    );

    const client = new AshbyConnector();
    const jobs = await client.fetchJobs({ boards: ["cohere"] });
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe("AI Research Intern");
  });

  it("4. Adzuna CA connector parses Canadian listings with BYOK credentials and defaults to 'software internship'", async () => {
    process.env.ADZUNA_APP_ID = "mock-app-id";
    process.env.ADZUNA_APP_KEY = "mock-app-key";

    const fixture = loadFixture("adzuna.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new AdzunaCaConnector();
    const jobs = await client.fetchJobs();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("what=software%20internship"),
      expect.anything()
    );

    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("adzuna_ca");
    expect(parsed.companyName).toBe("Canadian Fintech Inc.");
    expect(parsed.isCanadianEligible).toBe(true);
    expect(parsed.compensation?.min).toBe(110000);
    expect(parsed.compensation?.max).toBe(145000);
  });

  it("5. Jobicy connector parses Canada remote feed and conforms to schema", async () => {
    const fixture = loadFixture("jobicy.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new JobicyConnector();
    const jobs = await client.fetchJobs();

    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("jobicy");
    expect(parsed.companyName).toBe("CloudTech North");
    expect(parsed.workplaceType).toBe("remote");
    expect(parsed.compensation?.currency).toBe("CAD");
    expect(parsed.isCanadianEligible).toBe(true);
  });

  it("6. Remotive connector parses developer feed and conforms to schema", async () => {
    const fixture = loadFixture("remotive.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new RemotiveConnector();
    const jobs = await client.fetchJobs();

    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("remotive");
    expect(parsed.companyName).toBe("Distributed Labs");
    expect(parsed.title).toBe("Senior TypeScript Engineer");
    expect(parsed.isCanadianEligible).toBe(true);
  });

  it("7. RemoteOK connector filters developer tags and conforms to schema", async () => {
    const fixture = loadFixture("remoteok.json");
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(fixture), { status: 200 }))
    );

    const client = new RemoteOkConnector();
    const jobs = await client.fetchJobs();

    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("remoteok");
    expect(parsed.companyName).toBe("NextGen AI");
    expect(parsed.title).toBe("AI Systems Engineer");
    expect(parsed.compensation?.min).toBe(140000);
    expect(parsed.compensation?.max).toBe(190000);
  });
});
