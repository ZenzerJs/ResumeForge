import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionCookieName, readSessionToken, type SessionPayload } from "@/lib/security/session";

export const GUEST_SAVE_ERROR = "Sign in to save your work.";

export function guestSaveResponse() {
  return NextResponse.json(
    { success: false, error: GUEST_SAVE_ERROR, code: "GUEST_READ_ONLY" },
    { status: 401 }
  );
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
}

export async function sessionIsCurrent(session: SessionPayload | null): Promise<SessionPayload | null> {
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return session;
}

export async function getRequestUserId(request: Request): Promise<string | null> {
  const token = readCookie(request, getSessionCookieName());
  const session = await sessionIsCurrent(await readSessionToken(token));
  return session?.userId ?? null;
}

export async function requireUserId(request: Request): Promise<string | NextResponse> {
  const userId = await getRequestUserId(request);
  if (!userId) return guestSaveResponse();
  return userId;
}
