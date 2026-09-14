export type DiagnosticSeverity = "urgent" | "non_urgent" | "cosmetic";

export interface ResumeDiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  category: "missing_hard_requirement" | "unsubstantiated_claim" | "weak_quantification" | "passive_tone" | "formatting_overflow";
  message: string;
  targetLineOrBulletId: string;
  suggestedFix: string;
}

export interface ResumeDiagnosticReport {
  items: ResumeDiagnosticItem[];
  urgentCount: number;
  nonUrgentCount: number;
  cosmeticCount: number;
  overallScore: number;
}
