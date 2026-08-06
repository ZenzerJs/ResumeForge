import { describe, it, expect } from "vitest";
import { matchEvidenceToRequirements, EvidenceItemWithBullets } from "@/lib/matching/matcher";
import { JobRequirements } from "@/lib/jd-parser/types";

describe("Rule-Based Evidence Matcher Unit Tests", () => {
  const sampleRequirements: JobRequirements = {
    requiredSkills: ["TypeScript", "PostgreSQL"],
    preferredSkills: ["Redis"],
    domainTerms: ["Microservices"],
  };

  const evidenceItems: EvidenceItemWithBullets[] = [
    {
      id: "ev-verified-1",
      type: "experience",
      title: "Backend Engineer",
      organization: "Acme Inc",
      dates: "2023 - Present",
      verifiedSummary: "Built microservices backend using TypeScript and PostgreSQL",
      tags: ["TypeScript", "PostgreSQL"],
      status: "verified",
      bullets: [
        {
          id: "b-1",
          text: "Optimized PostgreSQL queries and integrated Redis cache",
          technologies: ["PostgreSQL", "Redis"],
          roleAffinity: ["Backend"],
          verified: true,
        },
      ],
    },
    {
      id: "ev-draft-1",
      type: "project",
      title: "Draft Portfolio App",
      organization: null,
      dates: "2024",
      verifiedSummary: "Draft unverified side project written in TypeScript",
      tags: ["TypeScript"],
      status: "draft",
      bullets: [
        {
          id: "b-draft",
          text: "Draft bullet mentioning TypeScript",
          technologies: ["TypeScript"],
          roleAffinity: ["Fullstack"],
          verified: false,
        },
      ],
    },
    {
      id: "ev-archived-1",
      type: "experience",
      title: "Legacy Project",
      organization: "Old Corp",
      dates: "2020",
      verifiedSummary: "Archived experience involving TypeScript and PostgreSQL",
      tags: ["TypeScript", "PostgreSQL"],
      status: "archived",
      bullets: [
        {
          id: "b-archived",
          text: "Archived bullet",
          technologies: ["TypeScript"],
          roleAffinity: [],
          verified: true,
        },
      ],
    },
  ];

  it("excludes archived EvidenceItem records from matching results entirely", () => {
    const matches = matchEvidenceToRequirements(evidenceItems, sampleRequirements);
    const archivedMatch = matches.find((m) => m.id === "ev-archived-1");

    expect(archivedMatch).toBeUndefined();
    expect(matches.every((m) => m.status !== "archived")).toBe(true);
  });

  it("includes draft EvidenceItem records in results but flags them as unverified", () => {
    const matches = matchEvidenceToRequirements(evidenceItems, sampleRequirements);
    const draftMatch = matches.find((m) => m.id === "ev-draft-1");

    expect(draftMatch).toBeDefined();
    expect(draftMatch?.status).toBe("draft");
    expect(draftMatch?.isDraft).toBe(true);
    expect(draftMatch?.matchedBullets[0]?.verified).toBe(false);
  });

  it("ranks evidence items correctly based on weighted requirement overlap", () => {
    const matches = matchEvidenceToRequirements(evidenceItems, sampleRequirements);

    expect(matches.length).toBe(2);
    // Verified item matches TypeScript (3pts), PostgreSQL (3pts), Redis (2pts), Microservices (1pt) = 9pts
    // Draft item matches TypeScript (3pts) = 3pts
    expect(matches[0].id).toBe("ev-verified-1");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[0].matchedRequirements).toContain("TypeScript");
    expect(matches[0].matchedRequirements).toContain("PostgreSQL");
  });
});
