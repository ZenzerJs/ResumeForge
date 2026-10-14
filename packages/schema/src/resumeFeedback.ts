import { z } from 'zod';

export const DiagnosticSeveritySchema = z.enum(["urgent", "non_urgent", "cosmetic"]);
export type DiagnosticSeverity = z.infer<typeof DiagnosticSeveritySchema>;

export const ResumeDiagnosticItemSchema = z.object({
  id: z.string(),
  severity: DiagnosticSeveritySchema,
  category: z.enum([
    "missing_hard_requirement",
    "unsubstantiated_claim",
    "weak_quantification",
    "passive_tone",
    "formatting_overflow"
  ]),
  message: z.string(),
  targetLineOrBulletId: z.string().optional(),
  suggestedFix: z.string().optional(),
});
export type ResumeDiagnosticItem = z.infer<typeof ResumeDiagnosticItemSchema>;

export const ResumeDiagnosticReportSchema = z.object({
  issues: z.array(ResumeDiagnosticItemSchema),
  urgentCount: z.number(),
  nonUrgentCount: z.number(),
  cosmeticCount: z.number(),
  overallHealthScore: z.number(),
});
export type ResumeDiagnosticReport = z.infer<typeof ResumeDiagnosticReportSchema>;
