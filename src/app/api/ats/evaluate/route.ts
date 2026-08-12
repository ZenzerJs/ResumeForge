import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { inferRoleProfile } from "@/lib/ats-evaluator/profile-inference";
import { augmentTypstWithEvidenceBank } from "@/lib/ats-evaluator/evidence-augment";
import { AtsEvaluateInputSchema, RoleProfile } from "@/lib/ats-evaluator/types";
import { JobRequirements } from "@/lib/jd-parser/types";
import { getMasterResume } from "@/lib/db/resumes";
import { getEvidenceItems } from "@/lib/db/evidence";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = AtsEvaluateInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid input: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    let typstContent = input.typstContent || "";
    let requirements: JobRequirements = input.extractedRequirements || {
      requiredSkills: [],
      preferredSkills: [],
      domainTerms: [],
    };
    let roleTitle = input.roleTitle;
    let rawDescription = "";

    if (input.variantId) {
      const variant = await prisma.resumeVariant.findUnique({
        where: { id: input.variantId },
        include: { job: true },
      });

      if (!variant) {
        return NextResponse.json(
          { success: false, error: `ResumeVariant not found: ${input.variantId}` },
          { status: 404 }
        );
      }

      if (!typstContent.trim()) {
        typstContent = variant.typstContent;
      }

      if (variant.job) {
        if (!roleTitle) roleTitle = variant.job.roleTitle || undefined;
        rawDescription = variant.job.rawDescription || "";
        if (!input.extractedRequirements && variant.job.extractedRequirements) {
          try {
            requirements = JSON.parse(variant.job.extractedRequirements);
          } catch {
            // keep defaults
          }
        }
      }
    }

    if (input.jobId && !requirements.requiredSkills.length && !requirements.preferredSkills.length) {
      const job = await prisma.job.findUnique({ where: { id: input.jobId } });
      if (job) {
        if (!roleTitle) roleTitle = job.roleTitle || undefined;
        rawDescription = job.rawDescription || "";
        if (job.extractedRequirements) {
          try {
            requirements = JSON.parse(job.extractedRequirements);
          } catch {
            // keep defaults
          }
        }
      }
    }

    // Prefer the saved master resume when explicitly requested.
    if (input.useMasterResume) {
      const master = await getMasterResume();
      if (master?.typstSource?.trim()) {
        typstContent = master.typstSource;
      }
    }

    if (!typstContent.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing typstContent, master resume, or valid variantId containing resume markup.",
        },
        { status: 400 }
      );
    }

    if (input.includeEvidenceBank) {
      const evidenceItems = await getEvidenceItems();
      typstContent = augmentTypstWithEvidenceBank(typstContent, evidenceItems);
    }

    const selectedProfile: RoleProfile =
      input.roleProfile || inferRoleProfile(roleTitle, rawDescription);

    const evaluationResult = evaluateAtsScore(typstContent, requirements, selectedProfile);

    return NextResponse.json({
      success: true,
      data: evaluationResult,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Server error during ATS evaluation: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
