import { NextRequest, NextResponse } from "next/server";
import {
  getAllCompanies,
  getAllProblems,
  getAllTopics,
  getProblemBySlug,
} from "@/lib/practice/practice-curriculum";
import { prisma } from "@/lib/prisma";
import { normalizeCompany } from "@/lib/company";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const topic = searchParams.get("topic");
    const company = searchParams.get("company")?.toLowerCase().trim();
    const difficulty = searchParams.get("difficulty");
    const search = searchParams.get("search")?.toLowerCase().trim();

    // If requesting a single specific problem
    if (slug) {
      const problem = getProblemBySlug(slug);
      if (!problem) {
        return NextResponse.json({ success: false, error: "Problem not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: problem });
    }

    let problems = getAllProblems();

    if (topic && topic !== "all") {
      problems = problems.filter((p) => p.topicId === topic);
    }

    if (difficulty && difficulty !== "all") {
      problems = problems.filter((p) => p.difficulty.toLowerCase() === difficulty.toLowerCase());
    }

    if (company && company !== "all") {
      problems = problems.filter((p) =>
        p.companies.some((c) => c.toLowerCase().includes(company))
      );
    }

    if (search) {
      problems = problems.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.summary.toLowerCase().includes(search) ||
          p.topicId.toLowerCase().includes(search) ||
          p.companies.some((c) => c.toLowerCase().includes(search))
      );
    }

    // Optional: Fetch additional company problems from database if company filter is active
    let dbCompanyProblems: any[] = [];
    if (company && company !== "all") {
      try {
        const companyKey = normalizeCompany(company);
        dbCompanyProblems = await prisma.interviewProblem.findMany({
          where: {
            OR: [
              { companyKey: { contains: companyKey } },
              { company: { contains: company, mode: "insensitive" } },
            ],
          },
          take: 20,
        });
      } catch {
        // Continue with static problems if db query fails
      }
    }

    const topics = getAllTopics();
    const companies = getAllCompanies();

    return NextResponse.json({
      success: true,
      data: {
        topics,
        problems,
        companies,
        dbCompanyProblems: dbCompanyProblems.map((p) => ({
          id: p.id,
          title: p.problemTitle,
          company: p.company,
          category: p.category || "OA",
          difficulty: p.difficulty || "Medium",
          tags: p.tags || [],
          sourceUrl: p.sourceUrl,
        })),
        total: problems.length,
      },
    });
  } catch (err: any) {
    console.error("[API practice/problems] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch practice curriculum" },
      { status: 500 }
    );
  }
}
