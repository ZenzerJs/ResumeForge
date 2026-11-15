import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  filterByPostedWithin,
  isPostedWithinParam,
  type PostedWithin,
} from "@/lib/jobs/posted-within";
import { isBoardEligible } from "@/lib/jobs/expiry";
import { sanitizeError } from "@/lib/ai/redact";

const WITHIN_DAYS: Record<Exclude<PostedWithin, "all">, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const filter = searchParams.get("filter") || "all"; // all | open | closed
    const postedRaw = searchParams.get("postedWithin") || "all";
    const postedWithin: PostedWithin = isPostedWithinParam(postedRaw) ? postedRaw : "all";

    const where: Prisma.DiscoveredJobWhereInput = {};
    const andFilters: Prisma.DiscoveredJobWhereInput[] = [];

    if (filter === "open") {
      where.isClosed = false;
    } else if (filter === "closed") {
      where.isClosed = true;
    }

    if (search) {
      andFilters.push({
        OR: [
          { company: { contains: search, mode: "insensitive" } },
          { roleTitle: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const now = new Date();
    if (postedWithin !== "all") {
      const cutoff = new Date(now.getTime() - WITHIN_DAYS[postedWithin] * 86_400_000);
      andFilters.push({
        OR: [
          { createdAt: { gte: cutoff } },
          {
            AND: [
              { datePosted: { not: null } },
              { NOT: { datePosted: { endsWith: "ago" } } },
            ],
          },
        ],
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const filtered: Awaited<ReturnType<typeof prisma.discoveredJob.findMany>> = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await prisma.discoveredJob.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: 500,
      });
      filtered.push(...filterByPostedWithin(
        page.filter(j => isBoardEligible(j.datePosted, j.createdAt, now)),
        postedWithin,
        j => j.datePosted,
        j => j.createdAt,
        now,
      ));
      if (filtered.length >= 200 || page.length < 500) break;
      cursor = page[page.length - 1].id;
    }
    filtered.splice(200);

    return NextResponse.json({
      success: true,
      data: filtered,
      meta: { postedWithin, filter, count: filtered.length },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch discovered jobs", message: sanitizeError(err) },
      { status: 500 },
    );
  }
}
