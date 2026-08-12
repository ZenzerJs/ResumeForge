import { describe, it, expect, beforeEach } from "vitest";
import { GET as getVariantsRoute } from "@/app/api/variants/route";
import { GET as getVariantByIdRoute } from "@/app/api/variants/[id]/route";
import { createResume } from "@/lib/db/resumes";
import { createJob } from "@/lib/db/jobs";
import { createVariant } from "@/lib/db/variants";
import { authedNextRequest, createTestUser } from "./helpers/auth";

describe("ResumeVariant Retrieval API Integration Tests (Task A)", () => {
  let masterResumeId: string;
  let testVariantId: string;
  let cookie: string;

  beforeEach(async () => {
    const auth = await createTestUser();
    cookie = auth.cookie;
    const master = await createResume({
      title: "Test Master Resume",
      typstSource: "= Test Master Typst",
      isMaster: true,
      userId: auth.user.id,
    });
    masterResumeId = master.id;

    const job = await createJob({
      company: "Acme Corp",
      roleTitle: "Backend Developer",
      rawDescription: "Need Node.js and PostgreSQL skills.",
      userId: auth.user.id,
    });

    const variant = await createVariant({
      masterResumeId,
      jobId: job.id,
      variantTitle: "Acme Backend Tailored Variant",
      typstContent: "= Acme Tailored Typst Content",
      userId: auth.user.id,
    });
    testVariantId = variant.id;
  });

  it("GET /api/variants returns 200 with list of variants including job metadata", async () => {
    const res = await getVariantsRoute(authedNextRequest("http://localhost:3000/api/variants", {}, cookie));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);

    const found = json.data.find((v: { id: string }) => v.id === testVariantId);
    expect(found).toBeDefined();
    expect(found.variantTitle).toBe("Acme Backend Tailored Variant");
    expect(found.job).toBeDefined();
    expect(found.job.company).toBe("Acme Corp");
  });

  it("GET /api/variants/[id] returns 200 with variant data when ID exists", async () => {
    const req = authedNextRequest(`http://localhost:3000/api/variants/${testVariantId}`, {}, cookie);
    const res = await getVariantByIdRoute(req, { params: Promise.resolve({ id: testVariantId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(testVariantId);
    expect(json.data.variantTitle).toBe("Acme Backend Tailored Variant");
    expect(json.data.typstContent).toBe("= Acme Tailored Typst Content");
    expect(Array.isArray(json.data.patches)).toBe(true);
  });

  it("GET /api/variants/[id] returns safe 404 when variant ID does not exist", async () => {
    const nonExistentId = "non-existent-variant-uuid-9999";
    const req = authedNextRequest(`http://localhost:3000/api/variants/${nonExistentId}`, {}, cookie);
    const res = await getVariantByIdRoute(req, { params: Promise.resolve({ id: nonExistentId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe("ResumeVariant not found");
  });

  it("GET /api/variants/[id] returns safe 400 when ID is whitespace or malformed", async () => {
    const req = authedNextRequest("http://localhost:3000/api/variants/%20", {}, cookie);
    const res = await getVariantByIdRoute(req, { params: Promise.resolve({ id: "   " }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid variant ID");
  });
});
