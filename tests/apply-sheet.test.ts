import { describe, it, expect } from "vitest";
import { checkGuardrail } from "@/lib/guardrail/check";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { ResumeFacts } from "@/lib/facts/types";

describe("One-Click Apply Pipeline", () => {
  const masterFacts: ResumeFacts = {
    version: 1,
    snapshotAt: "2026-08-14T00:00:00.000Z",
    employers: [{ raw: "Stripe", normalized: "stripe" }],
    titles: [{ raw: "Software Engineer", normalized: "software engineer" }],
    dateRanges: [{ raw: "2022 – 2024", startIso: "2022-01", endIso: "2024-01" }],
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
});
