import { NextResponse } from "next/server";
import { getVariants } from "@/lib/db/variants";
import { sanitizeError } from "@/lib/ai/redact";

export async function GET() {
  try {
    const variants = await getVariants();
    return NextResponse.json({ success: true, data: variants });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch variants",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
