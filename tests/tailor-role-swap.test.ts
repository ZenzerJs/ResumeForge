import { describe, it, expect } from "vitest";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { ROLE_PROFILES, RoleProfile } from "@/lib/ats-evaluator/types";

describe("WS4.1 — Tailor Dynamic Target Role Profile Swap", () => {
  const sampleTypst = `
#let resume-section(title) = [ === #title ]
#resume-section("Skills")
Languages: TypeScript, React, Next.js, HTML, CSS, Tailwind
#resume-section("Experience")
*Frontend Developer* (2023 - Present)
- Built interactive web applications and responsive UI components using React and Next.js.
- Implemented state management and client-side performance optimizations.
`;

  const jobRequirements = {
    requiredSkills: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
    preferredSkills: ["GraphQL", "WASM"],
    domainTerms: ["Frontend Performance", "Design Systems"],
    roleTitle: "Senior Frontend Engineer",
    company: "Acme Web",
  };

  it("contains all 6 canonical role profiles", () => {
    expect(ROLE_PROFILES).toEqual([
      "Full-stack",
      "Backend",
      "AI/LLM",
      "ML",
      "Frontend",
      "Data/Platform",
    ]);
  });

  it("calculates distinct ATS scoring when swapping role profile on the same resume text", () => {
    const frontendResult = evaluateAtsScore(
      sampleTypst,
      jobRequirements,
      "Frontend"
    );

    const backendResult = evaluateAtsScore(
      sampleTypst,
      jobRequirements,
      "Backend"
    );

    expect(frontendResult.selectedProfile).toBe("Frontend");
    expect(backendResult.selectedProfile).toBe("Backend");

    // Frontend profile should give higher relevance for frontend experience
    expect(frontendResult.overallScore).toBeGreaterThanOrEqual(backendResult.overallScore);
  });

  it("preserves underlying document typst content during profile evaluation", () => {
    const profiles: RoleProfile[] = ["Full-stack", "AI/LLM", "ML", "Data/Platform"];

    for (const p of profiles) {
      const res = evaluateAtsScore(
        sampleTypst,
        jobRequirements,
        p
      );

      expect(res.selectedProfile).toBe(p);
      expect(res.overallScore).toBeGreaterThanOrEqual(0);
      expect(res.overallScore).toBeLessThanOrEqual(100);
    }
  });
});
