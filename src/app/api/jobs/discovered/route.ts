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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const filter = searchParams.get("filter") || "all"; // all | open | closed
    const postedRaw = searchParams.get("postedWithin") || "all";
    const postedWithin: PostedWithin = isPostedWithinParam(postedRaw) ? postedRaw : "all";

    const where: Prisma.DiscoveredJobWhereInput = {};

    if (filter === "open") {
      where.isClosed = false;
    } else if (filter === "closed") {
      where.isClosed = true;
    }

    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { roleTitle: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }
    const filtered: Awaited<ReturnType<typeof prisma.discoveredJob.findMany>> = [];
    const now = new Date();
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
