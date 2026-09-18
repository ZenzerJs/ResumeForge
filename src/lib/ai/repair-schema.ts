import { z } from "zod";

export const MAX_REPAIR_SOURCE_LENGTH = 20000;
export const MAX_REPAIR_ERROR_LENGTH = 2000;

export const TypstRepairInputSchema = z.object({
  source: z
    .string()
    .min(1, "source is required")
    .max(MAX_REPAIR_SOURCE_LENGTH, `source exceeds maximum length of ${MAX_REPAIR_SOURCE_LENGTH} characters`),
  compileError: z
    .string()
    .min(1, "compileError is required")
    .max(MAX_REPAIR_ERROR_LENGTH, `compileError exceeds maximum length of ${MAX_REPAIR_ERROR_LENGTH} characters`),
  line: z.number().optional(),
  column: z.number().optional(),
  sourceExcerpt: z.string().optional(),
  documentId: z.string().optional(),
});

export type TypstRepairInput = z.infer<typeof TypstRepairInputSchema>;

export const TypstRepairProposalSchema = z.object({
  summary: z.string().min(1, "summary is required"),
  errorAnalysis: z.string().min(1, "errorAnalysis is required"),
  replacementSource: z.string().min(1, "replacementSource is required"),
  changedLinesCount: z.number().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  warnings: z.array(z.string()).default([]),
});

export type TypstRepairProposal = z.infer<typeof TypstRepairProposalSchema>;
