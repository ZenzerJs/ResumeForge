import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, WorkplaceType } from "@prisma/client";
import {
  geocodeCanadianLocation,
  isWithinRadiusKm,
  CANADIAN_TECH_HUBS,
} from "@/lib/geo/geocoding";
import { calculateBlendedScore, type ScoreBreakdown } from "@/lib/scoring/blended-sort";
import {
  calculateJobCompatibility,
  type CompatibilityResult,
} from "@/lib/scoring/compatibility-engine";
import { parseJobDescription } from "@/lib/jd-parser/parser";

export const dynamic = "force-dynamic";

export interface ScoredIngestedJob {
  id: string;
  externalId: string;
  source: string;
  companyName: string;
  title: string;
  location: string;
  workplaceType: string;
  isCanadianEligible: boolean;
  description: string;
  descriptionHtml: string;
  applyUrl: string;
  postedAt: Date | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  createdAt: Date;
  lat?: number | null;
  lng?: number | null;
  cityNorm?: string | null;
  trackedJob?: { id: string; status: string } | null;
  scoreBreakdown: ScoreBreakdown;
  blendedScore: number;
  compatibility?: CompatibilityResult;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const canadianOnly = searchParams.get("canadianOnly") === "true";
    const workplace = searchParams.get("workplace")?.toUpperCase();
    const source = searchParams.get("source")?.toUpperCase();
    const city = searchParams.get("city") || "all";
    const radiusKm = Number(searchParams.get("radiusKm") || "100");
    const minSalary = Number(searchParams.get("minSalary") || "0");
    const minScore = Number(searchParams.get("minScore") || "0");
    const sort = searchParams.get("sort") || "blended";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "40")));

    const postedWithin = searchParams.get("postedWithin") || "all";
    const andConditions: Prisma.IngestedJobWhereInput[] = [];

    if (canadianOnly) {
      andConditions.push({ isCanadianEligible: true });
    }

    if (workplace && workplace in WorkplaceType) {
      andConditions.push({ workplaceType: workplace as WorkplaceType });
    }

    if (source && source !== "ALL") {
      andConditions.push({ source: source as any });
    }

    if (search) {
      andConditions.push({
        OR: [
          { companyName: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (postedWithin && postedWithin !== "all") {
      const days =
        postedWithin === "1d"
          ? 1
          : postedWithin === "3d"
          ? 3
          : postedWithin === "7d"
          ? 7
          : postedWithin === "30d"
          ? 30
          : null;
      if (days) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        andConditions.push({
          OR: [
            { postedAt: { gte: since } },
            { AND: [{ postedAt: null }, { createdAt: { gte: since } }] },
          ],
        });
      }
    }

    if (minSalary > 0) {
      andConditions.push({
        OR: [
          { salaryMax: { gte: minSalary } },
          { AND: [{ salaryMax: null }, { salaryMin: { gte: minSalary } }] },
        ],
      });
    }

    const where: Prisma.IngestedJobWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    // Fetch candidate records to calculate scoring and geo-filtering
    const rawJobs = await prisma.ingestedJob.findMany({
      where,
      take: 200,
      include: {
        trackedJob: {
          select: { id: true, status: true },
        },
      },
    });

    // Fetch candidate Evidence items to calculate personalized compatibility
    let candidateSkills: string[] = [];
    let evidenceItemsForMatching: any[] = [];
    try {
      const evidenceRecords = await prisma.evidenceItem.findMany({
        where: { status: { not: "archived" } },
        include: { bullets: true },
      });
      evidenceItemsForMatching = evidenceRecords.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        organization: e.organization,
        dates: e.dates,
        verifiedSummary: e.verifiedSummary,
        tags: typeof e.tags === "string" ? JSON.parse(e.tags || "[]") : e.tags,
        status: e.status,
        bullets: e.bullets.map((b) => ({
          id: b.id,
          text: b.text,
          technologies:
            typeof b.technologies === "string"
              ? JSON.parse(b.technologies || "[]")
              : b.technologies,
          roleAffinity:
            typeof b.roleAffinity === "string"
              ? JSON.parse(b.roleAffinity || "[]")
              : b.roleAffinity,
          verified: b.verified,
        })),
      }));
      candidateSkills = evidenceItemsForMatching.flatMap((e) => [
        ...(Array.isArray(e.tags) ? e.tags : []),
        ...(Array.isArray(e.bullets)
          ? e.bullets.flatMap((b: any) => (Array.isArray(b.technologies) ? b.technologies : []))
          : []),
      ]);
    } catch {
      // Non-blocking fallback
    }

    const targetCityKey = city.toLowerCase();
    const hasCityFilter = targetCityKey !== "all" && targetCityKey !== "all canada" && targetCityKey !== "";

    // Score and geo-filter in memory
    const scoredJobs: ScoredIngestedJob[] = [];

    for (const job of rawJobs) {
      let jobLat = job.lat;
      let jobLng = job.lng;
      let isJobRemote = job.workplaceType === WorkplaceType.REMOTE;

      if (jobLat == null || jobLng == null) {
        const geo = geocodeCanadianLocation(job.location);
        if (geo) {
          jobLat = geo.lat;
          jobLng = geo.lng;
          isJobRemote = isJobRemote || geo.isRemote;
        }
      }

      // Geo-radius filtering
      if (hasCityFilter && !isJobRemote) {
        if (!isWithinRadiusKm(jobLat, jobLng, targetCityKey, radiusKm)) {
          continue;
        }
      }

      const isCityMatch = hasCityFilter && (
        (jobLat != null && jobLng != null && isWithinRadiusKm(jobLat, jobLng, targetCityKey, 40)) ||
        job.location.toLowerCase().includes(targetCityKey)
      );

      let reqs = null;
      try {
        reqs = parseJobDescription(job.description);
      } catch {
        reqs = null;
      }

      const compatibility = calculateJobCompatibility(
        reqs,
        candidateSkills,
        evidenceItemsForMatching
      );

      const scoreBreakdown = calculateBlendedScore({
        atsScore: compatibility.overallScore,
        postedAt: job.postedAt,
        createdAt: job.createdAt,
        isRemote: isJobRemote,
        isCityMatch,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        targetMinSalary: minSalary,
      });

      if (minScore > 0 && compatibility.overallScore < minScore && scoreBreakdown.finalScore < minScore) {
        continue;
      }

      scoredJobs.push({
        ...job,
        lat: jobLat,
        lng: jobLng,
        scoreBreakdown,
        blendedScore: scoreBreakdown.finalScore,
        compatibility,
      });
    }

    // Sort scored records
    if (sort === "blended") {
      scoredJobs.sort((a, b) => b.blendedScore - a.blendedScore);
    } else if (sort === "ats") {
      scoredJobs.sort((a, b) => b.scoreBreakdown.atsScore - a.scoreBreakdown.atsScore);
    } else if (sort === "newest") {
      scoredJobs.sort((a, b) => {
        const timeA = (a.postedAt || a.createdAt).getTime();
        const timeB = (b.postedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
    } else if (sort === "salary") {
      scoredJobs.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
    }

    const total = scoredJobs.length;
    const skip = (page - 1) * limit;
    const paginated = scoredJobs.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    console.error("[API connectors/jobs] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch ingested jobs" },
      { status: 500 }
    );
  }
}
