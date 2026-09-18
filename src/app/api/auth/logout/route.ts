import { NextResponse } from "next/server";
import { buildClearedSessionCookie } from "@/lib/security/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", buildClearedSessionCookie());
  return response;
}
