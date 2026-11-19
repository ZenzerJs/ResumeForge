import { describe, it, expect } from "vitest";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";

describe("Task 9.5 — Editor ATS Grade Button & Evidence Retirement Unit Tests", () => {
  const sampleTypst = `#let resume-section(title) = [ === #title ]
#resume-section("Skills")
Languages: TypeScript, Node.js, Python, PostgreSQL, Docker, React
#resume-section("Experience")
*Senior Software Engineer* (2022 - Present)
- Designed microservices using Node.js, TypeScript, PostgreSQL, and Docker.
`;

  it("1. Grade triggers ATS evaluator and produces valid score breakdown for editor draft", () => {
    const result = evaluateAtsScore(
      sampleTypst,
      {
        requiredSkills: ["TypeScript", "Node.js", "PostgreSQL"],
        preferredSkills: ["React", "Docker"],
        domainTerms: ["microservices"],
      },
      "Backend"
    );

    expect(result.overallScore).toBeGreaterThan(50);
    expect(result.baseHealth.maxScore).toBe(30);
    expect(result.requiredMatch.maxScore).toBe(40);
    expect(result.preferredMatch.maxScore).toBe(15);
    expect(result.roleEvidence.maxScore).toBe(15);
  });

  it("2. Evaluator output for identical Typst source and requirements is deterministic between Editor and Tailor", () => {
    const reqs = {
      requiredSkills: ["Python", "Docker"],
      preferredSkills: ["Kubernetes"],
      domainTerms: ["system design"],
    };

    const editorResult = evaluateAtsScore(sampleTypst, reqs, "Backend");
    const tailorResult = evaluateAtsScore(sampleTypst, reqs, "Backend");

    expect(editorResult.overallScore).toEqual(tailorResult.overallScore);
    expect(editorResult.baseHealth.score).toEqual(tailorResult.baseHealth.score);
    expect(editorResult.requiredMatch.score).toEqual(tailorResult.requiredMatch.score);
  });

  it("3. Grading empty content returns zero/penalized score or recoverable error", () => {
    const emptyResult = evaluateAtsScore(
      "",
      {
        requiredSkills: [],
        preferredSkills: [],
        domainTerms: [],
      },
      "Backend"
    );

    expect(emptyResult.overallScore).toBeLessThan(70);
    expect(emptyResult.gaps.length).toBeGreaterThan(0);
  });

  it("4. Uses measuredPages as source of truth for single-page check and falls back to char heuristic when omitted", () => {
    const reqs = {
      requiredSkills: ["TypeScript", "Node.js", "PostgreSQL"],
      preferredSkills: ["Docker"],
      domainTerms: ["microservices"],
    };
    const longOnePageTypst = `${sampleTypst}\n${"- Delivered measurable 25% latency improvements across distributed services.\n".repeat(65)}`;
    expect(longOnePageTypst.length).toBeGreaterThan(4000);

    // >4,000-char resume with measuredPages: 1 -> NO single-page warning
    const measuredOnePage = evaluateAtsScore(longOnePageTypst, reqs, "Backend", {
      measuredPages: 1,
    });
    expect(measuredOnePage.baseHealth.findings).toContain("✓ Standard one-page length constraints satisfied.");
    expect(measuredOnePage.baseHealth.findings).not.toContain("Warning: Document length may exceed a single page.");
    expect(measuredOnePage.gaps).not.toContain("Warning: Document length may exceed a single page.");

    // Short resume with measuredPages: 2 -> triggers single-page warning
    const measuredTwoPages = evaluateAtsScore(sampleTypst, reqs, "Backend", {
      measuredPages: 2,
    });
    expect(measuredTwoPages.baseHealth.findings).toContain("Warning: Document length may exceed a single page.");
    expect(measuredTwoPages.gaps).toContain("Warning: Document length may exceed a single page.");

    // Missing measuredPages -> preserves existing >4,000-char fallback heuristic
    const unmeasuredLong = evaluateAtsScore(longOnePageTypst, reqs, "Backend");
    expect(unmeasuredLong.baseHealth.findings).toContain("Warning: Document length may exceed a single page.");

    const unmeasuredShort = evaluateAtsScore(sampleTypst, reqs, "Backend");
    expect(unmeasuredShort.baseHealth.findings).toContain("✓ Standard one-page length constraints satisfied.");
  });
});
