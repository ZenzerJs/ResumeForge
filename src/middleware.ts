import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { isMutationMethod, isPublicPath, originAllowed } from "@/lib/security/session";

export const HEAVY_ENDPOINT_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/jobs/bulk-import": { limit: 10, windowMs: 60_000 },
  "/api/resumes/upload-pdf": { limit: 10, windowMs: 60_000 },
  "/api/jobs/extract": { limit: 15, windowMs: 60_000 },
  "/api/connectors/sync": { limit: 5, windowMs: 60_000 },
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/api/auth/") && isMutationMethod(request.method)) {
      if (!originAllowed(request)) {
        return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
      }
      const authLimit =
        process.env.NODE_ENV === "test" ||
        process.env.APP_ACCESS_SECRET === "playwright-test-secret"
          ? 100
          : 10;
      if (
        (pathname === "/api/auth/signup" || pathname === "/api/auth/login") &&
        !rateLimit(clientKey(request, "auth"), authLimit, 60_000)
      ) {
        return NextResponse.json({ success: false, error: "Too many sign-in attempts" }, { status: 429 });
      }
    }
    return NextResponse.next();
  }

  if (isMutationMethod(request.method) && !originAllowed(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin" }, { status: 403 });
  }

  const heavyConfig = HEAVY_ENDPOINT_LIMITS[pathname];
  if (pathname.startsWith("/api/ai/")) {
    if (!rateLimit(clientKey(request, "ai"), 20, 60_000)) {
      return NextResponse.json({ success: false, error: "Too many AI requests" }, { status: 429 });
    }
  } else if (heavyConfig) {
    if (!rateLimit(clientKey(request, `heavy:${pathname}`), heavyConfig.limit, heavyConfig.windowMs)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
  } else if (pathname.startsWith("/api/companies/") && pathname.endsWith("/dossier/generate")) {
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
