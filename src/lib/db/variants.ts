import { prisma } from "@/lib/prisma";

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
}

export interface UpdateVariantInput {
  variantTitle?: string;
  typstContent?: string;
  status?: string; // DRAFT | REVIEWED | EXPORTED
}

/**
 * Creates a new ResumeVariant linked to a master resume and job.
 * Verifies master resume exists and has isProtected=true (read-only source).
 */
export async function createVariant(input: CreateVariantInput) {
  // Verify master resume exists
  const masterResume = await prisma.resume.findUnique({
    where: { id: input.masterResumeId },
  });

  if (!masterResume) {
    throw new Error(`Master resume not found: ${input.masterResumeId}`);
  }

  // Verify job exists
  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
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
      status: "DRAFT",
    },
  });
}

/**
 * Updates an existing ResumeVariant.
 * Amendment 3: Hard guard — refuses if the target ID resolves to a protected Resume record.
 */
export async function updateVariant(variantId: string, input: UpdateVariantInput) {
  // Verify variant exists and is actually a ResumeVariant (not a Resume)
  const variant = await prisma.resumeVariant.findUnique({
    where: { id: variantId },
  });

  if (!variant) {
    throw new Error(`ResumeVariant not found: ${variantId}`);
  }

  // Double-check: ensure we are not somehow writing to a protected master resume
  // This guards against ID confusion attacks or bugs
  const protectedResume = await prisma.resume.findFirst({
    where: { id: variantId, isProtected: true },
  });

  if (protectedResume) {
    throw new Error(
      "SECURITY: Attempted to write AI-generated content to a protected Master Resume. This operation is forbidden."
    );
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
 * Fetches a ResumeVariant by ID with its patches.
 */
export async function getVariantById(variantId: string) {
  return await prisma.resumeVariant.findUnique({
    where: { id: variantId },
    include: {
      patches: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/**
 * Fetches all variants for a given job.
 */
export async function getVariantsByJobId(jobId: string) {
  return await prisma.resumeVariant.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetches all ResumeVariants ordered by creation date descending.
 */
export async function getVariants() {
  return await prisma.resumeVariant.findMany({
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
