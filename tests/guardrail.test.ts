import { describe, it, expect } from "vitest";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanExport, executeTailoringWithRetry, GuardrailBlockError } from "@/lib/guardrail/policy";
import { ResumeFacts } from "@/lib/facts/types";

describe("Mechanical Guardrail Engine", () => {
  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [
      { raw: "Google LLC", normalized: "google" },
      { raw: "Stripe, Inc.", normalized: "stripe" },
    ],
    titles: [
      { raw: "Software Engineer", normalized: "software engineer" },
      { raw: "Backend Engineer", normalized: "backend engineer" },
    ],
    dateRanges: [
      { raw: "May 2022 - Aug 2023", startIso: "2022-05", endIso: "2023-08", isCurrent: false },
    ],
    metrics: [
      { raw: "45ms", value: 45, unit: "ms", context: "latency", isTrivial: false },
      { raw: "10M", value: 10, unit: "M", context: "requests", isTrivial: false },
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

  it("detects unverified employer claim as a HARD violation", () => {
    const badTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "2022 - 2023")
- *Netflix* -- *Software Engineer*
    `;

    const result = checkGuardrail(badTypst, masterFacts);
    expect(result.passed).toBe(false);
    expect(result.hasHardViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "employer" && v.severity === "HARD")).toBe(true);
  });

  it("detects unverified job title as a HARD violation", () => {
    const badTypst = `
#resume-entry(title: "Principal Executive Architect", location: "NYC", date: "2022 - 2023")
- *Google* -- *Principal Executive Architect*
    `;

    const result = checkGuardrail(badTypst, masterFacts);
    expect(result.passed).toBe(false);
    expect(result.hasHardViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "title" && v.severity === "HARD")).toBe(true);
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

  it("treats unverified skills as SOFT violations without blocking export", () => {
    const softTypst = `
#resume-entry(title: "Software Engineer", location: "NYC", date: "May 2022 - Aug 2023")
- *Google* -- *Software Engineer*
- Skills: TypeScript, PostgreSQL, Rust
    `;

    const result = checkGuardrail(softTypst, masterFacts);
    expect(result.passed).toBe(true);
    expect(result.hasHardViolations).toBe(false);
    expect(result.hasSoftViolations).toBe(true);
    expect(result.violations.some((v) => v.kind === "skill" && v.severity === "SOFT")).toBe(true);
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

  it("assertCanExport throws GuardrailBlockError on hard violations", () => {
    const badTypst = `*Meta* -- *Software Engineer*`;
    expect(() => assertCanExport(badTypst, masterFacts)).toThrow(GuardrailBlockError);
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
      expect(res.patches.length).toBe(0); // Clean fallback
      expect(res.gaps.some((g) => g.requirement.includes("Guardrail Failure"))).toBe(true);
    });
  });
});
