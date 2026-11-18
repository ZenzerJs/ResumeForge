import { describe, it, expect } from "vitest";
import {
  matchEvidenceToRequirements,
  matchSkillToken,
  EvidenceItemWithBullets,
} from "@/lib/matching/matcher";
import { JobRequirements } from "@/lib/jd-parser/types";
import { POST as matchPOST } from "@/app/api/jobs/match/route";

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
        {
          id: "b-unmatched",
          text: "Attended weekly architecture syncs with cross-functional teams",
          technologies: [],
          roleAffinity: ["Backend"],
          verified: true,
        },
        {
          id: "b-unverified",
          text: "Prototyped Redis cluster failover",
          technologies: ["Redis"],
          roleAffinity: ["Backend"],
          verified: false,
        },
      ],
    },
    {
      id: "ev-verified-2",
      type: "project",
      title: "API Gateway",
      organization: null,
      dates: "2024",
      verifiedSummary: "Designed REST gateway",
      tags: [],
      status: "verified",
      bullets: [
        {
          id: "b-2",
          text: "Implemented rate limiter in TypeScript",
          technologies: [],
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
      id: "ev-marked-unverified",
      type: "project",
      title: "[UNVERIFIED] Planned Migration",
      organization: null,
      dates: "2025",
      verifiedSummary: "[PLANNED] Migrate services to TypeScript and PostgreSQL",
      tags: ["TypeScript", "PostgreSQL"],
      status: "verified",
      bullets: [
        {
          id: "b-marked",
          text: "Planned TypeScript migration",
          technologies: ["TypeScript"],
          roleAffinity: [],
          verified: true,
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

  it("excludes draft and [UNVERIFIED]/[PLANNED] items from verified matches by default", () => {
    const matches = matchEvidenceToRequirements(evidenceItems, sampleRequirements);

    expect(matches.find((m) => m.id === "ev-draft-1")).toBeUndefined();
    expect(matches.find((m) => m.id === "ev-marked-unverified")).toBeUndefined();
    expect(matches.map((m) => m.id)).toEqual(["ev-verified-1", "ev-verified-2"]);

    const withDrafts = matchEvidenceToRequirements(evidenceItems, sampleRequirements, {
      includeDrafts: true,
    });
    const draftMatch = withDrafts.find((m) => m.id === "ev-draft-1");
    expect(draftMatch).toBeDefined();
    expect(draftMatch?.status).toBe("draft");
    expect(draftMatch?.isDraft).toBe(true);
  });

  it("only attaches verified bullets that actually matched at least one requirement", () => {
    const matches = matchEvidenceToRequirements(evidenceItems, sampleRequirements);
    const topMatch = matches.find((m) => m.id === "ev-verified-1");

    expect(topMatch).toBeDefined();
    expect(topMatch?.matchedBullets.map((b) => b.id)).toEqual(["b-1"]);
    expect(topMatch?.matchedBullets.every((b) => b.verified)).toBe(true);
    expect(topMatch?.matchedBullets[0]?.matchedRequirements).toEqual([
      "PostgreSQL",
      "Redis",
    ]);
  });

  it("computes differentiated weighted matchPercentage values across verified items", () => {
    const matches = matchEvidenceToRequirements(evidenceItems, sampleRequirements);

    expect(matches.length).toBe(2);
    // Total weight: TypeScript (3) + PostgreSQL (3) + Redis (2) + Microservices (1) = 9
    // ev-verified-1 matches all 4 -> 9/9 = 100%
    // ev-verified-2 matches TypeScript via verified bullet text -> 3/9 = 33%
    expect(matches[0].id).toBe("ev-verified-1");
    expect(matches[0].score).toBe(9);
    expect(matches[0].matchPercentage).toBe(100);
    expect(matches[1].id).toBe("ev-verified-2");
    expect(matches[1].score).toBe(3);
    expect(matches[1].matchPercentage).toBe(33);
    expect(matches[0].matchPercentage).toBeGreaterThan(matches[1].matchPercentage);
  });

  it("uses boundary-aware token matching for short and punctuated tech skills", () => {
    // Short tokens must not match substrings inside unrelated words
    expect(matchSkillToken("Optimized search algorithm for cargo routing", "Go")).toBe(false);
    expect(matchSkillToken("Built Go microservices with gRPC", "Go")).toBe(true);

    expect(matchSkillToken("Built React UI with Tailwind CSS", "R")).toBe(false);
    expect(matchSkillToken("Statistical modeling in R and Python", "R")).toBe(true);

    expect(matchSkillToken("Styled components with Tailwind CSS", "AI")).toBe(false);
    expect(matchSkillToken("Built AI agent workflow", "AI")).toBe(true);

    expect(matchSkillToken("Stored records in SQLite and PostgreSQL", "SQL")).toBe(false);
    expect(matchSkillToken("Wrote complex SQL queries and migrations", "SQL")).toBe(true);
    expect(matchSkillToken("Managed PostgreSQL clusters", "PostgreSQL")).toBe(true);

    expect(matchSkillToken("Engineered C++ and C# services", "C")).toBe(false);
    expect(matchSkillToken("Engineered C++ and C# services", "C++")).toBe(true);
    expect(matchSkillToken("Engineered C++ and C# services", "C#")).toBe(true);
    expect(matchSkillToken("Built Objective-C module", "C")).toBe(false);
    expect(matchSkillToken("Low-level C and C++ systems", "C")).toBe(true);

    expect(matchSkillToken("Built Node.js and Next.js apps", "Node.js")).toBe(true);
    expect(matchSkillToken("Built Node.js and Next.js apps", "Next.js")).toBe(true);
    expect(matchSkillToken("Built Node.js and Next.js apps", "JS")).toBe(false);
    expect(matchSkillToken("Built .NET Core API", ".NET")).toBe(true);
    expect(matchSkillToken("Visit example.net for docs", ".NET")).toBe(false);

    // End-to-end verification in matchEvidenceToRequirements
    const subtleEvidence: EvidenceItemWithBullets[] = [
      {
        id: "ev-false-pos-guard",
        type: "project",
        title: "Cargo Algorithm Dashboard",
        organization: null,
        dates: "2024",
        verifiedSummary: "Built React + Tailwind UI backed by SQLite",
        tags: ["React", "SQLite"],
        status: "verified",
        bullets: [
          {
            id: "b-fp",
            text: "Optimized cargo algorithm in React with SQLite storage",
            technologies: ["React", "SQLite"],
            roleAffinity: [],
            verified: true,
          },
        ],
      },
    ];
    const shortSkillReqs: JobRequirements = {
      requiredSkills: ["Go", "R", "AI", "SQL", "C"],
      preferredSkills: [],
      domainTerms: [],
    };
    expect(matchEvidenceToRequirements(subtleEvidence, shortSkillReqs)).toEqual([]);
  });

  it("returns explicit guest: true flag from POST /api/jobs/match when unauthenticated", async () => {
    const request = new Request("http://localhost:3000/api/jobs/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleRequirements),
    });

    const response = await matchPOST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      success: true,
      guest: true,
      data: [],
    });
  });
});
