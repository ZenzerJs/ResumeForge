import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobSource, Prisma, WorkplaceType } from "@prisma/client";
import { isWithinRadiusKm } from "@/lib/geo/geocoding";
import { calculateBlendedScore, type ScoreBreakdown } from "@/lib/scoring/blended-sort";
import {
  calculateJobCompatibility,
  type CompatibilityResult,
} from "@/lib/scoring/compatibility-engine";
import { computeIngestedJobEnrichment } from "@/lib/connectors/enrichment";
import {
  ParsedIngestedRequirementsSchema,
  type ParsedIngestedRequirements,
} from "@/lib/jd-parser/types";
import { getRequestUserId } from "@/lib/security/auth-request";
import { jobMaxAgeDays } from "@/lib/jobs/expiry";
import { collapseDuplicateIngestedJobs } from "@/lib/jobs/posting-identity";
import { loadScoringEvidence } from "@/lib/scoring/user-evidence";

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

    const cutoff = new Date(Date.now() - jobMaxAgeDays() * 86_400_000);
    const now = new Date();
    andConditions.push({ OR: [
      { postedAt: { gte: cutoff, lte: now } },
      { AND: [{ OR: [{ postedAt: null }, { postedAt: { gt: now } }] }, { createdAt: { gte: cutoff } }] },
    ] });

    if (canadianOnly) {
      andConditions.push({ isCanadianEligible: true });
    }

    if (workplace && workplace in WorkplaceType) {
      andConditions.push({ workplaceType: workplace as WorkplaceType });
    }

    const validSources = Object.values(JobSource) as string[];
    if (source && source !== "ALL") {
      if (!validSources.includes(source)) {
        return NextResponse.json({ error: "Invalid source parameter" }, { status: 400 });
      }
      andConditions.push({ source: source as JobSource });
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

    // Pass 1: Fetch only filtering/scoring inputs for the 500-candidate window
    const candidateJobs = await prisma.ingestedJob.findMany({
      where,
      take: 500,
      orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        externalId: true,
        source: true,
        companyName: true,
        title: true,
        location: true,
        workplaceType: true,
        applyUrl: true,
        trackedJobId: true,
        postedAt: true,
        createdAt: true,
        salaryMin: true,
        salaryMax: true,
        lat: true,
        lng: true,
        cityNorm: true,
        parsedRequirements: true,
      },
    });

    const userId = await getRequestUserId(req);
    const { candidateSkills, evidenceItemsForMatching } = await loadScoringEvidence(userId);
    const hasEvidence = candidateSkills.length > 0 || evidenceItemsForMatching.length > 0;

    const targetCityKey = city.toLowerCase();
    const hasCityFilter = targetCityKey !== "all" && targetCityKey !== "all canada" && targetCityKey !== "";

    const parsedByJobId = new Map<string, ParsedIngestedRequirements>();
    const unprocessedIds: string[] = [];
    for (const job of candidateJobs) {
      const parsed = ParsedIngestedRequirementsSchema.safeParse(job.parsedRequirements);
      if (parsed.success) {
        parsedByJobId.set(job.id, parsed.data);
      } else {
        unprocessedIds.push(job.id);
      }
    }

    const fallbackEnrichmentById = new Map<
      string,
      ReturnType<typeof computeIngestedJobEnrichment>
    >();
    if (unprocessedIds.length > 0) {
      const legacyRows = await prisma.ingestedJob.findMany({
        where: { id: { in: unprocessedIds } },
        select: { id: true, description: true, location: true },
      });
      for (const row of legacyRows) {
        fallbackEnrichmentById.set(
          row.id,
          computeIngestedJobEnrichment({
            description: row.description,
            location: row.location,
          }),
        );
      }
    }

    // Score and geo-filter in memory
    interface ScoredCandidate {
      id: string;
      externalId: string;
      source: string;
      companyName: string;
      title: string;
      location: string;
      applyUrl: string;
      trackedJobId: string | null;
      hasParsedRequirements: boolean;
      lat: number | null;
      lng: number | null;
      postedAt: Date | null;
      createdAt: Date;
      salaryMin: number | null;
      salaryMax: number | null;
      scoreBreakdown: ScoreBreakdown;
      blendedScore: number;
      compatibility: CompatibilityResult;
    }

    const scoredJobs: ScoredCandidate[] = [];

    for (const job of candidateJobs) {
      const precomputed = parsedByJobId.get(job.id);
      const fallback = precomputed ? undefined : fallbackEnrichmentById.get(job.id);

      const jobLat = fallback ? fallback.lat : (job.lat ?? null);
      const jobLng = fallback ? fallback.lng : (job.lng ?? null);
      const geoRemote = precomputed
        ? precomputed.geoRemote
        : (fallback?.parsedRequirements.geoRemote ?? false);
      const isJobRemote = job.workplaceType === WorkplaceType.REMOTE || geoRemote;

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

      const reqs = precomputed
        ? precomputed.requirements
        : (fallback?.parsedRequirements.requirements ?? null);

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

      const hasParsedRequirements = Boolean(
        reqs &&
          reqs.requiredSkills.length + reqs.preferredSkills.length + reqs.domainTerms.length > 0
      );

      scoredJobs.push({
        id: job.id,
        externalId: job.externalId,
        source: job.source,
        companyName: job.companyName,
        title: job.title,
        location: job.location,
        applyUrl: job.applyUrl,
        trackedJobId: job.trackedJobId ?? null,
        hasParsedRequirements,
        lat: jobLat,
        lng: jobLng,
        postedAt: job.postedAt,
        createdAt: job.createdAt,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        scoreBreakdown,
        blendedScore: scoreBreakdown.finalScore,
        compatibility,
      });
    }

    const dedupedJobs = collapseDuplicateIngestedJobs(scoredJobs);

    // Sort scored records
    if (sort === "blended") {
      dedupedJobs.sort((a, b) => b.blendedScore - a.blendedScore);
    } else if (sort === "ats") {
      dedupedJobs.sort((a, b) => b.scoreBreakdown.atsScore - a.scoreBreakdown.atsScore);
    } else if (sort === "newest") {
      dedupedJobs.sort((a, b) => {
        const timeA = new Date(a.postedAt || a.createdAt).getTime();
        const timeB = new Date(b.postedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
    } else if (sort === "salary") {
      dedupedJobs.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
    }

    const total = dedupedJobs.length;
    const skip = (page - 1) * limit;
    const paginatedMeta = dedupedJobs.slice(skip, skip + limit);

    // Pass 2: Fetch full response fields only for the selected page
    const pageIds = paginatedMeta.map((item) => item.id);
    const pageRows = pageIds.length > 0
      ? await prisma.ingestedJob.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true,
            externalId: true,
            source: true,
            companyName: true,
            title: true,
            location: true,
            workplaceType: true,
            isCanadianEligible: true,
            description: true,
            descriptionHtml: true,
            applyUrl: true,
            postedAt: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            createdAt: true,
            lat: true,
            lng: true,
            cityNorm: true,
            trackedJob: {
              select: { id: true, status: true },
            },
          },
        })
      : [];
    const rowById = new Map(pageRows.map((row) => [row.id, row]));
    const paginated: ScoredIngestedJob[] = paginatedMeta
      .map((meta): ScoredIngestedJob | null => {
        const row = rowById.get(meta.id);
        if (!row) return null;
        return {
          ...row,
          lat: meta.lat,
          lng: meta.lng,
          scoreBreakdown: meta.scoreBreakdown,
          blendedScore: meta.blendedScore,
          compatibility: meta.compatibility,
        };
      })
      .filter((item): item is ScoredIngestedJob => item !== null);

    return NextResponse.json({
      success: true,
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        capped: false,
      },
      hasEvidence,
    });
  } catch (err: any) {
    console.error("[API connectors/jobs] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ingested jobs" },
      { status: 500 }
    );
  }
}
