import { prisma } from "@/lib/prisma";
import type { JobStatus } from "@/lib/db/jobs";

export class ApplicationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationInputError";
  }
}

export interface UpsertApplicationInput {
  status?: JobStatus;
  appliedAt?: Date | string | null;
  variantId?: string | null;
}

export async function upsertApplication(
  userId: string,
  jobId: string,
  input: UpsertApplicationInput
) {
  const job = await prisma.job.findFirst({ where: { id: jobId }, select: { id: true } });
  if (!job) return null;

  if (input.variantId) {
    const variant = await prisma.resumeVariant.findFirst({
      where: {
        id: input.variantId,
        jobId,
        masterResume: { userId },
      },
      select: { id: true },
    });
    if (!variant) {
      throw new ApplicationInputError("Variant does not belong to this job");
    }
  }

  const existing = await prisma.jobApplication.findFirst({
    where: { userId, jobId },
  });

  const nextStatus = input.status ?? existing?.status ?? "SAVED";
  let appliedAt = existing?.appliedAt ?? null;
  if (input.appliedAt !== undefined) {
    appliedAt = input.appliedAt ? new Date(input.appliedAt) : null;
  } else if (nextStatus === "APPLIED" && !appliedAt) {
    appliedAt = new Date();
  }

  const data = {
    status: nextStatus,
    appliedAt,
    ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
  };

  const saved = existing
    ? await prisma.jobApplication.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.jobApplication.create({
        data: {
          userId,
          jobId,
          ...data,
        },
      });

  if (!existing || existing.status !== nextStatus) {
    await prisma.applicationEvent.create({
      data: {
        applicationId: saved.id,
        fromStatus: existing?.status ?? null,
        toStatus: nextStatus,
      },
    });
  }

  return saved;
}
