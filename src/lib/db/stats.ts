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
      userId
        ? prisma.jobApplication.count({ where: { userId } })
        : Promise.resolve(0),
      userId
        ? prisma.jobApplication.count({ where: { userId, status: "APPLIED" } })
        : Promise.resolve(0),
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

const FUNNEL = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;

export interface VariantOutcome {
  variantId: string | null;
  variantTitle: string;
  company: string | null;
  roleTitle: string | null;
  applications: number;
  interviews: number;
  offers: number;
  interviewRate: number;
}

export interface OutcomeStats {
  funnel: Record<(typeof FUNNEL)[number], number>;
  interviewRate: number;
  medianResponseDays: number | null;
  variants: VariantOutcome[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function getOutcomeStats(userId: string): Promise<OutcomeStats> {
  const apps = await prisma.jobApplication.findMany({
    where: { userId },
    include: {
      job: { select: { company: true, roleTitle: true } },
      variant: { select: { id: true, variantTitle: true } },
      events: { orderBy: { at: "asc" } },
    },
  });

  const funnel = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEWING: 0,
    OFFER: 0,
    REJECTED: 0,
  };
  for (const app of apps) {
    if (app.status in funnel) funnel[app.status as keyof typeof funnel] += 1;
  }
  const pastSaved = funnel.APPLIED + funnel.INTERVIEWING + funnel.OFFER + funnel.REJECTED;
  const interviewed = funnel.INTERVIEWING + funnel.OFFER;
  const interviewRate = pastSaved === 0 ? 0 : interviewed / pastSaved;

  const responseDays: number[] = [];
  for (const app of apps) {
    const appliedEvent = app.events.find((event) => event.toStatus === "APPLIED");
    const appliedAt = appliedEvent?.at ?? app.appliedAt;
    const response = app.events.find((event) =>
      event.toStatus === "INTERVIEWING" || event.toStatus === "OFFER" || event.toStatus === "REJECTED"
    );
    if (!appliedAt || !response) continue;
    const days = (response.at.getTime() - new Date(appliedAt).getTime()) / 86_400_000;
    if (days >= 0) responseDays.push(days);
  }

  const groups = new Map<string, VariantOutcome>();
  for (const app of apps) {
    if (app.status === "SAVED" || app.status === "ARCHIVED") continue;
    const key = app.variantId ?? "none";
    const current = groups.get(key) ?? {
      variantId: app.variantId,
      variantTitle: app.variant?.variantTitle ?? "No variant sent",
      company: app.variantId ? app.job.company : null,
      roleTitle: app.variantId ? app.job.roleTitle : null,
      applications: 0,
      interviews: 0,
      offers: 0,
      interviewRate: 0,
    };
    if (current.applications > 0) {
      if (current.company && current.company !== app.job.company) current.company = null;
      if (current.roleTitle && current.roleTitle !== app.job.roleTitle) current.roleTitle = null;
    }
    current.applications += 1;
    if (app.status === "INTERVIEWING" || app.status === "OFFER") current.interviews += 1;
    if (app.status === "OFFER") current.offers += 1;
    current.interviewRate = current.applications === 0 ? 0 : current.interviews / current.applications;
    groups.set(key, current);
  }

  return {
    funnel,
    interviewRate,
    medianResponseDays: median(responseDays),
    variants: [...groups.values()].sort((a, b) => b.applications - a.applications),
  };
}
