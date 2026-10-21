import { NextResponse } from "next/server";
import { z } from "zod";
import { getCoverLetterById, updateCoverLetter, deleteCoverLetter } from "@/lib/db/cover-letters";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const UpdateCoverLetterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  proseMarkdown: z.string().max(100000).optional(),
  typstSource: z.string().max(200000).optional(),
  tone: z.enum(["FORMAL", "CONVERSATIONAL", "TECHNICAL", "EXECUTIVE"]).optional(),
  targetWordCount: z.number().int().min(50).max(2000).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Cover letter not found" },
        { status: 404 }
      );
    }

    const { id } = await params;
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid cover letter ID" },
        { status: 400 }
      );
    }

    const coverLetter = await getCoverLetterById(id, userId);
    if (!coverLetter) {
      return NextResponse.json(
        { success: false, error: "Cover letter not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: coverLetter });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cover letter",
        message: sanitizeError(String(err)),
      },
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
    const existing = await getCoverLetterById(id, userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Cover letter not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = UpdateCoverLetterSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid update payload",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const updated = await updateCoverLetter(id, validation.data, userId);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update cover letter",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { id } = await params;
    const existing = await getCoverLetterById(id, userId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Cover letter not found" },
        { status: 404 }
      );
    }

    await deleteCoverLetter(id, userId);
    return NextResponse.json({ success: true, message: "Cover letter deleted successfully" });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete cover letter",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
