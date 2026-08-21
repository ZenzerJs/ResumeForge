import { describe, it, expect } from "vitest";
import {
  synthesizeStarInterviewPrep,
  formatStarStoryForClipboard,
  EvidenceItem,
} from "@/lib/prep/star-synthesizer";

describe("STAR Interview Prep Synthesizer (Release Hardening)", () => {
  const sampleEvidence: EvidenceItem[] = [
    {
      id: "ev-1",
      title: "Senior Backend Engineer",
      organization: "Stripe",
      dates: "2022 – 2024",
      status: "verified",
      verifiedSummary: "Architected distributed payments service reducing latency by 45ms.",
      tags: ["TypeScript", "PostgreSQL", "Distributed Systems"],
      bullets: [
        {
          id: "b-1",
          text: "Scaled PostgreSQL cluster reducing query latency by 45ms across 10M daily transactions.",
          technologies: ["PostgreSQL", "TypeScript", "Redis"],
          verified: true,
        },
        {
          id: "b-2",
          text: "Mentored team of 4 junior engineers on TypeScript best practices.",
          technologies: ["TypeScript"],
          verified: true,
        },
      ],
    },
    {
      id: "ev-2",
      title: "Full Stack Engineer",
      organization: "Airbnb",
      dates: "2020 – 2022",
      status: "verified",
      verifiedSummary: "Built design system and UI components using React and Next.js.",
      tags: ["React", "Next.js", "Tailwind CSS"],
      bullets: [
        {
          id: "b-3",
          text: "Engineered responsive booking checkout flow improving conversion by 18%.",
          technologies: ["React", "Next.js"],
          verified: true,
        },
      ],
    },
  ];

  const sampleJob = {
    company: "Linear",
    roleTitle: "Staff Product Engineer",
    requirements: {
      requiredSkills: ["TypeScript", "PostgreSQL", "GraphQL"],
      preferredSkills: ["React", "Rust"],
      domainTerms: ["latency", "distributed systems"],
    },
  };

  it("synthesizes DIRECT STAR stories matching verified evidence items with exact citations", () => {
    const result = synthesizeStarInterviewPrep({
      job: sampleJob,
      evidenceItems: sampleEvidence,
    });

    // Verify TypeScript story
    const tsStory = result.stories.find((s) => s.requirement.toLowerCase() === "typescript");
    expect(tsStory).toBeDefined();
    expect(tsStory?.grounding).toBe("DIRECT");
    expect(tsStory?.evidenceIds).toContain("ev-1");
    expect(tsStory?.situation).toContain("Stripe");
    expect(tsStory?.technologies).toContain("TypeScript");

    // Verify PostgreSQL story
    const pgStory = result.stories.find((s) => s.requirement.toLowerCase() === "postgresql");
    expect(pgStory).toBeDefined();
    expect(pgStory?.grounding).toBe("DIRECT");
    expect(pgStory?.evidenceIds).toContain("ev-1");
    expect(pgStory?.sourceBulletIds).toContain("b-1");
    expect(pgStory?.result).toContain("45ms");

    // Verify React story
    const reactStory = result.stories.find((s) => s.requirement.toLowerCase() === "react");
    expect(reactStory).toBeDefined();
    expect(reactStory?.grounding).toBe("DIRECT");
    expect(reactStory?.evidenceIds).toContain("ev-2");
    expect(reactStory?.sourceBulletIds).toContain("b-3");
    expect(reactStory?.situation).toContain("Airbnb");
  });

  it("identifies TRANSFERABLE grounding when adjacent technologies exist", () => {
    const result = synthesizeStarInterviewPrep({
      job: sampleJob,
      evidenceItems: sampleEvidence,
    });

    // GraphQL is adjacent to TypeScript / REST
    const graphqlStory = result.stories.find((s) => s.requirement.toLowerCase() === "graphql");
    expect(graphqlStory).toBeDefined();
    expect(graphqlStory?.grounding).toBe("TRANSFERABLE");
    expect(graphqlStory?.evidenceIds.length).toBeGreaterThan(0);
    expect(graphqlStory?.mitigationPlan).toBeDefined();
    expect(graphqlStory?.mitigationPlan).toContain("typescript");
  });

  it("generates honest GAP for completely unbacked requirements without fabricating claims", () => {
    const result = synthesizeStarInterviewPrep({
      job: sampleJob,
      evidenceItems: sampleEvidence,
    });

    // Rust is not in evidence and no C/C++ in candidate background
    const rustStory = result.stories.find((s) => s.requirement.toLowerCase() === "rust");
    expect(rustStory).toBeDefined();
    expect(rustStory?.grounding).toBe("GAP");
    expect(rustStory?.evidenceIds).toEqual([]);
    expect(rustStory?.sourceBulletIds).toEqual([]);
    expect(rustStory?.situation).toBe("");
    expect(rustStory?.task).toBe("");
    expect(rustStory?.action).toBe("");
    expect(rustStory?.result).toBe("");
    expect(rustStory?.technologies).toEqual([]);
    expect(rustStory?.mitigationPlan).toContain("No verified example demonstrates Rust");
  });

  it("strictly rejects archived and draft evidence items from providing grounding", () => {
    const dirtyEvidence: EvidenceItem[] = [
      {
        id: "ev-draft",
        title: "Draft Lead",
        organization: "DraftOrg",
        status: "draft",
        isDraft: true,
        tags: ["GraphQL"],
        bullets: [{ id: "b-draft", text: "Built GraphQL gateway.", verified: false }],
      },
      {
        id: "ev-archived",
        title: "Old Lead",
        organization: "ArchivedOrg",
        status: "archived",
        tags: ["Rust"],
        bullets: [{ id: "b-archived", text: "Wrote Rust engine.", verified: true }],
      },
    ];

    const result = synthesizeStarInterviewPrep({
      job: sampleJob,
      evidenceItems: dirtyEvidence,
    });

    // Both should be GAP because all candidate items were rejected
    const gql = result.stories.find((s) => s.requirement.toLowerCase() === "graphql");
    const rust = result.stories.find((s) => s.requirement.toLowerCase() === "rust");

    expect(gql?.grounding).toBe("GAP");
    expect(gql?.evidenceIds).toEqual([]);
    expect(rust?.grounding).toBe("GAP");
    expect(rust?.evidenceIds).toEqual([]);
    expect(result.talkingPoints).toEqual([]);
  });

  it("guarantees zero hallucinated metrics and technologies", () => {
    const isolatedEvidence: EvidenceItem[] = [
      {
        id: "ev-iso",
        title: "Data Analyst",
        organization: "Startup Co",
        status: "verified",
        tags: ["SQL"],
        bullets: [
          {
            id: "b-iso",
            text: "Analyzed weekly retention metrics.",
            technologies: ["SQL"],
            verified: true,
          },
        ],
      },
    ];

    const result = synthesizeStarInterviewPrep({
      job: {
        company: "Meta",
        roleTitle: "Staff AI Engineer",
        requirements: {
          requiredSkills: ["PyTorch", "CUDA", "Kubernetes"],
          preferredSkills: [],
        },
      },
      evidenceItems: isolatedEvidence,
    });

    for (const story of result.stories) {
      if (story.grounding === "GAP") {
        expect(story.technologies).toEqual([]);
        expect(story.situation).toBe("");
        expect(story.result).toBe("");
      }
    }
  });

  it("formats STAR story clipboard text with citations and tags", () => {
    const directStory = {
      requirement: "PostgreSQL",
      grounding: "DIRECT" as const,
      evidenceIds: ["ev-1"],
      sourceBulletIds: ["b-1"],
      situation: "In role as Senior Backend Engineer at Stripe (2022 – 2024).",
      task: "Applied PostgreSQL to deliver technical outcomes.",
      action: "Scaled PostgreSQL cluster across 10M daily transactions.",
      result: "Reducing query latency by 45ms across 10M daily transactions.",
      technologies: ["PostgreSQL", "TypeScript", "Redis"],
      evidenceTitle: "Senior Backend Engineer at Stripe",
    };

    const formatted = formatStarStoryForClipboard(directStory);

    expect(formatted).toContain("STORY: PostgreSQL [DIRECT VERIFIED EVIDENCE]");
    expect(formatted).toContain("SOURCE: Senior Backend Engineer at Stripe (Evidence ID: ev-1)");
    expect(formatted).toContain("BULLET ID: b-1");
    expect(formatted).toContain("SITUATION: In role as Senior Backend Engineer at Stripe");
    expect(formatted).toContain("TECH:      PostgreSQL, TypeScript, Redis");

    const gapStory = {
      requirement: "Rust",
      grounding: "GAP" as const,
      evidenceIds: [],
      sourceBulletIds: [],
      situation: "",
      task: "",
      action: "",
      result: "",
      technologies: [],
      evidenceTitle: "Unverified Gap",
      mitigationPlan: "No verified example demonstrates Rust. State learning plan.",
    };

    const formattedGap = formatStarStoryForClipboard(gapStory);
    expect(formattedGap).toContain("REQUIREMENT: Rust [GAP - UNVERIFIED]");
    expect(formattedGap).toContain("MITIGATION PLAN:");
    expect(formattedGap).toContain("No verified example demonstrates Rust");
  });
});
