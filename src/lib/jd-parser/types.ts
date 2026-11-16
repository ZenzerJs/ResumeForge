import { z } from "zod";

export const JobRequirementsSchema = z.object({
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  domainTerms: z.array(z.string()).default([]),
  roleTitle: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
});

export type JobRequirements = z.infer<typeof JobRequirementsSchema>;

export const ParsedIngestedRequirementsSchema = z.object({
  requirements: JobRequirementsSchema,
  geoRemote: z.boolean(),
});

export type ParsedIngestedRequirements = z.infer<typeof ParsedIngestedRequirementsSchema>;

export const CURRENT_REQUIREMENTS_PARSER_VERSION = 1;

export const JobRequirementsSourceSchema = z.enum(["unparsed", "auto", "ingested", "manual"]);
export type JobRequirementsSource = z.infer<typeof JobRequirementsSourceSchema>;

export const RequirementsExtractionStatusSchema = z.enum([
  "analyzing",
  "ready",
  "unavailable",
  "unparsed",
]);
export type RequirementsExtractionStatus = z.infer<typeof RequirementsExtractionStatusSchema>;

export const JobRequirementsMetaSchema = z.object({
  source: JobRequirementsSourceSchema,
  version: z.number().int().nonnegative().optional(),
});
export type JobRequirementsMeta = z.infer<typeof JobRequirementsMetaSchema>;

export const HydratedJobDetailSchema = z.object({
  id: z.string(),
  rawDescription: z.string(),
  isPlaceholder: z.boolean(),
  hasFullDescription: z.boolean(),
  extractedRequirements: JobRequirementsSchema,
  requirementsStatus: RequirementsExtractionStatusSchema,
  requirementsSource: JobRequirementsSourceSchema,
  extractFailure: z.string().nullable(),
  notes: z.string().nullable(),
  salaryLabel: z.string().nullable(),
  company: z.string().nullable(),
  roleTitle: z.string().nullable(),
  location: z.string().nullable(),
  datePosted: z.string().nullable(),
  applyUrl: z.string().nullable(),
});

export type HydratedJobDetail = z.infer<typeof HydratedJobDetailSchema>;

export const HydrateResultSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "cached", "failed", "skipped"]),
  rawDescription: z.string().optional(),
  job: HydratedJobDetailSchema.optional(),
});

export type HydrateResult = z.infer<typeof HydrateResultSchema>;

export const CreateJobSchema = z.object({
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  rawDescription: z.string().min(1, "Job description cannot be empty").max(200_000),
  source: z.enum(["pasted", "manual", "simplify-jobs"]).default("pasted"),
  extractedRequirements: JobRequirementsSchema.optional(),
  personal: z.boolean().optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
