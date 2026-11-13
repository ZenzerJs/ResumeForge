import { describe, it, expect, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as jobsGET, POST as jobsPOST } from "@/app/api/jobs/route";
import { GET as jobByIdGET, PATCH as jobByIdPATCH, DELETE as jobByIdDELETE } from "@/app/api/jobs/[id]/route";
import { POST as fetchFulltextPOST } from "@/app/api/jobs/[id]/fetch-fulltext/route";
import { POST as hydratePOST } from "@/app/api/jobs/hydrate/route";
import { GET as evidenceGET, POST as evidencePOST } from "@/app/api/evidence/route";
import { authedNextRequest, authedRequest, createTestUser } from "./helpers/auth";
import { isTier1Placeholder } from "@/lib/ingestion/tier2-fetcher";
import { prisma } from "@/lib/prisma";

describe("shared job catalog and private evidence", () => {
  const createdJobIds: string[] = [];
  const createdEvidenceIds: string[] = [];

  afterAll(async () => {
    if (createdEvidenceIds.length > 0) {
      await prisma.evidenceItem.deleteMany({ where: { id: { in: createdEvidenceIds } } });
    }
    if (createdJobIds.length > 0) {
      await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    }
  });

  it("lets guests and other users read a job another user saved, but not their evidence", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const marker = `SharedJob ${crypto.randomUUID()}`;
    const evidenceTitle = `${marker} private evidence`;

    const createRes = await jobsPOST(
      authedRequest(
        "http://localhost:3000/api/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: marker,
            roleTitle: "Engineer",
            rawDescription: `${marker} full description TypeScript.`,
          }),
        },
        userA.cookie
      )
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const jobId = created.data.id as string;
    createdJobIds.push(jobId);

    const evidenceRes = await evidencePOST(
      authedRequest(
        "http://localhost:3000/api/evidence",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "experience",
            title: evidenceTitle,
            verifiedSummary: "Built something privately.",
          }),
        },
        userA.cookie
      )
    );
    expect(evidenceRes.status).toBe(201);
    const evidenceJson = await evidenceRes.json();
    createdEvidenceIds.push(evidenceJson.data.id);

    const guestList = await jobsGET(
      new Request(`http://localhost:3000/api/jobs?q=${encodeURIComponent(marker)}`)
    );
    const guestListJson = await guestList.json();
    expect(guestListJson.success).toBe(true);
    expect(guestListJson.guest).toBe(true);
    expect(guestListJson.data.some((job: { id: string }) => job.id === jobId)).toBe(true);

    const guestDetail = await jobByIdGET(new Request(`http://localhost:3000/api/jobs/${jobId}`), {
      params: Promise.resolve({ id: jobId }),
    });
    expect(guestDetail.status).toBe(200);
    const guestDetailJson = await guestDetail.json();
    expect(guestDetailJson.data.rawDescription).toContain("full description");

    const userBList = await jobsGET(
      authedRequest(
        `http://localhost:3000/api/jobs?q=${encodeURIComponent(marker)}`,
        { method: "GET" },
        userB.cookie
      )
    );
    const userBListJson = await userBList.json();
    expect(userBListJson.data.some((job: { id: string }) => job.id === jobId)).toBe(true);

    const userBEvidence = await evidenceGET(
      authedRequest("http://localhost:3000/api/evidence", { method: "GET" }, userB.cookie)
    );
    const userBEvidenceJson = await userBEvidence.json();
    expect(userBEvidenceJson.data.some((item: { title: string }) => item.title === evidenceTitle)).toBe(
      false
    );

    const userAEvidence = await evidenceGET(
      authedRequest("http://localhost:3000/api/evidence", { method: "GET" }, userA.cookie)
    );
    const userAEvidenceJson = await userAEvidence.json();
    expect(userAEvidenceJson.data.some((item: { title: string }) => item.title === evidenceTitle)).toBe(
      true
    );

    const guestEvidence = await evidenceGET(new Request("http://localhost:3000/api/evidence"));
    const guestEvidenceJson = await guestEvidence.json();
    expect(guestEvidenceJson.data).toEqual([]);
    expect(guestEvidenceJson.guest).toBe(true);

    // User B can track their own application status on the shared job, but cannot edit catalog fields or delete it.
    const userBAppPatch = await jobByIdPATCH(
      authedRequest(
        `http://localhost:3000/api/jobs/${jobId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "APPLIED" }),
        },
        userB.cookie
      ),
      { params: Promise.resolve({ id: jobId }) }
    );
    expect(userBAppPatch.status).toBe(200);

    const userBCatalogPatch = await jobByIdPATCH(
      authedRequest(
        `http://localhost:3000/api/jobs/${jobId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Attempted shared overwrite" }),
        },
        userB.cookie
      ),
      { params: Promise.resolve({ id: jobId }) }
    );
    expect(userBCatalogPatch.status).toBe(404);

    const userBDeleteShared = await jobByIdDELETE(
      authedRequest(`http://localhost:3000/api/jobs/${jobId}`, { method: "DELETE" }, userB.cookie),
      { params: Promise.resolve({ id: jobId }) }
    );
    expect(userBDeleteShared.status).toBe(404);
  });

  it("gates fetch-fulltext and hydrate endpoints by session and job ownership without mutating shared catalog rows", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const applyUrl = "https://job-boards.eu.greenhouse.io/hydrationco/jobs/987654";

    const sharedPlaceholder = await prisma.job.create({
      data: {
        company: "SharedHydrateCo",
        roleTitle: "Engineer",
        rawDescription: "[Pending Import] Full job description text not yet fetched...",
        notes: `Apply Link: ${applyUrl}`,
      },
    });
    const privatePlaceholder = await prisma.job.create({
      data: {
        userId: owner.user.id,
        company: "PrivateHydrateCo",
        roleTitle: "Engineer",
        rawDescription: "[Pending Import] Full job description text not yet fetched...",
        notes: `Apply Link: ${applyUrl}`,
      },
    });
    createdJobIds.push(sharedPlaceholder.id, privatePlaceholder.id);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          title: "Engineer",
          content:
            "<p>Full hydrated description requiring TypeScript, React, Node.js, and PostgreSQL experience for production services across distributed engineering teams building reliable cloud infrastructure.</p>",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    try {
      const guestSingle = await fetchFulltextPOST(
        new NextRequest(`http://localhost:3000/api/jobs/${sharedPlaceholder.id}/fetch-fulltext`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: sharedPlaceholder.id }) }
      );
      expect(guestSingle.status).toBe(401);

      const guestBulk = await hydratePOST(
        new NextRequest("http://localhost:3000/api/jobs/hydrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [sharedPlaceholder.id] }),
        })
      );
      expect(guestBulk.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Foreign user cannot fetch or hydrate owner's personal draft.
      const foreignSingle = await fetchFulltextPOST(
        authedNextRequest(
          `http://localhost:3000/api/jobs/${privatePlaceholder.id}/fetch-fulltext`,
          { method: "POST" },
          other.cookie
        ),
        { params: Promise.resolve({ id: privatePlaceholder.id }) }
      );
      expect(foreignSingle.status).toBe(404);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Bulk hydrate caps at 8 IDs and skips foreign private jobs without fetching them.
      const oversizedIds = [
        privatePlaceholder.id,
        sharedPlaceholder.id,
        "missing-1",
        "missing-2",
        "missing-3",
        "missing-4",
        "missing-5",
        "missing-6",
        "missing-7",
        "missing-8",
      ];
      const otherHydrate = await hydratePOST(
        authedNextRequest(
          "http://localhost:3000/api/jobs/hydrate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: oversizedIds }),
          },
          other.cookie
        )
      );
      expect(otherHydrate.status).toBe(200);
      const otherHydrateJson = await otherHydrate.json();
      expect(otherHydrateJson.results.length).toBeLessThanOrEqual(8);
      const privateResult = otherHydrateJson.results.find((r: { id: string }) => r.id === privatePlaceholder.id);
      expect(privateResult.status).toBe("skipped");
      const sharedResult = otherHydrateJson.results.find((r: { id: string }) => r.id === sharedPlaceholder.id);
      expect(sharedResult.status).toBe("ok");
      expect(sharedResult.rawDescription).toContain("TypeScript");

      // Shared catalog DB row must stay untouched when hydrated by a user request.
      const sharedRow = await prisma.job.findUnique({ where: { id: sharedPlaceholder.id } });
      expect(isTier1Placeholder(sharedRow?.rawDescription || "")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
      await prisma.user.deleteMany({ where: { id: { in: [owner.user.id, other.user.id] } } });
    }
  });
});
