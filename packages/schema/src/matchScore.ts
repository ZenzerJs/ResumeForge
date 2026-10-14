import { z } from "zod";

/**
 * Skill-to-Evidence Link Schema
 * Tracks exact skill matches, transitive framework alias inferences (e.g., Next.js -> React),
 * and missing requirements with explicit ground truth verification status.
 */
export const SkillEvidenceLinkSchema = z.object({
  skill: z.string(),
  matchType: z.enum(["exact", "alias", "missing"]),
  matchedEvidenceId: z.string().optional(),
  matchedBulletId: z.string().optional(),
  aliasChain: z.array(z.string()).optional(), // e.g. ["Next.js", "React"]
  verified: z.boolean().default(false), // True ONLY if backed by an Evidence Bank item
  evidenceTitle: z.string().optional(),
  notes: z.string().optional(),
});

export type SkillEvidenceLink = z.infer<typeof SkillEvidenceLinkSchema>;

/**
 * Match Component Breakdown Schema
 * Strict 4-factor deterministic scoring distribution:
 * Core Stack (50%) + Seniority (20%) + Tools (15%) + Evidence Coverage (15%) = 100%
 */
export const MatchComponentBreakdownSchema = z.object({
  coreStackScore: z.number().min(0).max(100), // 50% weight: primary languages & infrastructure
  seniorityScore: z.number().min(0).max(100), // 20% weight: candidate YOE vs required YOE delta
  toolsScore: z.number().min(0).max(100), // 15% weight: secondary frameworks, databases & CI/CD tools
  evidenceCoverageScore: z.number().min(0).max(100), // 15% weight: percentage of skills backed by evidence_id
});

export type MatchComponentBreakdown = z.infer<typeof MatchComponentBreakdownSchema>;

/**
 * Comprehensive Match Score Result Schema
 * Provides the explainable mathematical derivation for the popover UI.
 */
export const MatchScoreResultSchema = z.object({
  compositeScore: z.number().min(0).max(100),
  breakdown: MatchComponentBreakdownSchema,
  matchedSkills: z.array(SkillEvidenceLinkSchema),
  missingRequiredSkills: z.array(z.string()),
  explanationDerivation: z.array(z.string()), // Step-by-step point additions and deductions
});

export type MatchScoreResult = z.infer<typeof MatchScoreResultSchema>;
