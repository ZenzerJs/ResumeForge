import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanExport, GuardrailBlockError } from "@/lib/guardrail/policy";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { generateApplicationPackageZip } from "@/lib/export/zip";
import { ApplySheet, ApplySheetPatchCard, selectAcceptedPatchProposals } from "@/components/tracker/apply-sheet";
import type { PatchProposal } from "@/lib/ai/patch-schema";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import { ResumeFacts } from "@/lib/facts/types";

describe("One-Click Apply Pipeline", () => {
  const proposal: PatchProposal = {
    id: "patch-1",
    operation: "MODIFY_BULLET",
    targetSection: "Experience",
    before: "Built APIs",
    after: "Built verified APIs with TypeScript",
    rationale: "Clarifies the verified technology used.",
    confidence: 0.9,
    evidenceIds: ["evidence-1"],
  };

  it("shows before and after text with explicit accept and reject controls", () => {
    const markup = renderToStaticMarkup(React.createElement(ApplySheetPatchCard, {
      patch: proposal,
      decision: "pending",
      onAccept: () => {},
      onReject: () => {},
    }));

    expect(markup).toContain("Built APIs");
    expect(markup).toContain("Built verified APIs with TypeScript");
    expect(markup).toContain("apply-sheet-accept-patch-1");
    expect(markup).toContain("apply-sheet-reject-patch-1");
    expect(markup).toContain("Clarifies the verified technology used.");
  });

  it("selects only proposals the user explicitly accepted", () => {
    const second = { ...proposal, id: "patch-2" };
    expect(selectAcceptedPatchProposals([proposal, second], { "patch-1": "accepted", "patch-2": "pending" })).toEqual([proposal]);
  });

  it("reconstructs the preview from only the accepted server-bound proposals", () => {
    const second = { ...proposal, id: "patch-2", before: "TypeScript", after: "JavaScript" };
    const accepted = selectAcceptedPatchProposals([proposal, second], { "patch-1": "accepted", "patch-2": "rejected" });
    expect(applyPatchProposals("- Built APIs\n", accepted)).toEqual({
      typstSource: "- Built verified APIs with TypeScript\n",
      appliedIds: ["patch-1"],
    });
  });

  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [{ raw: "Stripe", normalized: "stripe" }],
    titles: [{ raw: "Software Engineer", normalized: "software engineer" }],
    dateRanges: [{ raw: "2022 – 2024", startIso: "2022-01", endIso: "2024-12" }],
    metrics: [{ raw: "45ms", value: 45, unit: "ms", context: "latency", isTrivial: false }],
    skills: ["typescript", "postgresql", "react"],
    evidenceIds: ["evid-1"],
  };

  const candidateTypst = `
= Jane Doe
== EXPERIENCE
*Stripe* -- *Software Engineer*
- Reduced latency by 45ms across TypeScript and PostgreSQL services.
== SKILLS
- Languages: TypeScript, SQL, React
  `;

  it("completes deterministic ATS scoring against job requirements", () => {
    const requirements = {
      roleTitle: "Software Engineer",
      company: "Stripe",
      requiredSkills: ["typescript", "postgresql"],
      preferredSkills: ["react"],
      domainTerms: ["latency"],
    };

    const score = evaluateAtsScore(candidateTypst, requirements, "Full-stack");
    expect(score.overallScore).toBeGreaterThan(50);
    expect(score.requiredMatch.score).toBeGreaterThan(0);
  });

  it("verifies clean mechanical guardrail status before permitting downloads", () => {
    const result = checkGuardrail(candidateTypst, masterFacts);
    expect(result.passed).toBe(true);
    expect(result.hasHardViolations).toBe(false);
  });

  it("generates an application package zip for the job with ATS score audit", async () => {
    const requirements = {
      roleTitle: "Software Engineer",
      company: "Stripe",
      requiredSkills: ["typescript", "postgresql"],
      preferredSkills: ["react"],
      domainTerms: ["latency"],
    };

    const score = evaluateAtsScore(candidateTypst, requirements, "Full-stack");

    const zipBytes = await generateApplicationPackageZip({
      typstSource: candidateTypst,
      masterFacts,
      job: {
        company: "Stripe",
        roleTitle: "Software Engineer",
        location: "San Francisco, CA",
        requirements,
      },
      atsScore: score,
    });

    expect(zipBytes).toBeInstanceOf(Uint8Array);
    const unzipped = await JSZip.loadAsync(zipBytes);
    expect(unzipped.file("resume.pdf")).not.toBeNull();
    expect(unzipped.file("resume.docx")).not.toBeNull();
    expect(unzipped.file("resume.txt")).not.toBeNull();
    expect(unzipped.file("resume.typ")).not.toBeNull();
    expect(unzipped.file("application_summary.txt")).not.toBeNull();

    const summary = await unzipped.file("application_summary.txt")?.async("string");
    expect(summary).toContain("Company: Stripe");
    expect(summary).toContain("Role: Software Engineer");
    expect(summary).toContain(`Overall Match Score: ${score.overallScore} / 100`);
  }, 15000);

  it("blocks downloads and export generation when guardrail detects hard violations", async () => {
    const invalidCandidate = `
= Jane Doe
== EXPERIENCE
*Tesla* -- *Chief Architect*
- Invented full self driving reducing latency by 99% across $10B revenue fleet.
    `;

    expect(() => assertCanExport(invalidCandidate, masterFacts)).toThrow(GuardrailBlockError);

    await expect(
      generateApplicationPackageZip({
        typstSource: invalidCandidate,
        masterFacts,
        job: { company: "Stripe", roleTitle: "Software Engineer" },
      })
    ).rejects.toThrow(GuardrailBlockError);
  });

  it("exports ApplySheet component accepting onVariantChange callback and variants", () => {
    let changedJobId: string | null = null;
    let changedVariantId: string | null = null;
    const onVariantChange = (jobId: string, variantId: string | null) => {
      changedJobId = jobId;
      changedVariantId = variantId;
    };

    const element = React.createElement(ApplySheet, {
      open: true,
      onOpenChange: () => {},
      job: {
        id: "job-test-1",
        company: "Stripe",
        roleTitle: "Software Engineer",
        status: "SAVED",
        appliedVariantId: "var-1",
        variants: [
          { id: "var-1", variantTitle: "Variant 1" },
          { id: "var-2", variantTitle: "Variant 2" },
        ],
      },
      onVariantChange,
    });

    expect(typeof ApplySheet).toBe("function");
    expect(element.props.job?.id).toBe("job-test-1");
    expect(element.props.job?.appliedVariantId).toBe("var-1");
    expect(element.props.job?.variants).toHaveLength(2);
    expect(typeof element.props.onVariantChange).toBe("function");

    element.props.onVariantChange?.("job-test-1", "var-2");
    expect(changedJobId).toBe("job-test-1");
    expect(changedVariantId).toBe("var-2");
  });
});
