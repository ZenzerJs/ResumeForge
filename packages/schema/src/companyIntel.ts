import { z } from "zod";

/**
 * US Department of Labor LCA H1B Sponsorship Intelligence Schema
 * Directly reflects verified DOL public disclosure data.
 */
export const H1BSponsorshipIntelSchema = z.object({
  hasHistoricalFilings: z.boolean(),
  recentFilingCount: z.record(z.string(), z.number()), // e.g. { '2024': 12, '2025': 9, '2026': 8 }
  engineeringRoleRatio: z.number().min(0).max(1), // 0 to 1 ratio of filings for engineering/technical titles
  sponsorConfidence: z.enum(["high", "moderate", "unlikely", "unknown"]),
  source: z.literal("US_DOL_LCA_PUBLIC"),
});

export type H1BSponsorshipIntel = z.infer<typeof H1BSponsorshipIntelSchema>;

/**
 * Company Venture Funding & Stability Intelligence Schema
 * Synthesizes public Crunchbase, PitchBook, and venture disclosures.
 */
export const CompanyFundingIntelSchema = z.object({
  stage: z.enum([
    "Seed",
    "Series A",
    "Series B",
    "Series C+",
    "Growth",
    "Public",
    "Bootstrapped",
  ]),
  totalRaisedUsd: z.number().optional(),
  latestRoundDate: z.string().optional(),
  leadInvestors: z.array(z.string()).default([]),
  estimatedRunwayMonths: z.number().optional(),
});

export type CompanyFundingIntel = z.infer<typeof CompanyFundingIntelSchema>;

/**
 * Enriched Company Dossier Schema combining company identity,
 * H1B visa history, venture funding rounds, and engineering culture.
 */
export const EnrichedCompanyDossierSchema = z.object({
  companySlug: z.string(),
  displayName: z.string(),
  h1bIntel: H1BSponsorshipIntelSchema.optional(),
  fundingIntel: CompanyFundingIntelSchema.optional(),
  isWhiteboardFree: z.boolean().default(false),
  interviewStyle: z
    .object({
      format: z.string().optional(),
      primaryEvaluationCriteria: z.array(z.string()).optional(),
      roundBreakdown: z.array(z.string()).optional(),
      proTips: z.array(z.string()).optional(),
    })
    .optional(),
  cultureMetrics: z
    .object({
      workLifeBalanceRating: z.number().optional(),
      deploymentVelocity: z.string().optional(),
      remoteCulture: z.string().optional(),
      pros: z.array(z.string()).optional(),
      cons: z.array(z.string()).optional(),
    })
    .optional(),
  recentSignals: z.string().optional(),
  referenceNotes: z.string().optional(),
  processNotes: z.string().optional(),
  lastUpdated: z.union([z.string(), z.date()]).optional(),
});

export type EnrichedCompanyDossier = z.infer<typeof EnrichedCompanyDossierSchema>;
