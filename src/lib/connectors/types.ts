import { z } from "zod";

export const WorkplaceTypeSchema = z.enum(["remote", "hybrid", "on_site", "unspecified"]);
export type WorkplaceType = z.infer<typeof WorkplaceTypeSchema>;

export const SourceConnectorSchema = z.enum([
  "greenhouse",
  "lever",
  "ashby",
  "adzuna_ca",
  "jobicy",
  "remotive",
  "remoteok",
]);
export type SourceConnector = z.infer<typeof SourceConnectorSchema>;

export const RawJobListingSchema = z.object({
  externalId: z.string().min(1),
  source: SourceConnectorSchema,
  companyName: z.string().min(1),
  title: z.string().min(1),
  location: z.string().default("Canada / Remote"),
  isCanadianEligible: z.boolean().default(true),
  workplaceType: WorkplaceTypeSchema.default("unspecified"),
  descriptionHtml: z.string().min(1),
  descriptionPlain: z.string().min(1),
  applyUrl: z.string().url(),
  postedAt: z.coerce.date().nullable().optional(),
  compensation: z
    .object({
      currency: z.string().default("CAD"),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
      period: z.enum(["hourly", "yearly"]).nullable().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RawJobListing = z.infer<typeof RawJobListingSchema>;

export interface ConnectorClient {
  readonly id: SourceConnector;
  readonly name: string;
  fetchJobs(params?: Record<string, unknown>): Promise<RawJobListing[]>;
  healthCheck(): Promise<boolean>;
}

export interface SyncResult {
  source: SourceConnector;
  success: boolean;
  jobsFound: number;
  jobsInserted: number;
  error?: string;
}
