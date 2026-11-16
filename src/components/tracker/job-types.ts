import type { JobStatus } from "@/lib/db/jobs";
import type {
  JobRequirementsSource,
  RequirementsExtractionStatus,
} from "@/lib/jd-parser/types";

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
  rawDescription?: string;
  salaryLabel?: string | null;
  isPlaceholder?: boolean;
  hasFullDescription?: boolean;
  extractFailure?: string | null;
  source: string;
  extractedRequirements: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
  };
  requirementsStatus?: RequirementsExtractionStatus;
  requirementsSource?: JobRequirementsSource;
  status: JobStatus;
  appliedAt?: string | null;
  appliedVariantId?: string | null;
  notes?: string | null;
  createdAt: string;
  variants?: JobVariant[];
  coverLetters?: JobCoverLetter[];
}
