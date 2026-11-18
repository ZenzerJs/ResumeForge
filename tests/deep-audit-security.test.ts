import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { promoteIngestedJobToTrackedJob } from "@/lib/connectors/orchestrator";
import { createCoverLetter } from "@/lib/db/cover-letters";
import { createVariant, updateVariant, type UpdateVariantInput } from "@/lib/db/variants";
import { saveMasterResume, restoreMasterSnapshot } from "@/lib/db/resumes";
import { extractResumeFacts } from "@/lib/facts/extract";
import { POST as coverLettersPOST } from "@/app/api/cover-letters/route";
import { POST as coverLettersGeneratePOST } from "@/app/api/cover-letters/generate/route";
import { NextRequest } from "next/server";
import { authedNextRequest, authedRequest, createTestUser } from "./helpers/auth";

const updateVariantScoped: (
  variantId: string,
  input: UpdateVariantInput & { userId?: string },
  userId?: string
) => ReturnType<typeof updateVariant> = updateVariant;

describe("Deep Audit Security & Extraction Regressions", () => {
  const createdUserIds: string[] = [];
  const createdJobIds: string[] = [];
  const createdIngestedIds: string[] = [];
  const createdResumeIds: string[] = [];
  const createdEvidenceIds: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (createdIngestedIds.length > 0) {
      await prisma.ingestedJob.deleteMany({ where: { id: { in: createdIngestedIds } } });
      createdIngestedIds.length = 0;
    }
    if (createdResumeIds.length > 0) {
      await prisma.coverLetter.deleteMany({ where: { variant: { masterResumeId: { in: createdResumeIds } } } });
      await prisma.resumeVariant.deleteMany({ where: { masterResumeId: { in: createdResumeIds } } });
      await prisma.masterHistory.deleteMany({ where: { resumeId: { in: createdResumeIds } } });
      await prisma.resume.deleteMany({ where: { id: { in: createdResumeIds } } });
      createdResumeIds.length = 0;
    }
    if (createdJobIds.length > 0) {
      await prisma.coverLetter.deleteMany({ where: { jobId: { in: createdJobIds } } });
      await prisma.jobApplication.deleteMany({ where: { jobId: { in: createdJobIds } } });
      await prisma.resumeVariant.deleteMany({ where: { jobId: { in: createdJobIds } } });
      await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
      createdJobIds.length = 0;
    }
    if (createdEvidenceIds.length > 0) {
      await prisma.bullet.deleteMany({ where: { evidenceId: { in: createdEvidenceIds } } });
      await prisma.evidenceItem.deleteMany({ where: { id: { in: createdEvidenceIds } } });
      createdEvidenceIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await prisma.jobApplication.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.resume.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  it("isolates promoteIngestedJobToTrackedJob across multiple users via shared catalog Job + personal JobApplication", async () => {
    const userA = await createTestUser("deep-promote-a@resumeforge.test");
    const userB = await createTestUser("deep-promote-b@resumeforge.test");
    createdUserIds.push(userA.user.id, userB.user.id);

    const suffix = crypto.randomUUID().slice(0, 8);
    const ingested = await prisma.ingestedJob.create({
      data: {
        fingerprint: crypto.createHash("sha256").update(`shared-${suffix}`).digest("hex"),
        externalId: `ext-shared-${suffix}`,
        source: "GREENHOUSE",
        companyName: "Northwind Telemetry",
        title: "Staff Platform Engineer",
        location: "Toronto, ON",
        workplaceType: "REMOTE",
        isCanadianEligible: true,
        description: "TypeScript, PostgreSQL, Kubernetes",
        descriptionHtml: "<p>TypeScript, PostgreSQL, Kubernetes</p>",
        applyUrl: `https://example.com/jobs/shared-${suffix}`,
      },
    });
    createdIngestedIds.push(ingested.id);

    const jobA = await promoteIngestedJobToTrackedJob(ingested.id, userA.user.id);
    createdJobIds.push(jobA.id);
    const jobB = await promoteIngestedJobToTrackedJob(ingested.id, userB.user.id);
    if (jobB.id !== jobA.id) createdJobIds.push(jobB.id);

    expect(jobA.userId).toBeNull();
    expect(jobB.userId).toBeNull();
    expect(jobB.id).toBe(jobA.id);

    const apps = await prisma.jobApplication.findMany({ where: { jobId: jobA.id } });
    expect(apps).toHaveLength(2);
    expect(apps.find((a) => a.userId === userA.user.id)?.status).toBe("SAVED");
    expect(apps.find((a) => a.userId === userB.user.id)?.status).toBe("SAVED");

    // Legacy hijack defense: if trackedJobId already pointed to userA's private Job, userB gets a shared catalog Job
    const privateJob = await prisma.job.create({
      data: {
        userId: userA.user.id,
        company: "Private Legacy Co",
        roleTitle: "Legacy Role",
        rawDescription: "Private job description",
        source: "greenhouse",
      },
    });
    createdJobIds.push(privateJob.id);

    const legacyIngested = await prisma.ingestedJob.create({
      data: {
        fingerprint: crypto.createHash("sha256").update(`legacy-${suffix}`).digest("hex"),
        externalId: `ext-legacy-${suffix}`,
        source: "LEVER",
        companyName: "Private Legacy Co",
        title: "Legacy Role",
        location: "Remote",
        workplaceType: "REMOTE",
        isCanadianEligible: true,
        description: "Build TypeScript services",
        descriptionHtml: "<p>Build TypeScript services</p>",
        applyUrl: `https://example.com/jobs/legacy-${suffix}`,
        trackedJobId: privateJob.id,
      },
    });
    createdIngestedIds.push(legacyIngested.id);

    const isolatedSharedJob = await promoteIngestedJobToTrackedJob(legacyIngested.id, userB.user.id);
    createdJobIds.push(isolatedSharedJob.id);

    expect(isolatedSharedJob.id).not.toBe(privateJob.id);
    expect(isolatedSharedJob.userId).toBeNull();

    const userBApp = await prisma.jobApplication.findFirst({
      where: { jobId: isolatedSharedJob.id, userId: userB.user.id },
    });
    expect(userBApp?.status).toBe("SAVED");
  });

  it("blocks cross-tenant createCoverLetter, createVariant, and updateVariant with 404 semantics", async () => {
    const userA = await createTestUser("deep-tenant-a@resumeforge.test");
    const userB = await createTestUser("deep-tenant-b@resumeforge.test");
    createdUserIds.push(userA.user.id, userB.user.id);

    const userAJob = await prisma.job.create({
      data: {
        userId: userA.user.id,
        company: "User A Private Inc",
        roleTitle: "Confidential Engineer",
        rawDescription: "Private job",
        source: "manual",
      },
    });
    const sharedJob = await prisma.job.create({
      data: {
        userId: null,
        company: "Shared Catalog Inc",
        roleTitle: "Shared Engineer",
        rawDescription: "Shared catalog job",
        source: "greenhouse",
      },
    });
    createdJobIds.push(userAJob.id, sharedJob.id);

    const userAMaster = await prisma.resume.create({
      data: {
        userId: userA.user.id,
        title: "User A Master",
        typstSource: "= User A\n\n== Experience\n- Shipped APIs.",
        isMaster: true,
        isProtected: true,
      },
    });
    const userBMaster = await prisma.resume.create({
      data: {
        userId: userB.user.id,
        title: "User B Master",
        typstSource: "= User B\n\n== Experience\n- Shipped UI.",
        isMaster: true,
        isProtected: true,
      },
    });
    createdResumeIds.push(userAMaster.id, userBMaster.id);

    const userAVariant = await createVariant({
      masterResumeId: userAMaster.id,
      jobId: userAJob.id,
      variantTitle: "User A Variant",
      typstContent: "= User A Tailored",
      userId: userA.user.id,
    });

    // DB-level isolation
    await expect(
      createCoverLetter({
        jobId: userAJob.id,
        title: "Cross-Tenant Job CL",
        openingParagraph: "Dear Hiring Team,",
        bodyParagraphs: ["I built systems."],
        closingParagraph: "Sincerely, User B",
        fullMarkdown: "Dear Hiring Team,\nI built systems.\nSincerely, User B",
        userId: userB.user.id,
      })
    ).rejects.toThrow(/Job record not found/);

    await expect(
      createCoverLetter({
        jobId: sharedJob.id,
        variantId: userAVariant.id,
        title: "Cross-Tenant Variant CL",
        openingParagraph: "Dear Hiring Team,",
        bodyParagraphs: ["I built systems."],
        closingParagraph: "Sincerely, User B",
        fullMarkdown: "Dear Hiring Team,\nI built systems.\nSincerely, User B",
        userId: userB.user.id,
      })
    ).rejects.toThrow(/ResumeVariant record not found/);

    await expect(
      createVariant({
        masterResumeId: userBMaster.id,
        jobId: userAJob.id,
        variantTitle: "Cross-Tenant Job Variant",
        typstContent: "= Hijack",
        userId: userB.user.id,
      })
    ).rejects.toThrow(/Job not found/);

    await expect(
      createVariant({
        masterResumeId: userAMaster.id,
        jobId: sharedJob.id,
        variantTitle: "Cross-Tenant Master Variant",
        typstContent: "= Hijack",
        userId: userB.user.id,
      })
    ).rejects.toThrow(/Master resume not found/);

    await expect(
      updateVariantScoped(userAVariant.id, { variantTitle: "Hijacked" }, userB.user.id)
    ).rejects.toThrow(/ResumeVariant not found/);

    // API route HTTP 404 isolation
    const postCoverLetterForeignJob = await coverLettersPOST(
      authedRequest(
        "http://localhost:3000/api/cover-letters",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: userAJob.id,
            title: "Cross-tenant API CL",
            openingParagraph: "Hello",
            bodyParagraphs: ["Paragraph 1"],
            closingParagraph: "Best",
            fullMarkdown: "Hello\nParagraph 1\nBest",
          }),
        },
        userB.cookie
      )
    );
    expect(postCoverLetterForeignJob.status).toBe(404);

    const generateForeignJob = await coverLettersGeneratePOST(
      authedNextRequest(
        "http://localhost:3000/api/cover-letters/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: userAJob.id }),
        },
        userB.cookie
      ) as NextRequest
    );
    expect(generateForeignJob.status).toBe(404);

    const generateForeignVariant = await coverLettersGeneratePOST(
      authedNextRequest(
        "http://localhost:3000/api/cover-letters/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: sharedJob.id, variantId: userAVariant.id }),
        },
        userB.cookie
      ) as NextRequest
    );
    expect(generateForeignVariant.status).toBe(404);
  });

  it("preserves active verified evidenceIds and excludes draft/archived items in restoreMasterSnapshot", async () => {
    const userA = await createTestUser("deep-snapshot@resumeforge.test");
    createdUserIds.push(userA.user.id);

    const verifiedEv = await prisma.evidenceItem.create({
      data: {
        userId: userA.user.id,
        type: "experience",
        title: "Verified Distributed Systems",
        organization: "Northwind",
        verifiedSummary: "Reduced tail latency by 40%.",
        status: "verified",
      },
    });
    const draftEv = await prisma.evidenceItem.create({
      data: {
        userId: userA.user.id,
        type: "experience",
        title: "Unverified Draft",
        organization: "Draft Corp",
        verifiedSummary: "Draft summary",
        status: "draft",
      },
    });
    const archivedEv = await prisma.evidenceItem.create({
      data: {
        userId: userA.user.id,
        type: "experience",
        title: "Archived Evidence",
        organization: "Old Corp",
        verifiedSummary: "Archived summary",
        status: "archived",
      },
    });
    createdEvidenceIds.push(verifiedEv.id, draftEv.id, archivedEv.id);

    const v1 = await saveMasterResume({
      userId: userA.user.id,
      title: "Master v1",
      typstSource: "= Jordan Example\n\n== Experience\n- Reduced tail latency by 40%.",
      confirmOverwrite: true,
    });
    createdResumeIds.push(v1.data.id);

    const v2 = await saveMasterResume({
      userId: userA.user.id,
      title: "Master v2",
      typstSource: "= Jordan Example\n\n== Experience\n- Overwritten line.",
      confirmOverwrite: true,
    });
    expect(v2.snapshotId).toBeDefined();

    const restored = await restoreMasterSnapshot(v2.snapshotId!, userA.user.id);
    const snapshotFacts = restored.factSnapshot as { evidenceIds?: string[] } | null;

    expect(snapshotFacts?.evidenceIds).toContain(verifiedEv.id);
    expect(snapshotFacts?.evidenceIds).not.toContain(draftEv.id);
    expect(snapshotFacts?.evidenceIds).not.toContain(archivedEv.id);
  });

  it("extracts employers, titles, and skills from plain-Typst single-bold *Role* — Company and == Skills lines", () => {
    const plainTypst = `= Jordan Taylor

== Experience
*Staff Backend Engineer* — Northwind Systems | Jan 2022 - Present
- Scaled distributed ingestion services by 45% across 12 workers.

== Skills
Languages: TypeScript, Go, Python
- Infrastructure: PostgreSQL, Kubernetes, Docker
`;

    const facts = extractResumeFacts(plainTypst, []);

    expect(facts.employers.some((emp) => emp.normalized === "northwind systems")).toBe(true);
    expect(facts.titles.some((title) => title.normalized === "staff backend engineer")).toBe(true);
    expect(facts.skills).toEqual(
      expect.arrayContaining(["typescript", "go", "python", "postgresql", "kubernetes", "docker"])
    );
  });
});
