import { describe, it, expect, vi, afterEach } from "vitest";
import { POST as extractPOST } from "@/app/api/jobs/extract/route";
import { GET as jobsGET, POST as jobsPOST } from "@/app/api/jobs/route";
import { GET as jobByIdGET, PATCH as jobByIdPATCH, DELETE as jobByIdDELETE } from "@/app/api/jobs/[id]/route";
import { authedRequest, createTestUser } from "./helpers/auth";
import { prisma } from "@/lib/prisma";

describe("Jobs API Endpoint Rejection Path & Zod Validation Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 before body parsing or outbound fetch for unauthenticated extract requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const request = new Request("http://localhost:3000/api/jobs/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://boards.greenhouse.io/example/jobs/123" }),
    });

    const response = await extractPOST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("GUEST_READ_ONLY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 Bad Request for empty/malformed extract request", async () => {
    const { cookie } = await createTestUser();
    const request = authedRequest(
      "http://localhost:3000/api/jobs/extract",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: "" }),
      },
      cookie
    );

    const response = await extractPOST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid request payload");
    expect(json.details).toBeDefined();
  });

  it("returns 401 when a guest posts a job", async () => {
    const request = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "Acme", rawDescription: "TypeScript required." }),
    });

    const response = await jobsPOST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.code).toBe("GUEST_READ_ONLY");
  });

  it("returns 400 Bad Request when posting invalid job payload", async () => {
    const { cookie } = await createTestUser();
    const request = authedRequest(
      "http://localhost:3000/api/jobs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: "Acme", rawDescription: "" }),
      },
      cookie
    );

    const response = await jobsPOST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid request payload");
  });

  it("extracts requirements cleanly on valid request payload", async () => {
    const { cookie } = await createTestUser();
    const request = authedRequest(
      "http://localhost:3000/api/jobs/extract",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawDescription: "Software Engineer required: TypeScript, React, Docker.",
        }),
      },
      cookie
    );

    const response = await extractPOST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.requiredSkills).toContain("TypeScript");
    expect(json.data.requiredSkills).toContain("React");
    expect(json.data.requiredSkills).toContain("Docker");
  });

  it("persists job description and extracted requirements via owner PATCH", async () => {
    const owner = await createTestUser();
    const { createJob, updateJob, getJobById } = await import("@/lib/db/jobs");
    const { prisma } = await import("@/lib/prisma");
    const created = await createJob({
      company: "PersistCo",
      roleTitle: "Engineer",
      rawDescription: "Initial description mentioning TypeScript.",
      source: "pasted",
      userId: owner.user.id,
    });

    const updated = await updateJob(
      created.id,
      {
        rawDescription: "Updated description requiring TypeScript, React, and Docker.",
        extractedRequirements: {
          requiredSkills: ["TypeScript", "React", "Docker"],
          preferredSkills: ["AWS"],
          domainTerms: ["APIs"],
        },
        company: "PersistCo Inc",
      },
      owner.user.id
    );

    expect(updated).not.toBeNull();
    expect(updated?.rawDescription).toContain("Updated description");
    expect(updated?.company).toBe("PersistCo Inc");
    expect(updated?.extractedRequirements.requiredSkills).toContain("Docker");

    const fetched = await getJobById(created.id, owner.user.id);
    expect(fetched?.rawDescription).toContain("Updated description");
    expect(fetched?.extractedRequirements.preferredSkills).toContain("AWS");

    await prisma.job.deleteMany({ where: { id: created.id } });
    await prisma.user.deleteMany({ where: { id: owner.user.id } });
  });

  it("enforces job ownership for PATCH, DELETE, mixed-PATCH rollback, and personal drafts", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const { prisma } = await import("@/lib/prisma");

    const sharedCreateRes = await jobsPOST(
      authedRequest(
        "http://localhost:3000/api/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: "Shared Catalog Co",
            roleTitle: "Platform Engineer",
            rawDescription: "Shared catalog posting TypeScript.",
          }),
        },
        owner.cookie
      )
    );
    expect(sharedCreateRes.status).toBe(201);
    const sharedJobId = (await sharedCreateRes.json()).data.id as string;

    const personalCreateRes = await jobsPOST(
      authedRequest(
        "http://localhost:3000/api/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: `PersonalDraft-${crypto.randomUUID()}`,
            roleTitle: "Draft Engineer",
            rawDescription: "Private personal draft description.",
            source: "pasted",
            personal: true,
          }),
        },
        owner.cookie
      )
    );
    expect(personalCreateRes.status).toBe(201);
    const personalJson = await personalCreateRes.json();
    const personalJobId = personalJson.data.id as string;
    expect(personalJson.data.userId).toBe(owner.user.id);

    try {
      // Other user cannot read, PATCH, or DELETE owner's personal draft.
      const otherPersonalGet = await jobByIdGET(
        authedRequest(`http://localhost:3000/api/jobs/${personalJobId}`, { method: "GET" }, other.cookie),
        { params: Promise.resolve({ id: personalJobId }) }
      );
      expect(otherPersonalGet.status).toBe(404);

      const otherPersonalPatch = await jobByIdPATCH(
        authedRequest(
          `http://localhost:3000/api/jobs/${personalJobId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPLIED" }),
          },
          other.cookie
        ),
        { params: Promise.resolve({ id: personalJobId }) }
      );
      expect(otherPersonalPatch.status).toBe(404);

      const otherPersonalDelete = await jobByIdDELETE(
        authedRequest(`http://localhost:3000/api/jobs/${personalJobId}`, { method: "DELETE" }, other.cookie),
        { params: Promise.resolve({ id: personalJobId }) }
      );
      expect(otherPersonalDelete.status).toBe(404);

      // Shared catalog job (userId: null) rejects catalog edits and DELETE with 404,
      // and rolls back mixed application updates atomically before committing anything.
      const mixedSharedPatch = await jobByIdPATCH(
        authedRequest(
          `http://localhost:3000/api/jobs/${sharedJobId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPLIED", notes: "unauthorized catalog edit" }),
          },
          owner.cookie
        ),
        { params: Promise.resolve({ id: sharedJobId }) }
      );
      expect(mixedSharedPatch.status).toBe(404);
      const rolledBackApp = await prisma.jobApplication.findFirst({
        where: { userId: owner.user.id, jobId: sharedJobId },
      });
      expect(rolledBackApp).toBeNull();

      const sharedDelete = await jobByIdDELETE(
        authedRequest(`http://localhost:3000/api/jobs/${sharedJobId}`, { method: "DELETE" }, owner.cookie),
        { params: Promise.resolve({ id: sharedJobId }) }
      );
      expect(sharedDelete.status).toBe(404);

      // Owner can read personal draft in list and PATCH/DELETE it cleanly.
      const ownerList = await jobsGET(
        authedRequest(
          `http://localhost:3000/api/jobs?q=${encodeURIComponent(personalJson.data.company)}`,
          { method: "GET" },
          owner.cookie
        )
      );
      const ownerListJson = await ownerList.json();
      expect(ownerListJson.data.some((j: { id: string }) => j.id === personalJobId)).toBe(true);

      const guestList = await jobsGET(
        new Request(`http://localhost:3000/api/jobs?q=${encodeURIComponent(personalJson.data.company)}`)
      );
      const guestListJson = await guestList.json();
      expect(guestListJson.data.some((j: { id: string }) => j.id === personalJobId)).toBe(false);

      const ownerDelete = await jobByIdDELETE(
        authedRequest(`http://localhost:3000/api/jobs/${personalJobId}`, { method: "DELETE" }, owner.cookie),
        { params: Promise.resolve({ id: personalJobId }) }
      );
      expect(ownerDelete.status).toBe(200);
    } finally {
      await prisma.jobApplication.deleteMany({ where: { jobId: { in: [sharedJobId, personalJobId] } } });
      await prisma.job.deleteMany({ where: { id: { in: [sharedJobId, personalJobId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.user.id, other.user.id] } } });
    }
  });

  it("blocks owned job DELETE with 409 when an unowned or foreign cover letter references it", async () => {
    const suffix = crypto.randomUUID();
    const owner = await createTestUser(`cl-owner-${suffix}@test.invalid`);
    const other = await createTestUser(`cl-other-${suffix}@test.invalid`);
    const job = await prisma.job.create({
      data: {
        userId: owner.user.id,
        company: "RefCo",
        roleTitle: "Engineer",
        rawDescription: "TypeScript.",
      },
    });
    const letter = await prisma.coverLetter.create({
      data: {
        userId: null,
        jobId: job.id,
        variantId: null,
        title: "Legacy Letter",
        openingParagraph: "Hello",
        bodyParagraphs: "[]",
        closingParagraph: "Thanks",
        fullMarkdown: "Hello",
      },
    });

    try {
      const res = await jobByIdDELETE(
        authedRequest(`http://localhost:3000/api/jobs/${job.id}`, { method: "DELETE" }, owner.cookie),
        { params: Promise.resolve({ id: job.id }) }
      );
      expect(res.status).toBe(409);
      expect(await prisma.job.findUnique({ where: { id: job.id } })).not.toBeNull();
      expect(await prisma.coverLetter.findUnique({ where: { id: letter.id } })).not.toBeNull();
    } finally {
      await prisma.coverLetter.deleteMany({ where: { id: letter.id } });
      await prisma.job.deleteMany({ where: { id: job.id } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.user.id, other.user.id] } } });
    }
  });
});
