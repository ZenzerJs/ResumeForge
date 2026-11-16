import { describe, it, expect } from "vitest";
import { buildEvidenceMatchChecklist } from "@/lib/jobs/evidence-match-checklist";
import type { EvidenceItemWithBullets } from "@/lib/matching/matcher";
import type { JobRequirements } from "@/lib/jd-parser/types";

const requirements: JobRequirements = {
  requiredSkills: ["TypeScript", "React", "FPGA"],
  preferredSkills: ["GraphQL"],
  domainTerms: ["Trading"],
};

const evidence: EvidenceItemWithBullets[] = [
  {
    id: "e1",
    type: "experience",
    title: "Frontend Intern",
    organization: "Acme",
    dates: "2024",
    verifiedSummary: "Built React dashboards in TypeScript",
    tags: ["TypeScript", "React"],
    status: "verified",
    bullets: [
      {
        id: "b1",
        text: "Shipped React features with TypeScript",
        technologies: ["TypeScript", "React"],
        roleAffinity: [],
        verified: true,
      },
    ],
  },
  {
    id: "e2",
    type: "project",
    title: "Archived FPGA lab",
    organization: null,
    dates: null,
    verifiedSummary: "Verilog FPGA work",
    tags: ["FPGA", "Verilog"],
    status: "archived",
    bullets: [],
  },
];

describe("buildEvidenceMatchChecklist", () => {
  it("returns checklist items with match percent against non-archived verified evidence", () => {
    const result = buildEvidenceMatchChecklist(requirements, evidence);

    expect(result.total).toBe(5);
    expect(result.matched).toBe(2);
    expect(result.needsVerification).toBe(0);
    expect(result.percent).toBe(40);
    expect(result.items).toEqual([
      { label: "TypeScript", matched: true, status: "verified" },
      { label: "React", matched: true, status: "verified" },
      { label: "FPGA", matched: false, status: "missing" },
      { label: "GraphQL", matched: false, status: "missing" },
      { label: "Trading", matched: false, status: "missing" },
    ]);
  });

  it("returns zeros when requirements are empty", () => {
    const result = buildEvidenceMatchChecklist(
      { requiredSkills: [], preferredSkills: [], domainTerms: [] },
      evidence,
    );
    expect(result).toEqual({
      total: 0,
      matched: 0,
      needsVerification: 0,
      percent: 0,
      items: [],
    });
  });

  it("deduplicates requirement labels case-insensitively", () => {
    const result = buildEvidenceMatchChecklist(
      {
        requiredSkills: ["React", "react"],
        preferredSkills: [],
        domainTerms: [],
      },
      evidence,
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      label: "React",
      matched: true,
      status: "verified",
    });
  });

  it("marks draft evidence and unverified bullets as needs_verification instead of verified matches", () => {
    const mixedEvidence: EvidenceItemWithBullets[] = [
      {
        id: "e-draft",
        type: "experience",
        title: "Draft GraphQL Work",
        organization: "Beta",
        dates: "2025",
        verifiedSummary: "Draft GraphQL API",
        tags: ["GraphQL"],
        status: "draft",
        bullets: [
          {
            id: "b-draft",
            text: "Built GraphQL resolvers",
            technologies: ["GraphQL"],
            roleAffinity: [],
            verified: true,
          },
        ],
      },
      {
        id: "e-unverified-bullet",
        type: "project",
        title: "Systems Lab",
        organization: null,
        dates: null,
        verifiedSummary: "Built low-level systems",
        tags: [],
        status: "verified",
        bullets: [
          {
            id: "b-unverified",
            text: "Implemented FPGA pipeline",
            technologies: ["FPGA"],
            roleAffinity: [],
            verified: false,
          },
        ],
      },
      evidence[0],
    ];

    const result = buildEvidenceMatchChecklist(requirements, mixedEvidence);

    expect(result.total).toBe(5);
    expect(result.matched).toBe(2);
    expect(result.needsVerification).toBe(2);
    expect(result.percent).toBe(40);
    expect(result.items).toEqual([
      { label: "TypeScript", matched: true, status: "verified" },
      { label: "React", matched: true, status: "verified" },
      { label: "FPGA", matched: false, status: "needs_verification" },
      { label: "GraphQL", matched: false, status: "needs_verification" },
      { label: "Trading", matched: false, status: "missing" },
    ]);
  });
});
