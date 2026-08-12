import { describe, it, expect, beforeEach } from "vitest";
import { createResume, getMasterResume } from "@/lib/db/resumes";
import { createJob } from "@/lib/db/jobs";
import { createVariant } from "@/lib/db/variants";
import { GET as getResumesRoute } from "@/app/api/resumes/route";
import { GET as getVariantByIdRoute } from "@/app/api/variants/[id]/route";
import { authedNextRequest, createTestUser } from "./helpers/auth";

describe("EditorWorkspace Canonical Loading Logic Tests (Task B1)", () => {
  let masterResumeId: string;
  let testVariantId: string;
  let cookie: string;
  const masterContent = "= Database Master Typst Content";
  const variantContent = "= Tailored Variant Typst Content";

  beforeEach(async () => {
    const auth = await createTestUser();
    cookie = auth.cookie;
    const master = await createResume({
      title: "Master Resume DB",
      typstSource: masterContent,
      isMaster: true,
      userId: auth.user.id,
    });
    masterResumeId = master.id;

    const job = await createJob({
      company: "Acme Corp",
      roleTitle: "Backend Engineer",
      rawDescription: "Node.js backend role",
      userId: auth.user.id,
    });

    const variant = await createVariant({
      masterResumeId,
      jobId: job.id,
      variantTitle: "Acme Backend Variant",
      typstContent: variantContent,
      userId: auth.user.id,
    });
    testVariantId = variant.id;
  });

  it("1. fetches canonical SQLite master resume when no query parameter exists", async () => {
    const res = await getResumesRoute(authedNextRequest("http://localhost:3000/api/resumes", {}, cookie));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    const master = json.data.find((r: { id: string }) => r.id === masterResumeId);
    expect(master).toBeDefined();
    expect(master.typstSource).toBe(masterContent);
  });

  it("2. ?variantId= fetches variant Typst content cleanly via GET /api/variants/[id]", async () => {
    const req = authedNextRequest(`http://localhost:3000/api/variants/${testVariantId}`, {}, cookie);
    const res = await getVariantByIdRoute(req, { params: Promise.resolve({ id: testVariantId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(testVariantId);
    expect(json.data.variantTitle).toBe("Acme Backend Variant");
    expect(json.data.typstContent).toBe(variantContent);
  });

  it("3. invalid variant ID returns 404 error", async () => {
    const invalidId = "invalid-variant-id-999";
    const req = authedNextRequest(`http://localhost:3000/api/variants/${invalidId}`, {}, cookie);
    const res = await getVariantByIdRoute(req, { params: Promise.resolve({ id: invalidId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe("ResumeVariant not found");
  });

  it("4. verifies database master takes precedence over stale localStorage source", async () => {
    const localStorageMock = "= Stale LocalStorage Content";

    const res = await getResumesRoute(authedNextRequest("http://localhost:3000/api/resumes", {}, cookie));
    const json = await res.json();
    const dbMaster = json.data.find((r: { id: string }) => r.id === masterResumeId);

    expect(dbMaster.typstSource).toBe(masterContent);
    expect(dbMaster.typstSource).not.toBe(localStorageMock);
  });
});
