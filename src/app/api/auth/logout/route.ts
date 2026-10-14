import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readCookie } from "@/lib/security/auth-request";
import { buildClearedSessionCookie, getSessionCookieName, readSessionToken } from "@/lib/security/session";

export async function POST(request: Request): Promise<NextResponse>;
export async function POST(): Promise<NextResponse>;
export async function POST(request?: Request): Promise<NextResponse> {
  if (request) {
    const session = await readSessionToken(readCookie(request, getSessionCookieName()));
    if (session) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { sessionVersion: { increment: 1 } },
      }).catch(() => undefined);
    }
  }
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", buildClearedSessionCookie());
  return response;
}
