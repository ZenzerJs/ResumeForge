import { describe, it, expect } from "vitest";
import { checkGuardrail } from "@/lib/guardrail/check";
import {
  assertCanApplyPatches,
  assertCanExport,
  executeTailoringWithRetry,
  GuardrailBlockError,
  isDocumentPatched,
  PATCHED_DOCUMENT_MARKER,
  stripPatchedDocumentMarker,
} from "@/lib/guardrail/policy";
import { mergeAndMarkAcceptedPatches } from "@/components/tailor/patch-diff-review";
import { applyAcceptedSidebarPatches } from "@/components/editor/ai-sidebar";
import { resolveDiagnosticFixAction } from "@/components/tailor/tailor-diagnostic-panel";
import { ResumeFacts } from "@/lib/facts/types";

describe("Mechanical Guardrail Engine", () => {
  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [
      { raw: "Google LLC", normalized: "google", aliases: ["google"] },
      { raw: "Stripe, Inc.", normalized: "stripe", aliases: ["stripe"] },
    ],
    titles: [
      { raw: "Software Engineer", normalized: "software engineer" },
      { raw: "Backend Engineer", normalized: "backend engineer" },
      { raw: "Full Stack Software Engineer", normalized: "full stack software engineer" },
    ],
    dateRanges: [
      { raw: "May 2022 - Aug 2023", startIso: "2022-05", endIso: "2023-08", isCurrent: false },
    ],
    metrics: [
      { raw: "45ms", value: 45, unit: "ms", context: "latency", isTrivial: false },
      { raw: "10M", value: 10, unit: "M", context: "requests", subject: "request", isTrivial: false },
      { raw: "40%", value: 40, unit: "%", context: "reduced latency by 40%", isTrivial: false },
      { raw: "4", value: 4, unit: "", context: "team of 4", isTrivial: true },
    ],
    skills: ["typescript", "postgresql", "react"],
    evidenceIds: ["evid-1", "bullet-101"],
  };

  it("passes clean candidate with verified facts", () => {
    const cleanTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Reduced latency by 45ms across 10M requests.
- Skills: TypeScript, PostgreSQL, React
    `;

    const result = checkGuardrail(cleanTypst, masterFacts);
    expect(result.passed).toBe(true);
    expect(result.hasHardViolations).toBe(false);
    expect(result.status).toBe("clean");
  });

  it("detects unverified employer claim as a HARD violation (no substring pass)", () => {
    const badTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Netflix* -- *Software Engineer*
    `;

    const result = checkGuardrail(badTypst, masterFacts);
    expect(result.passed).toBe(false);
    expect(result.hasHardViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "employer" && v.severity === "HARD")).toBe(true);

    // Substring employer inflation (e.g. "Google Cloud Ventures" when master is "Google") must also be blocked
    const inflatedEmployerTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google Ventures* -- *Software Engineer*
    `;
    const subRes = checkGuardrail(inflatedEmployerTypst, masterFacts);
    expect(subRes.passed).toBe(false);
    expect(subRes.violations.some((v) => v.kind === "employer" && v.severity === "HARD")).toBe(true);
  });

  it("detects unverified job title as a HARD violation", () => {
    const badTypst = `
#resume-entry(title: "Principal Executive Architect", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Principal Executive Architect*
    `;

    const result = checkGuardrail(badTypst, masterFacts);
    expect(result.passed).toBe(false);
    expect(result.hasHardViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "title" && v.severity === "HARD")).toBe(true);
  });

  it("blocks seniority inflation ('Software Engineer' -> 'Senior Software Engineer' and 'Backend Engineer' -> 'Staff Backend Engineer')", () => {
    const seniorTypst = `
#resume-entry(title: "Senior Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Senior Software Engineer*
    `;
    const res1 = checkGuardrail(seniorTypst, masterFacts);
    expect(res1.passed).toBe(false);
    expect(res1.violations.some((v) => v.kind === "title" && v.severity === "HARD")).toBe(true);

    const staffTypst = `
#resume-entry(title: "Staff Backend Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Stripe* -- *Staff Backend Engineer*
    `;
    const res2 = checkGuardrail(staffTypst, masterFacts);
    expect(res2.passed).toBe(false);
    expect(res2.violations.some((v) => v.kind === "title" && v.severity === "HARD")).toBe(true);
  });

  it("blocks dropping level markers ('Software Engineer Intern' -> 'Software Engineer')", () => {
    const internMaster: ResumeFacts = {
      ...masterFacts,
      titles: [{ raw: "Software Engineer Intern", normalized: "software engineer intern" }],
    };

    const droppedInternTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
    `;

    const res = checkGuardrail(droppedInternTypst, internMaster);
    expect(res.passed).toBe(false);
    expect(res.violations.some((v) => v.kind === "title" && v.severity === "HARD")).toBe(true);
  });

  it("detects metric inflation as a HARD violation", () => {
    const badTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Scaled system handling 500M daily active users and generated $20M revenue.
    `;

    const result = checkGuardrail(badTypst, masterFacts);
    expect(result.passed).toBe(false);
    expect(result.hasHardViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "metric" && v.severity === "HARD")).toBe(true);
  });

  it("blocks metric subject swap ('10M requests' reused as '10M users') while allowing '10M requests/day' and 'reduced latency by 40%'", () => {
    const swappedSubjectTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Scaled platform serving 10M users globally.
    `;
    const swapRes = checkGuardrail(swappedSubjectTypst, masterFacts);
    expect(swapRes.passed).toBe(false);
    expect(swapRes.violations.some((v) => v.kind === "metric" && v.severity === "HARD")).toBe(true);

    const validRateAndPctTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Handled 10M requests/day and reduced latency by 40%.
    `;
    const validRes = checkGuardrail(validRateAndPctTypst, masterFacts);
    expect(validRes.passed).toBe(true);
    expect(validRes.hasHardViolations).toBe(false);
  });

  it("emits SOFT metric warning when only one side has a trailing subject noun", () => {
    const oneSidedSubjectTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Improved 40% throughput across API tier.
    `;
    const res = checkGuardrail(oneSidedSubjectTypst, masterFacts);
    expect(res.passed).toBe(true);
    expect(res.hasHardViolations).toBe(false);
    expect(res.violations.some((v) => v.kind === "metric" && v.severity === "SOFT")).toBe(true);
  });

  it("blocks shifted start dates (2022 -> 2020) and extending 'Present' beyond a bounded master end date, while allowing narrowed dates", () => {
    const shiftedStartTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2020 - Aug 2023")
- *Google* -- *Software Engineer*
    `;
    const shiftedRes = checkGuardrail(shiftedStartTypst, masterFacts);
    expect(shiftedRes.passed).toBe(false);
    expect(shiftedRes.violations.some((v) => v.kind === "date" && v.severity === "HARD")).toBe(true);

    const extendedPresentTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Present")
- *Google* -- *Software Engineer*
    `;
    const presentRes = checkGuardrail(extendedPresentTypst, masterFacts);
    expect(presentRes.passed).toBe(false);
    expect(presentRes.violations.some((v) => v.kind === "date" && v.severity === "HARD")).toBe(true);

    const narrowedTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "Jun 2022 - Jul 2023")
- *Google* -- *Software Engineer*
    `;
    const narrowedRes = checkGuardrail(narrowedTypst, masterFacts);
    expect(narrowedRes.passed).toBe(true);
    expect(narrowedRes.hasHardViolations).toBe(false);

    // Explicit same-year month widening (May 2022 -> Jan 2022) is HARD-blocked via ISO month comparison
    const sameYearMonthShiftTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "Jan 2022 - Dec 2023")
- *Google* -- *Software Engineer*
    `;
    const sameYearRes = checkGuardrail(sameYearMonthShiftTypst, masterFacts);
    expect(sameYearRes.passed).toBe(false);
    expect(sameYearRes.violations.some((v) => v.kind === "date" && v.severity === "HARD")).toBe(true);

    // Year-only date range ("2022 - 2023", omitting months) passes when start/end years match master
    const yearOnlyTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "2022 - 2023")
- *Google* -- *Software Engineer*
    `;
    const yearOnlyRes = checkGuardrail(yearOnlyTypst, masterFacts);
    expect(yearOnlyRes.passed).toBe(true);
    expect(yearOnlyRes.hasHardViolations).toBe(false);
  });

  it("treats unverified skills as SOFT violations in candidate document, but requires explicit per-skill acknowledgement in assertCanApplyPatches", () => {
    const softTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Skills: TypeScript, PostgreSQL, Kubernetes, Terraform
    `;

    const result = checkGuardrail(softTypst, masterFacts);
    expect(result.passed).toBe(true);
    expect(result.hasHardViolations).toBe(false);
    expect(result.hasSoftViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "skill" && v.severity === "SOFT")).toBe(true);

    // Patch adding unverified skills is blocked unless acknowledged
    const skillPatch = [
      {
        id: "p-skill",
        after: "- Skills: TypeScript, Kubernetes",
        evidenceIds: ["evid-1"],
      },
    ];
    expect(() => assertCanApplyPatches("#resume-entry(title: \"Software Engineer\")", masterFacts, skillPatch)).toThrow(
      GuardrailBlockError
    );

    const ackRes = assertCanApplyPatches(
      "#resume-entry(title: \"Software Engineer\")",
      masterFacts,
      skillPatch,
      { acknowledgedSkills: ["Kubernetes"] }
    );
    expect(ackRes.passed).toBe(true);
  });

  it("detects hallucinated patch evidence citations", () => {
    const cleanTypst = `#resume-entry(title: "Software Engineer")`;
    const patches = [
      {
        id: "patch-1",
        after: "Optimized database layer.",
        evidenceIds: ["FAKE-EVID-999"],
      },
    ];

    const result = checkGuardrail(cleanTypst, masterFacts, { patches });
    expect(result.passed).toBe(false);
    expect(result.hasHardViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "evidence" && v.severity === "HARD")).toBe(true);
  });

  it("assertCanExport throws GuardrailBlockError on hard violations and when masterFacts is missing (unless allowUnfrozenMasterSelfExport is set)", () => {
    const badTypst = `*Meta* -- *Software Engineer*`;
    expect(() => assertCanExport(badTypst, masterFacts)).toThrow(GuardrailBlockError);

    const cleanTypst = `*Google* -- *Software Engineer*`;
    expect(() => assertCanExport(cleanTypst, null)).toThrow(/Freeze your master resume first/i);
    expect(() => assertCanExport(cleanTypst, undefined)).toThrow(/Freeze your master resume first/i);

    const guestFirstRun = assertCanExport(cleanTypst, null, { allowUnfrozenMasterSelfExport: true });
    expect(guestFirstRun.passed).toBe(true);

    // An AI-patched variant with no frozen master must still be blocked (allowUnfrozenMasterSelfExport: false)
    const aiPatchedVariantTypst = `// @conversion-path: ai\n*Google* -- *Software Engineer*`;
    expect(() =>
      assertCanExport(aiPatchedVariantTypst, null, { allowUnfrozenMasterSelfExport: false })
    ).toThrow(/Freeze your master resume first/i);
  });

  it("persists patch provenance in the document across every apply path (Tailor review, AI sidebar, Diagnostics fix) and blocks export in a new session with no frozen master", () => {
    const baseDoc = `= Alex Rivera\n// RF_BULLET:b1\n- Built backend services in TypeScript.`;

    // 1. Tailor patch review path (PatchDiffReview)
    const tailorPatched = mergeAndMarkAcceptedPatches(baseDoc, [
      {
        before: "- Built backend services in TypeScript.",
        after: "- Built low-latency backend services in TypeScript.",
      },
    ]);
    expect(isDocumentPatched(tailorPatched)).toBe(true);
    expect(tailorPatched).toContain(PATCHED_DOCUMENT_MARKER);

    // 2. AI Sidebar patch apply path (AiSidebar)
    const sidebarPatched = applyAcceptedSidebarPatches(baseDoc, [
      {
        before: "- Built backend services in TypeScript.",
        after: "- Engineered TypeScript microservices.",
      },
    ]);
    expect(isDocumentPatched(sidebarPatched)).toBe(true);
    expect(sidebarPatched).toContain(PATCHED_DOCUMENT_MARKER);

    // 3. Diagnostics deterministic fix path (TailorDiagnosticPanel / applyDeterministicPatch)
    const diagOutcome = resolveDiagnosticFixAction(
      {
        id: "diag-1",
        severity: "urgent",
        category: "missing_hard_requirement",
        message:
          "Missing required skill: PostgreSQL. Only add if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap.",
        suggestedFix:
          "Only add PostgreSQL if you have real experience; log it in your Evidence Bank first, otherwise treat it as a gap.",
        targetLineOrBulletId: "b1",
      },
      baseDoc,
      [
        {
          id: "evid-pg",
          verifiedSummary: "Built backend services in TypeScript and PostgreSQL.",
          tags: ["TypeScript", "PostgreSQL"],
        },
      ]
    );
    expect(diagOutcome.applied).toBe(true);
    if (diagOutcome.applied) {
      expect(isDocumentPatched(diagOutcome.patchedTypstAst)).toBe(true);
      expect(diagOutcome.patchedTypstAst).toContain(PATCHED_DOCUMENT_MARKER);
    }

    // Simulate a brand-new browser tab/session (no sessionStorage state, even if caller passes allowUnfrozenMasterSelfExport: true):
    // Export with no frozen master (masterFacts = null) MUST still be blocked for all three patched documents.
    for (const patchedDoc of [
      tailorPatched,
      sidebarPatched,
      diagOutcome.applied ? diagOutcome.patchedTypstAst : "",
    ]) {
      expect(() =>
        assertCanExport(patchedDoc, null, { allowUnfrozenMasterSelfExport: true })
      ).toThrow(/Freeze your master resume first/i);
    }

    // Once explicitly frozen as Master (marker stripped), self-export is allowed
    const frozenClean = stripPatchedDocumentMarker(sidebarPatched);
    expect(isDocumentPatched(frozenClean)).toBe(false);
    expect(assertCanExport(frozenClean, null, { allowUnfrozenMasterSelfExport: true }).passed).toBe(true);
  });

  describe("Fail-Closed Retry Policy", () => {
    it("returns clean status when attempt 1 passes", async () => {
      const mockGenerate = async () => ({
        patches: [
          {
            id: "p1",
            after: "Reduced latency by 45ms.",
            evidenceIds: ["evid-1"],
          },
        ],
        gaps: [],
      });

      const res = await executeTailoringWithRetry(mockGenerate, "master", masterFacts);
      expect(res.status).toBe("clean");
      expect(res.patches.length).toBe(1);
    });

    it("retries 1x when attempt 1 fails and attempt 2 succeeds", async () => {
      let callCount = 0;
      const mockGenerate = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            patches: [{ id: "bad", after: "Generated $999M profit.", evidenceIds: ["evid-1"] }],
            gaps: [],
          };
        }
        return {
          patches: [{ id: "good", after: "Reduced latency by 45ms.", evidenceIds: ["evid-1"] }],
          gaps: [],
        };
      };

      const res = await executeTailoringWithRetry(mockGenerate, "master", masterFacts);
      expect(callCount).toBe(2);
      expect(res.status).toBe("retried");
      expect(res.patches.length).toBe(1);
    });

    it("fails closed when both attempts fail", async () => {
      const mockGenerate = async () => ({
        patches: [{ id: "bad", after: "Generated $999M profit.", evidenceIds: ["evid-1"] }],
        gaps: [],
      });

      const res = await executeTailoringWithRetry(mockGenerate, "master", masterFacts);
      expect(res.status).toBe("fell_back");
      expect(res.patches.length).toBe(0);
      expect(res.gaps.some((g) => g.requirement.includes("Guardrail Failure"))).toBe(true);
    });
  });
});
