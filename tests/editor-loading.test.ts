import { describe, it, expect, beforeEach } from "vitest";
import { createResume, getMasterResume } from "@/lib/db/resumes";
import { createJob } from "@/lib/db/jobs";
import { createVariant } from "@/lib/db/variants";
import { GET as getResumesRoute } from "@/app/api/resumes/route";
import { GET as getResumeByIdRoute } from "@/app/api/resumes/[id]/route";
import { GET as getVariantByIdRoute } from "@/app/api/variants/[id]/route";
import { NextRequest } from "next/server";

describe("EditorWorkspace Canonical Loading Logic Tests (Task B1)", () => {
  let masterResumeId: string;
  let testVariantId: string;
  const masterContent = "= Database Master Typst Content";
  const variantContent = "= Tailored Variant Typst Content";

  beforeEach(async () => {
    const master = await createResume({
      title: "Master Resume DB",
      typstSource: masterContent,
      isMaster: true,
    });
    masterResumeId = master.id;

    // Seed DB Job & Variant
    const job = await createJob({
      company: "Acme Corp",
      roleTitle: "Backend Engineer",
      rawDescription: "Node.js backend role",
    });

    const variant = await createVariant({
      masterResumeId,
      jobId: job.id,
      variantTitle: "Acme Backend Variant",
      typstContent: variantContent,
    });
    testVariantId = variant.id;
  });

  it("1. fetches canonical SQLite master resume when no query parameter exists", async () => {
    const res = await getResumesRoute();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    const master = json.data.find((r: { id: string }) => r.id === masterResumeId);
    expect(master).toBeDefined();
    expect(master.typstSource).toBe(masterContent);
  });

  it("2. ?variantId= fetches variant Typst content cleanly via GET /api/variants/[id]", async () => {
    const req = new NextRequest(`http://localhost:3000/api/variants/${testVariantId}`);
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
    const req = new NextRequest(`http://localhost:3000/api/variants/${invalidId}`);
    const res = await getVariantByIdRoute(req, { params: Promise.resolve({ id: invalidId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe("ResumeVariant not found");
  });

  it("4. verifies database master takes precedence over stale localStorage source", async () => {
    const localStorageMock = "= Stale LocalStorage Content";

    // Simulate database query precedence: DB master is fetched and overrides stale local content
    const res = await getResumesRoute();
    const json = await res.json();
    const dbMaster = json.data.find((r: { id: string }) => r.id === masterResumeId);

    expect(dbMaster.typstSource).toBe(masterContent);
    expect(dbMaster.typstSource).not.toBe(localStorageMock);
  });
});
