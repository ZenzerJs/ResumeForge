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
  const owner = userId ? { userId } : {};
  const [
    masterResume,
    evidenceCount,
    verifiedEvidenceCount,
    jobsCount,
    appliedJobsCount,
    variantsCount,
    coverLettersCount,
  ] = await Promise.all([
    prisma.resume.findFirst({ where: { isMaster: true, ...owner }, select: { title: true } }),
    prisma.evidenceItem.count({ where: { status: { not: "archived" }, ...owner } }),
    prisma.evidenceItem.count({ where: { status: "verified", ...owner } }),
    prisma.job.count({ where: owner }),
    prisma.job.count({ where: { status: "APPLIED", ...owner } }),
    userId
      ? prisma.resumeVariant.count({ where: { masterResume: { userId } } })
      : prisma.resumeVariant.count(),
    userId
      ? prisma.coverLetter.count({ where: { job: { userId } } })
      : prisma.coverLetter.count(),
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
