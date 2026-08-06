import { describe, it, expect } from "vitest";
import { AtsQualitativeReviewSchema } from "@/lib/ai/qualitative-schema";

describe("AtsQualitativeReviewSchema Validation Tests", () => {
  const validPayload = {
    overviewCommentary:
      "Your experience strongly demonstrates REST API design and PostgreSQL indexing for high-scale microservices.",
    categoryFeedbacks: [
      {
        categoryName: "Required Role Match",
        observations: ["Node.js and PostgreSQL are contextually demonstrated in experience bullets."],
        strengths: ["Clear query latency reduction metrics."],
        weaknesses: ["Kubernetes is missing from experience."],
      },
    ],
    bulletFeedbacks: [
      {
        bulletText: "Engineered REST APIs using Node.js and TypeScript",
        verdict: "STRONG_EVIDENCE",
        reasoning: "Demonstrates clear technology stack and specific impact.",
        improvementAdvice: "Add evidence for traffic volume if available in Evidence Bank.",
      },
    ],
    jdContextAdjustment: 3,
    adjustmentReasoning: [
      {
        points: 3,
        jdSignal: "Must have strong hands-on experience with PostgreSQL query optimization",
        targetCategory: "Required Role Match",
        explanation: "The posting heavily stresses database optimization depth, which is well-demonstrated in your experience section.",
      },
    ],
    detectedAntiPatterns: [],
    nextStepsAdvice: [
      "Use the AI Patch Generator to propose evidence-backed updates for missing Kubernetes skills.",
    ],
  };

  it("accepts a valid qualitative review payload", () => {
    const res = AtsQualitativeReviewSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
  });

  it("rejects overviewCommentary containing competing numeric score fractions (e.g. 85/100)", () => {
    const invalid = {
      ...validPayload,
      overviewCommentary: "Overall I would rate this resume 85/100.",
    };
    const res = AtsQualitativeReviewSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects jdContextAdjustment greater than +10", () => {
    const invalid = {
      ...validPayload,
      jdContextAdjustment: 12,
      adjustmentReasoning: [
        {
          points: 12,
          jdSignal: "Must have strong hands-on experience with PostgreSQL query optimization",
          targetCategory: "Required Role Match",
          explanation: "High match.",
        },
      ],
    };
    const res = AtsQualitativeReviewSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects jdContextAdjustment less than -10", () => {
    const invalid = {
      ...validPayload,
      jdContextAdjustment: -15,
      adjustmentReasoning: [
        {
          points: -15,
          jdSignal: "Must have strong hands-on experience with PostgreSQL query optimization",
          targetCategory: "Required Role Match",
          explanation: "Low match.",
        },
      ],
    };
    const res = AtsQualitativeReviewSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects non-zero adjustment if adjustmentReasoning is empty", () => {
    const invalid = {
      ...validPayload,
      jdContextAdjustment: 5,
      adjustmentReasoning: [],
    };
    const res = AtsQualitativeReviewSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects if sum of reasoning points does not equal jdContextAdjustment", () => {
    const invalid = {
      ...validPayload,
      jdContextAdjustment: 5,
      adjustmentReasoning: [
        {
          points: 3,
          jdSignal: "Must have strong hands-on experience with PostgreSQL query optimization",
          targetCategory: "Required Role Match",
          explanation: "Partial adjustment.",
        },
      ],
    };
    const res = AtsQualitativeReviewSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects generic or trivial jdSignal strings (e.g. 'important')", () => {
    const invalid = {
      ...validPayload,
      jdContextAdjustment: 3,
      adjustmentReasoning: [
        {
          points: 3,
          jdSignal: "important",
          targetCategory: "Required Role Match",
          explanation: "Generic signal test.",
        },
      ],
    };
    const res = AtsQualitativeReviewSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });
});
