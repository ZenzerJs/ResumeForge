import { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
}

export const GetResumeFactsParamsSchema = z.object({
  resumeId: z.string().optional(),
  typstSource: z.string().optional(),
});

export const RunGuardrailParamsSchema = z.object({
  candidateTypst: z.string(),
  masterFacts: z.any().optional(),
  patches: z.array(z.any()).optional(),
});

export const GetAtsScoreParamsSchema = z.object({
  typstContent: z.string(),
  roleProfile: z.enum(["Full-stack", "Backend", "AI/LLM", "ML", "Frontend", "Data/Platform"]).default("Full-stack"),
  requirements: z.object({
    roleTitle: z.string().optional(),
    company: z.string().optional(),
    requiredSkills: z.array(z.string()).default([]),
    preferredSkills: z.array(z.string()).default([]),
    domainTerms: z.array(z.string()).default([]),
  }).default({
    requiredSkills: [],
    preferredSkills: [],
    domainTerms: [],
  }),
});

export const GetJobParamsSchema = z.object({
  jobId: z.string(),
});

export const SearchSavedJobsParamsSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
});

export const ProposePatchesParamsSchema = z.object({
  masterTypst: z.string(),
  jobRequirements: z.object({
    roleTitle: z.string().optional(),
    company: z.string().optional(),
    requiredSkills: z.array(z.string()).default([]),
    preferredSkills: z.array(z.string()).default([]),
    domainTerms: z.array(z.string()).default([]),
  }),
  evidenceItems: z.array(z.any()),
});

export const ApplyPatchesParamsSchema = z.object({
  variantId: z.string().optional(),
  masterResumeId: z.string().optional(),
  patchIds: z.array(z.string()),
  acceptedPatches: z.array(z.object({
    id: z.string(),
    before: z.string(),
    after: z.string(),
  })),
  currentTypst: z.string(),
  masterFacts: z.any().optional(),
});

export const ExportDocxParamsSchema = z.object({
  typstSource: z.string(),
  masterFacts: z.any().optional(),
});

export const ALLOWLISTED_TOOLS = [
  "get_resume_facts",
  "run_guardrail",
  "get_ats_score",
  "get_job",
  "search_saved_jobs",
  "propose_patches",
  "apply_patches",
  "export_docx",
] as const;

export type AllowlistedToolName = (typeof ALLOWLISTED_TOOLS)[number];
