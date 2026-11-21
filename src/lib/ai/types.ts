import { z } from "zod";

export const ProviderTypeSchema = z.enum(["openai", "anthropic", "gemini", "groq", "ollama", "custom"]);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

const GEMINI_MODEL_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export function isValidGeminiModelSegment(model: string): boolean {
  const trimmed = model.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== "." &&
    trimmed !== ".." &&
    GEMINI_MODEL_SEGMENT_RE.test(trimmed)
  );
}

export const ProviderConfigSchema = z
  .object({
    provider: ProviderTypeSchema,
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provider === "gemini" && data.model !== undefined && !isValidGeminiModelSegment(data.model)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["model"],
        message: "Gemini model must be a single non-empty segment matching [A-Za-z0-9._-]+ (excluding '.' and '..').",
      });
    }
  });

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export interface TestConnectionResult {
  success: boolean;
  provider: ProviderType;
  message: string;
  modelCount?: number;
  availableModels?: string[];
  latencyMs?: number;
}

export interface TextCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextCompletionOptions {
  defaultModel?: string;
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
  thinkingBudget?: number;
  missingKeyMessage?: string;
  taskLabel?: string;
}

export interface TextCompletionResult {
  success: boolean;
  text?: string;
  error?: string;
  providerStatus?: number;
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
  providerStatus?: number;
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
  formattingVersion?: 2;
}

export interface ConvertPdfResult {
  success: boolean;
  typstSource?: string;
  error?: string;
  assignments?: unknown;
}

