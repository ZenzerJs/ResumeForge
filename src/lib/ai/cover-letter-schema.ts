import { z } from "zod";

/**
 * Zod schema for structured cover letter generation output from BYOK AI gateway.
 */
export const CoverLetterResponseSchema = z.object({
  title: z.string().describe("Descriptive title for this cover letter"),
  salutation: z.string().default("Dear Hiring Team,"),
  openingParagraph: z.string().min(20).describe("Engaging opening hook citing target role and company"),
  bodyParagraphs: z.array(z.string().min(30)).min(1).describe("1-3 evidence-grounded body paragraphs highlighting candidate achievements"),
  closingParagraph: z.string().min(20).describe("Professional closing call-to-action and thank you"),
  fullMarkdown: z.string().min(100).describe("Complete assembled markdown cover letter"),
  evidenceCitations: z.array(z.string()).describe("Array of evidenceIds cited/used in drafting the body prose"),
  gapsAddressed: z.array(z.string()).default([]).describe("Optional list of candidate gaps addressed or mitigated"),
});

export type CoverLetterResponse = z.infer<typeof CoverLetterResponseSchema>;

/**
 * Zod schema for input to generate-cover-letter API route.
 */
export const GenerateCoverLetterInputSchema = z.object({
  jobId: z.string().min(1),
  variantId: z.string().optional(),
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  rawDescription: z.string().min(10),
  extractedRequirements: z.record(z.string(), z.any()).optional(),
  candidateName: z.string().default("Candidate"),
  activeRoleProfile: z.string().default("Full-stack"),
});

export type GenerateCoverLetterInput = z.infer<typeof GenerateCoverLetterInputSchema>;
