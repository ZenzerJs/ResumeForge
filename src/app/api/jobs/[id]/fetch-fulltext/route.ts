import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheJobFullText } from "@/lib/ingestion/tier2-fetcher";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { sanitizeError } from "@/lib/ai/redact";
import { buildHydratedJobDetail, getJobById } from "@/lib/db/jobs";
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

    const result = await fetchAndCacheJobFullText(id, { viewerUserId: userId });

    if (!result.success) {
      const detail = result.data
        ? buildHydratedJobDetail(result.data, {
            requirementsStatus: isPlaceholderDescription(result.data.rawDescription)
              ? "unavailable"
              : undefined,
            extractFailure: result.failureCode ?? result.data.extractFailure ?? "failed",
          })
        : undefined;
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          fallbackToManual: result.fallbackToManual ?? true,
          data: detail,
        },
        { status: 200 } // Return 200 with fallbackToManual: true for graceful client handling
      );
    }

    const detail = result.data ? buildHydratedJobDetail(result.data) : undefined;
    return NextResponse.json({
      success: true,
      cached: result.cached,
      data: detail,
    });
  } catch (error: unknown) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: sanitized || "Failed to process Tier 2 fetch" },
      { status: 500 }
    );
  }
}
