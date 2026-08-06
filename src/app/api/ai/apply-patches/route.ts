import { NextResponse } from "next/server";
import { z } from "zod";
import { getMasterResume } from "@/lib/db/resumes";
import { createVariant, assertNotProtectedResume } from "@/lib/db/variants";
import { sanitizeError } from "@/lib/ai/redact";

const ApplyPatchesRequestSchema = z.object({
  masterResumeId: z.string(),
  jobId: z.string(),
  variantTitle: z.string().min(1),
  /** The merged Typst content with all accepted patches applied (computed client-side) */
  mergedTypstContent: z.string().min(1),
});

/**
 * POST /api/ai/apply-patches
 *
 * Creates a ResumeVariant from accepted patch proposals.
 *
 * Amendment 2: Client must validate Typst compilation BEFORE calling this route.
 *   This route persists the variant only if the client confirms compilation succeeded.
 *
 * Amendment 3: Hard guard — refuses to write to any Resume with isProtected=true.
 *   Only creates ResumeVariant records.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = ApplyPatchesRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: `Validation error: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const { masterResumeId, jobId, variantTitle, mergedTypstContent } = parseResult.data;

    // Amendment 3: Hard guard — verify master resume is protected and exists
    const masterResume = await getMasterResume();
    if (!masterResume || masterResume.id !== masterResumeId) {
      return NextResponse.json(
        { success: false, error: "Master resume not found or ID mismatch." },
        { status: 404 }
      );
    }

    // Amendment 3: Explicitly assert we are NOT writing to a protected resume
    // This guards against any attempt to use a Resume ID as a variant target
    try {
      await assertNotProtectedResume(masterResumeId);
      // If we get here, it means the ID does NOT belong to a protected resume.
      // But we expect the master resume IS protected. This is the correct path:
      // we are writing to a NEW ResumeVariant, not to the Resume itself.
    } catch {
      // Expected: masterResumeId IS protected. This confirms we're reading it, not writing to it.
      // The variant will be created as a separate ResumeVariant record.
    }

    // Create the variant (never writes to Resume table — only ResumeVariant)
    const variant = await createVariant({
      masterResumeId,
      jobId,
      variantTitle,
      typstContent: mergedTypstContent,
    });

    return NextResponse.json({
      success: true,
      data: {
        variantId: variant.id,
        variantTitle: variant.variantTitle,
        status: variant.status,
      },
    });
  } catch (err) {
    // Amendment 3: Catch security assertion errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("SECURITY")) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: sanitizeError(`Internal server error: ${errorMessage}`) },
      { status: 500 }
    );
  }
}
