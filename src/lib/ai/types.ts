import { z } from "zod";

export const ProviderTypeSchema = z.enum(["openai", "anthropic", "gemini", "custom"]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const ProviderConfigSchema = z.object({
  provider: ProviderTypeSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export interface TestConnectionResult {
  success: boolean;
  provider: ProviderType;
  message: string;
  modelCount?: number;
  latencyMs?: number;
}

// --- Phase 4.2: Patch generation types ---

export interface EvidenceItemForPrompt {
  id: string;
  type: string;
  title: string;
  organization: string | null;
  dates: string | null;
  verifiedSummary: string;
  tags: string[];
  status: string;
  bullets: {
    id: string;
    text: string;
    technologies: string[];
    verified: boolean;
  }[];
}

export interface TailorFeedbackContext {
  overviewCommentary: string;
  nextStepsAdvice?: string[];
}

export interface GeneratePatchesInput {
  providerConfig: ProviderConfig;
  masterTypst: string;
  jobRequirements: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
    roleTitle?: string;
    company?: string;
  };
  evidenceItems: EvidenceItemForPrompt[];
  tailorFeedback?: TailorFeedbackContext;
}

export interface GeneratePatchesResult {
  success: boolean;
  rawJson?: string;
  error?: string;
}

// --- Phase 4.3b: Qualitative review types ---

export interface GenerateQualitativeReviewResult {
  success: boolean;
  rawJson?: string;
  error?: string;
}

// --- Phase 5: Cover letter generation types ---

export interface GenerateCoverLetterResult {
  success: boolean;
  rawJson?: string;
  error?: string;
}

// --- Task 9.1: PDF-to-Typst conversion types ---

import { ExtractedPdfLink } from "../pdf/parser";

export interface ConvertPdfInput {
  providerConfig: ProviderConfig;
  rawText: string;
  fileName?: string;
  links?: ExtractedPdfLink[];
}

export interface ConvertPdfResult {
  success: boolean;
  typstSource?: string;
  error?: string;
}

