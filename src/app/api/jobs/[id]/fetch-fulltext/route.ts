import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheJobFullText } from "@/lib/ingestion/tier2-fetcher";
import { sanitizeError } from "@/lib/ai/redact";
import { getJobById } from "@/lib/db/jobs";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getRequestUserId(req);

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 }
      );
    }

    const owned = await getJobById(id);
    if (!owned) {
      return NextResponse.json(
        { success: false, error: "Job posting not found" },
        { status: 404 }
      );
    }

    if (owned.userId !== null && owned.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
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
