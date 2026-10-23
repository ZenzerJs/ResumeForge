import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { JobRequirements, JobRequirementsSchema } from "@/lib/jd-parser/types";
import {
  extractPostingDateFromNotes,
  isPlaceholderDescription,
  matchesWorkplaceFilter,
  type WorkplaceFilter,
} from "@/lib/ingestion/helpers";
import {
  filterByPostedWithin,
  type PostedWithin,
} from "@/lib/jobs/posted-within";

export type JobStatus = "SAVED" | "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED" | "ARCHIVED";

export interface CreateJobInput {
  company?: string;
  roleTitle?: string;
  rawDescription: string;
  source?: "pasted" | "manual" | "simplify-jobs";
  extractedRequirements?: JobRequirements;
  status?: JobStatus;
  appliedAt?: Date | string | null;
  notes?: string | null;
  /** Ignored. Jobs are a shared catalog, not owned by a user. */
  userId?: string;
}

export interface UpdateJobInput {
  company?: string;
  roleTitle?: string;
  rawDescription?: string;
  extractedRequirements?: JobRequirements;
  status?: JobStatus;
  appliedAt?: Date | string | null;
  notes?: string | null;
}

import { normalizeCompany } from "@/lib/company";

export async function createJob(input: CreateJobInput) {
  const reqsJson = input.extractedRequirements
    ? JSON.stringify(input.extractedRequirements)
    : JSON.stringify({ requiredSkills: [], preferredSkills: [], domainTerms: [] });

  let dossierId: string | null = null;
  if (input.company) {
    const slug = normalizeCompany(input.company);
    if (slug) {
      const existingDossier = await prisma.companyDossier.findUnique({
        where: { companySlug: slug },
        select: { id: true },
      });
      if (existingDossier) {
        dossierId = existingDossier.id;
      }
    }
  }

  const job = await prisma.job.create({
    data: {
      company: input.company || null,
      roleTitle: input.roleTitle || null,
      rawDescription: input.rawDescription,
      source: input.source || "pasted",
      extractedRequirements: reqsJson,
      status: input.status || "SAVED",
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
      notes: input.notes || null,
      dossierId,
    },
    include: {
      variants: {
        select: { id: true, variantTitle: true, status: true, createdAt: true },
      },
      coverLetters: {
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });

  return {
    ...job,
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  };
}

export async function updateJob(id: string, input: UpdateJobInput, viewerUserId?: string | null) {
  const existing = await prisma.job.findFirst({
    where: { id },
  });
  if (!existing) return null;

  const dataToUpdate: Record<string, unknown> = {};
  if (input.company !== undefined) dataToUpdate.company = input.company;
  if (input.roleTitle !== undefined) dataToUpdate.roleTitle = input.roleTitle;
  if (input.notes !== undefined) dataToUpdate.notes = input.notes;
  if (input.rawDescription !== undefined) dataToUpdate.rawDescription = input.rawDescription;
  if (input.extractedRequirements !== undefined) {
    dataToUpdate.extractedRequirements = JSON.stringify(input.extractedRequirements);
  }

  const updated = await prisma.job.update({
    where: { id },
    data: dataToUpdate,
    include: jobIncludeForViewer(viewerUserId),
  });

  return {
    ...withViewerOutcome(updated, viewerUserId),
    extractedRequirements: parseRequirementsJson(updated.extractedRequirements),
  };
}

const outcomeSelect = { status: true, appliedAt: true, variantId: true } as const;

function applicationInclude(viewerUserId?: string | null) {
  return {
    where: { userId: viewerUserId || "__none__" },
    select: outcomeSelect,
  };
}

function withViewerOutcome<T extends { applications?: { status: string; appliedAt: Date | null; variantId: string | null }[] }>(
  job: T,
  viewerUserId?: string | null
) {
  const { applications, ...rest } = job;
  const app = viewerUserId ? applications?.[0] : undefined;
  return {
    ...rest,
    status: (app?.status ?? "SAVED") as JobStatus,
    appliedAt: app?.appliedAt ?? null,
    appliedVariantId: app?.variantId ?? null,
  };
}

const jobListInclude = {
  variants: {
    select: { id: true, variantTitle: true, status: true, createdAt: true },
  },
  coverLetters: {
    select: { id: true, title: true, status: true, createdAt: true },
  },
  applications: applicationInclude(),
} as const;

function jobIncludeForViewer(viewerUserId?: string | null): Prisma.JobInclude {
  if (viewerUserId === undefined) {
    return jobListInclude;
  }
  const hide = { id: "__none__" };
  return {
    variants: {
      where: viewerUserId ? { masterResume: { userId: viewerUserId } } : hide,
      select: { id: true, variantTitle: true, status: true, createdAt: true },
    },
    coverLetters: {
      where: viewerUserId
        ? {
            OR: [
              { userId: viewerUserId },
              { variant: { masterResume: { userId: viewerUserId } } },
            ],
          }
        : hide,
      select: { id: true, title: true, status: true, createdAt: true },
    },
    applications: applicationInclude(viewerUserId),
  };
}

export async function getJobs() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    include: jobListInclude,
  });

  return jobs.map((job) => ({
    ...job,
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  }));
}

export type { WorkplaceFilter };

export interface JobListQuery {
  page?: number;
  limit?: number;
  q?: string;
  location?: string;
  workplace?: WorkplaceFilter;
  status?: JobStatus | JobStatus[] | "ALL";
  postedWithin?: PostedWithin;
  /** Viewer id — scopes nested variants/cover letters, not the job catalog. */
  userId?: string | null;
}

export async function getJobsList(query: JobListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));
  const where: Prisma.JobWhereInput = {};

  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { company: { contains: q, mode: "insensitive" } },
      { roleTitle: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { rawDescription: { contains: q, mode: "insensitive" } },
    ];
  }

  if (query.location?.trim()) {
    const loc = query.location.trim();
    const locationFilter: Prisma.JobWhereInput = {
      OR: [
        { notes: { contains: loc, mode: "insensitive" } },
        { rawDescription: { contains: loc, mode: "insensitive" } },
      ],
    };
    const existingAnd = where.AND
      ? Array.isArray(where.AND)
        ? where.AND
        : [where.AND]
      : [];
    where.AND = [...existingAnd, locationFilter];
  }

  const rawStatus = query.status;
  const isAllStatus =
    !rawStatus ||
    rawStatus === "ALL" ||
    (Array.isArray(rawStatus) && (rawStatus.length === 0 || rawStatus.includes("ALL" as any)));

  if (!isAllStatus && rawStatus) {
    const statuses = (Array.isArray(rawStatus) ? rawStatus : [rawStatus]).filter(
      (s) => (s as string) !== "ALL"
    );
    const includesSaved = statuses.includes("SAVED");
    if (!query.userId) {
      if (!includesSaved) {
        where.id = "__none__";
      }
    } else {
      const statusCondition: Prisma.JobWhereInput = !includesSaved
        ? {
            applications: {
              some: {
                userId: query.userId,
                status: { in: statuses },
              },
            },
          }
        : {
            OR: [
              {
                applications: {
                  some: {
                    userId: query.userId,
                    status: { in: statuses },
                  },
                },
              },
              {
                applications: {
                  none: {
                    userId: query.userId,
                  },
                },
              },
            ],
          };
      const existingAnd = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : [];
      where.AND = [...existingAnd, statusCondition];
    }
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: jobIncludeForViewer(query.userId),
  });

  const mapped = jobs.map((job) => {
    const item = withViewerOutcome(job, query.userId);
    return {
      ...item,
      extractedRequirements: parseRequirementsJson(job.extractedRequirements),
      isPlaceholder: isPlaceholderDescription(item.rawDescription),
    };
  });

  const statusFiltered = mapped.filter((job) => {
    if (isAllStatus) return true;
    const statuses = (Array.isArray(rawStatus) ? rawStatus : [rawStatus]).filter(
      (s) => (s as string) !== "ALL"
    );
    return statuses.includes(job.status);
  });

  const postedWithin = query.postedWithin ?? "all";
  const postedFiltered =
    postedWithin === "all"
      ? statusFiltered
      : filterByPostedWithin(
          statusFiltered,
          postedWithin,
          (j) => {
            const raw = extractPostingDateFromNotes(j.notes)?.trim() || null;
            if (!raw || /^apply$/i.test(raw)) return null;
            return raw;
          },
          (j) => j.createdAt
        );

  const workplace = query.workplace ?? "all";
  const filtered =
    workplace === "all"
      ? postedFiltered
      : postedFiltered.filter((j) => matchesWorkplaceFilter(j.notes, workplace));

  const total = filtered.length;
  const start = (page - 1) * limit;
  let applied = 0;
  let interviewing = 0;
  for (const job of filtered) {
    if (job.status === "APPLIED" || job.status === "INTERVIEWING" || job.status === "OFFER") {
      applied += 1;
    }
    if (job.status === "INTERVIEWING") interviewing += 1;
  }
  return {
    data: filtered.slice(start, start + limit),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: { applied, interviewing },
    },
  };
}

export async function getJobById(id: string, viewerUserId?: string | null) {
  const job = await prisma.job.findFirst({
    where: { id },
    include: jobIncludeForViewer(viewerUserId),
  });

  if (!job) return null;

  return {
    ...withViewerOutcome(job, viewerUserId),
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  };
}

export async function deleteJob(id: string, userId?: string) {
  const existing = await prisma.job.findFirst({
    where: { id, ...(userId ? { OR: [{ userId }, { userId: null }] } : {}) },
  });
  if (!existing) {
    throw new Error("Job not found");
  }

  if (userId && existing.userId === null) {
    const [otherApps, otherVariants, otherLetters] = await Promise.all([
      prisma.jobApplication.findFirst({
        where: { jobId: id, NOT: { userId } },
      }),
      prisma.resumeVariant.findFirst({
        where: { jobId: id, NOT: { masterResume: { userId } } },
      }),
      prisma.coverLetter.findFirst({
        where: {
          jobId: id,
          NOT: {
            OR: [{ userId }, { variant: { masterResume: { userId } } }],
          },
        },
      }),
    ]);

    const isReferencedByOthers = Boolean(otherApps || otherVariants || otherLetters);
    if (isReferencedByOthers) {
      await Promise.all([
        prisma.jobApplication.deleteMany({ where: { jobId: id, userId } }),
        prisma.coverLetter.deleteMany({ where: { jobId: id, userId } }),
        prisma.resumeVariant.deleteMany({ where: { jobId: id, masterResume: { userId } } }),
      ]);
      return existing;
    }
  }

  await prisma.jobApplication.deleteMany({ where: { jobId: id } });
  await prisma.coverLetter.deleteMany({ where: { jobId: id } });
  await prisma.resumeVariant.deleteMany({ where: { jobId: id } });
  await prisma.job.delete({ where: { id } });
  return existing;
}

function parseRequirementsJson(jsonStr: string): JobRequirements {
  try {
    const parsed = JSON.parse(jsonStr);
    return JobRequirementsSchema.parse(parsed);
  } catch {
    return {
      requiredSkills: [],
      preferredSkills: [],
      domainTerms: [],
    };
  }
}


import { resolvePostedAgeDays } from "@/lib/jobs/posted-within";

export interface CleanupStalePositionsOptions {
  /** Maximum age in days before a position is purged. Defaults to 30 (1 month). */
  maxAgeDays?: number;
  /** Reference time for age comparison. Defaults to new Date(). */
  now?: Date;
}

export interface CleanupStalePositionsResult {
  deletedIngestedJobs: number;
  deletedDiscoveredJobs: number;
  deletedJobs: number;
  totalDeleted: number;
  cutoffDate: string;
  maxAgeDays: number;
}

/**
 * Purges positions older than `maxAgeDays` (default: 30 days / 1 month) across
 * `IngestedJob`, `DiscoveredJob`, and untracked/unapplied `Job` records.
 */
export async function cleanupStalePositions(
  options: CleanupStalePositionsOptions = {}
): Promise<CleanupStalePositionsResult> {
  const maxAgeDays = Math.max(1, options.maxAgeDays ?? 30);
  const now = options.now ?? new Date();
  const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs);

  // 1. Clean stale Job rows first so any linked IngestedJob rows can also be cleaned
  const candidateJobs = await prisma.job.findMany({
    where: { userId: null, status: "SAVED" },
    select: { id: true, notes: true, createdAt: true },
  });

  const staleJobIds: string[] = [];
  for (const job of candidateJobs) {
    const rawPosted = extractPostingDateFromNotes(job.notes)?.trim() || null;
    const cleanedPosted = rawPosted && !/^apply$/i.test(rawPosted) ? rawPosted : null;
    const ageDays = resolvePostedAgeDays(cleanedPosted, now, job.createdAt);
    const createdMs = new Date(job.createdAt).getTime();
    const isStale =
      (ageDays !== null && ageDays > maxAgeDays) ||
      (!Number.isNaN(createdMs) && createdMs < cutoffMs);

    if (isStale) {
      staleJobIds.push(job.id);
    }
  }

  let deletedJobs = 0;
  if (staleJobIds.length > 0) {
    deletedJobs = await prisma.$transaction(async (tx) => {
      // FK inserts acquire KEY SHARE on Job. Lock parents first, then use a
      // fresh READ COMMITTED snapshot to see references committed while waiting.
      // This also prevents new references between the check and deletion.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "Job"
        WHERE "id" IN (${Prisma.join(staleJobIds)})
        ORDER BY "id" FOR UPDATE
      `);
      const removableWhere: Prisma.JobWhereInput = {
        id: { in: staleJobIds },
        userId: null,
        status: "SAVED",
        applications: { none: {} },
        variants: { none: {} },
        coverLetters: { none: {} },
      };
      const removableJobs = await tx.job.findMany({
        where: removableWhere,
        select: { id: true },
      });
      const removableIds = removableJobs.map((job) => job.id);
      if (removableIds.length === 0) return 0;

      await tx.ingestedJob.updateMany({
        where: { trackedJobId: { in: removableIds } },
        data: { trackedJobId: null },
      });
      const delJobsRes = await tx.job.deleteMany({
        where: {
          ...removableWhere,
          id: { in: removableIds },
        },
      });
      return delJobsRes.count;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  // 2. Clean stale IngestedJob rows (unlinked to active tracked jobs)
  const candidateIngested = await prisma.ingestedJob.findMany({
    where: { trackedJobId: null },
    select: { id: true, postedAt: true, createdAt: true },
  });

  const staleIngestedIds: string[] = [];
  for (const item of candidateIngested) {
    const effectiveDate = item.postedAt ?? item.createdAt;
    const effectiveMs = new Date(effectiveDate).getTime();
    if (!Number.isNaN(effectiveMs) && effectiveMs < cutoffMs) {
      staleIngestedIds.push(item.id);
    }
  }

  let deletedIngestedJobs = 0;
  if (staleIngestedIds.length > 0) {
    const delIngestedRes = await prisma.ingestedJob.deleteMany({
      where: { id: { in: staleIngestedIds }, trackedJobId: null },
    });
    deletedIngestedJobs = delIngestedRes.count;
  }

  // 3. Clean stale DiscoveredJob rows
  const candidateDiscovered = await prisma.discoveredJob.findMany({
    select: { id: true, datePosted: true, createdAt: true },
  });

  const staleDiscoveredIds: string[] = [];
  for (const item of candidateDiscovered) {
    const ageDays = resolvePostedAgeDays(item.datePosted, now, item.createdAt);
    const createdMs = new Date(item.createdAt).getTime();
    if (
      (ageDays !== null && ageDays > maxAgeDays) ||
      (!Number.isNaN(createdMs) && createdMs < cutoffMs)
    ) {
      staleDiscoveredIds.push(item.id);
    }
  }

  let deletedDiscoveredJobs = 0;
  if (staleDiscoveredIds.length > 0) {
    const delDiscoveredRes = await prisma.discoveredJob.deleteMany({
      where: { id: { in: staleDiscoveredIds } },
    });
    deletedDiscoveredJobs = delDiscoveredRes.count;
  }

  return {
    deletedIngestedJobs,
    deletedDiscoveredJobs,
    deletedJobs,
    totalDeleted: deletedIngestedJobs + deletedDiscoveredJobs + deletedJobs,
    cutoffDate: cutoffDate.toISOString(),
    maxAgeDays,
  };
}
