export interface FactEmployer {
  raw: string;
  normalized: string;
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
}

export interface FactMetric {
  raw: string;
  value: number;
  unit: string;
  context: string;
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
