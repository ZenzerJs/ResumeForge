import { describe, it, expect } from "vitest";
import {
  extractJsonObject,
  normalizeQualitativeReviewPayload,
  normalizeCoverLetterPayload,
} from "@/lib/ai/json-response";
import { AtsQualitativeReviewSchema } from "@/lib/ai/qualitative-schema";
import { CoverLetterResponseSchema } from "@/lib/ai/cover-letter-schema";

describe("AI JSON response helpers", () => {
  it("extracts JSON from markdown fences and trailing prose", () => {
    const raw = `Here you go:\n\`\`\`json\n{"title":"Cover Letter","ok":true}\n\`\`\`\nThanks!`;
    expect(extractJsonObject(raw)).toEqual({ title: "Cover Letter", ok: true });
  });

  it("normalizes qualitative category aliases and unsafe adjustments", () => {
    const normalized = normalizeQualitativeReviewPayload({
      overviewCommentary: "Solid draft overall, maybe 82/100.",
      categoryFeedbacks: [
        {
          categoryName: "Required Skills",
          observations: ["APIs present"],
          strengths: ["Node"],
          weaknesses: [],
        },
      ],
      bulletFeedbacks: [
        {
          bulletText: "Built APIs",
          verdict: "strong",
          reasoning: "Clear tech.",
          improvementAdvice: "Add metrics.",
        },
      ],
      jdContextAdjustment: 5,
      adjustmentReasoning: [],
      detectedAntiPatterns: [],
      nextStepsAdvice: ["Patch generator"],
    });

    const parsed = AtsQualitativeReviewSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.overviewCommentary).not.toMatch(/82\s*\/\s*100/);
      expect(parsed.data.categoryFeedbacks[0].categoryName).toBe("Required Role Match");
      expect(parsed.data.bulletFeedbacks[0].verdict).toBe("STRONG_EVIDENCE");
      expect(parsed.data.jdContextAdjustment).toBe(0);
      expect(parsed.data.adjustmentReasoning).toEqual([]);
    }
  });

  it("normalizes short cover letter fields to meet schema floors", () => {
    const normalized = normalizeCoverLetterPayload(
      {
        title: "Cover Letter — Acme",
        salutation: "Dear Team,",
        openingParagraph: "I am interested.",
        bodyParagraphs: ["I built APIs."],
        closingParagraph: "Thanks.",
        fullMarkdown: "short",
        evidenceCitations: ["exp-1"],
        gapsAddressed: [],
      },
      "Jane"
    );

    const parsed = CoverLetterResponseSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.openingParagraph.length).toBeGreaterThanOrEqual(20);
      expect(parsed.data.bodyParagraphs[0].length).toBeGreaterThanOrEqual(30);
      expect(parsed.data.closingParagraph.length).toBeGreaterThanOrEqual(20);
      expect(parsed.data.fullMarkdown.length).toBeGreaterThanOrEqual(100);
      expect(parsed.data.fullMarkdown).toContain("Jane");
    }
  });
});
