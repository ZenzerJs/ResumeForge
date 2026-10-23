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
