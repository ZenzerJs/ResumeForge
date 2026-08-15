import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { isMutationMethod, isPublicPath, originAllowed } from "@/lib/security/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/api/auth/") && isMutationMethod(request.method)) {
      if (!originAllowed(request)) {
        return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
      }
      if (
        (pathname === "/api/auth/signup" || pathname === "/api/auth/login") &&
        !rateLimit(clientKey(request, "auth"), 10, 60_000)
      ) {
        return NextResponse.json({ success: false, error: "Too many sign-in attempts" }, { status: 429 });
      }
    }
    return NextResponse.next();
  }

  if (isMutationMethod(request.method) && !originAllowed(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  if (pathname.startsWith("/api/ai/")) {
    if (!rateLimit(clientKey(request, "ai"), 20, 60_000)) {
      return NextResponse.json({ success: false, error: "Too many AI requests" }, { status: 429 });
    }
  } else if (
    pathname === "/api/jobs/bulk-import" ||
    pathname === "/api/resumes/upload-pdf" ||
    pathname === "/api/connectors/sync"
  ) {
    if (!rateLimit(clientKey(request, "heavy"), 10, 60_000)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|wasm/|fonts/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|woff2?|ttf|otf)$).*)",
  ],
};
