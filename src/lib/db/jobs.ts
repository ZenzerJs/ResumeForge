import { Prisma } from "@prisma/client";
import { isBoardEligible, jobMaxAgeDays } from "@/lib/jobs/expiry";
import { prisma } from "@/lib/prisma";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import {
  CURRENT_REQUIREMENTS_PARSER_VERSION,
  HydratedJobDetailSchema,
  JobRequirements,
  JobRequirementsMetaSchema,
  JobRequirementsSchema,
  type HydratedJobDetail,
  type JobRequirementsSource,
  type RequirementsExtractionStatus,
} from "@/lib/jd-parser/types";
import {
  extractApplyUrlFromNotes,
  extractLocationFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
  matchesWorkplaceFilter,
  type WorkplaceFilter,
} from "@/lib/ingestion/helpers";
import {
  filterByPostedWithin,
  type PostedWithin,
} from "@/lib/jobs/posted-within";
import { collapseDuplicateTrackerJobs } from "@/lib/jobs/posting-identity";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class JobDeleteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobDeleteConflictError";
  }
}

export function sharedOrSelfJobWhere(viewerUserId?: string | null): Prisma.JobWhereInput {
  return viewerUserId ? { OR: [{ userId: null }, { userId: viewerUserId }] } : { userId: null };
}

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
  userId?: string | null;
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
    ? serializeRequirementsWithMeta(input.extractedRequirements, "manual")
    : !isPlaceholderDescription(input.rawDescription)
      ? serializeRequirementsWithMeta(parseJobDescription(input.rawDescription), "auto")
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
      userId: input.userId ?? null,
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

  const reqState = parseRequirementsState(job.extractedRequirements, job.rawDescription, job.extractFailure);
  const isPlaceholder = isPlaceholderDescription(job.rawDescription);

  return {
    ...job,
    extractedRequirements: reqState.extractedRequirements,
    requirementsStatus: reqState.requirementsStatus,
    requirementsSource: reqState.requirementsSource,
    isPlaceholder,
    hasFullDescription: !isPlaceholder,
  };
}

export async function updateJob(
  id: string,
  input: UpdateJobInput,
  viewerUserId?: string | null,
  db: DbClient = prisma
) {
  if (!viewerUserId) return null;

  const existing = await db.job.findFirst({
    where: { id, userId: viewerUserId },
  });
  if (!existing) return null;

  const dataToUpdate: Prisma.JobUpdateManyMutationInput = {};
  if (input.company !== undefined) dataToUpdate.company = input.company;
  if (input.roleTitle !== undefined) dataToUpdate.roleTitle = input.roleTitle;
  if (input.notes !== undefined) dataToUpdate.notes = input.notes;
  if (input.rawDescription !== undefined) dataToUpdate.rawDescription = input.rawDescription;
  if (input.extractedRequirements !== undefined) {
    dataToUpdate.extractedRequirements = serializeRequirementsWithMeta(
      input.extractedRequirements,
      "manual"
    );
  } else if (
    input.rawDescription !== undefined &&
    !isManuallyEditedRequirements(existing.extractedRequirements) &&
    !isPlaceholderDescription(input.rawDescription)
  ) {
    dataToUpdate.extractedRequirements = serializeRequirementsWithMeta(
      parseJobDescription(input.rawDescription),
      "auto"
    );
  }

  if (Object.keys(dataToUpdate).length > 0) {
    const updatedCount = await db.job.updateMany({
      where: { id, userId: viewerUserId },
      data: dataToUpdate,
    });
    if (updatedCount.count === 0) return null;
  }

  const updated = await db.job.findFirst({
    where: { id, userId: viewerUserId },
    include: jobIncludeForViewer(viewerUserId),
  });
  if (!updated) return null;

  const reqState = parseRequirementsState(
    updated.extractedRequirements,
    updated.rawDescription,
    updated.extractFailure
  );
  const isPlaceholder = isPlaceholderDescription(updated.rawDescription);

  return {
    ...withViewerOutcome(updated, viewerUserId),
    extractedRequirements: reqState.extractedRequirements,
    requirementsStatus: reqState.requirementsStatus,
    requirementsSource: reqState.requirementsSource,
    isPlaceholder,
    hasFullDescription: !isPlaceholder,
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

export type { WorkplaceFilter };

export type JobListScope = "all" | "tracked";

export interface JobListQuery {
  page?: number;
  limit?: number;
  q?: string;
  location?: string;
  workplace?: WorkplaceFilter;
  status?: JobStatus | JobStatus[] | "ALL";
  postedWithin?: PostedWithin;
  scope?: JobListScope;
  /** Viewer id — scopes nested variants/cover letters, not the job catalog. */
  userId?: string | null;
}

export async function getJobsList(query: JobListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));

  if (query.scope === "tracked" && !query.userId) {
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 1,
        counts: { applied: 0, interviewing: 0 },
      },
    };
  }

  const where: Prisma.JobWhereInput = {
    AND: [
      sharedOrSelfJobWhere(query.userId),
      ...(query.scope === "tracked" && query.userId
        ? [
            {
              OR: [
                { userId: query.userId },
                { applications: { some: { userId: query.userId } } },
                { variants: { some: { masterResume: { userId: query.userId } } } },
                {
                  coverLetters: {
                    some: {
                      OR: [
                        { userId: query.userId },
                        { variant: { masterResume: { userId: query.userId } } },
                      ],
                    },
                  },
                },
                { patchProposalBatches: { some: { userId: query.userId } } },
              ],
            } satisfies Prisma.JobWhereInput,
          ]
        : []),
    ],
  };

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

  const now = new Date();
  const postedWithin = query.postedWithin ?? "all";
  const workplace = query.workplace ?? "all";
  const start = (page - 1) * limit;
  let cursor: string | undefined;
  type RawJobRow = Prisma.JobGetPayload<{ include: typeof jobListInclude }> & {
    patchProposalBatches?: { id: string }[];
  };
  type EligibleJobEntry = ReturnType<typeof withViewerOutcome<RawJobRow>> & {
    applications: RawJobRow["applications"];
    rawDescription: string;
    extractedRequirements: string;
    patchProposalBatches?: { id: string }[];
  };
  const eligible: EligibleJobEntry[] = [];

  for (;;) {
    const jobs = await prisma.job.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 500,
      include: {
        ...jobIncludeForViewer(query.userId),
        patchProposalBatches: {
          where: query.userId ? { userId: query.userId } : { id: "__none__" },
          select: { id: true },
        },
      },
    });

    for (const job of jobs) {
      const hasPersonalHistory = Boolean(
        query.userId && (
          job.userId === query.userId ||
          job.applications?.length ||
          job.variants?.length ||
          job.coverLetters?.length ||
          ("patchProposalBatches" in job &&
            Array.isArray(job.patchProposalBatches) &&
            job.patchProposalBatches.length)
        )
      );
      const posted = extractPostingDateFromNotes(job.notes)?.trim() || null;
      const cleanedPosted = posted && !/^apply$/i.test(posted) ? posted : null;
      if (query.scope === "tracked" && !hasPersonalHistory) continue;
      if (!hasPersonalHistory && !isBoardEligible(cleanedPosted, job.createdAt, now)) continue;

      const item = withViewerOutcome(job, query.userId);
      const statuses = (Array.isArray(rawStatus) ? rawStatus : [rawStatus]).filter(
        (status) => (status as string) !== "ALL"
      );
      if (!isAllStatus && !statuses.includes(item.status)) continue;
      if (postedWithin !== "all" &&
          filterByPostedWithin([item], postedWithin, () => cleanedPosted, () => job.createdAt, now).length === 0) continue;
      if (workplace !== "all" && !matchesWorkplaceFilter(job.notes, workplace)) continue;

      eligible.push({
        ...(item as ReturnType<typeof withViewerOutcome<RawJobRow>>),
        applications: job.applications ?? [],
        rawDescription: job.rawDescription,
        extractedRequirements: job.extractedRequirements,
        patchProposalBatches:
          "patchProposalBatches" in job && Array.isArray(job.patchProposalBatches)
            ? job.patchProposalBatches
            : undefined,
      });
    }
    if (jobs.length < 500) break;
    cursor = jobs[jobs.length - 1].id;
  }

  const deduped = collapseDuplicateTrackerJobs(eligible);
  const total = deduped.length;
  let applied = 0;
  let interviewing = 0;
  for (const entry of deduped) {
    if (entry.status === "APPLIED" || entry.status === "INTERVIEWING" || entry.status === "OFFER") {
      applied++;
    }
    if (entry.status === "INTERVIEWING") {
      interviewing++;
    }
  }

  const data: Array<Omit<Prisma.JobGetPayload<{ include: typeof jobListInclude }>, "applications" | "extractedRequirements" | "status" | "rawDescription"> & {
    status: JobStatus;
    appliedAt: Date | null;
    appliedVariantId: string | null;
    extractedRequirements: JobRequirements;
    requirementsStatus: RequirementsExtractionStatus;
    requirementsSource: JobRequirementsSource;
    isPlaceholder: boolean;
    hasFullDescription: boolean;
    salaryLabel: string | null;
  }> = [];

  for (const entry of deduped.slice(start, start + limit)) {
    // The scoped proposal lookup is internal and must not leak into board responses.
    const {
      patchProposalBatches: _internal,
      applications: _applications,
      rawDescription,
      extractedRequirements,
      ...visible
    } = entry;
    void _internal;
    void _applications;
    const reqState = parseRequirementsState(
      extractedRequirements,
      rawDescription,
      entry.extractFailure
    );
    const isPlaceholder = isPlaceholderDescription(rawDescription);
    data.push({
      ...visible,
      extractedRequirements: reqState.extractedRequirements,
      requirementsStatus: reqState.requirementsStatus,
      requirementsSource: reqState.requirementsSource,
      isPlaceholder,
      hasFullDescription: !isPlaceholder,
      salaryLabel: extractSalaryFromNotes(entry.notes, rawDescription),
    });
  }

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: { applied, interviewing },
    },
  };
}

export async function getJobById(
  id: string,
  viewerUserId?: string | null,
  db: DbClient = prisma
) {
  const job = await db.job.findFirst({
    where: { id, ...sharedOrSelfJobWhere(viewerUserId) },
    include: jobIncludeForViewer(viewerUserId),
  });

  if (!job) return null;

  const reqState = parseRequirementsState(
    job.extractedRequirements,
    job.rawDescription,
    job.extractFailure
  );
  const isPlaceholder = isPlaceholderDescription(job.rawDescription);

  return {
    ...withViewerOutcome(job, viewerUserId),
    extractedRequirements: reqState.extractedRequirements,
    requirementsStatus: reqState.requirementsStatus,
    requirementsSource: reqState.requirementsSource,
    isPlaceholder,
    hasFullDescription: !isPlaceholder,
    salaryLabel: extractSalaryFromNotes(job.notes, job.rawDescription),
  };
}

export async function deleteJob(id: string, userId?: string) {
  if (!userId) {
    throw new Error("Job not found");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.job.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new Error("Job not found");
    }

    const [proposalBatch, otherApps, variants, coverLetters] = await Promise.all([
      tx.patchProposalBatch.findFirst({
        where: { jobId: id },
        select: { id: true },
      }),
      tx.jobApplication.findFirst({
        where: { jobId: id, userId: { not: userId } },
        select: { id: true },
      }),
      tx.resumeVariant.findMany({
        where: { jobId: id },
        include: { masterResume: { select: { userId: true } } },
      }),
      tx.coverLetter.findMany({
        where: { jobId: id },
        select: { id: true, userId: true, variantId: true },
      }),
    ]);

    const ownedVariantIds = new Set<string>();
    let hasOtherVariants = false;
    for (const v of variants) {
      if (v.masterResume?.userId === userId) {
        ownedVariantIds.add(v.id);
      } else {
        hasOtherVariants = true;
      }
    }

    const ownedLetterIds: string[] = [];
    let hasOtherLetters = false;
    for (const cl of coverLetters) {
      const ownedDirect = cl.userId === userId;
      const ownedViaVariant =
        cl.userId == null && cl.variantId != null && ownedVariantIds.has(cl.variantId);
      if (ownedDirect || ownedViaVariant) {
        ownedLetterIds.push(cl.id);
      } else {
        hasOtherLetters = true;
      }
    }

    if (proposalBatch || otherApps || hasOtherVariants || hasOtherLetters) {
      throw new JobDeleteConflictError(
        "Cannot delete job posting because it has dependent proposal history or external references."
      );
    }

    await tx.jobApplication.deleteMany({ where: { jobId: id, userId } });
    if (ownedLetterIds.length > 0) {
      await tx.coverLetter.deleteMany({
        where: { id: { in: ownedLetterIds } },
      });
    }
    if (ownedVariantIds.size > 0) {
      await tx.resumeVariant.deleteMany({
        where: { id: { in: Array.from(ownedVariantIds) }, masterResume: { userId } },
      });
    }

    const deleted = await tx.job.deleteMany({
      where: { id, userId },
    });
    if (deleted.count === 0) {
      throw new Error("Job not found");
    }
    return existing;
  });
}

const EMPTY_REQUIREMENTS: JobRequirements = {
  requiredSkills: [],
  preferredSkills: [],
  domainTerms: [],
};

function parseRawRequirementsObject(jsonStr: string): {
  extractedRequirements: JobRequirements;
  meta: { source: JobRequirementsSource; version?: number } | null;
} {
  try {
    const raw = JSON.parse(jsonStr) as Record<string, unknown> | null;
    const extractedRequirements = JobRequirementsSchema.parse(raw ?? {});
    const metaParsed = JobRequirementsMetaSchema.safeParse(raw?._meta);
    return {
      extractedRequirements,
      meta: metaParsed.success ? metaParsed.data : null,
    };
  } catch {
    return { extractedRequirements: { ...EMPTY_REQUIREMENTS }, meta: null };
  }
}

export function serializeRequirementsWithMeta(
  reqs: JobRequirements,
  source: JobRequirementsSource
): string {
  const validated = JobRequirementsSchema.parse(reqs);
  return JSON.stringify({
    ...validated,
    _meta: { source, version: CURRENT_REQUIREMENTS_PARSER_VERSION },
  });
}

export function isManuallyEditedRequirements(jsonStr: string): boolean {
  return parseRawRequirementsObject(jsonStr).meta?.source === "manual";
}

export function parseRequirementsState(
  jsonStr: string,
  rawDescription?: string | null,
  extractFailure?: string | null
): {
  extractedRequirements: JobRequirements;
  requirementsStatus: RequirementsExtractionStatus;
  requirementsSource: JobRequirementsSource;
  needsReparse: boolean;
  isManual: boolean;
} {
  const { extractedRequirements, meta } = parseRawRequirementsObject(jsonStr);
  const hasAny =
    extractedRequirements.requiredSkills.length +
      extractedRequirements.preferredSkills.length +
      extractedRequirements.domainTerms.length >
    0;
  const isPlaceholder = isPlaceholderDescription(rawDescription);
  const requirementsSource: JobRequirementsSource = meta
    ? meta.source
    : hasAny
      ? "auto"
      : "unparsed";
  const isManual = requirementsSource === "manual";

  const isStale =
    !isManual &&
    meta !== null &&
    (meta.source === "auto" || meta.source === "ingested") &&
    (meta.version ?? 0) < CURRENT_REQUIREMENTS_PARSER_VERSION;

  const needsReparse =
    !isManual &&
    !isPlaceholder &&
    (requirementsSource === "unparsed" || isStale);

  let requirementsStatus: RequirementsExtractionStatus;
  if (isManual) {
    requirementsStatus = "ready";
  } else if (isPlaceholder) {
    requirementsStatus = extractFailure ? "unavailable" : hasAny ? "ready" : "unparsed";
  } else if (needsReparse) {
    requirementsStatus = "unparsed";
  } else {
    requirementsStatus = "ready";
  }

  return {
    extractedRequirements,
    requirementsStatus,
    requirementsSource,
    needsReparse,
    isManual,
  };
}

export function buildHydratedJobDetail(
  job: {
    id: string;
    rawDescription: string;
    extractedRequirements: string;
    extractFailure?: string | null;
    notes?: string | null;
    company?: string | null;
    roleTitle?: string | null;
  },
  overrides?: {
    requirementsStatus?: RequirementsExtractionStatus;
    extractFailure?: string | null;
  }
): HydratedJobDetail {
  const isPlaceholder = isPlaceholderDescription(job.rawDescription);
  const extractFailure =
    overrides?.extractFailure !== undefined
      ? overrides.extractFailure
      : (job.extractFailure ?? null);
  const reqState = parseRequirementsState(
    job.extractedRequirements,
    job.rawDescription,
    extractFailure
  );
  const requirementsStatus = overrides?.requirementsStatus ?? reqState.requirementsStatus;

  return HydratedJobDetailSchema.parse({
    id: job.id,
    rawDescription: job.rawDescription,
    isPlaceholder,
    hasFullDescription: !isPlaceholder,
    extractedRequirements: reqState.extractedRequirements,
    requirementsStatus,
    requirementsSource: reqState.requirementsSource,
    extractFailure,
    notes: job.notes ?? null,
    salaryLabel: extractSalaryFromNotes(job.notes, job.rawDescription),
    company: job.company ?? null,
    roleTitle: job.roleTitle ?? null,
    location: extractLocationFromNotes(job.notes) || null,
    datePosted: extractPostingDateFromNotes(job.notes) || null,
    applyUrl: extractApplyUrlFromNotes(job.notes) || null,
  });
}



export interface CleanupStalePositionsOptions {
  maxAgeDays?: number;
  now?: Date;
  dryRun?: boolean;
}

/** A non-destructive visibility audit. Identity and all linked history stay intact. */
export async function cleanupStalePositions(options: CleanupStalePositionsOptions = {}) {
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? jobMaxAgeDays();
  // Bounded pages keep memory independent of catalog and history size.
  const expired = { jobs: 0, ingestedJobs: 0, discoveredJobs: 0 };
  const preserved = { applications: 0, variants: 0, coverLetters: 0, proposalBatches: 0, linkedIngestedJobs: 0 };
  const pageSize = 500;
  for (let cursor: string | undefined; ;) {
    const rows = await prisma.job.findMany({
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize,
      select: {
        id: true,
        notes: true,
        createdAt: true,
        _count: { select: { applications: true, variants: true, coverLetters: true, patchProposalBatches: true } },
      },
    });
    for (const j of rows) {
      if (isBoardEligible(extractPostingDateFromNotes(j.notes), j.createdAt, now, maxAgeDays)) continue;
      expired.jobs++;
      if (j._count?.applications) preserved.applications++;
      if (j._count?.variants) preserved.variants++;
      if (j._count?.coverLetters) preserved.coverLetters++;
      if (j._count?.patchProposalBatches) preserved.proposalBatches++;
    }
    if (rows.length < pageSize) break;
    cursor = rows[rows.length - 1].id;
  }
  for (let cursor: string | undefined; ;) {
    const rows = await prisma.ingestedJob.findMany({
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize,
      select: { id: true, postedAt: true, createdAt: true, trackedJobId: true },
    });
    for (const j of rows) {
      if (isBoardEligible(j.postedAt ? new Date(j.postedAt).toISOString() : null, j.createdAt, now, maxAgeDays)) continue;
      expired.ingestedJobs++;
      if (j.trackedJobId) preserved.linkedIngestedJobs++;
    }
    if (rows.length < pageSize) break;
    cursor = rows[rows.length - 1].id;
  }
  for (let cursor: string | undefined; ;) {
    const rows = await prisma.discoveredJob.findMany({
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize,
      select: { id: true, datePosted: true, createdAt: true },
    });
    for (const j of rows) {
      if (!isBoardEligible(j.datePosted, j.createdAt, now, maxAgeDays)) expired.discoveredJobs++;
    }
    if (rows.length < pageSize) break;
    cursor = rows[rows.length - 1].id;
  }
  return {
    dryRun: options.dryRun ?? false,
    maxAgeDays,
    cutoffDate: new Date(now.getTime() - maxAgeDays * 86_400_000).toISOString(),
    expired,
    preserved,
    deletedJobs: 0,
    deletedIngestedJobs: 0,
    deletedDiscoveredJobs: 0,
    totalDeleted: 0,
  };
}
