import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  syncSingleConnector,
  promoteIngestedJobToTrackedJob,
} from "@/lib/connectors/orchestrator";
import { ConnectorClient, RawJobListing } from "@/lib/connectors/types";

describe("Phase 12 Orchestrator & Promotion Pipeline", () => {
  beforeEach(async () => {
    // Clear test tables
    await prisma.connectorSyncLog.deleteMany({});
    await prisma.ingestedJob.deleteMany({});
  });

  it("1. syncSingleConnector parses and upserts listings, creating IngestedJob and ConnectorSyncLog", async () => {
    const mockClient: ConnectorClient = {
      id: "greenhouse",
      name: "Mock Greenhouse",
      fetchJobs: async (): Promise<RawJobListing[]> => [
        {
          externalId: "mock_gh_1",
          source: "greenhouse",
          companyName: "Shopify",
          title: "Senior Backend Engineer",
          location: "Toronto, ON (Remote)",
          isCanadianEligible: true,
          workplaceType: "remote",
          descriptionHtml: "<p>Scale distributed systems</p>",
          descriptionPlain: "Scale distributed systems",
          applyUrl: "https://boards.greenhouse.io/shopify/jobs/101",
          postedAt: new Date("2026-08-10T12:00:00Z"),
          metadata: { boardSlug: "shopify" },
        },
      ],
      healthCheck: async () => true,
    };

    const result = await syncSingleConnector(mockClient);
    expect(result.success).toBe(true);
    expect(result.jobsFound).toBe(1);
    expect(result.jobsInserted).toBe(1);

    const jobs = await prisma.ingestedJob.findMany({});
    expect(jobs.length).toBe(1);
    expect(jobs[0].companyName).toBe("Shopify");
    expect(jobs[0].isCanadianEligible).toBe(true);
    expect(jobs[0].fingerprint).toHaveLength(64);

    const logs = await prisma.connectorSyncLog.findMany({});
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe("SUCCESS");
    expect(logs[0].jobsInserted).toBe(1);
  });

  it("2. syncSingleConnector is idempotent on duplicate syncs", async () => {
    const mockClient: ConnectorClient = {
      id: "lever",
      name: "Mock Lever",
      fetchJobs: async (): Promise<RawJobListing[]> => [
        {
          externalId: "mock_lever_1",
          source: "lever",
          companyName: "Certn",
          title: "Full Stack Engineer",
          location: "Victoria, BC",
          isCanadianEligible: true,
          workplaceType: "hybrid",
          descriptionHtml: "<p>Build verification services</p>",
          descriptionPlain: "Build verification services",
          applyUrl: "https://jobs.lever.co/certn/999",
          postedAt: new Date("2026-08-11T12:00:00Z"),
          metadata: {},
        },
      ],
      healthCheck: async () => true,
    };

    // First sync
    const res1 = await syncSingleConnector(mockClient);
    expect(res1.jobsInserted).toBe(1);

    // Second sync (same item -> updated, not inserted again)
    const res2 = await syncSingleConnector(mockClient);
    expect(res2.jobsFound).toBe(1);
    expect(res2.jobsInserted).toBe(0);

    const count = await prisma.ingestedJob.count();
    expect(count).toBe(1);
  });

  it("3. promoteIngestedJobToTrackedJob promotes IngestedJob to Job and links trackedJobId", async () => {
    const mockClient: ConnectorClient = {
      id: "ashby",
      name: "Mock Ashby",
      fetchJobs: async (): Promise<RawJobListing[]> => [
        {
          externalId: "mock_ashby_1",
          source: "ashby",
          companyName: "Cohere",
          title: "AI Infrastructure Engineer",
          location: "Toronto, ON",
          isCanadianEligible: true,
          workplaceType: "remote",
          descriptionHtml: "<p>Train foundation models</p>",
          descriptionPlain: "Train foundation models",
          applyUrl: "https://jobs.ashbyhq.com/cohere/123",
          postedAt: new Date("2026-08-12T12:00:00Z"),
          metadata: {},
        },
      ],
      healthCheck: async () => true,
    };

    await syncSingleConnector(mockClient);
    const ingested = await prisma.ingestedJob.findFirstOrThrow({});

    const tracked = await promoteIngestedJobToTrackedJob(ingested.id);
    expect(tracked.id).toBeDefined();
    expect(tracked.company).toBe("Cohere");
    expect(tracked.roleTitle).toBe("AI Infrastructure Engineer");
    expect(tracked.status).toBe("SAVED");
    expect(tracked.notes).toContain("Location: Toronto, ON");
    expect(tracked.notes).toContain("Workplace: remote");
    expect(tracked.notes).toContain("Apply Link: https://jobs.ashbyhq.com/cohere/123");

    // Check linked relation
    const updatedIngested = await prisma.ingestedJob.findUnique({
      where: { id: ingested.id },
    });
    expect(updatedIngested?.trackedJobId).toBe(tracked.id);
  });
});
