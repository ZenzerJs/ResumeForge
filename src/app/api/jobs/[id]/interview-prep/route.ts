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
    if (companyKey) {
      problems = await prisma.interviewProblem.findMany({
        where: { companyKey },
        orderBy: ORDER,
        take: 5,
      });

      // 2. Prefix fallback for variants ("Amazon Web Services" -> "amaz")
      if (problems.length === 0 && companyKey.length >= 4) {
        problems = await prisma.interviewProblem.findMany({
          where: { companyKey: { contains: companyKey.slice(0, 4) } },
          orderBy: ORDER,
          take: 5,
        });
      }
    }

    return NextResponse.json({
      success: true,
      matched: problems.length > 0,
      company: job.company || "Unknown Company",
      roleTitle: job.roleTitle || "Target Role",
      problems: problems.map((p) => ({
        id: p.id,
        title: p.problemTitle,
        category: p.category || "OA",
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
