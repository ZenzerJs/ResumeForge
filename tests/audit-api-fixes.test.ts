import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import nextConfig from "../next.config";
import { config as middlewareConfig, middleware } from "@/middleware";
import { cookieSecure, isPublicPath } from "@/lib/security/session";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/db/jobs";
import { saveMasterResume } from "@/lib/db/resumes";
import * as aiGateway from "@/lib/ai/gateway";
import { POST as testConnectionPOST } from "@/app/api/ai/test-connection/route";
import { POST as repairTypstPOST } from "@/app/api/ai/repair-typst/route";
import { POST as extractJobPOST } from "@/app/api/jobs/extract/route";
import { POST as uploadPdfPOST } from "@/app/api/resumes/upload-pdf/route";
import { PATCH as jobByIdPATCH } from "@/app/api/jobs/[id]/route";
import { POST as undoMasterPOST } from "@/app/api/resumes/undo-master/route";
import { GET as authMeGET, PATCH as authMePATCH } from "@/app/api/auth/me/route";
import { POST as dossierGeneratePOST } from "@/app/api/companies/[slug]/dossier/generate/route";
import { POST as byokProxyPOST } from "@/app/api/ai/byok-proxy/route";
import { POST as coverLetterGeneratePOST } from "@/app/api/cover-letters/generate/route";
import { POST as qualitativeReviewPOST } from "@/app/api/ai/qualitative-review/route";
import { POST as generatePatchesPOST } from "@/app/api/ai/generate-patches/route";
import { POST as atsEvaluatePOST } from "@/app/api/ats/evaluate/route";
import { POST as evidencePOST } from "@/app/api/evidence/route";
import { PUT as evidencePUT } from "@/app/api/evidence/[id]/route";
import { POST as jobsPOST } from "@/app/api/jobs/route";
import { authedNextRequest, authedRequest, createTestUser } from "./helpers/auth";

describe("Backend & Serverless Audit Fixes", () => {
  const originalDemoMode = process.env.DEMO_MODE;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    resetRateLimitsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetRateLimitsForTests();
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  describe("1. CSP connect-src & static worker/middleware exclusions", () => {
    it("allows browser-side Ollama/local endpoints in CSP connect-src without weakening other directives", async () => {
      const headersConfig = await nextConfig.headers?.();
      const rootRule = headersConfig?.find((rule) => rule.source === "/:path*");
      const cspHeader = rootRule?.headers.find((h) => h.key === "Content-Security-Policy")?.value || "";

      expect(cspHeader).toContain("connect-src 'self' blob: https://generativelanguage.googleapis.com http://localhost:* http://127.0.0.1:*");
      expect(cspHeader).toContain("frame-ancestors 'none'");
      expect(cspHeader).toContain("object-src 'none'");
    });

    it("excludes /workers/ and .mjs from session public-path checks and middleware matcher", () => {
      expect(isPublicPath("/workers/pdf.worker.min.mjs")).toBe(true);
      expect(isPublicPath("/custom/module.mjs")).toBe(true);
      expect(middlewareConfig.matcher[0]).toContain("workers/");
      expect(middlewareConfig.matcher[0]).toContain("mjs");
    });

    it("prefers legacy pdf.worker.min.mjs with fallback in scripts/copy-pdf-worker.ts", () => {
      const script = fs.readFileSync(path.resolve("scripts/copy-pdf-worker.ts"), "utf8");
      const legacyIdx = script.indexOf("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      const fallbackIdx = script.indexOf("pdfjs-dist/build/pdf.worker.min.mjs");
      expect(legacyIdx).toBeGreaterThan(-1);
      expect(fallbackIdx).toBeGreaterThan(legacyIdx);
    });

    it("sets Secure cookie flag over HTTPS reverse-proxy/Preview deployments when NEXT_PUBLIC_APP_URL is unset", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(
        cookieSecure(
          new Request("http://internal:3000/api/auth/login", {
            headers: { "x-forwarded-proto": "https" },
          })
        )
      ).toBe(true);
      expect(cookieSecure(new Request("https://preview-123.vercel.app/api/auth/login"))).toBe(true);
      expect(cookieSecure(new Request("http://localhost:3000/api/auth/login"))).toBe(false);
    });
  });

  describe("2. DEMO_SAFE_POST_PATHS & demo PDF upload limits", () => {
    it("allows unauthenticated DEMO_MODE=true requests on /api/ai/test-connection, /api/ai/repair-typst, and /api/jobs/extract with same-origin header", async () => {
      process.env.DEMO_MODE = "true";
      const testSpy = vi.spyOn(aiGateway, "testProviderConnection").mockResolvedValue({
        success: true,
        provider: "openai",
        message: "Connected",
        modelCount: 1,
        latencyMs: 10,
      });
      const repairSpy = vi.spyOn(aiGateway, "repairTypstSource").mockResolvedValue({
        success: true,
        data: {
          summary: "Fixed missing paren",
          errorAnalysis: "Closed paren",
          replacementSource: "= Jane\n",
          confidence: "high",
          warnings: [],
          changedLinesCount: 1,
        },
      });

      const connNoOrigin = await testConnectionPOST(
        new Request("http://localhost:3000/api/ai/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "openai", apiKey: "sk-demo" }),
        })
      );
      expect(connNoOrigin.status).toBe(403);

      const connOk = await testConnectionPOST(
        new Request("http://localhost:3000/api/ai/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ provider: "openai", apiKey: "sk-demo" }),
        })
      );
      expect(connOk.status).toBe(200);
      expect(testSpy).toHaveBeenCalledTimes(1);

      const repairNoOrigin = await repairTypstPOST(
        new Request("http://localhost:3000/api/ai/repair-typst", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "= Jane",
            compileError: "unclosed",
            providerConfig: { provider: "openai", apiKey: "sk-demo" },
          }),
        })
      );
      expect(repairNoOrigin.status).toBe(403);

      const repairOk = await repairTypstPOST(
        new Request("http://localhost:3000/api/ai/repair-typst", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({
            source: "= Jane",
            compileError: "unclosed",
            providerConfig: { provider: "openai", apiKey: "sk-demo" },
          }),
        })
      );
      expect(repairOk.status).toBe(200);
      expect(repairSpy).toHaveBeenCalledTimes(1);

      const extractNoOrigin = await extractJobPOST(
        new Request("http://localhost:3000/api/jobs/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawDescription: "Required: TypeScript, PostgreSQL" }),
        })
      );
      expect(extractNoOrigin.status).toBe(403);

      const extractOk = await extractJobPOST(
        new Request("http://localhost:3000/api/jobs/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ rawDescription: "Required: TypeScript, PostgreSQL" }),
        })
      );
      expect(extractOk.status).toBe(200);
      const extractJson = await extractOk.json();
      expect(extractJson.success).toBe(true);
      expect(extractJson.data.requiredSkills).toContain("TypeScript");
    });

    it("enforces middleware rate limits on DEMO_SAFE_POST_PATHS in DEMO_MODE=true", async () => {
      process.env.DEMO_MODE = "true";
      for (let i = 0; i < 15; i++) {
        const res = await middleware(
          new NextRequest("http://localhost:3000/api/jobs/extract", {
            method: "POST",
            headers: { origin: "http://localhost:3000" },
          })
        );
        expect(res.status).toBe(200);
      }
      const limited = await middleware(
        new NextRequest("http://localhost:3000/api/jobs/extract", {
          method: "POST",
          headers: { origin: "http://localhost:3000" },
        })
      );
      expect(limited.status).toBe(429);
    });

    it("allows demo JSON pdfBase64 uploads up to 10 MB PDF (~13.4 MB base64) while rejecting >10 MB decoded PDFs", async () => {
      process.env.DEMO_MODE = "true";
      // ~8 MB invalid-magic payload encoded as base64 (~10.67 MB JSON, >10.06 MB old limit, <=13.4 MB new limit)
      const eightMbDummy = Buffer.alloc(8 * 1024 * 1024, 0x41);
      const base64EightMb = eightMbDummy.toString("base64");
      const resEightMb = await uploadPdfPOST(
        new Request("http://localhost:3000/api/resumes/upload-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ pdfBase64: base64EightMb }),
        })
      );
      // Should pass the body-size check and reach PDF magic check (400), NOT 413
      expect(resEightMb.status).toBe(400);

      // >10 MB decoded PDF should still return 413
      const elevenMbDummy = Buffer.alloc(10 * 1024 * 1024 + 512, 0x41);
      const resTooBig = await uploadPdfPOST(
        new Request("http://localhost:3000/api/resumes/upload-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
          body: JSON.stringify({ pdfBase64: elevenMbDummy.toString("base64") }),
        })
      );
      expect(resTooBig.status).toBe(413);
    });
  });

  describe("3. Status code mappings & missing try/catch hardening", () => {
    it("returns 400 on malformed request.json() across API routes", async () => {
      const { cookie } = await createTestUser();
      const malformedInit = (useCookie = true): RequestInit => ({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(useCookie ? { Cookie: cookie } : {}),
        },
        body: "{not-valid-json",
      });

      const res1 = await testConnectionPOST(new Request("http://localhost:3000/api/ai/test-connection", malformedInit()));
      expect(res1.status).toBe(400);

      const res2 = await repairTypstPOST(new Request("http://localhost:3000/api/ai/repair-typst", malformedInit()));
      expect(res2.status).toBe(400);

      const res3 = await extractJobPOST(new Request("http://localhost:3000/api/jobs/extract", malformedInit()));
      expect(res3.status).toBe(400);

      const res4 = await generatePatchesPOST(new Request("http://localhost:3000/api/ai/generate-patches", malformedInit()));
      expect(res4.status).toBe(400);

      const res5 = await atsEvaluatePOST(authedNextRequest("http://localhost:3000/api/ats/evaluate", malformedInit(false), cookie));
      expect(res5.status).toBe(400);

      const res6 = await coverLetterGeneratePOST(
        authedNextRequest("http://localhost:3000/api/cover-letters/generate", malformedInit(false), cookie)
      );
      expect(res6.status).toBe(400);

      const res7 = await jobsPOST(new Request("http://localhost:3000/api/jobs", malformedInit()));
      expect(res7.status).toBe(400);

      const res8 = await jobByIdPATCH(
        new Request("http://localhost:3000/api/jobs/job-1", { ...malformedInit(), method: "PATCH" }),
        { params: Promise.resolve({ id: "job-1" }) }
      );
      expect(res8.status).toBe(400);

      const res9 = await undoMasterPOST(new Request("http://localhost:3000/api/resumes/undo-master", malformedInit()));
      expect(res9.status).toBe(400);

      const res10 = await authMePATCH(
        new Request("http://localhost:3000/api/auth/me", { ...malformedInit(), method: "PATCH" })
      );
      expect(res10.status).toBe(400);
    });

    it("returns 400 when PATCH /api/jobs/[id] receives an invalid appliedAt date", async () => {
      const { user, cookie } = await createTestUser();
      const job = await createJob({
        company: "DateTestCo",
        roleTitle: "Engineer",
        rawDescription: "TypeScript",
        userId: user.id,
      });

      const res = await jobByIdPATCH(
        authedRequest(
          `http://localhost:3000/api/jobs/${job.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPLIED", appliedAt: "not-a-valid-date" }),
          },
          cookie
        ),
        { params: Promise.resolve({ id: job.id }) }
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when POST /api/resumes/undo-master references a missing snapshot", async () => {
      const { cookie } = await createTestUser();
      const res = await undoMasterPOST(
        authedRequest(
          "http://localhost:3000/api/resumes/undo-master",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshotId: "non-existent-snapshot-id" }),
          },
          cookie
        )
      );
      expect(res.status).toBe(404);
    });

    it("handles auth/me P2002 race condition as 409 and catches unexpected DB errors", async () => {
      const { cookie } = await createTestUser();
      vi.spyOn(prisma.user, "findFirst").mockResolvedValueOnce(null);
      vi.spyOn(prisma.user, "update").mockRejectedValueOnce({ code: "P2002" });

      const conflictRes = await authMePATCH(
        authedRequest(
          "http://localhost:3000/api/auth/me",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "taken_race_name" }),
          },
          cookie
        )
      );
      expect(conflictRes.status).toBe(409);

      vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("DB offline"));
      const getErrRes = await authMeGET(authedRequest("http://localhost:3000/api/auth/me", { method: "GET" }, cookie));
      expect(getErrRes.status).toBe(500);
    });

    it("catches early await failures in dossier/generate and byok-proxy", async () => {
      const { cookie } = await createTestUser();
      vi.spyOn(prisma.companyDossier, "findUnique").mockRejectedValueOnce(new Error("DB error"));

      const dossierRes = await dossierGeneratePOST(
        authedNextRequest(
          "http://localhost:3000/api/companies/acme/dossier/generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName: "Acme" }),
          },
          cookie
        ),
        { params: Promise.resolve({ slug: "acme" }) }
      );
      expect(dossierRes.status).toBe(500);

      const brokenReq = new Request("http://localhost:3000/api/ai/byok-proxy", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000",
          cookie,
          "x-byok-target-url": "https://api.openai.com/v1/chat/completions",
        },
        body: JSON.stringify({ model: "gpt-4o" }),
      });
      vi.spyOn(brokenReq, "arrayBuffer").mockRejectedValueOnce(new Error("Stream aborted"));
      const proxyRes = await byokProxyPOST(brokenReq);
      expect(proxyRes.status).toBe(500);
    });

    it("returns 404 for missing job/variant and 502 for upstream AI failures in cover-letters/generate and qualitative-review", async () => {
      const { user, cookie } = await createTestUser();
      const job = await createJob({
        company: "LetterCo",
        roleTitle: "Backend Engineer",
        rawDescription: "Node.js and PostgreSQL",
        userId: user.id,
      });
      await saveMasterResume({
        title: "Master",
        typstSource: "= Jane\n",
        confirmOverwrite: true,
        userId: user.id,
      });

      const missingJobRes = await coverLetterGeneratePOST(
        authedNextRequest(
          "http://localhost:3000/api/cover-letters/generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: "missing-job-id",
              providerConfig: { provider: "openai", apiKey: "sk-test-123" },
            }),
          },
          cookie
        )
      );
      expect(missingJobRes.status).toBe(404);

      const missingVariantRes = await coverLetterGeneratePOST(
        authedNextRequest(
          "http://localhost:3000/api/cover-letters/generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: job.id,
              variantId: "missing-variant-id",
              providerConfig: { provider: "openai", apiKey: "sk-test-123" },
            }),
          },
          cookie
        )
      );
      expect(missingVariantRes.status).toBe(404);

      vi.spyOn(aiGateway, "generateCoverLetter").mockResolvedValueOnce({
        success: false,
        error: "Upstream 429",
      });
      const coverUpstreamFail = await coverLetterGeneratePOST(
        authedNextRequest(
          "http://localhost:3000/api/cover-letters/generate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: job.id,
              providerConfig: { provider: "openai", apiKey: "sk-test-123" },
            }),
          },
          cookie
        )
      );
      expect(coverUpstreamFail.status).toBe(502);

      vi.spyOn(aiGateway, "generateQualitativeReview").mockResolvedValueOnce({
        success: false,
        error: "Upstream 503",
      });
      const qualUpstreamFail = await qualitativeReviewPOST(
        authedNextRequest(
          "http://localhost:3000/api/ai/qualitative-review",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerConfig: { provider: "openai", apiKey: "sk-test-123" },
              typstContent: "= Jane",
              jobRequirements: { requiredSkills: ["Node.js"], preferredSkills: [], domainTerms: [] },
              deterministicResult: {
                overallScore: 80,
                baseHealth: {},
                requiredMatch: {},
                preferredMatch: {},
                roleEvidence: {},
                skillEvaluations: [],
                gaps: [],
                selectedProfile: "Backend",
              },
            }),
          },
          cookie
        )
      );
      expect(qualUpstreamFail.status).toBe(502);
    });

    it("PUT /api/evidence/[id] promoting draft to verified also verifies draft bullets", async () => {
      const { cookie } = await createTestUser("evidence-verify@example.com");

      const createRes = await evidencePOST(
        authedRequest(
          "http://localhost:3000/api/evidence",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "project",
              title: "Draft CLI Tool",
              verifiedSummary: "Built a CLI tool in TypeScript.",
              status: "draft",
              bullets: [
                {
                  text: "Reduced build time by 35% across 4 packages.",
                  verified: false,
                },
              ],
            }),
          },
          cookie
        )
      );
      expect(createRes.status).toBe(201);
      const createdJson = await createRes.json();
      const itemId = createdJson.data.id as string;
      expect(createdJson.data.status).toBe("draft");
      expect(createdJson.data.bullets[0].verified).toBe(false);

      const verifyRes = await evidencePUT(
        authedRequest(
          `http://localhost:3000/api/evidence/${itemId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "verified" }),
          },
          cookie
        ),
        { params: Promise.resolve({ id: itemId }) }
      );
      expect(verifyRes.status).toBe(200);
      const verifiedJson = await verifyRes.json();
      expect(verifiedJson.success).toBe(true);
      expect(verifiedJson.data.status).toBe("verified");
      expect(verifiedJson.data.bullets).toHaveLength(1);
      expect(verifiedJson.data.bullets[0].verified).toBe(true);
    });
  });
});
