import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCompany } from "@/lib/company";
import { sanitizeError } from "@/lib/ai/redact";

const ORDER: Prisma.InterviewProblemOrderByWithRelationInput[] = [
  { lastObserved: { sort: "desc", nulls: "last" } }, // Postgres sorts NULLs first on DESC otherwise
  { createdAt: "desc" },
];

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id?: string; jobId?: string }> }
) {
  try {
    const params = await props.params;
    const jobId = params.id || params.jobId;

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { company: true, roleTitle: true, rawDescription: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const companyKey = normalizeCompany(job.company || "");

    // 1. Exact match
    let problems: any[] = [];
    let isFallback = false;

    if (companyKey) {
      problems = await prisma.interviewProblem.findMany({
        where: { companyKey },
        orderBy: ORDER,
        take: 50,
      });

      // 2. Prefix / substring match for variants (e.g. "amazonwebservices" -> "amazon")
      if (problems.length === 0 && companyKey.length >= 3) {
        problems = await prisma.interviewProblem.findMany({
          where: {
            OR: [
              { companyKey: { contains: companyKey.slice(0, 4) } },
              { company: { contains: job.company || "", mode: "insensitive" } },
            ],
          },
          orderBy: ORDER,
          take: 50,
        });
      }
    }

    // 3. Fallback to curated popular OA problems if no specific company records
    if (problems.length === 0) {
      isFallback = true;
      problems = await prisma.interviewProblem.findMany({
        orderBy: ORDER,
        take: 10,
      });
    }

    return NextResponse.json({
      success: true,
      matched: !isFallback && problems.length > 0,
      isFallback,
      company: job.company || "Target Company",
      roleTitle: job.roleTitle || "Target Role",
      problems: problems.map((p) => ({
        id: p.id,
        title: p.problemTitle,
        company: p.company,
        category: p.category || "OA",
        tags: p.tags || [],
        difficulty: p.difficulty || null,
        sourceUrl: p.sourceUrl || null,
        lastObserved: p.lastObserved || null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch interview prep questions", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
