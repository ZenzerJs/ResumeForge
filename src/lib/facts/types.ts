export interface FactEmployer {
  raw: string;
  normalized: string;
  aliases?: string[];
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  evidenceId?: string;
}

export interface FactTitle {
  raw: string;
  normalized: string;
  employerNormalized?: string;
  evidenceId?: string;
}

export interface FactDateRange {
  raw: string;
  startIso?: string;
  endIso?: string;
  isCurrent?: boolean;
  employerNormalized?: string;
}

export interface FactMetric {
  raw: string;
  value: number;
  unit: string;
  context: string;
  subject?: string;
  isTrivial: boolean;
}

export interface ResumeFacts {
  version: 1;
  snapshotAt: string;
  employers: FactEmployer[];
  titles: FactTitle[];
  dateRanges: FactDateRange[];
  metrics: FactMetric[];
  skills: string[];
  evidenceIds: string[];
}

export interface VerifiedEvidenceRegistry {
  evidenceIds: string[];
  bulletIds: string[];
  /** Maps each verified bulletId to its owning verified evidenceId. */
  bulletToEvidenceId: Record<string, string>;
}

export interface TailoringValidationContext {
  version: 2;
  /** Version/fingerprint of the protected master baseline + current owned verified evidence. */
  revision: string;
  /** Protected frozen master baseline snapshot (never mutated or silently re-frozen). */
  masterBaseline: ResumeFacts;
  /** Combined validation facts (master baseline + current owned verified evidence/bullets). */
  facts: ResumeFacts;
  /** Verified evidence + bullet ownership/membership registry. */
  registry: VerifiedEvidenceRegistry;
  assembledAt: string;
}
