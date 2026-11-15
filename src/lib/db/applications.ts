import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JobStatus } from "@/lib/db/jobs";

type DbClient = Prisma.TransactionClient | typeof prisma;

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
  input: UpsertApplicationInput,
  tx?: Prisma.TransactionClient
) {
  const db: DbClient = tx ?? prisma;
  const job = await db.job.findFirst({
    where: {
      id: jobId,
      OR: [{ userId: null }, { userId }],
    },
    select: { id: true },
  });
  if (!job) return null;

  if (input.variantId) {
    const variant = await db.resumeVariant.findFirst({
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

  const existing = await db.jobApplication.findFirst({
    where: { userId, jobId },
  });

  const nextStatus = input.status ?? existing?.status ?? "SAVED";
  let appliedAt = existing?.appliedAt ?? null;
  if (input.appliedAt !== undefined) {
    if (input.appliedAt === null || input.appliedAt === "") {
      appliedAt = null;
    } else {
      const parsedDate = input.appliedAt instanceof Date ? input.appliedAt : new Date(input.appliedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new ApplicationInputError("Invalid appliedAt date");
      }
      appliedAt = parsedDate;
    }
  } else if (nextStatus === "APPLIED" && !appliedAt) {
    appliedAt = new Date();
  }

  const data = {
    status: nextStatus,
    appliedAt,
    ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
  };

  const saved = existing
    ? await db.jobApplication.update({
        where: { id: existing.id },
        data,
      })
    : await db.jobApplication.create({
        data: {
          userId,
          jobId,
          ...data,
        },
      });

  if (!existing || existing.status !== nextStatus) {
    await db.applicationEvent.create({
      data: {
        applicationId: saved.id,
        fromStatus: existing?.status ?? null,
        toStatus: nextStatus,
      },
    });
  }

  return saved;
}
