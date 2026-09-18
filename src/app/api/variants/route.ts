import { NextResponse } from "next/server";
import { getVariants } from "@/lib/db/variants";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ success: true, data: [], guest: true });
    }
    const variants = await getVariants(userId);
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
