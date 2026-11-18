import { describe, it, expect, beforeEach } from "vitest";
import { convertExtractedPdfToEvidenceItems } from "@/lib/evidence/evidence-transform";
import { buildSelectedPdfEvidence } from "@/components/evidence/bulk-pdf-dropzone";
import {
  archiveEvidenceItemsLocally,
  restoreEvidenceItemsLocally,
  verifyEvidenceItemsLocally,
  type EvidenceItem,
} from "@/components/library/library-workspace";
import {
  createEvidenceItem,
  bulkEvidenceAction,
  preflightEvidenceDeletion,
} from "@/lib/db/evidence";
import { POST as bulkPOST } from "@/app/api/evidence/bulk/route";
import { PUT as evidencePUT, DELETE as evidenceDELETE } from "@/app/api/evidence/[id]/route";
import { resetMockStore } from "@/lib/db-mock";
import { prisma } from "@/lib/prisma";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("Evidence Bank Search & Import Data Format Verification", () => {
  it("validates evidence item JSON payload structure", () => {
    const rawImportData = [
      {
        title: "Senior Full Stack Engineer",
        organization: "Vercel",
        type: "experience",
        verifiedSummary: "Built edge network dashboard and reduced bundle sizes by 35%.",
        tags: ["Next.js", "React", "Edge"],
        bullets: [
          "Optimized bundle size across 40+ packages.",
          "Implemented zero-downtime database migrations.",
        ],
      },
    ];

    expect(Array.isArray(rawImportData)).toBe(true);
    const item = rawImportData[0];
    expect(item.title).toBe("Senior Full Stack Engineer");
    expect(item.type).toBe("experience");
    expect(item.verifiedSummary).toContain("bundle sizes");
    expect(item.tags).toHaveLength(3);
    expect(item.bullets).toHaveLength(2);
  });

  it("filters items by query string accurately", () => {
    const items = [
      {
        title: "Lead Frontend Engineer",
        organization: "Stripe",
        verifiedSummary: "Built payment element components in React.",
        tags: ["React", "Stripe.js"],
      },
      {
        title: "Backend Architect",
        organization: "AWS",
        verifiedSummary: "Designed serverless event-driven architecture.",
        tags: ["Rust", "Lambda"],
      },
    ];

    const searchQuery = "stripe";
    const filtered = items.filter((item) => {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.organization.toLowerCase().includes(q) ||
        item.verifiedSummary.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].organization).toBe("Stripe");
  });

  it("converts ExtractedPdfEvidence into structured Evidence Bank items", () => {
    const samplePdfExtracted = {
      sourceDoc: "alex_resume.pdf",
      pages: [{ pageNumber: 1, text: "Sample text" }],
      sections: {
        experience: [
          "Developed distributed streaming pipeline handling 50k events/sec.",
          "Reduced p99 database query latency by 45% using Redis caching.",
        ],
        projects: [
          "Architected real-time multiplayer code editor with operational transformation.",
        ],
        skills: ["TypeScript", "Rust", "Next.js", "PostgreSQL"],
        education: ["State University, Honours Computer Science"],
        certifications: ["AWS Certified Solutions Architect"],
        uncategorized: [],
      },
      extractedTechnologies: ["TypeScript", "Rust", "Next.js"],
      impactMetrics: ["50k events/sec", "45%"],
    };

    const items = convertExtractedPdfToEvidenceItems(samplePdfExtracted);
    expect(items.length).toBeGreaterThanOrEqual(4);

    const expItem = items.find((i) => i.type === "experience");
    expect(expItem).toBeDefined();
    expect(expItem?.title).toContain("alex_resume");
    expect(expItem?.bullets).toHaveLength(2);
    expect(expItem?.bullets[0].text).toContain("streaming pipeline");

    const projItem = items.find((i) => i.type === "project");
    expect(projItem).toBeDefined();
    expect(projItem?.bullets).toHaveLength(1);

    const skillItem = items.find((i) => i.type === "skill");
    expect(skillItem).toBeDefined();
    expect(skillItem?.bullets.map((b) => b.text)).toContain("TypeScript");

    const eduItem = items.find((i) => i.type === "education");
    expect(eduItem).toBeDefined();
    expect(eduItem?.organization).toContain("State University");
  });
});

describe("Evidence Bank Selection, Bulk Actions & Lifecycle", () => {
  beforeEach(() => {
    resetMockStore();
  });

  const makeLocalItem = (overrides: Partial<EvidenceItem> = {}): EvidenceItem => ({
    id: overrides.id ?? "guest-1",
    type: "experience",
    title: "Staff Engineer",
    organization: "Acme",
    verifiedSummary: "Built distributed job scheduler.",
    tags: ["Go", "Postgres"],
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    bullets: [{ id: "b-1", text: "Cut p99 latency by 40%", verified: false }],
    ...overrides,
  });

  it("local archive sets status=archived without deleting and preserves Undo state", () => {
    const items = [
      makeLocalItem({ id: "guest-1", status: "verified" }),
      makeLocalItem({ id: "guest-2", status: "draft" }),
    ];
    const archivedAt = "2026-02-01T12:00:00.000Z";
    const { nextItems, results, undoEntries } = archiveEvidenceItemsLocally(
      items,
      ["guest-1"],
      archivedAt
    );

    expect(nextItems).toHaveLength(2);
    expect(nextItems[0].status).toBe("archived");
    expect(nextItems[0].updatedAt).toBe(archivedAt);
    expect(nextItems[1].status).toBe("draft");
    expect(results[0]).toMatchObject({ id: "guest-1", outcome: "succeeded" });
    expect(undoEntries).toEqual([
      {
        id: "guest-1",
        title: "Staff Engineer",
        previousStatus: "verified",
        updatedAt: archivedAt,
      },
    ]);
  });

  it("local restore honors expectedUpdatedAt and blocks overwriting newer edits", () => {
    const archivedAt = "2026-02-01T12:00:00.000Z";
    const newerEditAt = "2026-02-01T12:05:00.000Z";
    const items = [
      makeLocalItem({ id: "guest-1", status: "archived", updatedAt: archivedAt }),
      makeLocalItem({
        id: "guest-2",
        status: "archived",
        verifiedSummary: "Edited summary",
        updatedAt: newerEditAt,
      }),
    ];

    const { nextItems, results } = restoreEvidenceItemsLocally(items, [
      { id: "guest-1", restoreStatus: "verified", expectedUpdatedAt: archivedAt },
      { id: "guest-2", restoreStatus: "draft", expectedUpdatedAt: archivedAt },
    ]);

    expect(results).toEqual([
      expect.objectContaining({ id: "guest-1", outcome: "succeeded" }),
      expect.objectContaining({ id: "guest-2", outcome: "conflict" }),
    ]);
    expect(nextItems[0].status).toBe("verified");
    expect(nextItems[1].status).toBe("archived");
    expect(nextItems[1].verifiedSummary).toBe("Edited summary");
  });

  it("local verify updates draft items and bullets while skipping archived items", () => {
    const items = [
      makeLocalItem({ id: "guest-1", status: "draft" }),
      makeLocalItem({ id: "guest-2", status: "archived" }),
    ];
    const { nextItems, results } = verifyEvidenceItemsLocally(items, [
      "guest-1",
      "guest-2",
    ]);

    expect(results[0].outcome).toBe("succeeded");
    expect(results[1].outcome).toBe("skipped");
    expect(nextItems[0].status).toBe("verified");
    expect(nextItems[0].bullets[0].verified).toBe(true);
    expect(nextItems[1].status).toBe("archived");
  });

  it("POST /api/evidence/bulk rejects unauthenticated and invalid Zod payloads", async () => {
    const unauthRes = await bulkPOST(
      new Request("http://localhost:3000/api/evidence/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", ids: ["e1"] }),
      })
    );
    expect(unauthRes.status).toBe(401);

    const user = await createTestUser();
    const dupRes = await bulkPOST(
      authedRequest(
        "http://localhost:3000/api/evidence/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", ids: ["e1", "e1"] }),
        },
        user.cookie
      )
    );
    expect(dupRes.status).toBe(400);

    const badActionRes = await bulkPOST(
      authedRequest(
        "http://localhost:3000/api/evidence/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "nuke", ids: ["e1"] }),
        },
        user.cookie
      )
    );
    expect(badActionRes.status).toBe(400);
  });

  it("bulk verify atomically verifies item+bullets, invalidates open proposal batches, and enforces ownership", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();

    const draftItem = await createEvidenceItem({
      userId: owner.user.id,
      type: "experience",
      title: "Platform Engineer",
      verifiedSummary: "Built CI pipeline.",
      status: "draft",
      bullets: [{ text: "Cut deploy time 60%", verified: false }],
    });
    const archivedItem = await createEvidenceItem({
      userId: owner.user.id,
      type: "project",
      title: "Archived Tool",
      verifiedSummary: "Legacy CLI.",
      status: "archived",
      bullets: [{ text: "Migrated 10 repos", verified: false }],
    });
    const foreignItem = await createEvidenceItem({
      userId: other.user.id,
      type: "project",
      title: "Other User Item",
      verifiedSummary: "Private",
      status: "draft",
    });

    const openBatch = await prisma.patchProposalBatch.create({
      data: {
        userId: owner.user.id,
        masterResumeId: "resume-1",
        jobId: "job-1",
        revisionToken: "rev-1",
        masterFingerprint: "m1",
        jobFingerprint: "j1",
        citationFingerprint: "c1",
        proposals: [],
        gaps: [],
        status: "OPEN",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await bulkPOST(
      authedRequest(
        "http://localhost:3000/api/evidence/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verify",
            ids: [draftItem.id, archivedItem.id, foreignItem.id],
          }),
        },
        owner.cookie
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.summary).toEqual({
      succeeded: 1,
      skipped: 2,
      conflict: 0,
      blocked: 0,
    });

    const updatedDraft = await prisma.evidenceItem.findUnique({
      where: { id: draftItem.id },
    });
    const updatedBullets = await prisma.bullet.findMany({
      where: { evidenceId: draftItem.id },
    });
    const untouchedForeign = await prisma.evidenceItem.findUnique({
      where: { id: foreignItem.id },
    });
    const updatedBatch = await prisma.patchProposalBatch.findUnique({
      where: { id: openBatch.id },
    });

    expect(updatedDraft?.status).toBe("verified");
    expect(updatedBullets[0]?.verified).toBe(true);
    expect(untouchedForeign?.status).toBe("draft");
    expect(updatedBatch?.status).toBe("INVALIDATED");
  });

  it("citation preflight and mixed bulk delete keep cited items untouched and reject purge with 409", async () => {
    const owner = await createTestUser();

    const citedByBullet = await createEvidenceItem({
      userId: owner.user.id,
      type: "experience",
      title: "Cited Experience",
      verifiedSummary: "Scaled API.",
      status: "verified",
      bullets: [{ text: "Handled 10k RPS", verified: true }],
    });
    const unreferenced = await createEvidenceItem({
      userId: owner.user.id,
      type: "skill",
      title: "Unused Skill",
      verifiedSummary: "GraphQL basics",
      status: "draft",
    });

    await prisma.patchCitation.create({
      data: {
        patchId: "patch-1",
        bulletId: citedByBullet.bullets[0].id,
      },
    });

    const preflight = await preflightEvidenceDeletion(
      [citedByBullet.id, unreferenced.id],
      owner.user.id
    );
    expect(preflight.eligibleIds).toEqual([unreferenced.id]);
    expect(preflight.blocked).toHaveLength(1);
    expect(preflight.blocked[0].id).toBe(citedByBullet.id);
    expect(preflight.blocked[0].citationCount).toBe(1);

    // Single purge on cited item returns 409 and never converts to archive
    const purgeRes = await evidenceDELETE(
      authedRequest(
        `http://localhost:3000/api/evidence/${citedByBullet.id}?mode=purge`,
        { method: "DELETE" },
        owner.cookie
      ),
      { params: Promise.resolve({ id: citedByBullet.id }) }
    );
    expect(purgeRes.status).toBe(409);
    const purgeJson = await purgeRes.json();
    expect(purgeJson.code).toBe("EVIDENCE_CITATION_RESTRICTED");

    const stillActive = await prisma.evidenceItem.findUnique({
      where: { id: citedByBullet.id },
    });
    expect(stillActive?.status).toBe("verified");

    // Mixed bulk delete deletes only the eligible item and reports blocked for the cited item
    const bulkDeleteRes = await bulkEvidenceAction(
      {
        action: "delete",
        ids: [citedByBullet.id, unreferenced.id],
      },
      owner.user.id
    );
    expect(bulkDeleteRes.summary).toEqual({
      succeeded: 1,
      skipped: 0,
      conflict: 0,
      blocked: 1,
    });
    expect(
      await prisma.evidenceItem.findUnique({ where: { id: unreferenced.id } })
    ).toBeNull();
    expect(
      await prisma.evidenceItem.findUnique({ where: { id: citedByBullet.id } })
    ).not.toBeNull();
  });

  it("optimistic concurrency rejects stale Undo/PUT restores with 409 conflict", async () => {
    const owner = await createTestUser();
    const item = await createEvidenceItem({
      userId: owner.user.id,
      type: "project",
      title: "Search Indexer",
      verifiedSummary: "Built BM25 engine",
      status: "verified",
    });

    // Archive via DELETE
    const archiveRes = await evidenceDELETE(
      authedRequest(
        `http://localhost:3000/api/evidence/${item.id}`,
        { method: "DELETE" },
        owner.cookie
      ),
      { params: Promise.resolve({ id: item.id }) }
    );
    expect(archiveRes.status).toBe(200);
    const archiveJson = await archiveRes.json();
    const archiveUpdatedAt = archiveJson.data.updatedAt as string;

    // Simulate a newer edit bumping updatedAt (ensure wall-clock advances for mock DB)
    await new Promise((resolve) => setTimeout(resolve, 15));
    await prisma.evidenceItem.update({
      where: { id: item.id },
      data: { verifiedSummary: "Newer edited summary" },
    });

    const staleUndo = await bulkEvidenceAction(
      {
        action: "restore",
        ids: [item.id],
        items: [
          {
            id: item.id,
            restoreStatus: "verified",
            expectedUpdatedAt: archiveUpdatedAt,
          },
        ],
      },
      owner.user.id
    );
    expect(staleUndo.summary.conflict).toBe(1);

    const stalePutRes = await evidencePUT(
      authedRequest(
        `http://localhost:3000/api/evidence/${item.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "verified",
            expectedUpdatedAt: archiveUpdatedAt,
          }),
        },
        owner.cookie
      ),
      { params: Promise.resolve({ id: item.id }) }
    );
    expect(stalePutRes.status).toBe(409);

    const preserved = await prisma.evidenceItem.findUnique({
      where: { id: item.id },
    });
    expect(preserved?.verifiedSummary).toBe("Newer edited summary");
    expect(preserved?.status).toBe("archived");
  });

  it("buildSelectedPdfEvidence excludes unchecked bullets and prevents fallback to raw page lines", () => {
    const extracted = {
      sourceDoc: "alex_resume.pdf",
      pages: [
        {
          pageNumber: 1,
          text: "Experience\nNorthwind Labs — Backend Engineer (2023 - Present)\n- Kept distributed PostgreSQL pipeline.\n- Excluded legacy XML bullet with Go.",
        },
      ],
      sections: {
        experience: [
          "Northwind Labs — Backend Engineer (2023 - Present)",
          "- Kept distributed PostgreSQL pipeline.",
          "- Excluded legacy XML bullet with Go.",
        ],
        projects: [],
        education: [],
        certifications: [],
        skills: [],
        uncategorized: [],
      },
      extractedTechnologies: ["PostgreSQL", "Go"],
      impactMetrics: [],
    };

    const selected = buildSelectedPdfEvidence("alex_resume.pdf", extracted, {
      "alex_resume.pdf:experience:2": true,
    });
    expect(selected.pages).toEqual([]);
    expect(selected.extractedTechnologies).toContain("PostgreSQL");
    expect(selected.extractedTechnologies).not.toContain("Go");

    const converted = convertExtractedPdfToEvidenceItems(selected);
    const allTexts = converted.flatMap((item) => [
      item.verifiedSummary,
      ...item.bullets.map((b) => b.text),
    ]);
    expect(allTexts.some((t) => t.includes("Kept distributed PostgreSQL pipeline"))).toBe(true);
    expect(allTexts.some((t) => t.includes("Excluded legacy XML bullet"))).toBe(false);

    // Unchecking every bullet yields zero shell or raw-page-fallback items
    const noneSelected = buildSelectedPdfEvidence("alex_resume.pdf", extracted, {
      "alex_resume.pdf:experience:0": true,
      "alex_resume.pdf:experience:1": true,
      "alex_resume.pdf:experience:2": true,
    });
    expect(convertExtractedPdfToEvidenceItems(noneSelected)).toEqual([]);
  });
});
