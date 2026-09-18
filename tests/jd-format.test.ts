import { describe, it, expect } from "vitest";
import {
  FormattedJdSchema,
  TargetRoleProfileIdSchema,
  JdSenioritySchema,
  type FormattedJd,
} from "@/lib/ai/jd-format-schema";
import {
  buildJdFormatSystemPrompt,
  buildJdFormatUserPrompt,
} from "@/lib/ai/jd-format-prompt";

describe("WS1.4 — AI JD Formatter & Taxonomy Extraction", () => {
  it("validates well-formed formatted JD JSON objects", () => {
    const validSample: FormattedJd = {
      roleTitle: "Senior Distributed Systems Engineer",
      seniority: "senior",
      team: "Core Infrastructure",
      mustHaves: [
        "5+ years backend Go experience",
        "Kubernetes orchestration in production",
        "PostgreSQL query optimization",
      ],
      niceToHaves: ["AWS ECS experience", "GraphQL API design"],
      tools: ["Go", "Kubernetes", "PostgreSQL", "AWS", "Docker"],
      domain: ["Distributed Systems", "Cloud Infrastructure"],
      tone: "Engineering-centric, high-scale",
      keywords: ["Golang", "Kubernetes", "PostgreSQL", "Scalability"],
      targetRoleProfileId: "backend",
    };

    const parsed = FormattedJdSchema.safeParse(validSample);
    expect(parsed.success).toBe(true);
  });

  it("validates all 6 target role profile IDs", () => {
    const profiles = [
      "fullstack",
      "backend",
      "ai_llm",
      "ml",
      "frontend",
      "data_platform",
    ];

    for (const p of profiles) {
      expect(TargetRoleProfileIdSchema.safeParse(p).success).toBe(true);
    }
    expect(TargetRoleProfileIdSchema.safeParse("invalid_profile").success).toBe(false);
  });

  it("validates all seniority levels", () => {
    const seniorities = [
      "intern",
      "entry",
      "mid",
      "senior",
      "lead",
      "principal",
      "unknown",
    ];

    for (const s of seniorities) {
      expect(JdSenioritySchema.safeParse(s).success).toBe(true);
    }
  });

  it("builds composed system prompt with zero-hallucination guardrails", () => {
    const systemPrompt = buildJdFormatSystemPrompt();
    expect(systemPrompt).toContain("ZERO HALLUCINATION");
    expect(systemPrompt).toContain("TARGET ROLE PROFILE ID");
    expect(systemPrompt).toContain("STRICT JSON OUTPUT CONTRACT");
  });

  it("builds user prompt with provided metadata and JD text", () => {
    const userPrompt = buildJdFormatUserPrompt({
      company: "Stripe",
      roleTitle: "Staff Software Engineer",
      rawDescription: "We are hiring a Staff Engineer for billing systems...",
    });

    expect(userPrompt).toContain("COMPANY: Stripe");
    expect(userPrompt).toContain("TARGET ROLE TITLE: Staff Software Engineer");
    expect(userPrompt).toContain("We are hiring a Staff Engineer for billing systems...");
  });
});
