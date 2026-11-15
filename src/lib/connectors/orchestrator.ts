import { prisma } from "../prisma";
import { generateJobFingerprint } from "./dedupe";
import { AdzunaCaConnector } from "./providers/adzuna";
import { AshbyConnector } from "./providers/ashby";
import { GreenhouseConnector } from "./providers/greenhouse";
import { JobicyConnector } from "./providers/jobicy";
import { LeverConnector } from "./providers/lever";
import { RemotiveConnector } from "./providers/remotive";
import { RemoteOkConnector } from "./providers/remoteok";
import {
  ConnectorClient,
  ConnectorSkippedError,
  RawJobListing,
  SourceConnector,
  SyncResult,
} from "./types";
import { JobSource as PrismaJobSource, Prisma, WorkplaceType as PrismaWorkplaceType } from "@prisma/client";
import { ParsedIngestedRequirementsSchema } from "@/lib/jd-parser/types";
import { computeIngestedJobEnrichment } from "./enrichment";

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
    const now = new Date();
    const keyedListings = rawListings.map((item) => ({
      item,
      fingerprint: generateJobFingerprint(item.companyName, item.title, item.applyUrl),
    }));
    const fingerprints = Array.from(new Set(keyedListings.map((k) => k.fingerprint)));
    const existingRows =
      fingerprints.length > 0
        ? await prisma.ingestedJob.findMany({
            where: { fingerprint: { in: fingerprints } },
            select: {
              id: true,
              fingerprint: true,
              postedAt: true,
              createdAt: true,
              description: true,
              location: true,
              workplaceType: true,
              parsedRequirements: true,
            },
          })
        : [];
    const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row]));

    const toCreate: Prisma.IngestedJobCreateManyInput[] = [];
    const toUpdate: Array<ReturnType<typeof prisma.ingestedJob.update>> = [];
    const queuedNewFingerprints = new Set<string>();

    for (const { item, fingerprint } of keyedListings) {
      const existing = existingByFingerprint.get(fingerprint);
      const nextWorkplaceType = mapWorkplaceTypeToPrisma(item.workplaceType);
      const needsEnrichment =
        !existing ||
        existing.description !== item.descriptionPlain ||
        existing.location !== item.location ||
        existing.workplaceType !== nextWorkplaceType ||
        !ParsedIngestedRequirementsSchema.safeParse(existing.parsedRequirements).success;

      const enrichment = needsEnrichment
        ? computeIngestedJobEnrichment({
            description: item.descriptionPlain,
            location: item.location,
          })
        : null;

      if (existing) {
        toUpdate.push(
          prisma.ingestedJob.update({
            where: { fingerprint },
            data: {
              title: item.title,
              location: item.location,
              workplaceType: nextWorkplaceType,
              isCanadianEligible: item.isCanadianEligible,
              description: item.descriptionPlain,
              descriptionHtml: item.descriptionHtml,
              applyUrl: item.applyUrl,
              postedAt:
                item.postedAt &&
                item.postedAt <= now &&
                (!existing.postedAt || item.postedAt.getTime() > new Date(existing.postedAt).getTime())
                  ? item.postedAt
                  : existing.postedAt ?? null,
              salaryMin: item.compensation?.min,
              salaryMax: item.compensation?.max,
              salaryCurrency: item.compensation?.currency || "CAD",
              rawMetadata: (item.metadata || {}) as Prisma.InputJsonValue,
              ...(enrichment
                ? {
                    lat: enrichment.lat,
                    lng: enrichment.lng,
                    cityNorm: enrichment.cityNorm,
                    parsedRequirements: enrichment.parsedRequirements as unknown as Prisma.InputJsonValue,
                  }
                : {}),
            },
          }),
        );
      } else if (!queuedNewFingerprints.has(fingerprint)) {
        queuedNewFingerprints.add(fingerprint);
        toCreate.push({
          fingerprint,
          externalId: item.externalId,
          source: prismaSource,
          companyName: item.companyName,
          title: item.title,
          location: item.location,
          workplaceType: nextWorkplaceType,
          isCanadianEligible: item.isCanadianEligible,
          description: item.descriptionPlain,
          descriptionHtml: item.descriptionHtml,
          applyUrl: item.applyUrl,
          postedAt: item.postedAt && item.postedAt <= now ? item.postedAt : null,
          salaryMin: item.compensation?.min,
          salaryMax: item.compensation?.max,
          salaryCurrency: item.compensation?.currency || "CAD",
          rawMetadata: (item.metadata || {}) as Prisma.InputJsonValue,
          lat: enrichment?.lat ?? null,
          lng: enrichment?.lng ?? null,
          cityNorm: enrichment?.cityNorm ?? null,
          parsedRequirements: (enrichment ??
            computeIngestedJobEnrichment({
              description: item.descriptionPlain,
              location: item.location,
            })).parsedRequirements as unknown as Prisma.InputJsonValue,
        });
      }
    }

    if (toCreate.length > 0) {
      await prisma.ingestedJob.createMany({ data: toCreate, skipDuplicates: true });
    }
    const BATCH_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      await prisma.$transaction(toUpdate.slice(i, i + BATCH_SIZE));
    }
    const insertedCount = toCreate.length;

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
    const skipped = err instanceof ConnectorSkippedError || err?.name === "ConnectorSkippedError";
    const errorMsg = err?.message || String(err);
    if (!skipped) {
      console.error(`[Orchestrator] Connector ${source} failed:`, err);
    } else {
      console.info(`[Orchestrator] Connector ${source} skipped: ${errorMsg}`);
    }

    await prisma.connectorSyncLog.create({
      data: {
        source: prismaSource,
        status: skipped ? "SKIPPED" : "FAILED",
        jobsFound: 0,
        jobsInserted: 0,
        errorMessage: errorMsg,
      },
    });

    return {
      source,
      success: false,
      skipped,
      jobsFound: 0,
      jobsInserted: 0,
      error: errorMsg,
    };
  }
}

/**
 * Runs all active connectors in parallel using Promise.allSettled,
 * with expiry audited independently.
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

  // Create corresponding Job record and link trackedJobId atomically
  return await prisma.$transaction(async (tx) => {
    const createdJob = await tx.job.create({
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

    await tx.ingestedJob.update({
      where: { id: ingestedJobId },
      data: { trackedJobId: createdJob.id },
    });

    return createdJob;
  });
}
