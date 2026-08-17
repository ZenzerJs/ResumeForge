import { z } from "zod";

export const JdSenioritySchema = z.enum([
  "intern",
  "entry",
  "mid",
  "senior",
  "lead",
  "principal",
  "unknown",
]);
export type JdSeniority = z.infer<typeof JdSenioritySchema>;

export const TargetRoleProfileIdSchema = z.enum([
  "fullstack",
  "backend",
  "ai_llm",
  "ml",
  "frontend",
  "data_platform",
]);
export type TargetRoleProfileId = z.infer<typeof TargetRoleProfileIdSchema>;

export const FormattedJdSchema = z.object({
  roleTitle: z.string().min(1, "Role title cannot be empty"),
  seniority: JdSenioritySchema,
  team: z.string().nullable().optional(),
  mustHaves: z.array(z.string()).min(1, "At least one must-have requirement required"),
  niceToHaves: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  domain: z.array(z.string()).default([]),
  tone: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  targetRoleProfileId: TargetRoleProfileIdSchema,
});

export type FormattedJd = z.infer<typeof FormattedJdSchema>;
