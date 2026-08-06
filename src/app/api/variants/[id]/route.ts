import { NextResponse } from "next/server";
import { getVariantById } from "@/lib/db/variants";
import { sanitizeError } from "@/lib/ai/redact";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid variant ID" },
        { status: 400 }
      );
    }

    const variant = await getVariantById(id);

    if (!variant) {
      return NextResponse.json(
        { success: false, error: "ResumeVariant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: variant });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch variant",
        message: sanitizeError(String(err)),
      },
      { status: 500 }
    );
  }
}
