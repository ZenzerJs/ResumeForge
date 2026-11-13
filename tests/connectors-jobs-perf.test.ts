import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeStore } from "@/lib/db-mock";
import { backfillIngestedJobs } from "@/lib/connectors/backfill-ingested";
import { computeIngestedJobEnrichment } from "@/lib/connectors/enrichment";
import * as parserModule from "@/lib/jd-parser/parser";
import * as geocodingModule from "@/lib/geo/geocoding";
import * as userEvidenceModule from "@/lib/scoring/user-evidence";
import { GET } from "@/app/api/connectors/jobs/route";
import { authedNextRequest, createTestUser } from "./helpers/auth";

describe("PERF-03 IngestedJob enrichment, backfill & two-pass reader", () => {
  beforeEach(() => {
    activeStore.ingestedJob = [];
    activeStore.job = [];
    activeStore.user = [];
    activeStore.resume = [];
    activeStore.evidenceItem = [];
    vi.restoreAllMocks();
  });

  it("backfills unprocessed rows in cursor batches with dry-run support and race guard", async () => {
    const now = new Date();
    const row1 = await prisma.ingestedJob.create({
      data: {
        id: "job-a",
        fingerprint: "fp-a",
        externalId: "ext-a",
        source: "GREENHOUSE",
        companyName: "Acme",
        title: "Backend Intern",
        location: "Toronto, ON (Remote)",
        workplaceType: "HYBRID",
        isCanadianEligible: true,
        description: "Required: TypeScript, PostgreSQL",
        descriptionHtml: "<p>Required: TypeScript, PostgreSQL</p>",
        applyUrl: "https://example.com/a",
        postedAt: now,
      },
    });
    const row2 = await prisma.ingestedJob.create({
      data: {
        id: "job-b",
        fingerprint: "fp-b",
        externalId: "ext-b",
        source: "LEVER",
        companyName: "Beta",
        title: "Systems Intern",
        location: "Unknown City",
        workplaceType: "ON_SITE",
        isCanadianEligible: true,
        description: "No recognized dictionary keywords here.",
        descriptionHtml: "<p>No recognized dictionary keywords here.</p>",
        applyUrl: "https://example.com/b",
        postedAt: null,
      },
    });

    const dry = await backfillIngestedJobs({ prisma, dryRun: true, batchSize: 1 });
    expect(dry).toEqual({ dryRun: true, scanned: 2, pending: 2, updated: 0, skippedRace: 0 });

    const beforeRow1 = await prisma.ingestedJob.findUniqueOrThrow({ where: { id: row1.id } });
    expect(beforeRow1.parsedRequirements ?? null).toBeNull();

    const firstPass = await backfillIngestedJobs({ prisma, dryRun: false, batchSize: 1 });
    expect(firstPass).toEqual({ dryRun: false, scanned: 2, pending: 2, updated: 2, skippedRace: 0 });

    const afterRow1 = await prisma.ingestedJob.findUniqueOrThrow({ where: { id: row1.id } });
    expect(afterRow1.cityNorm).toBe("toronto");
    expect(afterRow1.parsedRequirements).toMatchObject({
      geoRemote: true,
      requirements: {
        requiredSkills: expect.arrayContaining(["TypeScript", "PostgreSQL"]),
      },
    });

    const afterRow2 = await prisma.ingestedJob.findUniqueOrThrow({ where: { id: row2.id } });
    expect(afterRow2.lat).toBeNull();
    expect(afterRow2.parsedRequirements).toEqual({
      geoRemote: false,
      requirements: {
        requiredSkills: [],
        preferredSkills: [],
        domainTerms: [],
      },
    });

    // Idempotent second run
    const secondPass = await backfillIngestedJobs({ prisma, dryRun: false, batchSize: 1 });
    expect(secondPass).toEqual({ dryRun: false, scanned: 2, pending: 0, updated: 0, skippedRace: 0 });
  });

  it("skips overwriting rows modified concurrently during backfill", async () => {
    const row = await prisma.ingestedJob.create({
      data: {
        id: "job-race",
        fingerprint: "fp-race",
        externalId: "ext-race",
        source: "ASHBY",
        companyName: "RaceCo",
        title: "Intern",
        location: "Vancouver, BC",
        workplaceType: "ON_SITE",
        isCanadianEligible: true,
        description: "Initial Python description",
        descriptionHtml: "<p>Initial</p>",
        applyUrl: "https://example.com/race",
      },
    });

    const ingestedModel = prisma.ingestedJob;
    let updateManyCalls = 0;
    const racingPrisma = {
      ingestedJob: {
        findMany: ingestedModel.findMany.bind(ingestedModel),
        updateMany: async (args: Parameters<typeof ingestedModel.updateMany>[0]) => {
          updateManyCalls += 1;
          // Simulate concurrent ingestion updating the row before backfill writes
          activeStore.ingestedJob[0].description = "Updated Rust description";
          activeStore.ingestedJob[0].updatedAt = new Date(Date.now() + 5000);
          return ingestedModel.updateMany(args);
        },
      },
    };

    const summary = await backfillIngestedJobs({
      prisma: racingPrisma as unknown as typeof prisma,
      dryRun: false,
      batchSize: 10,
    });
    expect(updateManyCalls).toBe(1);
    expect(summary).toEqual({ dryRun: false, scanned: 1, pending: 1, updated: 0, skippedRace: 1 });
    expect((await prisma.ingestedJob.findUniqueOrThrow({ where: { id: row.id } })).description).toBe(
      "Updated Rust description",
    );
  });

  it("executes GET /api/connectors/jobs with zero description parses/geocodes and preserves parity across unknown cities, remote, missing dates, and page 2", async () => {
    const now = new Date();
    const fixtures = [
      {
        id: "j1",
        fingerprint: "fp1",
        externalId: "e1",
        source: "GREENHOUSE" as const,
        companyName: "Alpha",
        title: "Backend",
        location: "Toronto, ON (Remote)",
        workplaceType: "HYBRID" as const,
        description: "Required: TypeScript, PostgreSQL",
        postedAt: now,
        createdAt: new Date(now.getTime() - 10_000),
        salaryMin: 110000,
        salaryMax: 130000,
      },
      {
        id: "j2",
        fingerprint: "fp2",
        externalId: "e2",
        source: "LEVER" as const,
        companyName: "Beta",
        title: "Frontend",
        location: "Unknown City",
        workplaceType: "REMOTE" as const,
        description: "Required: React",
        postedAt: null,
        createdAt: new Date(now.getTime() - 20_000),
        salaryMin: null,
        salaryMax: null,
      },
      {
        id: "j3",
        fingerprint: "fp3",
        externalId: "e3",
        source: "ASHBY" as const,
        companyName: "Gamma",
        title: "Platform",
        location: "Ottawa, ON",
        workplaceType: "ON_SITE" as const,
        description: "Required: Docker, Go",
        postedAt: new Date(now.getTime() - 86_400_000),
        createdAt: new Date(now.getTime() - 86_400_000),
        salaryMin: 90000,
        salaryMax: 100000,
      },
    ];

    for (const f of fixtures) {
      const enrichment = computeIngestedJobEnrichment({
        description: f.description,
        location: f.location,
      });
      await prisma.ingestedJob.create({
        data: {
          ...f,
          isCanadianEligible: true,
          descriptionHtml: `<p>${f.description}</p>`,
          applyUrl: `https://example.com/${f.id}`,
          lat: enrichment.lat,
          lng: enrichment.lng,
          cityNorm: enrichment.cityNorm,
          parsedRequirements: enrichment.parsedRequirements,
        },
      });
    }

    const parseSpy = vi.spyOn(parserModule, "parseJobDescription");
    const geocodeSpy = vi.spyOn(geocodingModule, "geocodeCanadianLocation");

    // Page 2 with limit=1 filtered to Toronto+Remote should include j1 (geoRemote) and j2 (workplace REMOTE) but exclude j3 (Ottawa ON_SITE)
    const req = new NextRequest(
      "http://localhost/api/connectors/jobs?city=toronto&radiusKm=50&sort=newest&page=2&limit=1",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.meta.total).toBe(2);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("j2");
    expect(json.data[0].description).toBe("Required: React");

    // Original connector workplace filter still uses original workplaceType (HYBRID, not REMOTE)
    const hybridReq = new NextRequest(
      "http://localhost/api/connectors/jobs?workplace=HYBRID",
    );
    const hybridRes = await GET(hybridReq);
    const hybridJson = await hybridRes.json();
    expect(hybridJson.data.map((d: { id: string }) => d.id)).toEqual(["j1"]);

    expect(parseSpy).not.toHaveBeenCalled();
    expect(geocodeSpy).not.toHaveBeenCalled();
  });

  it("validates GET /api/connectors/jobs source against JobSource enum members and rejects stale/unknown sources with 400", async () => {
    const now = new Date();
    const sources = ["ADZUNA_CA", "JOBICY", "REMOTIVE", "REMOTEOK"] as const;
    for (const source of sources) {
      const enrichment = computeIngestedJobEnrichment({
        description: "Required: TypeScript",
        location: "Remote",
      });
      await prisma.ingestedJob.create({
        data: {
          id: `job-${source}`,
          fingerprint: `fp-${source}`,
          externalId: `ext-${source}`,
          source,
          companyName: `${source} Corp`,
          title: "Engineer",
          location: "Remote",
          workplaceType: "REMOTE",
          isCanadianEligible: true,
          description: "Required: TypeScript",
          descriptionHtml: "<p>Required: TypeScript</p>",
          applyUrl: `https://example.com/${source}`,
          postedAt: now,
          createdAt: now,
          lat: enrichment.lat,
          lng: enrichment.lng,
          cityNorm: enrichment.cityNorm,
          parsedRequirements: enrichment.parsedRequirements,
        },
      });
    }

    for (const [querySource, expectedSource] of [
      ["ADZUNA_CA", "ADZUNA_CA"],
      ["jobicy", "JOBICY"],
      ["REMOTIVE", "REMOTIVE"],
      ["remoteok", "REMOTEOK"],
    ] as const) {
      const res = await GET(
        new NextRequest(`http://localhost/api/connectors/jobs?source=${querySource}`)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.map((d: { source: string }) => d.source)).toEqual([expectedSource]);
    }

    // Empty and ALL return all ingested jobs
    const allRes = await GET(new NextRequest("http://localhost/api/connectors/jobs?source=ALL"));
    expect(allRes.status).toBe(200);
    expect((await allRes.json()).data).toHaveLength(4);

    const emptyRes = await GET(new NextRequest("http://localhost/api/connectors/jobs?source="));
    expect(emptyRes.status).toBe(200);
    expect((await emptyRes.json()).data).toHaveLength(4);

    // Legacy removed or unknown sources return 400 without parsing/geocoding/DB work
    const parseSpy = vi.spyOn(parserModule, "parseJobDescription");
    const evidenceSpy = vi.spyOn(userEvidenceModule, "loadScoringEvidence");
    for (const invalid of ["USAJOBS", "PITTCSC", "SIMPLIFY", "UNKNOWN_SOURCE"]) {
      const res = await GET(
        new NextRequest(`http://localhost/api/connectors/jobs?source=${invalid}`)
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid source parameter");
    }
    expect(parseSpy).not.toHaveBeenCalled();
    expect(evidenceSpy).not.toHaveBeenCalled();
  });

  it("computes viewer-specific compatibility and returns trackedJob on selected page", async () => {
    const now = new Date();
    const userA = await createTestUser();
    const userB = await createTestUser();

    await prisma.evidenceItem.create({
      data: {
        userId: userA.user.id,
        type: "work",
        title: "Rust Systems",
        verifiedSummary: "Built Rust and Docker services",
        tags: JSON.stringify(["Rust", "Docker"]),
        status: "verified",
      },
    });
    await prisma.evidenceItem.create({
      data: {
        userId: userB.user.id,
        type: "work",
        title: "Frontend React",
        verifiedSummary: "Built React and TypeScript UI",
        tags: JSON.stringify(["React", "TypeScript"]),
        status: "verified",
      },
    });

    const tracked = await prisma.job.create({
      data: {
        userId: userA.user.id,
        company: "SystemsCo",
        roleTitle: "Rust Engineer",
        rawDescription: "Required: Rust, Docker",
        status: "APPLIED",
      },
    });

    const rustEnrich = computeIngestedJobEnrichment({
      description: "Required: Rust, Docker",
      location: "Toronto, ON",
    });
    const reactEnrich = computeIngestedJobEnrichment({
      description: "Required: React, TypeScript",
      location: "Toronto, ON",
    });

    await prisma.ingestedJob.create({
      data: {
        id: "rust-job",
        fingerprint: "fp-rust",
        externalId: "ext-rust",
        source: "GREENHOUSE",
        companyName: "SystemsCo",
        title: "Rust Engineer",
        location: "Toronto, ON",
        workplaceType: "ON_SITE",
        isCanadianEligible: true,
        description: "Required: Rust, Docker",
        descriptionHtml: "<p>Required: Rust, Docker</p>",
        applyUrl: "https://example.com/rust",
        postedAt: now,
        createdAt: now,
        trackedJobId: tracked.id,
        lat: rustEnrich.lat,
        lng: rustEnrich.lng,
        cityNorm: rustEnrich.cityNorm,
        parsedRequirements: rustEnrich.parsedRequirements,
      },
    });

    await prisma.ingestedJob.create({
      data: {
        id: "react-job",
        fingerprint: "fp-react",
        externalId: "ext-react",
        source: "LEVER",
        companyName: "WebCo",
        title: "React Engineer",
        location: "Toronto, ON",
        workplaceType: "ON_SITE",
        isCanadianEligible: true,
        description: "Required: React, TypeScript",
        descriptionHtml: "<p>Required: React, TypeScript</p>",
        applyUrl: "https://example.com/react",
        postedAt: now,
        createdAt: now,
        lat: reactEnrich.lat,
        lng: reactEnrich.lng,
        cityNorm: reactEnrich.cityNorm,
        parsedRequirements: reactEnrich.parsedRequirements,
      },
    });

    // Viewer A ranks rust-job first and receives trackedJob on page 1 (limit=1)
    const resA = await GET(
      authedNextRequest("http://localhost/api/connectors/jobs?sort=ats&limit=1&page=1", {}, userA.cookie),
    );
    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.data).toHaveLength(1);
    expect(jsonA.data[0].id).toBe("rust-job");
    expect(jsonA.data[0].trackedJob).toEqual({ id: tracked.id, status: "APPLIED" });
    expect(jsonA.hasEvidence).toBe(true);

    // Viewer B ranks react-job first on the exact same shared postings
    const resB = await GET(
      authedNextRequest("http://localhost/api/connectors/jobs?sort=ats&limit=1&page=1", {}, userB.cookie),
    );
    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    expect(jsonB.data).toHaveLength(1);
    expect(jsonB.data[0].id).toBe("react-job");
    expect(jsonB.data[0].compatibility.overallScore).toBeGreaterThan(
      jsonA.data[0].compatibility.overallScore === 0 ? -1 : 0,
    );
  });
});
