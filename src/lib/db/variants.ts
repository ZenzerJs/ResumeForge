import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseRequirementsState } from "@/lib/db/jobs";
import { sharedOrSelfJobWhere } from "@/lib/db/jobs";

/**
 * Phase 4.2: ResumeVariant Data Access Layer
 *
 * Amendment 3 — Master Resume Isolation Guarantee:
 * Write operations ONLY target ResumeVariant records, never Resume records.
 * The isProtected field on Resume is enforced as a hard guard.
 */

export interface CreateVariantInput {
  masterResumeId: string;
  jobId: string;
  variantTitle: string;
  typstContent: string;
  userId?: string;
}

export interface UpdateVariantInput {
  variantTitle?: string;
  typstContent?: string;
  status?: string; // DRAFT | REVIEWED | EXPORTED
  userId?: string;
}

/**
 * Creates a new ResumeVariant linked to a master resume and job.
 * Verifies master resume exists and has isProtected=true (read-only source).
 */
export async function createVariant(input: CreateVariantInput) {
  // Verify master resume exists
  const masterResume = await prisma.resume.findFirst({
    where: { id: input.masterResumeId, ...(input.userId ? { userId: input.userId } : {}) },
  });

  if (!masterResume) {
    throw new Error(`Master resume not found: ${input.masterResumeId}`);
  }

  const effectiveUserId = input.userId ?? masterResume.userId;

  // Verify job exists and is accessible to the caller
  const job = await prisma.job.findFirst({
    where: {
      id: input.jobId,
      ...sharedOrSelfJobWhere(effectiveUserId),
    },
  });

  if (!job) {
    throw new Error(`Job not found: ${input.jobId}`);
  }

  return await prisma.resumeVariant.create({
    data: {
      masterResumeId: input.masterResumeId,
      jobId: input.jobId,
      variantTitle: input.variantTitle,
      typstContent: input.typstContent,
      factSnapshot: (masterResume.factSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "DRAFT",
    },
  });
}

/**
 * Updates an existing ResumeVariant.
 * Amendment 3: Hard guard — refuses if the target ID does not resolve to an owned ResumeVariant record.
 */
export async function updateVariant(
  variantId: string,
  input: UpdateVariantInput,
  userId?: string
) {
  const effectiveUserId = userId ?? input.userId;

  // Verify variant exists, belongs to caller when userId is provided, and is actually a ResumeVariant
  const variant = await prisma.resumeVariant.findFirst({
    where: {
      id: variantId,
      ...(effectiveUserId ? { masterResume: { userId: effectiveUserId } } : {}),
    },
  });

  if (!variant) {
    throw new Error(`ResumeVariant not found: ${variantId}`);
  }

  return await prisma.resumeVariant.update({
    where: { id: variantId },
    data: {
      variantTitle: input.variantTitle,
      typstContent: input.typstContent,
      status: input.status,
    },
  });
}

/**
 * Fetches a ResumeVariant by ID with its patches and linked job context.
 */
export async function getVariantById(variantId: string, userId?: string) {
  const variant = await prisma.resumeVariant.findFirst({
    where: {
      id: variantId,
      ...(userId ? { masterResume: { userId } } : {}),
    },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
          extractedRequirements: true,
          rawDescription: true,
          extractFailure: true,
        },
      },
      patches: {
        orderBy: { createdAt: "asc" },
        include: {
          citations: { include: { evidence: true, bullet: true } },
        },
      },
    },
  });

  if (!variant) return null;

  return {
    ...variant,
    job: variant.job
      ? {
          id: variant.job.id,
          company: variant.job.company,
          roleTitle: variant.job.roleTitle,
          extractedRequirements: parseRequirementsState(
            variant.job.extractedRequirements,
            variant.job.rawDescription,
            variant.job.extractFailure
          ).extractedRequirements,
        }
      : null,
  };
}

/**
 * Fetches all variants for a given job.
 */
export async function getVariantsByJobId(jobId: string, userId?: string) {
  return await prisma.resumeVariant.findMany({
    where: {
      jobId,
      ...(userId ? { masterResume: { userId } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetches all ResumeVariants ordered by creation date descending.
 */
export async function getVariants(userId?: string) {
  return await prisma.resumeVariant.findMany({
    where: userId ? { masterResume: { userId } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
        },
      },
    },
  });
}

/**
 * Amendment 3 enforcement utility: Asserts a resume ID is NOT protected.
 * Used by API routes as a hard guard before any write operation.
 */
export async function assertNotProtectedResume(resumeId: string): Promise<void> {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, isProtected: true },
  });

  if (resume) {
    throw new Error(
      "SECURITY: Cannot write AI-generated content to a protected Master Resume. Only ResumeVariant records may be modified by AI operations."
    );
  }
}
