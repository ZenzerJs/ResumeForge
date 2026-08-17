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

export const SearchEvidenceParamsSchema = z.object({
  query: z.string(),
  tags: z.array(z.string()).optional(),
  limit: z.number().optional().default(10),
  status: z.enum(["verified", "draft", "all"]).optional().default("verified"),
});

export const InspectLayoutBudgetParamsSchema = z.object({
  typstSource: z.string(),
  pageLimit: z.number().optional().default(1),
  roleProfile: z.string().optional(),
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
  "search_evidence",
  "inspect_layout_budget",
] as const;

export type AllowlistedToolName = (typeof ALLOWLISTED_TOOLS)[number];

/** Read-only tool subset available in Chat mode (no apply_patches, export_docx, propose_patches). */
export const CHAT_TOOLS: AllowlistedToolName[] = [
  "get_resume_facts",
  "run_guardrail",
  "get_ats_score",
  "get_job",
  "search_saved_jobs",
  "search_evidence",
  "inspect_layout_budget",
];

/** OpenAI function-calling format schemas for chat-accessible tools. */
export const CHAT_TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "search_evidence",
      description: "Search the Evidence Bank for verified experience items matching a query or tags.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search query" },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags to filter by" },
          limit: { type: "number", description: "Max results (default 10)" },
          status: { type: "string", enum: ["verified", "draft", "all"], description: "Filter by status" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_ats_score",
      description: "Run the deterministic ATS evaluator against resume content and optional job requirements.",
      parameters: {
        type: "object",
        properties: {
          typstContent: { type: "string", description: "Typst resume source" },
          roleProfile: { type: "string", enum: ["Full-stack", "Backend", "AI/LLM", "ML", "Frontend", "Data/Platform"], description: "Role profile" },
          requirements: {
            type: "object",
            properties: {
              roleTitle: { type: "string" },
              company: { type: "string" },
              requiredSkills: { type: "array", items: { type: "string" } },
              preferredSkills: { type: "array", items: { type: "string" } },
              domainTerms: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["typstContent"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_resume_facts",
      description: "Extract structured facts (employers, titles, metrics, skills) from the resume and evidence bank.",
      parameters: {
        type: "object",
        properties: {
          typstSource: { type: "string", description: "Optional Typst source to analyze" },
          resumeId: { type: "string", description: "Optional resume ID to load" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_guardrail",
      description: "Check candidate content against frozen master facts for hallucination violations.",
      parameters: {
        type: "object",
        properties: {
          candidateTypst: { type: "string", description: "Typst source to check" },
        },
        required: ["candidateTypst"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_job",
      description: "Retrieve a saved job by ID with its title, company, requirements, and description.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID to look up" },
        },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_saved_jobs",
      description: "Search saved jobs by company name, role title, or status.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term for company or role title" },
          status: { type: "string", description: "Filter by job status" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_layout_budget",
      description: "Check if Typst source fits within page limits and get layout statistics.",
      parameters: {
        type: "object",
        properties: {
          typstSource: { type: "string", description: "Typst source to analyze" },
          pageLimit: { type: "number", description: "Target page count (default 1)" },
          roleProfile: { type: "string", description: "Optional role profile" },
        },
        required: ["typstSource"],
      },
    },
  },
];
