import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SetupChecklist,
  computeOnboardingChecklistState,
  hasLocalPersonalResume,
  parseGuestEvidenceSummary,
  parseGuestJobsSummary,
} from "@/components/landing/home-landing";
import { emptyGuestStats, type DashboardStats } from "@/lib/db/stats";
import { DEMO_EVIDENCE, DEMO_JOB } from "@/lib/demo-samples";

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    ...emptyGuestStats(),
    ...overrides,
  };
}

describe("Setup progress checklist predicates and UI states", () => {
  describe("parseGuestEvidenceSummary", () => {
    it("treats empty, malformed, draft, archived, and missing-status items as incomplete", () => {
      expect(parseGuestEvidenceSummary(null)).toEqual({
        personalVerifiedCount: 0,
        personalDraftCount: 0,
        hasSampleVerified: false,
      });
      expect(parseGuestEvidenceSummary("")).toEqual({
        personalVerifiedCount: 0,
        personalDraftCount: 0,
        hasSampleVerified: false,
      });
      expect(parseGuestEvidenceSummary("{not-valid-json")).toEqual({
        personalVerifiedCount: 0,
        personalDraftCount: 0,
        hasSampleVerified: false,
      });
      expect(parseGuestEvidenceSummary(JSON.stringify({ id: "e1", status: "verified" }))).toEqual({
        personalVerifiedCount: 0,
        personalDraftCount: 0,
        hasSampleVerified: false,
      });

      const mixedInvalid = JSON.stringify([
        null,
        "bad-string",
        42,
        ["nested"],
        { status: "verified" }, // missing id
        { id: "", status: "verified" }, // empty id
        { id: "e-empty-title", title: "   ", status: "verified" }, // blank title
        { id: "e-draft", title: "Draft item", status: "draft" },
        { id: "e-archived", title: "Archived item", status: "archived" },
        { id: "e-missing-status", title: "No status" },
        { id: "e-wrong-case", title: "Wrong case", status: "VERIFIED" },
      ]);
      expect(parseGuestEvidenceSummary(mixedInvalid)).toEqual({
        personalVerifiedCount: 0,
        personalDraftCount: 1,
        hasSampleVerified: false,
      });
    });

    it("distinguishes demo-sample- fixtures from personal verified evidence", () => {
      const sampleOnly = JSON.stringify(DEMO_EVIDENCE);
      expect(parseGuestEvidenceSummary(sampleOnly)).toEqual({
        personalVerifiedCount: 0,
        personalDraftCount: 0,
        hasSampleVerified: true,
      });

      const mixed = JSON.stringify([
        ...DEMO_EVIDENCE,
        { id: "guest-evi-draft", title: "Draft work", status: "draft" },
        { id: "guest-evi-1", title: "Verified project", status: "verified" },
      ]);
      expect(parseGuestEvidenceSummary(mixed)).toEqual({
        personalVerifiedCount: 1,
        personalDraftCount: 1,
        hasSampleVerified: true,
      });
    });
  });

  describe("parseGuestJobsSummary", () => {
    it("rejects malformed arrays, missing ids, and empty-content records", () => {
      expect(parseGuestJobsSummary(null)).toEqual({ personalCount: 0, hasSampleJob: false });
      expect(parseGuestJobsSummary("not-json")).toEqual({ personalCount: 0, hasSampleJob: false });
      expect(parseGuestJobsSummary(JSON.stringify({ id: "guest-job-1", rawDescription: "JD" }))).toEqual({
        personalCount: 0,
        hasSampleJob: false,
      });

      const malformed = JSON.stringify([
        null,
        123,
        { rawDescription: "Missing id" },
        { id: "", rawDescription: "Empty id" },
        { id: "guest-job-empty" },
        { id: "guest-job-spaces", rawDescription: "   ", company: "  ", roleTitle: "" },
        { id: "guest-job-bad-type", rawDescription: 999, company: "Acme" },
      ]);
      expect(parseGuestJobsSummary(malformed)).toEqual({
        personalCount: 0,
        hasSampleJob: false,
      });
    });

    it("distinguishes demo-sample- jobs from personal saved jobs", () => {
      expect(parseGuestJobsSummary(JSON.stringify([DEMO_JOB]))).toEqual({
        personalCount: 0,
        hasSampleJob: true,
      });

      const mixed = JSON.stringify([
        DEMO_JOB,
        {
          id: "guest-job-1",
          company: "Acme Corp",
          roleTitle: "Backend Intern",
          rawDescription: "Build TypeScript APIs and PostgreSQL queries.",
        },
        {
          id: "guest-job-2",
          company: "Beta Co",
          roleTitle: "Platform Engineer",
          rawDescription: "",
        },
      ]);
      expect(parseGuestJobsSummary(mixed)).toEqual({
        personalCount: 2,
        hasSampleJob: true,
      });
    });
  });

  describe("computeOnboardingChecklistState", () => {
    it("computes 0/4 on zero records and ignores draft-only or demo-only evidence and jobs", () => {
      const zero = computeOnboardingChecklistState({
        stats: makeStats(),
        hasLocalResume: false,
        guestEvidence: parseGuestEvidenceSummary(null),
        guestJobs: parseGuestJobsSummary(null),
        hasAiKey: false,
        aiKeyless: false,
      });
      expect(zero).toEqual({
        step1Done: false,
        step2Done: false,
        step3Done: false,
        step4Done: false,
        completedCount: 0,
        progressPct: 0,
      });

      const demoAndDraftOnly = computeOnboardingChecklistState({
        stats: makeStats({ evidenceCount: 2, verifiedEvidenceCount: 0, jobsCount: 0, hasTargetJob: false }),
        hasLocalResume: hasLocalPersonalResume("= Personal Resume\n" + "a".repeat(40)),
        guestEvidence: parseGuestEvidenceSummary(JSON.stringify(DEMO_EVIDENCE)),
        guestJobs: parseGuestJobsSummary(JSON.stringify([DEMO_JOB])),
        hasAiKey: true,
        aiKeyless: true,
      });
      expect(demoAndDraftOnly).toEqual({
        step1Done: true,
        step2Done: false,
        step3Done: false,
        step4Done: false,
        completedCount: 1,
        progressPct: 25,
      });
    });

    it("computes 4/4 for completed server setup and drops when verified evidence is archived", () => {
      const completed = computeOnboardingChecklistState({
        stats: makeStats({
          hasMasterResume: true,
          evidenceCount: 3,
          verifiedEvidenceCount: 1,
          hasTargetJob: true,
        }),
        hasLocalResume: false,
        guestEvidence: parseGuestEvidenceSummary(null),
        guestJobs: parseGuestJobsSummary(null),
        hasAiKey: true,
        aiKeyless: false,
      });
      expect(completed).toEqual({
        step1Done: true,
        step2Done: true,
        step3Done: true,
        step4Done: true,
        completedCount: 4,
        progressPct: 100,
      });

      const afterArchive = computeOnboardingChecklistState({
        stats: makeStats({
          hasMasterResume: true,
          evidenceCount: 2,
          verifiedEvidenceCount: 0,
          hasTargetJob: true,
        }),
        hasLocalResume: false,
        guestEvidence: parseGuestEvidenceSummary(null),
        guestJobs: parseGuestJobsSummary(null),
        hasAiKey: true,
        aiKeyless: false,
      });
      expect(afterArchive).toEqual({
        step1Done: true,
        step2Done: false,
        step3Done: true,
        step4Done: true,
        completedCount: 3,
        progressPct: 75,
      });
    });
  });

  describe("SetupChecklist rendered UI states", () => {
    it("renders truthful heading, sample-availability notes, and keyless local provider copy", () => {
      const html = renderToStaticMarkup(
        React.createElement(SetupChecklist, {
          stats: makeStats(),
          hasLocalResume: false,
          guestEvidence: parseGuestEvidenceSummary(JSON.stringify(DEMO_EVIDENCE)),
          guestJobs: parseGuestJobsSummary(JSON.stringify([DEMO_JOB])),
          hasAiKey: true,
          aiKeyless: true,
          onUploadPdf: () => {},
          onDismiss: () => {},
        })
      );

      expect(html).toContain("Prepare your workspace for truthful tailoring.");
      expect(html).not.toContain("under 3 minutes");
      expect(html).toContain("0 of 4 steps completed (0%)");
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="0"');

      // Sample availability shown explicitly without crediting completion
      expect(html).toContain("onboarding-step-2-sample-note");
      expect(html).toContain("Synthetic sample available · verify your own item");
      expect(html).toContain("onboarding-step-4-sample-note");
      expect(html).toContain("Synthetic sample available · save your own job");

      // Keyless local provider gets neutral explanation, retains incomplete predicate
      expect(html).toContain("Local provider selected; test in Settings");
      expect(html).toContain("Open Settings");

      // Step 4 truthful copy
      expect(html).toContain("Add a target job");
      expect(html).toContain("Save a job description, then open Tailor to review matches and proposed edits.");
    });

    it("renders keyed provider as 'Key saved · Manage' and completed step 4 without submission-ready claims", () => {
      const html = renderToStaticMarkup(
        React.createElement(SetupChecklist, {
          stats: makeStats({
            hasMasterResume: true,
            evidenceCount: 4,
            verifiedEvidenceCount: 2,
            hasTargetJob: true,
          }),
          hasLocalResume: false,
          guestEvidence: parseGuestEvidenceSummary(JSON.stringify(DEMO_EVIDENCE)),
          guestJobs: parseGuestJobsSummary(JSON.stringify([DEMO_JOB])),
          hasAiKey: true,
          aiKeyless: false,
          onUploadPdf: () => {},
          onDismiss: () => {},
        })
      );

      expect(html).toContain("4 of 4 steps completed (100%)");
      expect(html).toContain('aria-valuenow="4"');
      expect(html).toContain("View 2 Verified");
      expect(html).toContain("Key saved · Manage");
      expect(html).not.toContain("Connected");
      expect(html).not.toContain("Test passed");
      expect(html).toContain("Open Tailor");
      expect(html).not.toMatch(/ready to submit/i);
      // Sample availability notes are hidden once personal setup steps are complete
      expect(html).not.toContain("onboarding-step-2-sample-note");
      expect(html).not.toContain("onboarding-step-4-sample-note");
    });
  });
});
