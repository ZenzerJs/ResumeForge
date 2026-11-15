import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  extractApiErrorMessage,
  parseApiError,
  readApiResponse,
  readJsonSafe,
} from "@/lib/api-error";
import { buildQuickAddEvidencePayload } from "@/components/tailor/quick-add-evidence-modal";
import {
  isLocalOrDemoJobId,
  matchGuestEvidenceItems,
} from "@/components/tailor/tailor-workspace";
import { shouldFetchInterviewPrep } from "@/components/tracker/apply-prep-sheet-modal";
import { isLocalEvidenceId } from "@/components/library/library-workspace";
import { resolveEffectiveAuthMode } from "@/components/auth/login-form";
import { DEMO_EVIDENCE } from "@/lib/demo-samples";

function makeResponse(
  body: string,
  init: { status?: number; statusText?: string } = {}
): Response {
  const status = init.status ?? 200;
  return new Response(body, {
    status,
    statusText: init.statusText,
    headers: { "Content-Type": body.trimStart().startsWith("<") ? "text/html" : "application/json" },
  });
}

describe("audit tailor, library, tracker & auth fixes", () => {
  describe("api-error helpers", () => {
    it("readJsonSafe parses valid JSON and returns null on HTML 413/500/502 or empty bodies without throwing", async () => {
      expect(await readJsonSafe(makeResponse('{"success":true,"data":{"id":"1"}}'))).toEqual({
        success: true,
        data: { id: "1" },
      });
      expect(await readJsonSafe(makeResponse(""))).toBeNull();
      expect(
        await readJsonSafe(
          makeResponse("<html><body><h1>502 Bad Gateway</h1></body></html>", {
            status: 502,
            statusText: "Bad Gateway",
          })
        )
      ).toBeNull();
      expect(
        await readJsonSafe(
          makeResponse("<!DOCTYPE html><html><title>413 Payload Too Large</title></html>", {
            status: 413,
            statusText: "Payload Too Large",
          })
        )
      ).toBeNull();
    });

    it("extractApiErrorMessage prefers message || error and appends formatted details", () => {
      expect(
        extractApiErrorMessage({
          error: "Failed to create evidence item",
          message: "Connection timeout",
        })
      ).toBe("Connection timeout");

      expect(
        extractApiErrorMessage({
          error: "Invalid request payload",
          details: {
            verifiedSummary: ["Verified summary is required"],
            type: ["Invalid enum value"],
          },
        })
      ).toBe(
        "Invalid request payload: verifiedSummary: Verified summary is required; type: Invalid enum value"
      );

      expect(
        extractApiErrorMessage({
          error: { message: "Nested error message" },
        })
      ).toBe("Nested error message");
    });

    it("parseApiError safely handles HTML 500/502 gateway pages without leaking raw HTML", async () => {
      const html502 = makeResponse("<html><body><h1>502 Bad Gateway</h1></body></html>", {
        status: 502,
        statusText: "Bad Gateway",
      });
      const msg = await parseApiError(html502, "Failed to save item");
      expect(msg).toBe("Failed to save item (HTTP 502 Bad Gateway)");
      expect(msg).not.toContain("<html>");

      const json400 = makeResponse(
        JSON.stringify({
          success: false,
          error: "Invalid request payload",
          details: { title: ["Title is required"] },
        }),
        { status: 400, statusText: "Bad Request" }
      );
      expect(await parseApiError(json400, "Fallback")).toBe(
        "Invalid request payload: title: Title is required"
      );
    });

    it("readApiResponse reads the body once and surfaces !ok or success:false errors", async () => {
      const successRes = makeResponse(JSON.stringify({ success: true, data: { id: "abc" } }), {
        status: 201,
      });
      expect(await readApiResponse(successRes)).toEqual({
        ok: true,
        status: 201,
        data: { success: true, data: { id: "abc" } },
        error: null,
      });

      const logicalFail = makeResponse(
        JSON.stringify({ success: false, error: "Save rejected", message: "Duplicate entry" }),
        { status: 200 }
      );
      expect(await readApiResponse(logicalFail, "Fallback")).toEqual({
        ok: false,
        status: 200,
        data: { success: false, error: "Save rejected", message: "Duplicate entry" },
        error: "Duplicate entry",
      });

      const html500 = makeResponse("<html><body>Internal Server Error</body></html>", {
        status: 500,
        statusText: "Internal Server Error",
      });
      expect(await readApiResponse(html500, "Upload failed")).toEqual({
        ok: false,
        status: 500,
        data: null,
        error: "Upload failed (HTTP 500 Internal Server Error)",
      });
    });
  });

  describe("QuickAddEvidenceModal payload contract", () => {
    it("maps category -> lowercase API type, sends lowercase status 'draft', non-empty verifiedSummary, and inline bullets", () => {
      const workPayload = buildQuickAddEvidencePayload({
        title: "Backend API",
        organization: "Acme",
        category: "WORK",
        bulletPoint: "Built GraphQL gateway in Go.",
        initialSkill: "GraphQL",
      });

      expect(workPayload.type).toBe("experience");
      expect(workPayload.status).toBe("draft");
      expect(workPayload.verifiedSummary).toBe("Built GraphQL gateway in Go.");
      expect(workPayload.tags).toEqual(["graphql", "experience"]);
      expect(workPayload.bullets).toEqual([
        {
          text: "Built GraphQL gateway in Go.",
          technologies: ["GraphQL"],
          roleAffinity: [],
          verified: false,
          orderIndex: 0,
        },
      ]);

      const projPayload = buildQuickAddEvidencePayload({
        title: "Docker Lab",
        category: "PROJECT",
        bulletPoint: "",
        initialSkill: "Docker",
      });
      expect(projPayload.type).toBe("project");
      expect(projPayload.status).toBe("draft");
      expect(projPayload.verifiedSummary).toBe("Docker Lab");
      expect(projPayload.bullets).toBeUndefined();

      expect(
        buildQuickAddEvidencePayload({ title: "Cert", category: "EDUCATION", initialSkill: "AWS" })
          .type
      ).toBe("education");
      expect(
        buildQuickAddEvidencePayload({ title: "Skill", category: "SKILL", initialSkill: "Rust" })
          .type
      ).toBe("skill");
    });

    it("does not reference the non-existent /bullets endpoint", () => {
      const source = fs.readFileSync(
        path.resolve("src/components/tailor/quick-add-evidence-modal.tsx"),
        "utf8"
      );
      expect(source).not.toContain("/bullets");
      expect(source).toContain("resumeforge_guest_evidence");
    });
  });

  describe("Tailor workspace & tracker modal/sheet demo guards", () => {
    it("identifies local/demo job IDs so PATCH /api/jobs/guest-job-* is never called", () => {
      expect(isLocalOrDemoJobId("guest-job-123", false)).toBe(true);
      expect(isLocalOrDemoJobId("demo-sample-job", false)).toBe(true);
      expect(isLocalOrDemoJobId("cuid-real-job", true)).toBe(true);
      expect(isLocalOrDemoJobId("cuid-real-job", false)).toBe(false);
      expect(isLocalOrDemoJobId(null, false)).toBe(false);
    });

    it("matches guest evidence locally in DEMO_MODE without calling POST /api/jobs/match", () => {
      const matches = matchGuestEvidenceItems(DEMO_EVIDENCE, {
        requiredSkills: ["TypeScript", "PostgreSQL"],
        preferredSkills: ["AWS"],
        domainTerms: [],
      });
      expect(matches.length).toBe(1);
      expect(matches[0].id).toBe("demo-sample-evidence-project");
      expect(matches[0].matchedRequirements).toContain("TypeScript");
    });

    it("skips interview-prep fetch in DEMO_MODE or for local/sample/missing job IDs", () => {
      expect(shouldFetchInterviewPrep("real-job-123", true)).toBe(false);
      expect(shouldFetchInterviewPrep("demo-sample-job", false)).toBe(false);
      expect(shouldFetchInterviewPrep("guest-job-999", false)).toBe(false);
      expect(shouldFetchInterviewPrep("sample", false)).toBe(false);
      expect(shouldFetchInterviewPrep(undefined, false)).toBe(false);
      expect(shouldFetchInterviewPrep("real-job-123", false)).toBe(true);
    });
  });

  describe("Library workspace demo/guest support & LoginForm signup guard", () => {
    it("treats both guest-* and demo-sample-* IDs as local evidence items", () => {
      expect(isLocalEvidenceId("demo-sample-evidence-project")).toBe(true);
      expect(isLocalEvidenceId("guest-evi-123")).toBe(true);
      expect(isLocalEvidenceId("guest-dup-candidate")).toBe(true);
      expect(isLocalEvidenceId("clxyz123456")).toBe(false);
    });

    it("forces signin mode when signupEnabled is false even when ?mode=signup is requested", () => {
      expect(resolveEffectiveAuthMode("signup", false)).toBe("signin");
      expect(resolveEffectiveAuthMode("signin", false)).toBe("signin");
      expect(resolveEffectiveAuthMode("signup", true)).toBe("signup");
      expect(resolveEffectiveAuthMode("signin", true)).toBe("signin");
      expect(resolveEffectiveAuthMode(null, true)).toBe("signin");
    });

    it("uses safe JSON parsing instead of raw res.json() across all owned components", () => {
      const ownedFiles = [
        "src/components/tailor/quick-add-evidence-modal.tsx",
        "src/components/tailor/tailor-workspace.tsx",
        "src/components/tracker/apply-prep-sheet-modal.tsx",
        "src/components/tracker/apply-sheet.tsx",
        "src/components/tracker/company-intel-dossier-panel.tsx",
        "src/components/library/library-workspace.tsx",
        "src/components/auth/login-form.tsx",
      ];
      for (const file of ownedFiles) {
        const content = fs.readFileSync(path.resolve(file), "utf8");
        expect(content, `${file} should not call raw res.json()`).not.toMatch(/\bawait\s+\w+\.json\s*\(/);
      }
    });

    it("provides both a status selector and a one-click Verify action to promote draft evidence to verified", () => {
      const librarySource = fs.readFileSync(
        path.resolve("src/components/library/library-workspace.tsx"),
        "utf8"
      );
      expect(librarySource).toContain('id="evidence-item-status"');
      expect(librarySource).toContain('data-testid="verify-evidence-btn"');
      expect(librarySource).toContain("handleVerifyItem");

      const dbSource = fs.readFileSync(path.resolve("src/lib/db/evidence.ts"), "utf8");
      expect(dbSource).toContain('input.status === "verified"');
      expect(dbSource).toContain("tx.bullet.updateMany");
    });
  });
});
