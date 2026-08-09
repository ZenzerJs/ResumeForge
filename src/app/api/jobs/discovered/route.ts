import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  filterByPostedWithin,
  isPostedWithinParam,
  type PostedWithin,
} from "@/lib/jobs/posted-within";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
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
        { company: { contains: search } },
        { roleTitle: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const jobs = await prisma.discoveredJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const filtered = filterByPostedWithin(
      jobs,
      postedWithin,
      (j) => j.datePosted,
      (j) => j.createdAt,
    ).slice(0, 200);

    return NextResponse.json({
      success: true,
      data: filtered,
      meta: { postedWithin, filter, count: filtered.length },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch discovered jobs", message: String(err) },
      { status: 500 },
    );
  }
}
