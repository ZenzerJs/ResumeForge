import { NextResponse } from "next/server";
import { getDashboardStats, emptyGuestStats } from "@/lib/db/stats";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    const data = userId ? await getDashboardStats(userId) : emptyGuestStats();
    return NextResponse.json({ success: true, data, guest: !userId });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
