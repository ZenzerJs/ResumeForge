import { z } from "zod";
import { JobRequirementsSchema } from "@/lib/jd-parser/types";

export type RoleProfile =
  | "Full-stack"
  | "Backend"
  | "AI/LLM"
  | "ML"
  | "Frontend"
  | "Data/Platform";

export const ROLE_PROFILES: RoleProfile[] = [
  "Full-stack",
  "Backend",
  "AI/LLM",
  "ML",
  "Frontend",
  "Data/Platform",
];

export type SkillMatchStatus =
  | "DEMONSTRATED_IN_EXPERIENCE"
  | "LISTED_IN_SKILLS_ONLY"
  | "UNSUPPORTED_GAP";

export interface SkillEvaluation {
  skill: string;
  category: "required" | "preferred";
  status: SkillMatchStatus;
  matchedContext?: string;
  score: number;
  maxScore: number;
}

export interface CategoryResult {
  score: number;
  maxScore: number;
  percentage: number;
  findings: string[];
}

export interface AtsEvaluationResult {
  overallScore: number; // 0 - 100
  baseHealth: CategoryResult; // 30 pts max
  requiredMatch: CategoryResult; // 40 pts max
  preferredMatch: CategoryResult; // 15 pts max
  roleEvidence: CategoryResult; // 15 pts max
  skillEvaluations: SkillEvaluation[];
  gaps: string[];
  selectedProfile: RoleProfile;
}

export const AtsEvaluateInputSchema = z.object({
  variantId: z.string().optional(),
  typstContent: z.string().optional(),
  jobId: z.string().optional(),
  extractedRequirements: JobRequirementsSchema.optional(),
  roleTitle: z.string().optional(),
  roleProfile: z
    .enum(["Full-stack", "Backend", "AI/LLM", "ML", "Frontend", "Data/Platform"])
    .optional(),
});

export type AtsEvaluateInput = z.infer<typeof AtsEvaluateInputSchema>;
