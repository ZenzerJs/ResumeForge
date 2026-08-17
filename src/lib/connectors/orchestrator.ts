import { prisma } from "../prisma";
import { generateJobFingerprint } from "./dedupe";
import { AdzunaCaConnector } from "./providers/adzuna";
import { AshbyConnector } from "./providers/ashby";
import { GreenhouseConnector } from "./providers/greenhouse";
import { JobicyConnector } from "./providers/jobicy";
import { LeverConnector } from "./providers/lever";
import { RemotiveConnector } from "./providers/remotive";
import { RemoteOkConnector } from "./providers/remoteok";
import { ConnectorClient, RawJobListing, SourceConnector, SyncResult } from "./types";
import { JobSource as PrismaJobSource, WorkplaceType as PrismaWorkplaceType } from "@prisma/client";

export const CONNECTORS: Record<SourceConnector, ConnectorClient> = {
  greenhouse: new GreenhouseConnector(),
  lever: new LeverConnector(),
  ashby: new AshbyConnector(),
  adzuna_ca: new AdzunaCaConnector(),
  jobicy: new JobicyConnector(),
  remotive: new RemotiveConnector(),
  remoteok: new RemoteOkConnector(),
};

function mapSourceToPrisma(source: SourceConnector): PrismaJobSource {
  switch (source) {
    case "greenhouse":
      return PrismaJobSource.GREENHOUSE;
    case "lever":
      return PrismaJobSource.LEVER;
    case "ashby":
      return PrismaJobSource.ASHBY;
    case "adzuna_ca":
      return PrismaJobSource.ADZUNA_CA;
    case "jobicy":
      return PrismaJobSource.JOBICY;
    case "remotive":
      return PrismaJobSource.REMOTIVE;
    case "remoteok":
      return PrismaJobSource.REMOTEOK;
    default:
      return PrismaJobSource.MANUAL;
  }
}

function mapWorkplaceTypeToPrisma(type: string): PrismaWorkplaceType {
  switch (type.toLowerCase()) {
    case "remote":
      return PrismaWorkplaceType.REMOTE;
    case "hybrid":
      return PrismaWorkplaceType.HYBRID;
    case "on_site":
      return PrismaWorkplaceType.ON_SITE;
    default:
      return PrismaWorkplaceType.UNSPECIFIED;
  }
}

/**
 * Executes a single connector, upserts parsed listings into the database, and records telemetry.
 */
export async function syncSingleConnector(
  connector: ConnectorClient,
  params?: Record<string, unknown>
): Promise<SyncResult> {
  const source = connector.id;
  const prismaSource = mapSourceToPrisma(source);

  try {
    const rawListings: RawJobListing[] = await connector.fetchJobs(params);
    let insertedCount = 0;

    for (const item of rawListings) {
      const fingerprint = generateJobFingerprint(
        item.companyName,
        item.title,
        item.applyUrl
      );

      const existing = await prisma.ingestedJob.findUnique({
        where: { fingerprint },
        select: { id: true },
      });

      await prisma.ingestedJob.upsert({
        where: { fingerprint },
        update: {
          title: item.title,
          location: item.location,
          isCanadianEligible: item.isCanadianEligible,
          description: item.descriptionPlain,
          descriptionHtml: item.descriptionHtml,
          applyUrl: item.applyUrl,
          postedAt: item.postedAt,
          salaryMin: item.compensation?.min,
          salaryMax: item.compensation?.max,
          salaryCurrency: item.compensation?.currency || "CAD",
          rawMetadata: (item.metadata || {}) as any,
        },
        create: {
          fingerprint,
          externalId: item.externalId,
          source: prismaSource,
          companyName: item.companyName,
          title: item.title,
          location: item.location,
          workplaceType: mapWorkplaceTypeToPrisma(item.workplaceType),
          isCanadianEligible: item.isCanadianEligible,
          description: item.descriptionPlain,
          descriptionHtml: item.descriptionHtml,
          applyUrl: item.applyUrl,
          postedAt: item.postedAt,
          salaryMin: item.compensation?.min,
          salaryMax: item.compensation?.max,
          salaryCurrency: item.compensation?.currency || "CAD",
          rawMetadata: (item.metadata || {}) as any,
        },
      });

      if (!existing) {
        insertedCount++;
      }
    }

    // Record Sync Log
    await prisma.connectorSyncLog.create({
      data: {
        source: prismaSource,
        status: "SUCCESS",
        jobsFound: rawListings.length,
        jobsInserted: insertedCount,
        errorMessage: null,
      },
    });

    return {
      source,
      success: true,
      jobsFound: rawListings.length,
      jobsInserted: insertedCount,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[Orchestrator] Connector ${source} failed:`, err);

    await prisma.connectorSyncLog.create({
      data: {
        source: prismaSource,
        status: "FAILED",
        jobsFound: 0,
        jobsInserted: 0,
        errorMessage: errorMsg,
      },
    });

    return {
      source,
      success: false,
      jobsFound: 0,
      jobsInserted: 0,
      error: errorMsg,
    };
  }
}

/**
 * Runs all active connectors in parallel using Promise.allSettled.
 */
export async function syncAllConnectors(options?: {
  sources?: SourceConnector[];
}): Promise<SyncResult[]> {
  const targetKeys = options?.sources
    ? options.sources.filter((s) => s in CONNECTORS)
    : (Object.keys(CONNECTORS) as SourceConnector[]);

  const tasks = targetKeys.map((key) => syncSingleConnector(CONNECTORS[key]));
  const settlements = await Promise.allSettled(tasks);

  return settlements.map((s, idx) => {
    const key = targetKeys[idx];
    if (s.status === "fulfilled") {
      return s.value;
    } else {
      return {
        source: key,
        success: false,
        jobsFound: 0,
        jobsInserted: 0,
        error: s.reason?.message || String(s.reason),
      };
    }
  });
}

/**
 * Promotes an IngestedJob record to a tracked Job row in the database.
 * This links with the Phase 11.5 Apply Sheet and tailoring pipeline.
 */
export async function promoteIngestedJobToTrackedJob(
  ingestedJobId: string,
  userId?: string
) {
  const ingested = await prisma.ingestedJob.findUnique({
    where: { id: ingestedJobId },
    include: { trackedJob: true },
  });

  if (!ingested) {
    throw new Error(`IngestedJob ${ingestedJobId} not found.`);
  }

  if (ingested.trackedJob) {
    return ingested.trackedJob;
  }

  // Format rich notes with Location, Workplace, Apply Link, and Salary so TrackerFeed helpers parse them
  const notesParts = [
    `Ingested from ${ingested.source}`,
    ingested.location ? `Location: ${ingested.location}` : null,
    ingested.workplaceType && ingested.workplaceType !== "UNSPECIFIED"
      ? `Workplace: ${ingested.workplaceType.toLowerCase()}`
      : null,
    ingested.applyUrl ? `Apply Link: ${ingested.applyUrl}` : null,
    ingested.postedAt ? `Posted: ${new Date(ingested.postedAt).toLocaleDateString()}` : null,
    ingested.salaryMin || ingested.salaryMax
      ? `Salary: ${ingested.salaryCurrency || "CAD"} ${ingested.salaryMin ? `$${ingested.salaryMin.toLocaleString()}` : ""}${ingested.salaryMin && ingested.salaryMax ? " - " : ""}${ingested.salaryMax ? `$${ingested.salaryMax.toLocaleString()}` : ""}`
      : null,
  ].filter(Boolean);

  // Create corresponding Job record
  const createdJob = await prisma.job.create({
    data: {
      userId: userId || null,
      company: ingested.companyName,
      roleTitle: ingested.title,
      rawDescription: ingested.description,
      source: ingested.source.toLowerCase(),
      status: "SAVED",
      notes: notesParts.join(" | "),
    },
  });

  // Link trackedJobId on IngestedJob
  await prisma.ingestedJob.update({
    where: { id: ingestedJobId },
    data: { trackedJobId: createdJob.id },
  });

  return createdJob;
}
