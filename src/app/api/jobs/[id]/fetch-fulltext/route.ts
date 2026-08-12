import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheJobFullText } from "@/lib/ingestion/tier2-fetcher";
import { sanitizeError } from "@/lib/ai/redact";
import { getJobById } from "@/lib/db/jobs";
import { requireUserId } from "@/lib/security/auth-request";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(req);
    if (userId instanceof NextResponse) return userId;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 }
      );
    }

    const owned = await getJobById(id, userId);
    if (!owned) {
      return NextResponse.json(
        { success: false, error: "Job posting not found" },
        { status: 404 }
      );
    }

    const result = await fetchAndCacheJobFullText(id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          fallbackToManual: result.fallbackToManual ?? true,
          data: result.data,
        },
        { status: 200 } // Return 200 with fallbackToManual: true for graceful client handling
      );
    }

    return NextResponse.json({
      success: true,
      cached: result.cached,
      data: result.data,
    });
  } catch (error: any) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: sanitized || "Failed to process Tier 2 fetch" },
      { status: 500 }
    );
  }
}
