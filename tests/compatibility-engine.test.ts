import { describe, it, expect } from "vitest";
import { calculateJobCompatibility } from "@/lib/scoring/compatibility-engine";
import { JobRequirements } from "@/lib/jd-parser/types";
import { EvidenceItemWithBullets } from "@/lib/matching/matcher";

describe("WS3.1 — Fast In-Memory Compatibility Engine", () => {
  it("calculates high compatibility when candidate evidence matches required skills and synonyms", () => {
    const requirements: JobRequirements = {
      requiredSkills: ["TypeScript", "Golang", "Kubernetes", "PostgreSQL"],
      preferredSkills: ["GraphQL", "AWS"],
      domainTerms: ["Fintech", "Microservices"],
    };

    const candidateSkills = ["TypeScript", "Go", "React"];
    const evidenceItems: EvidenceItemWithBullets[] = [
      {
        id: "ev-1",
        type: "work",
        title: "Senior Backend Engineer",
        verifiedSummary: "Built distributed services using k8s and Postgres",
        tags: ["k8s", "Postgres", "Backend"],
        status: "verified",
        bullets: [
          {
            id: "b-1",
            text: "Scaled microservices running on k8s cluster",
            technologies: ["k8s", "Go"],
            roleAffinity: ["Backend"],
            verified: true,
          },
        ],
      },
    ];

    const result = calculateJobCompatibility(requirements, candidateSkills, evidenceItems);

    // TypeScript (direct), Golang (synonym Go), Kubernetes (synonym k8s), PostgreSQL (synonym Postgres)
    expect(result.matchedSkills).toContain("TypeScript");
    expect(result.matchedSkills).toContain("Golang");
    expect(result.matchedSkills).toContain("Kubernetes");
    expect(result.matchedSkills).toContain("PostgreSQL");
    expect(result.missingSkills.length).toBe(0);

    expect(result.requiredScore).toBe(100);
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.compatibilityTier).toBe("HIGH");
    expect(result.matchedEvidenceCount).toBe(1);
  });

  it("calculates partial and low compatibility correctly", () => {
    const requirements: JobRequirements = {
      requiredSkills: ["Rust", "C++", "CUDA", "Embedded Systems"],
      preferredSkills: ["Linux Kernel"],
      domainTerms: ["Robotics"],
    };

    const candidateSkills = ["JavaScript", "HTML", "CSS"];
    const evidenceItems: EvidenceItemWithBullets[] = [];

    const result = calculateJobCompatibility(requirements, candidateSkills, evidenceItems);

    expect(result.matchedSkills.length).toBe(0);
    expect(result.missingSkills.length).toBe(4);
    expect(result.requiredScore).toBe(0);
    expect(result.overallScore).toBeLessThan(40);
    expect(result.compatibilityTier).toBe("LOW");
  });

  it("handles empty or null requirements gracefully with fallback defaults", () => {
    const result = calculateJobCompatibility(null, ["React", "TypeScript"]);

    expect(result.overallScore).toBe(75);
    expect(result.compatibilityTier).toBe("MEDIUM");
    expect(result.matchedSkills.length).toBe(0);
  });
});
