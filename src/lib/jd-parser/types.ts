import { z } from "zod";

export const JobRequirementsSchema = z.object({
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  domainTerms: z.array(z.string()).default([]),
  roleTitle: z.string().optional(),
  company: z.string().optional(),
});

export type JobRequirements = z.infer<typeof JobRequirementsSchema>;

export const CreateJobSchema = z.object({
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  rawDescription: z.string().min(1, "Job description cannot be empty"),
  source: z.enum(["pasted", "manual"]).default("pasted"),
  extractedRequirements: JobRequirementsSchema.optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
