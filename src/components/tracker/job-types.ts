import type { JobStatus } from "@/lib/db/jobs";

export interface JobVariant {
  id: string;
  variantTitle: string;
  status: string;
  createdAt: string;
}

export interface JobCoverLetter {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface JobItem {
  id: string;
  company?: string | null;
  roleTitle?: string | null;
  rawDescription: string;
  source: string;
  extractedRequirements: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
  };
  status: JobStatus;
  appliedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  variants?: JobVariant[];
  coverLetters?: JobCoverLetter[];
}
