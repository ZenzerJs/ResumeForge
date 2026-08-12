import { NextResponse } from "next/server";
import { z } from "zod";
import { getResumeById, updateResume } from "@/lib/db/resumes";
import { sanitizeError } from "@/lib/ai/redact";
import { ProtectedResumeError } from "@/lib/security/protected-resume";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const UpdateResumeSchema = z.object({
  title: z.string().max(200).optional(),
  typstSource: z.string().min(1, "typstSource cannot be empty").max(200_000).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Resume record not found" }, { status: 404 });
    }
    const { id } = await params;
    const resume = await getResumeById(id, userId);

    if (!resume) {
      return NextResponse.json(
        { success: false, error: "Resume record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: resume });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch resume", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { id } = await params;
    const body = await request.json();
    const validation = UpdateResumeSchema.safeParse(body);

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

    const existing = await getResumeById(id, userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Resume record not found" },
        { status: 404 }
      );
    }

    const updated = await updateResume(id, validation.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof ProtectedResumeError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to update resume", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
