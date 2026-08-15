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

  it("1. Greenhouse connector parses boards and conforms to schema", async () => {
    const fixture = loadFixture("greenhouse.json");
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
    );

    const client = new GreenhouseConnector();
    const jobs = await client.fetchJobs({ boards: ["shopify"] });

    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("greenhouse");
    expect(parsed.companyName).toBe("Shopify");
    expect(parsed.title).toBe("Senior Backend Developer");
    expect(parsed.isCanadianEligible).toBe(true);
    expect(parsed.workplaceType).toBe("remote");
    expect(parsed.descriptionPlain).toContain("scale systems");
    expect(parsed.descriptionHtml).not.toContain("<script>");
  });

  it("2. Lever connector parses postings and conforms to schema", async () => {
    const fixture = loadFixture("lever.json");
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
    );

    const client = new LeverConnector();
    const jobs = await client.fetchJobs({ boards: ["certn"] });

    expect(jobs.length).toBe(1);
    const parsed = RawJobListingSchema.parse(jobs[0]);
    expect(parsed.source).toBe("lever");
    expect(parsed.companyName).toBe("Certn");
    expect(parsed.title).toBe("Full Stack Engineer");
    expect(parsed.location).toContain("Vancouver");
    expect(parsed.isCanadianEligible).toBe(true);
    expect(parsed.workplaceType).toBe("remote");
    expect(parsed.descriptionPlain).toContain("Competitive benefits");
  });

  it("3. Ashby connector parses compensation and conforms to schema", async () => {
    const fixture = loadFixture("ashby.json");
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
    );

    const client = new AshbyConnector();
    const jobs = await client.fetchJobs({ boards: ["cohere"] });

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

  it("4. Adzuna CA connector parses Canadian listings with BYOK credentials", async () => {
    process.env.ADZUNA_APP_ID = "mock-app-id";
    process.env.ADZUNA_APP_KEY = "mock-app-key";

    const fixture = loadFixture("adzuna.json");
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
    );

    const client = new AdzunaCaConnector();
    const jobs = await client.fetchJobs();

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
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
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
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
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
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 })
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
