import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";
import { createSessionToken, getSessionCookieName } from "@/lib/security/session";

export async function createTestUser(email?: string) {
  const user = await prisma.user.create({
    data: {
      email: email ?? `test-${crypto.randomUUID()}@resumeforge.test`,
      passwordHash: await hashPassword("test-password-ok"),
    },
  });
  const token = await createSessionToken(user.id);
  if (!token) {
    throw new Error("Failed to create session token. APP_ACCESS_SECRET is required in tests.");
  }
  const cookie = `${getSessionCookieName()}=${encodeURIComponent(token)}`;
  return { user, cookie, headers: { Cookie: cookie } as Record<string, string> };
}

export function authedRequest(url: string, init: RequestInit, cookie: string): Request {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  return new Request(url, { ...init, headers });
}

export function authedNextRequest(url: string, init: RequestInit, cookie: string): NextRequest {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  return new NextRequest(url, {
    method: init.method,
    headers,
    body: init.body,
  });
}
