import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  filterByPostedWithin,
  isPostedWithinParam,
  type PostedWithin,
} from "@/lib/jobs/posted-within";
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

    // SQLite `contains` is case-sensitive — pull candidates then filter in JS.
    const jobs = await prisma.discoveredJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const q = search.toLowerCase();
    const searched = q
      ? jobs.filter(
          (j) =>
            j.company.toLowerCase().includes(q) ||
            j.roleTitle.toLowerCase().includes(q) ||
            (j.location || "").toLowerCase().includes(q),
        )
      : jobs;

    const filtered = filterByPostedWithin(
      searched,
      postedWithin,
      (j) => {
        const raw = (j.datePosted || "").trim();
        // Guard bad column parses like "Apply"
        if (!raw || /^apply$/i.test(raw)) return null;
        return raw;
      },
      (j) => j.createdAt,
    ).slice(0, 200);

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
