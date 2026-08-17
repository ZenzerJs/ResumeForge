import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  hasMasterResume: boolean;
  masterResumeTitle: string | null;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  jobsCount: number;
  appliedJobsCount: number;
  variantsCount: number;
  coverLettersCount: number;
}

export async function getDashboardStats(userId?: string): Promise<DashboardStats> {
  try {
    const [
      masterResume,
      evidenceCount,
      verifiedEvidenceCount,
      jobsCount,
      appliedJobsCount,
      variantsCount,
      coverLettersCount,
    ] = await Promise.all([
      userId
        ? prisma.resume.findFirst({ where: { isMaster: true, userId }, select: { title: true } })
        : Promise.resolve(null),
      userId
        ? prisma.evidenceItem.count({ where: { status: { not: "archived" }, userId } })
        : Promise.resolve(0),
      userId
        ? prisma.evidenceItem.count({ where: { status: "verified", userId } })
        : Promise.resolve(0),
      prisma.job.count(),
      prisma.job.count({ where: { status: "APPLIED" } }),
      userId
        ? prisma.resumeVariant.count({ where: { masterResume: { userId } } })
        : Promise.resolve(0),
      userId
        ? prisma.coverLetter.count({
            where: {
              OR: [{ userId }, { variant: { masterResume: { userId } } }],
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      hasMasterResume: Boolean(masterResume),
      masterResumeTitle: masterResume?.title ?? null,
      evidenceCount,
      verifiedEvidenceCount,
      jobsCount,
      appliedJobsCount,
      variantsCount,
      coverLettersCount,
    };
  } catch (err) {
    console.warn("[getDashboardStats] Database unavailable, returning guest fallback:", err);
    return emptyGuestStats();
  }
}

export function emptyGuestStats(): DashboardStats {
  return {
    hasMasterResume: false,
    masterResumeTitle: null,
    evidenceCount: 0,
    verifiedEvidenceCount: 0,
    jobsCount: 0,
    appliedJobsCount: 0,
    variantsCount: 0,
    coverLettersCount: 0,
  };
}
