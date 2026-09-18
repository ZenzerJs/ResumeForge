import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db/stats";
import { sanitizeError } from "@/lib/ai/redact";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function GET(request: Request) {
  try {
    const userId = await getRequestUserId(request);
    const data = await getDashboardStats(userId ?? undefined);
    return NextResponse.json({ success: true, data, guest: !userId });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: sanitizeError(err) },
      { status: 500 }
    );
  }
}
