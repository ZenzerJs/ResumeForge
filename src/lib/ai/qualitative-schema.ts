import { z } from "zod";

export const BulletVerdictSchema = z.enum([
  "STRONG_EVIDENCE",
  "WEAK_EVIDENCE",
  "KEYWORD_STUFFING",
  "VAGUE_CLAIM",
]);
export type BulletVerdict = z.infer<typeof BulletVerdictSchema>;

export const BulletFeedbackSchema = z.object({
  bulletText: z.string().min(1, "bulletText is required"),
  verdict: BulletVerdictSchema,
  reasoning: z.string().min(1, "reasoning is required"),
  improvementAdvice: z.string().min(1, "improvementAdvice is required"),
});
export type BulletFeedback = z.infer<typeof BulletFeedbackSchema>;

export const TargetCategorySchema = z.enum([
  "Base Resume Health",
  "Required Role Match",
  "Preferred Match",
  "Role-Relevant Evidence",
]);
export type TargetCategory = z.infer<typeof TargetCategorySchema>;

export const QualitativeCategoryFeedbackSchema = z.object({
  categoryName: TargetCategorySchema,
  observations: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});
export type QualitativeCategoryFeedback = z.infer<
  typeof QualitativeCategoryFeedbackSchema
>;

const GENERIC_SIGNAL_PATTERNS = [
  /^important$/i,
  /^this seems important$/i,
  /^this seems strong$/i,
  /^good fit$/i,
  /^nice to have$/i,
  /^general$/i,
  /^n\/a$/i,
  /^none$/i,
];

export const JdAdjustmentReasoningSchema = z.object({
  points: z.number().int("Points must be an integer"),
  jdSignal: z
    .string()
    .min(5, "jdSignal must be at least 5 characters long")
    .refine(
      (val) => !GENERIC_SIGNAL_PATTERNS.some((p) => p.test(val.trim())),
      "jdSignal must be a specific quote or paraphrase from the JD, not a generic phrase"
    ),
  targetCategory: TargetCategorySchema,
  explanation: z.string().min(1, "explanation is required"),
});
export type JdAdjustmentReasoning = z.infer<typeof JdAdjustmentReasoningSchema>;

export const AtsQualitativeReviewSchema = z
  .object({
    overviewCommentary: z
      .string()
      .min(1, "overviewCommentary is required")
      .refine(
        (val) => !/\b\d{1,3}\s*\/\s*100\b/i.test(val) && !/\b\d{1,2}\s*\/\s*10\b/i.test(val),
        "overviewCommentary must not contain competing numeric scores or fractions (e.g. 85/100)"
      ),
    categoryFeedbacks: z.array(QualitativeCategoryFeedbackSchema),
    bulletFeedbacks: z.array(BulletFeedbackSchema),
    jdContextAdjustment: z
      .number()
      .int("jdContextAdjustment must be an integer")
      .min(-10, "jdContextAdjustment cannot be less than -10")
      .max(10, "jdContextAdjustment cannot be greater than +10"),
    adjustmentReasoning: z.array(JdAdjustmentReasoningSchema),
    detectedAntiPatterns: z.array(z.string()),
    nextStepsAdvice: z.array(z.string()),
  })
  .refine((data) => {
    // Refinement 1: If jdContextAdjustment is non-zero, adjustmentReasoning cannot be empty
    if (data.jdContextAdjustment !== 0 && data.adjustmentReasoning.length === 0) {
      return false;
    }
    return true;
  }, {
    message: "adjustmentReasoning must not be empty when jdContextAdjustment is non-zero",
    path: ["adjustmentReasoning"],
  })
  .refine((data) => {
    // Refinement 2: Sum of reasoning points must equal jdContextAdjustment exactly
    const sumPoints = data.adjustmentReasoning.reduce((acc, curr) => acc + curr.points, 0);
    return sumPoints === data.jdContextAdjustment;
  }, {
    message: "The sum of points in adjustmentReasoning must equal jdContextAdjustment exactly",
    path: ["jdContextAdjustment"],
  });

export type AtsQualitativeReviewResult = z.infer<typeof AtsQualitativeReviewSchema>;
