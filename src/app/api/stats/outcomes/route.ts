import { NextResponse } from "next/server";
import { getOutcomeStats } from "@/lib/db/stats";
import { getRequestUserId } from "@/lib/security/auth-request";

export async function GET(request: Request) {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return NextResponse.json({
      success: true,
      guest: true,
      data: { funnel: { SAVED: 0, APPLIED: 0, INTERVIEWING: 0, OFFER: 0, REJECTED: 0 }, interviewRate: 0, medianResponseDays: null, variants: [] },
    });
  }
  const data = await getOutcomeStats(userId);
  return NextResponse.json({ success: true, guest: false, data });
}
