import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, WorkplaceType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const canadianOnly = searchParams.get("canadianOnly") === "true";
    const workplace = searchParams.get("workplace")?.toUpperCase();
    const source = searchParams.get("source")?.toUpperCase();
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "40")));
    const skip = (page - 1) * limit;

    const where: Prisma.IngestedJobWhereInput = {};

    if (canadianOnly) {
      where.isCanadianEligible = true;
    }

    if (workplace && workplace in WorkplaceType) {
      where.workplaceType = workplace as WorkplaceType;
    }

    if (source && source !== "ALL") {
      where.source = source as any;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, jobs] = await Promise.all([
      prisma.ingestedJob.count({ where }),
      prisma.ingestedJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          trackedJob: {
            select: { id: true, status: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: jobs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
