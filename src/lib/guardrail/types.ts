export type ViolationKind = "employer" | "title" | "date" | "metric" | "skill" | "evidence";

export type ViolationSeverity = "HARD" | "SOFT";

export type GuardrailStatus = "clean" | "retried" | "fell_back" | "blocked";

export interface GuardrailViolation {
  kind: ViolationKind;
  severity: ViolationSeverity;
  field: string;
  message: string;
  expected?: string;
  actual: string;
  snippet?: string;
}

export interface GuardrailResult {
  passed: boolean;
  status: GuardrailStatus;
  hasHardViolations: boolean;
  hasSoftViolations: boolean;
  violations: GuardrailViolation[];
}
