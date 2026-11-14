import type { Prisma, PrismaClient } from "@prisma/client";
import { ParsedIngestedRequirementsSchema } from "@/lib/jd-parser/types";
import { computeIngestedJobEnrichment } from "./enrichment";

export interface BackfillIngestedOptions {
  prisma: PrismaClient;
  dryRun?: boolean;
  batchSize?: number;
}

export interface BackfillIngestedSummary {
  dryRun: boolean;
  scanned: number;
  pending: number;
  updated: number;
  skippedRace: number;
}

export async function backfillIngestedJobs(
  options: BackfillIngestedOptions,
): Promise<BackfillIngestedSummary> {
  const { prisma, dryRun = false, batchSize = 100 } = options;
  const effectiveBatchSize = Math.max(1, Math.min(500, batchSize));

  let lastId: string | undefined;
  let scanned = 0;
  let pending = 0;
  let updated = 0;
  let skippedRace = 0;

  while (true) {
    const batch = await prisma.ingestedJob.findMany({
      where: lastId ? { id: { gt: lastId } } : undefined,
      orderBy: { id: "asc" },
      take: effectiveBatchSize,
      select: {
        id: true,
        description: true,
        location: true,
        workplaceType: true,
        parsedRequirements: true,
        updatedAt: true,
      },
    });

    if (batch.length === 0) break;
    scanned += batch.length;
    lastId = batch[batch.length - 1].id;

    for (const row of batch) {
      if (ParsedIngestedRequirementsSchema.safeParse(row.parsedRequirements).success) continue;
      pending += 1;
      if (dryRun) continue;

      const enrichment = computeIngestedJobEnrichment({
        description: row.description,
        location: row.location,
      });

      // Guard against concurrent connector ingestion changing the row mid-backfill.
      const result = await prisma.ingestedJob.updateMany({
        where: {
          id: row.id,
          description: row.description,
          location: row.location,
          workplaceType: row.workplaceType,
          updatedAt: row.updatedAt,
        },
        data: {
          lat: enrichment.lat,
          lng: enrichment.lng,
          cityNorm: enrichment.cityNorm,
          parsedRequirements: enrichment.parsedRequirements as unknown as Prisma.InputJsonValue,
        },
      });

      if (result.count === 1) {
        updated += 1;
      } else {
        skippedRace += 1;
      }
    }

    if (batch.length < effectiveBatchSize) break;
  }

  return { dryRun, scanned, pending, updated, skippedRace };
}
