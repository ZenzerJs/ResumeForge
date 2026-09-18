import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { inferRoleProfile } from "@/lib/ats-evaluator/profile-inference";
import { augmentTypstWithEvidenceBank } from "@/lib/ats-evaluator/evidence-augment";
import { AtsEvaluateInputSchema, RoleProfile } from "@/lib/ats-evaluator/types";
import { JobRequirements } from "@/lib/jd-parser/types";
import { getMasterResume } from "@/lib/db/resumes";
import { getEvidenceItems } from "@/lib/db/evidence";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
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
      const variant = await prisma.resumeVariant.findFirst({
        where: { id: input.variantId, ...(userId ? { masterResume: { userId } } : { id: "__guest__" }) },
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
      const job = await prisma.job.findFirst({ where: { id: input.jobId } });
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
      const master = userId ? await getMasterResume(userId) : null;
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
      const evidenceItems = userId ? await getEvidenceItems(undefined, userId) : [];
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
        error: sanitizeError(
          `Server error during ATS evaluation: ${err instanceof Error ? err.message : String(err)}`
        ),
      },
      { status: 500 }
    );
  }
}
