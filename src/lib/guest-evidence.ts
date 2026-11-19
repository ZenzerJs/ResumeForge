import { z } from "zod";

export const GuestEvidenceStatusSchema = z.enum(["draft", "verified", "archived"]);
export const GuestEvidenceOrderIndexSchema = z.int32();

const GuestEvidenceBulletSchema = z.object({
  text: z.string().min(1),
  technologies: z.array(z.string()).optional(),
  roleAffinity: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  orderIndex: GuestEvidenceOrderIndexSchema.optional(),
});

export const GuestEvidenceItemSchema = z.object({
  title: z.string().min(1),
  organization: z.string().optional(),
  dates: z.string().optional(),
  category: z.string().default("PROJECT"),
  verifiedSummary: z.string().optional(),
  status: GuestEvidenceStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  bullets: z.array(z.union([z.string(), GuestEvidenceBulletSchema])).optional(),
});

export type GuestEvidenceItemPayload = z.input<typeof GuestEvidenceItemSchema>;
