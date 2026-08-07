import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeError } from "@/lib/ai/redact";

export async function GET() {
  try {
    const [
      masterResume,
      evidenceCount,
      verifiedEvidenceCount,
      jobsCount,
      appliedJobsCount,
      variantsCount,
      coverLettersCount,
    ] = await Promise.all([
      prisma.resume.findFirst({ where: { isMaster: true } }),
      prisma.evidenceItem.count({ where: { status: { not: "archived" } } }),
      prisma.evidenceItem.count({ where: { status: "verified" } }),
      prisma.job.count(),
      prisma.job.count({ where: { status: "APPLIED" } }),
      prisma.resumeVariant.count(),
      prisma.coverLetter.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        hasMasterResume: Boolean(masterResume),
        masterResumeTitle: masterResume?.title ?? null,
        evidenceCount,
        verifiedEvidenceCount,
        jobsCount,
        appliedJobsCount,
        variantsCount,
        coverLettersCount,
      },
    });
  } catch (err: unknown) {
    const errorMessage = sanitizeError(err);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
