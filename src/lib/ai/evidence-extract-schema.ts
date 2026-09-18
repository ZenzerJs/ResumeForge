import { z } from "zod";
import { ProviderConfigSchema } from "@/lib/ai/types";

export const EvidenceExtractBulletSchema = z.object({
  text: z.string().min(1),
  technologies: z.array(z.string()).default([]),
  roleAffinity: z.array(z.string()).default([]),
});

export const EvidenceExtractItemSchema = z.object({
  type: z.enum(["experience", "project", "skill", "education", "award", "metric"]),
  title: z.string().min(1),
  organization: z.string().optional(),
  dates: z.string().optional(),
  verifiedSummary: z.string().min(1),
  tags: z.array(z.string()).default([]),
  bullets: z.array(EvidenceExtractBulletSchema).default([]),
});

export const EvidenceExtractResponseSchema = z.object({
  items: z.array(EvidenceExtractItemSchema),
  skippedSections: z.array(z.string()).default([]),
});

export type EvidenceExtractBullet = z.infer<typeof EvidenceExtractBulletSchema>;
export type EvidenceExtractItem = z.infer<typeof EvidenceExtractItemSchema>;
export type EvidenceExtractResponse = z.infer<typeof EvidenceExtractResponseSchema>;

export const ExtractEvidenceRequestSchema = z.object({
  typstSource: z.string().min(1, "typstSource is required").max(200_000),
  providerConfig: ProviderConfigSchema.optional(),
});

export type ExtractEvidenceRequest = z.infer<typeof ExtractEvidenceRequestSchema>;
