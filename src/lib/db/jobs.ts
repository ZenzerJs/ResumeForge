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

export async function createJob(input: CreateJobInput) {
  const reqsJson = input.extractedRequirements
    ? JSON.stringify(input.extractedRequirements)
    : JSON.stringify({ requiredSkills: [], preferredSkills: [], domainTerms: [] });

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
      userId: input.userId,
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

export async function updateJob(id: string, input: UpdateJobInput, userId?: string) {
  const existing = await prisma.job.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
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

  if (input.status !== undefined) {
    dataToUpdate.status = input.status;
    if (input.status === "APPLIED" && input.appliedAt === undefined && !existing.appliedAt) {
      dataToUpdate.appliedAt = new Date();
    }
  }

  if (input.appliedAt !== undefined) {
    dataToUpdate.appliedAt = input.appliedAt ? new Date(input.appliedAt) : null;
  }

  const updated = await prisma.job.update({
    where: { id },
    data: dataToUpdate,
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
    ...updated,
    extractedRequirements: parseRequirementsJson(updated.extractedRequirements),
  };
}

const jobListInclude = {
  variants: {
    select: { id: true, variantTitle: true, status: true, createdAt: true },
  },
  coverLetters: {
    select: { id: true, title: true, status: true, createdAt: true },
  },
} as const;

export async function getJobs(userId?: string) {
  const jobs = await prisma.job.findMany({
    where: userId ? { userId } : undefined,
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
  userId?: string;
}

export async function getJobsList(query: JobListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));
  const where: Prisma.JobWhereInput = {};
  if (query.userId) where.userId = query.userId;

  if (query.status && query.status !== "ALL") {
    const statuses = Array.isArray(query.status) ? query.status : [query.status];
    where.status = { in: statuses };
  }

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

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: jobListInclude,
  });

  const mapped = jobs.map((job) => {
    const { rawDescription, ...rest } = job;
    return {
      ...rest,
      extractedRequirements: parseRequirementsJson(job.extractedRequirements),
      isPlaceholder: isPlaceholderDescription(rawDescription),
    };
  });

  const postedWithin = query.postedWithin ?? "all";
  const postedFiltered =
    postedWithin === "all"
      ? mapped
      : filterByPostedWithin(
          mapped,
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
  return {
    data: filtered.slice(start, start + limit),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getJobById(id: string, userId?: string) {
  const job = await prisma.job.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
    include: {
      variants: {
        select: { id: true, variantTitle: true, status: true, createdAt: true },
      },
      coverLetters: {
        select: { id: true, title: true, status: true, createdAt: true },
      },
    },
  });

  if (!job) return null;

  return {
    ...job,
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  };
}

export async function deleteJob(id: string, userId?: string) {
  const existing = await prisma.job.findFirst({
    where: { id, ...(userId ? { userId } : {}) },
  });
  if (!existing) return null;
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

