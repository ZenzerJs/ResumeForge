import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { executeServerTool } from "@/lib/ai/tools/executor";
import { cleanupStalePositions } from "@/lib/db/jobs";
import { POST as cleanupPOST } from "@/app/api/jobs/cleanup/route";
import { NextRequest } from "next/server";
import { createTestUser } from "../helpers/auth";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createPatchCitations, readPatchCitations } from "@/lib/ai/patch-citations";
import { DELETE as evidenceDELETE } from "@/app/api/evidence/[id]/route";

describe("real PostgreSQL contracts", () => {
  const userIds: string[] = [];
  const jobIds: string[] = [];
  const patchIds: string[] = [];

  beforeAll(async () => {
    const expectedSchema = new URL(process.env.DATABASE_URL!).searchParams.get("schema");
    const [{ schema }] = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
    expect(expectedSchema).toMatch(/^rf_it_[0-9]+_[a-f0-9]{32}$/);
    expect(schema).toBe(expectedSchema);

    // db push cannot express the migration's CHECK constraint. Replace only
    // the generated table in the runner-verified disposable schema, then run
    // the authored SQL statements there to exercise the actual PostgreSQL contract.
    await prisma.$executeRawUnsafe('DROP TABLE "PatchCitation"');
    const migration = readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20261023000000_patch_citations/migration.sql"),
      "utf8"
    );
    for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
  });

  async function createUser(email: string) {
    const user = await prisma.user.create({
      data: { email, username: email.split("@")[0], passwordHash: "integration-only" },
    });
    userIds.push(user.id);
    return user;
  }

  it("persists and reads owner-bound citations, legacy IDs, and PostgreSQL restrictions", async () => {
    const suffix = crypto.randomUUID();
    const { user: owner, cookie } = await createTestUser(`citations-${suffix}@test.invalid`);
    userIds.push(owner.id);
    const other = await createUser(`citations-other-${suffix}@test.invalid`);
    const job = await prisma.job.create({ data: { rawDescription: "Citation integration job" } });
    jobIds.push(job.id);
    const master = await prisma.resume.create({
      data: { userId: owner.id, title: "Citation master", typstSource: "resume", isMaster: true },
    });
    const variant = await prisma.resumeVariant.create({
      data: { masterResumeId: master.id, jobId: job.id, variantTitle: "Citation variant", typstContent: "resume" },
    });
    const otherMaster = await prisma.resume.create({
      data: { userId: other.id, title: "Other master", typstSource: "resume", isMaster: true },
    });
    const otherVariant = await prisma.resumeVariant.create({
      data: { masterResumeId: otherMaster.id, jobId: job.id, variantTitle: "Other variant", typstContent: "resume" },
    });
    const evidence = await prisma.evidenceItem.create({
      data: {
        userId: owner.id,
        type: "project",
        title: "Verified project",
        verifiedSummary: "Built a verified project.",
        bullets: { create: [{ text: "First verified bullet" }, { text: "Second verified bullet" }] },
      },
      include: { bullets: true },
    });
    const otherEvidence = await prisma.evidenceItem.create({
      data: {
        userId: other.id,
        type: "project",
        title: "Other user's project",
        verifiedSummary: "Private evidence.",
        bullets: { create: [{ text: "Private bullet" }] },
      },
      include: { bullets: true },
    });
    const citationPatch = await prisma.patch.create({
      data: {
        variantId: variant.id,
        operation: "MODIFY_BULLET",
        targetSection: "experience",
        beforeContent: "Before",
        afterContent: "After",
        rationale: "Verified evidence",
      },
    });
    const legacyPatch = await prisma.patch.create({
      data: {
        variantId: variant.id,
        operation: "MODIFY_BULLET",
        targetSection: "experience",
        beforeContent: "Before",
        afterContent: "After",
        evidenceCitations: JSON.stringify([evidence.id, evidence.bullets[1].id, otherEvidence.id, "missing-id"]),
        rationale: "Legacy citation fixture",
      },
    });
    const foreignPatch = await prisma.patch.create({
      data: {
        variantId: otherVariant.id,
        operation: "MODIFY_BULLET",
        targetSection: "experience",
        beforeContent: "Before",
        afterContent: "After",
        rationale: "Foreign patch fixture",
      },
    });
    patchIds.push(citationPatch.id, legacyPatch.id, foreignPatch.id);

    await prisma.$transaction((tx) => createPatchCitations(tx, {
      patchId: citationPatch.id,
      ownerId: owner.id,
      citations: [
        { evidenceId: evidence.id },
        { bulletId: evidence.bullets[0].id },
        { evidenceId: evidence.id, bulletId: evidence.bullets[1].id },
      ],
    }));
    const storedCitations = await readPatchCitations(citationPatch.id, owner.id);
    expect(storedCitations).not.toBeNull();
    expect(storedCitations!.citations).toHaveLength(3);
    expect(storedCitations!.citations).toEqual(expect.arrayContaining([
        { evidenceId: evidence.id },
        { bulletId: evidence.bullets[0].id },
        { evidenceId: evidence.id, bulletId: evidence.bullets[1].id },
    ]));
    expect(storedCitations!.unresolvedLegacyReferences).toEqual([]);
    expect(await readPatchCitations(legacyPatch.id, owner.id)).toEqual({
      citations: [
        { evidenceId: evidence.id },
        { bulletId: evidence.bullets[1].id },
      ],
      unresolvedLegacyReferences: [otherEvidence.id, "missing-id"],
    });
    expect(await readPatchCitations(legacyPatch.id, other.id)).toBeNull();

    await expect(prisma.$transaction((tx) => createPatchCitations(tx, {
      patchId: citationPatch.id,
      ownerId: owner.id,
      citations: [{ evidenceId: otherEvidence.id }],
    }))).rejects.toThrow();
    await expect(prisma.$transaction((tx) => createPatchCitations(tx, {
      patchId: citationPatch.id,
      ownerId: owner.id,
      citations: [{ evidenceId: evidence.id, bulletId: otherEvidence.bullets[0].id }],
    }))).rejects.toThrow();
    await expect(prisma.$transaction((tx) => createPatchCitations(tx, {
      patchId: foreignPatch.id,
      ownerId: owner.id,
      citations: [{ evidenceId: evidence.id }],
    }))).rejects.toThrow();

    await expect(prisma.$executeRaw`
      INSERT INTO "PatchCitation" ("id", "patchId", "createdAt")
      VALUES (${crypto.randomUUID()}, ${citationPatch.id}, CURRENT_TIMESTAMP)
    `).rejects.toThrow();
    await expect(prisma.evidenceItem.delete({ where: { id: evidence.id } })).rejects.toThrow();
    await expect(prisma.bullet.delete({ where: { id: evidence.bullets[0].id } })).rejects.toThrow();
    const purge = await evidenceDELETE(
      new Request(`http://localhost/api/evidence/${evidence.id}?mode=purge`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      }),
      { params: Promise.resolve({ id: evidence.id }) }
    );
    expect(purge.status).toBe(409);
    const purgeBody = await purge.json();
    expect(purgeBody.code).toBe("EVIDENCE_CITATION_RESTRICTED");
    expect(purgeBody.error).toContain("Archive it instead.");
    const archive = await evidenceDELETE(
      new Request(`http://localhost/api/evidence/${evidence.id}`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      }),
      { params: Promise.resolve({ id: evidence.id }) }
    );
    expect(archive.status).toBe(200);
    expect(await prisma.evidenceItem.findUnique({ where: { id: evidence.id } })).toMatchObject({
      status: "archived",
    });
  });

  afterAll(async () => {
    await prisma.patchCitation.deleteMany({ where: { patchId: { in: patchIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  });

  it("searches nonempty roleTitle and keeps shared application state private per user", async () => {
    const suffix = crypto.randomUUID();
    const userA = await createUser(`search-a-${suffix}@test.invalid`);
    const userB = await createUser(`search-b-${suffix}@test.invalid`);
    const shared = await prisma.job.create({
      data: {
        company: `Shared ${suffix}`,
        roleTitle: "Platform Engineer",
        rawDescription: "PostgreSQL",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    });
    jobIds.push(shared.id);
    const owned = await prisma.job.create({
      data: {
        userId: userA.id,
        company: `Owned ${suffix}`,
        roleTitle: "Platform Engineer",
        rawDescription: "PostgreSQL",
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    });
    jobIds.push(owned.id);

    await Promise.all([
      prisma.jobApplication.create({ data: { userId: userA.id, jobId: shared.id, status: "OFFER" } }),
      prisma.jobApplication.create({ data: { userId: userB.id, jobId: shared.id, status: "REJECTED" } }),
    ]);

    const aResult = await executeServerTool("search_saved_jobs", { search: "Platform Engineer" }, userA.id);
    expect(aResult.success).toBe(true);
    expect(aResult.data.jobs.map((job: { id: string }) => job.id)).toEqual([owned.id, shared.id]);
    expect(aResult.data.jobs.find((job: { id: string }) => job.id === shared.id).status).toBe("OFFER");

    const bResult = await executeServerTool("search_saved_jobs", { search: "Platform Engineer", status: "OFFER" }, userB.id);
    expect(bResult.success).toBe(true);
    expect(bResult.data.jobs).toEqual([]);
    const bRejected = await executeServerTool("search_saved_jobs", { search: "Platform Engineer", status: "REJECTED" }, userB.id);
    expect(bRejected.data.jobs.map((job: { id: string }) => job.id)).toEqual([shared.id]);
  });

  it("denies cleanup to guests and ordinary accounts, then preserves applications and artifacts for maintenance", async () => {
    const suffix = crypto.randomUUID();
    const originalSecret = process.env.JOB_SYNC_SECRET;
    process.env.JOB_SYNC_SECRET = `integration-maintenance-${suffix}`;
    const { user: owner, cookie } = await createTestUser(`cleanup-${suffix}@test.invalid`);
    userIds.push(owner.id);
    const staleDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const applicationJob = await prisma.job.create({
      data: { company: "Protected", roleTitle: "Historical", rawDescription: "Old listing", createdAt: staleDate },
    });
    const variantJob = await prisma.job.create({
      data: { company: "Variant", roleTitle: "Historical", rawDescription: "Old listing", createdAt: staleDate },
    });
    const letterJob = await prisma.job.create({
      data: { company: "Letter", roleTitle: "Historical", rawDescription: "Old listing", createdAt: staleDate },
    });
    jobIds.push(applicationJob.id, variantJob.id, letterJob.id);
    await prisma.jobApplication.create({ data: { userId: owner.id, jobId: applicationJob.id, status: "REJECTED" } });
    const resume = await prisma.resume.create({
      data: { userId: owner.id, title: "Integration master", typstSource: "resume", isMaster: true },
    });
    const variant = await prisma.resumeVariant.create({
      data: { masterResumeId: resume.id, jobId: variantJob.id, variantTitle: "Saved variant", typstContent: "resume" },
    });
    const letter = await prisma.coverLetter.create({
      data: {
        userId: owner.id,
        jobId: letterJob.id,
        variantId: variant.id,
        title: "Saved letter",
        openingParagraph: "Opening",
        bodyParagraphs: "[]",
        closingParagraph: "Closing",
        fullMarkdown: "Letter",
      },
    });

    try {
      const guest = await cleanupPOST(new NextRequest("http://localhost/api/jobs/cleanup", { method: "POST" }));
      const ordinary = await cleanupPOST(new NextRequest("http://localhost/api/jobs/cleanup", {
        method: "POST",
        headers: { Cookie: cookie },
      }));
      expect(guest.status).toBe(401);
      expect(ordinary.status).toBe(401);

      const maintenance = await cleanupPOST(new NextRequest("http://localhost/api/jobs/cleanup", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.JOB_SYNC_SECRET}` },
      }));
      expect(maintenance.status).toBe(200);
      expect(await prisma.job.findMany({ where: { id: { in: [applicationJob.id, variantJob.id, letterJob.id] } } })).toHaveLength(3);
      expect(await prisma.jobApplication.findUnique({ where: { userId_jobId: { userId: owner.id, jobId: applicationJob.id } } })).toMatchObject({ status: "REJECTED" });
      expect(await prisma.resumeVariant.findUnique({ where: { id: variant.id } })).not.toBeNull();
      expect(await prisma.coverLetter.findUnique({ where: { id: letter.id } })).not.toBeNull();
    } finally {
      if (originalSecret === undefined) delete process.env.JOB_SYNC_SECRET;
      else process.env.JOB_SYNC_SECRET = originalSecret;
    }
  });

  it("blocks cleanup behind a concurrent application FK and keeps the committed job link", async () => {
    const suffix = crypto.randomUUID();
    const owner = await createUser(`race-${suffix}@test.invalid`);
    const now = new Date();
    const staleDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const raceJob = await prisma.job.create({
      data: { rawDescription: "Racing application", createdAt: staleDate },
    });
    const freeJob = await prisma.job.create({
      data: { rawDescription: "Unreferenced listing", createdAt: staleDate },
    });
    jobIds.push(raceJob.id, freeJob.id);
    const linked = await prisma.ingestedJob.create({
      data: {
        fingerprint: `${suffix}-race`, externalId: `${suffix}-race`, source: "MANUAL",
        companyName: "Fixture", title: "Race", location: "Remote", description: "fixture",
        descriptionHtml: "fixture", applyUrl: "https://example.invalid/race", trackedJobId: raceJob.id,
        createdAt: staleDate, updatedAt: staleDate,
      },
    });
    await prisma.ingestedJob.create({
      data: {
        fingerprint: `${suffix}-free`, externalId: `${suffix}-free`, source: "MANUAL",
        companyName: "Fixture", title: "Free", location: "Remote", description: "fixture",
        descriptionHtml: "fixture", applyUrl: "https://example.invalid/free", trackedJobId: freeJob.id,
        createdAt: staleDate, updatedAt: staleDate,
      },
    });
    const applicationId = crypto.randomUUID();
    let releaseWriter!: () => void;
    let announceInsert!: () => void;
    const writerGate = new Promise<void>((resolve) => { releaseWriter = resolve; });
    const inserted = new Promise<void>((resolve) => { announceInsert = resolve; });
    let cleanupSettled = false;
    const writer = prisma.$transaction(async (tx) => {
      await tx.jobApplication.create({ data: { id: applicationId, userId: owner.id, jobId: raceJob.id } });
      announceInsert();
      await writerGate;
    }, { timeout: 30000 });
    let cleanup: ReturnType<typeof cleanupStalePositions> | undefined;
    try {
      await Promise.race([
        inserted,
        writer.then(() => { throw new Error("Application writer unexpectedly completed before cleanup began."); }),
      ]);
      cleanup = cleanupStalePositions({ maxAgeDays: 30, now }).finally(() => { cleanupSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(cleanupSettled).toBe(false);
      const waiting = await prisma.$queryRaw<Array<{ wait_event_type: string | null }>>`
        SELECT wait_event_type FROM pg_stat_activity
        WHERE datname = current_database() AND query ILIKE '%FOR UPDATE%' AND pid <> pg_backend_pid()
      `;
      expect(waiting.some((row) => row.wait_event_type === "Lock")).toBe(true);
      releaseWriter();
      await writer;
      const result = await cleanup;
      expect(result.deletedJobs).toBe(1);
      expect(await prisma.job.findUnique({ where: { id: raceJob.id } })).not.toBeNull();
      expect(await prisma.jobApplication.findUnique({ where: { id: applicationId } })).not.toBeNull();
      expect(await prisma.ingestedJob.findUnique({ where: { id: linked.id } })).toMatchObject({ trackedJobId: raceJob.id });
      expect(await prisma.job.findUnique({ where: { id: freeJob.id } })).toBeNull();
    } finally {
      releaseWriter();
      await writer.catch(() => undefined);
      await cleanup?.catch(() => undefined);
      await prisma.ingestedJob.deleteMany({ where: { fingerprint: { in: [`${suffix}-race`, `${suffix}-free`] } } });
    }
  });

  it("rolls back records from a failed transaction", async () => {
    const suffix = crypto.randomUUID();
    const email = `rollback-${suffix}@test.invalid`;
    await expect(prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { email, username: `rollback-${suffix}`, passwordHash: "integration-only" },
      });
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

});
