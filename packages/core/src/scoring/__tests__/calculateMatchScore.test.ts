import { describe, it, expect } from "vitest";
import {
  calculateMatchScore,
  CandidateEvidenceInput,
  JobRequirementInput,
  resolveSkillMatch,
} from "../calculateMatchScore";

describe("Deterministic Match-Score Engine & Popover Derivation", () => {
  const sampleEvidenceBank: CandidateEvidenceInput["evidenceItems"] = [
    {
      id: "evid-backend-01",
      title: "Nova Distributed Microservices",
      tags: ["Go", "Python", "Docker"],
      bullets: [
        {
          id: "b-101",
          text: "Engineered scalable Go microservices processing 10k req/sec.",
          technologies: ["Go", "RESTful APIs", "PostgreSQL"],
        },
        {
          id: "b-102",
          text: "Built containerized automated data pipelines in Python and Docker.",
          technologies: ["Python", "Docker"],
        },
      ],
    },
    {
      id: "evid-frontend-02",
      title: "WebCraft Enterprise Web Platform",
      tags: ["Next.js", "TypeScript"],
      bullets: [
        {
          id: "b-201",
          text: "Architected modern Next.js client interface with TypeScript.",
          technologies: ["Next.js", "TypeScript", "Tailwind CSS"],
        },
      ],
    },
  ];

  it("calculates a 100% composite score on a full match with all evidence verified", () => {
    const job: JobRequirementInput = {
      requiredSkills: ["Go", "Python", "Docker"],
      tools: ["PostgreSQL"],
      requiredYoe: 3,
    };

    const candidate: CandidateEvidenceInput = {
      skills: ["Go", "Python", "Docker", "PostgreSQL"],
      totalYoe: 5,
      evidenceItems: sampleEvidenceBank,
    };

    const result = calculateMatchScore(job, candidate);

    expect(result.compositeScore).toBe(100);
    expect(result.breakdown.coreStackScore).toBe(100);
    expect(result.breakdown.seniorityScore).toBe(100);
    expect(result.breakdown.toolsScore).toBe(100);
    expect(result.breakdown.evidenceCoverageScore).toBe(100);
    expect(result.missingRequiredSkills).toHaveLength(0);
    expect(result.explanationDerivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining("+50.0 pts (Core Stack: 50% weight)"),
        expect.stringContaining("+20.0 pts (Seniority: 20% weight)"),
        expect.stringContaining("+15.0 pts (Tools & Preferred: 15% weight)"),
        expect.stringContaining("+15.0 pts (Evidence Coverage: 15% weight)"),
      ])
    );
  });

  it("penalizes missing critical stack components and records explicit deductions", () => {
    const job: JobRequirementInput = {
      requiredSkills: ["Go", "Kubernetes", "Rust", "C++"],
      tools: ["Docker"],
      requiredYoe: 4,
    };

    const candidate: CandidateEvidenceInput = {
      skills: ["Go", "Docker"],
      totalYoe: 4,
      evidenceItems: sampleEvidenceBank, // Has Go and Docker, lacks Kubernetes, Rust, C++
    };

    const result = calculateMatchScore(job, candidate);

    expect(result.breakdown.coreStackScore).toBe(25); // 1 of 4 verified
    expect(result.missingRequiredSkills).toEqual(["Kubernetes", "Rust", "C++"]);
    expect(result.compositeScore).toBeLessThan(60);
    expect(result.explanationDerivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Deductions applied: Missing core requirements: Kubernetes, Rust, C++"),
      ])
    );
  });

  it("resolves framework alias implications with verified citations (Next.js -> React)", () => {
    const job: JobRequirementInput = {
      requiredSkills: ["React", "TypeScript"],
      tools: ["Tailwind CSS"],
      requiredYoe: 2,
    };

    const candidate: CandidateEvidenceInput = {
      skills: ["Next.js", "TypeScript"],
      totalYoe: 3,
      evidenceItems: sampleEvidenceBank, // Has Next.js and TypeScript, but NOT explicit React
    };

    const result = calculateMatchScore(job, candidate);

    const reactMatch = result.matchedSkills.find((s) => s.skill === "React");
    expect(reactMatch).toBeDefined();
    expect(reactMatch?.matchType).toBe("alias");
    expect(reactMatch?.aliasChain).toEqual(["next.js", "React"]);
    expect(reactMatch?.verified).toBe(true);
    expect(reactMatch?.matchedEvidenceId).toBe("evid-frontend-02");

    // TypeScript is exact match
    const tsMatch = result.matchedSkills.find((s) => s.skill === "TypeScript");
    expect(tsMatch?.matchType).toBe("exact");
    expect(tsMatch?.verified).toBe(true);

    // High composite score with alias credit
    expect(result.compositeScore).toBeGreaterThanOrEqual(90);
  });

  it("penalizes ungrounded skills not backed by an Evidence Bank ID", () => {
    const job: JobRequirementInput = {
      requiredSkills: ["Go", "Python", "Kubernetes"], // Kubernetes has no evidence
      requiredYoe: 3,
    };

    const candidate: CandidateEvidenceInput = {
      // Listed Kubernetes in resume text, but ZERO evidence in Evidence Bank
      skills: ["Go", "Python", "Kubernetes"],
      totalYoe: 3,
      evidenceItems: sampleEvidenceBank, // Contains Go and Python, NO Kubernetes
    };

    const result = calculateMatchScore(job, candidate);

    const k8sMatch = result.matchedSkills.find((s) => s.skill === "Kubernetes");
    expect(k8sMatch).toBeDefined();
    expect(k8sMatch?.verified).toBe(false);
    expect(k8sMatch?.matchedEvidenceId).toBeUndefined();

    // Core stack score gets 0.40 penalty credit instead of 1.0 for Kubernetes
    // (1.0 + 1.0 + 0.40) / 3 = 2.4 / 3 = 80%
    expect(result.breakdown.coreStackScore).toBe(80);
    expect(result.breakdown.evidenceCoverageScore).toBe(67); // 2 out of 3 verified
    expect(result.explanationDerivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Penalty applied: 1 unverified skills lack Evidence Bank ID citations: Kubernetes"),
      ])
    );
  });

  it("calculates YOE delta penalty for candidates with less seniority than required", () => {
    const job: JobRequirementInput = {
      requiredSkills: ["Go", "Python"],
      requiredYoe: 5,
    };

    const candidate: CandidateEvidenceInput = {
      skills: ["Go", "Python"],
      totalYoe: 2, // 2 YOE vs 5 required
      evidenceItems: sampleEvidenceBank,
    };

    const result = calculateMatchScore(job, candidate);

    // 2 / 5 = 40% seniority score
    expect(result.breakdown.seniorityScore).toBe(40);
    expect(result.explanationDerivation).toEqual(
      expect.arrayContaining([
        expect.stringContaining("+8.0 pts (Seniority: 20% weight) — Candidate 2 YOE vs 5 YOE required (-3 YOE gap)"),
      ])
    );
  });

  it("handles boundary values cleanly (0 YOE, empty skills)", () => {
    const job: JobRequirementInput = {
      requiredSkills: [],
      requiredYoe: 0,
    };

    const candidate: CandidateEvidenceInput = {
      skills: [],
      totalYoe: 0,
      evidenceItems: [],
    };

    const result = calculateMatchScore(job, candidate);

    expect(result.compositeScore).toBe(100);
    expect(result.missingRequiredSkills).toHaveLength(0);
  });
});
