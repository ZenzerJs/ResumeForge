import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheJobFullText } from "@/lib/ingestion/tier2-fetcher";
import { sanitizeError } from "@/lib/ai/redact";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 }
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
