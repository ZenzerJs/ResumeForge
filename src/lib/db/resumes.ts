import { prisma } from "@/lib/prisma";

export interface CreateResumeInput {
  title?: string;
  typstSource: string;
  isMaster?: boolean;
}

export interface UpdateResumeInput {
  title?: string;
  typstSource?: string;
  isMaster?: boolean;
}

/**
 * Creates a new Resume record.
 * Single Master Enforcement: If `isMaster` is true, a Prisma transaction sets `isMaster = false`
 * on all existing resumes before creating the new master resume record.
 */
export async function createResume(input: CreateResumeInput) {
  const isMaster = Boolean(input.isMaster);

  if (isMaster) {
    return await prisma.$transaction(async (tx) => {
      // Un-master all previous resumes
      await tx.resume.updateMany({
        where: { isMaster: true },
        data: { isMaster: false },
      });

      // Create new master resume
      return await tx.resume.create({
        data: {
          title: input.title || "Master Resume",
          typstSource: input.typstSource,
          isMaster: true,
          isProtected: true,
        },
      });
    });
  }

  return await prisma.resume.create({
    data: {
      title: input.title || "Untitled Resume Variant",
      typstSource: input.typstSource,
      isMaster: false,
      isProtected: false,
    },
  });
}

/**
 * Updates an existing Resume record by ID.
 * If `isMaster` is set to true, un-masters all other resumes in a transaction.
 */
export async function updateResume(id: string, input: UpdateResumeInput) {
  if (input.isMaster) {
    return await prisma.$transaction(async (tx) => {
      await tx.resume.updateMany({
        where: { isMaster: true, NOT: { id } },
        data: { isMaster: false },
      });

      return await tx.resume.update({
        where: { id },
        data: {
          title: input.title,
          typstSource: input.typstSource,
          isMaster: true,
        },
      });
    });
  }

  return await prisma.resume.update({
    where: { id },
    data: {
      title: input.title,
      typstSource: input.typstSource,
      isMaster: input.isMaster,
    },
  });
}

export async function getResumes() {
  return await prisma.resume.findMany({
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMasterResume() {
  return await prisma.resume.findFirst({
    where: { isMaster: true },
  });
}

export async function getResumeById(id: string) {
  return await prisma.resume.findUnique({
    where: { id },
  });
}
