import { NextResponse } from "next/server";
import { getCoverLetterById, updateCoverLetter, deleteCoverLetter } from "@/lib/db/cover-letters";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

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
    const updated = await updateCoverLetter(id, body, userId);
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
