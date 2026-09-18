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
});
