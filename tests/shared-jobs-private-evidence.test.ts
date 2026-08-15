import { describe, it, expect, afterAll } from "vitest";
import { GET as jobsGET, POST as jobsPOST } from "@/app/api/jobs/route";
import { GET as jobByIdGET } from "@/app/api/jobs/[id]/route";
import { GET as evidenceGET, POST as evidencePOST } from "@/app/api/evidence/route";
import { authedRequest, createTestUser } from "./helpers/auth";
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
  });
});
