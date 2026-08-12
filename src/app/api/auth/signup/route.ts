import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, normalizeEmail } from "@/lib/security/passwords";
import {
  buildSessionCookie,
  createSessionToken,
  getAppAccessSecret,
} from "@/lib/security/session";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(request: Request) {
  if (!getAppAccessSecret()) {
    return NextResponse.json(
      { success: false, error: "Server is missing APP_ACCESS_SECRET" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid signup payload",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  const token = await createSessionToken(user.id);
  if (!token) {
    return NextResponse.json({ success: false, error: "Unable to create session" }, { status: 500 });
  }

  const secure = new URL(request.url).protocol === "https:";
  const response = NextResponse.json({
    success: true,
    data: { id: user.id, email: user.email },
  });
  response.headers.set("Set-Cookie", buildSessionCookie(token, secure));
  return response;
}
