import { NextResponse } from "next/server";
import { z } from "zod";
import { importTier1Jobs, DEFAULT_SIMPLIFY_SOURCE_URL } from "@/lib/ingestion/tier1-importer";
import { sanitizeError } from "@/lib/ai/redact";

const BulkImportSchema = z.object({
  sourceUrl: z.string().url().optional(),
  tableMarkdown: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is valid (defaults to DEFAULT_SIMPLIFY_SOURCE_URL)
    }

    const parseResult = BulkImportSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload for Tier 1 bulk job import",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { sourceUrl, tableMarkdown } = parseResult.data;

    const result = await importTier1Jobs({
      sourceUrl: sourceUrl || DEFAULT_SIMPLIFY_SOURCE_URL,
      tableMarkdown,
    });

    return NextResponse.json({
      success: result.success,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      totalProcessed: result.totalProcessed,
      data: result.data,
      message: result.message,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute Tier 1 bulk job import",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
