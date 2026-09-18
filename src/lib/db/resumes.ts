import { prisma } from "@/lib/prisma";
import { ProtectedResumeError } from "@/lib/security/protected-resume";
import { extractResumeFacts } from "@/lib/facts/extract";

export interface CreateResumeInput {
  title?: string;
  typstSource: string;
  isMaster?: boolean;
  userId?: string;
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
      await tx.resume.updateMany({
        where: { isMaster: true, ...(input.userId ? { userId: input.userId } : {}) },
        data: { isMaster: false },
      });

      const evidence = await (tx as any).evidenceItem.findMany({
        where: { status: "verified", ...(input.userId ? { userId: input.userId } : {}) },
        include: { bullets: true },
      });
      const factSnapshot = extractResumeFacts(input.typstSource, evidence);

      return await tx.resume.create({
        data: {
          title: input.title || "Master Resume",
          typstSource: input.typstSource,
          isMaster: true,
          isProtected: true,
          factSnapshot: factSnapshot as any,
          userId: input.userId,
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
      userId: input.userId,
    },
  });
}

/**
 * Updates an existing Resume record by ID.
 * If `isMaster` is set to true, un-masters all other resumes in a transaction.
 */
export async function updateResume(id: string, input: UpdateResumeInput) {
  const existing = await prisma.resume.findUnique({ where: { id } });
  if (!existing) return null;

  if (existing.isProtected) {
    throw new ProtectedResumeError();
  }

  if (input.isMaster) {
    return await prisma.$transaction(async (tx) => {
      await tx.resume.updateMany({
        where: { isMaster: true, NOT: { id } },
        data: { isMaster: false },
      });

      const evidence = await (tx as any).evidenceItem.findMany({
        where: { status: "verified", ...(existing.userId ? { userId: existing.userId } : {}) },
        include: { bullets: true },
      });
      const factSnapshot = extractResumeFacts(input.typstSource || existing.typstSource, evidence);

      return await tx.resume.update({
        where: { id },
        data: {
          title: input.title,
          typstSource: input.typstSource,
          isMaster: true,
          isProtected: true,
          factSnapshot: factSnapshot as any,
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

export async function getResumes(userId?: string) {
  return await prisma.resume.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMasterResume(userId?: string) {
  return await prisma.resume.findFirst({
    where: {
      isMaster: true,
      ...(userId ? { userId } : {}),
    },
  });
}

export async function getResumeById(id: string, userId?: string) {
  return await prisma.resume.findFirst({
    where: {
      id,
      ...(userId ? { userId } : {}),
    },
  });
}

export interface SaveMasterInput {
  id?: string;
  title?: string;
  typstSource: string;
  confirmOverwrite?: boolean;
  userId?: string;
}

export interface SaveMasterResult {
  success: boolean;
  data: any;
  snapshotId?: string;
}

/**
 * Task 7.9: Confirmed "Save as Master" with automatic pre-overwrite snapshot.
 *
 * 1. Checks if an existing Master resume exists.
 * 2. Blocks unconfirmed overwrite attempts (returns error / throws).
 * 3. In a transaction:
 *    a. Creates a MasterHistory snapshot record of the pre-overwrite state.
 *    b. Updates or creates the Master resume with new typstSource.
 * 4. Returns the updated master resume and the snapshotId for instant Undo.
 */
export async function saveMasterResume(input: SaveMasterInput): Promise<SaveMasterResult> {
  const currentMaster = await getMasterResume(input.userId);

  if (currentMaster && !input.confirmOverwrite) {
    throw new Error("Unconfirmed Master Resume overwrite blocked. Explicit confirmation required before saving to Master.");
  }

  let targetId = input.id || currentMaster?.id;
  if (targetId && input.userId) {
    const owned = await getResumeById(targetId, input.userId);
    if (!owned) targetId = currentMaster?.id;
  }

  return await prisma.$transaction(async (tx) => {
    let master: any;
    const ownerFilter = input.userId ? { userId: input.userId } : {};

    const evidence = await (tx as any).evidenceItem.findMany({
      where: { status: "verified", ...ownerFilter },
      include: { bullets: true },
    });
    const factSnapshot = extractResumeFacts(input.typstSource, evidence);

    if (targetId && currentMaster) {
      await tx.resume.updateMany({
        where: { isMaster: true, ...ownerFilter, NOT: { id: targetId } },
        data: { isMaster: false },
      });

      master = await tx.resume.update({
        where: { id: targetId },
        data: {
          title: input.title || "Master Resume",
          typstSource: input.typstSource,
          isMaster: true,
          isProtected: true,
          factSnapshot: factSnapshot as any,
          ...(input.userId ? { userId: input.userId } : {}),
        },
      });
    } else {
      await tx.resume.updateMany({
        where: { isMaster: true, ...ownerFilter },
        data: { isMaster: false },
      });

      master = await tx.resume.create({
        data: {
          title: input.title || "Master Resume",
          typstSource: input.typstSource,
          isMaster: true,
          isProtected: true,
          factSnapshot: factSnapshot as any,
          userId: input.userId,
        },
      });
    }

    // Record snapshot of state prior to save (or initial version)
    const snapshotSource = currentMaster ? currentMaster.typstSource : input.typstSource;
    const snapshotTitle = currentMaster ? currentMaster.title : (input.title || "Master Resume");

    const snapshot = await (tx as any).masterHistory.create({
      data: {
        resumeId: master.id,
        title: snapshotTitle,
        typstSource: snapshotSource,
        reason: currentMaster ? "pre-overwrite-snapshot" : "initial-master-snapshot",
      },
    });

    return {
      success: true,
      data: master,
      snapshotId: snapshot.id,
    };
  });
}

export async function getLatestSnapshot(resumeId: string) {
  return await (prisma as any).masterHistory.findFirst({
    where: { resumeId },
    orderBy: { savedAt: "desc" },
  });
}

export async function restoreMasterSnapshot(snapshotId: string, userId?: string) {
  const snapshot = await (prisma as any).masterHistory.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) {
    throw new Error(`MasterHistory snapshot record "${snapshotId}" not found.`);
  }

  if (userId) {
    const owned = await getResumeById(snapshot.resumeId, userId);
    if (!owned) {
      throw new Error(`MasterHistory snapshot record "${snapshotId}" not found.`);
    }
  }

  return await prisma.$transaction(async (tx) => {
    // Restore the snapshot typstSource to the master resume
    const restored = await tx.resume.update({
      where: { id: snapshot.resumeId },
      data: {
        typstSource: snapshot.typstSource,
        title: snapshot.title,
        isMaster: true,
        isProtected: true,
      },
    });

    return restored;
  });
}

