import { NextResponse } from "next/server";
import { z } from "zod";
import { createResume, getResumes } from "@/lib/db/resumes";
import { getEvidenceItems } from "@/lib/db/evidence";
import { buildTailoringValidationContext } from "@/lib/facts/extract";
import type { ResumeFacts, TailoringValidationContext } from "@/lib/facts/types";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const CreateResumeSchema = z.object({
  title: z.string().max(200).optional(),
  typstSource: z.string().min(1, "typstSource is required").max(200_000),
});

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ success: true, data: [], guest: true, validationContext: null });
    }
    const [resumes, ownedEvidence] = await Promise.all([
      getResumes(userId),
      getEvidenceItems(undefined, userId),
    ]);
    const master = resumes.find((r) => r.isMaster);
    let validationContext: TailoringValidationContext | null = null;
    if (master?.factSnapshot) {
      validationContext = buildTailoringValidationContext(
        master.factSnapshot as unknown as ResumeFacts,
        ownedEvidence,
        { ownerId: userId, authoritativeEvidence: true }
      );
    }
    return NextResponse.json({ success: true, data: resumes, validationContext });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch resumes", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
    }
    const validation = CreateResumeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const newResume = await createResume({
      ...validation.data,
      isMaster: false,
      userId,
    });
    return NextResponse.json({ success: true, data: newResume }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create resume", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
