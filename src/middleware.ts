import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit, type RateLimitNamespace } from "@/lib/security/rate-limit";
import { isMutationMethod, isPublicPath, originAllowed } from "@/lib/security/session";
import { demoAllowsMutation, isDemoMode } from "@/lib/demo-mode";

export const HEAVY_ENDPOINT_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/jobs/bulk-import": { limit: 10, windowMs: 60_000 },
  "/api/jobs/hydrate": { limit: 10, windowMs: 60_000 },
  "/api/resumes/upload-pdf": { limit: 10, windowMs: 60_000 },
  "/api/jobs/extract": { limit: 15, windowMs: 60_000 },
  "/api/connectors/sync": { limit: 5, windowMs: 60_000 },
  "/api/cover-letters/generate": { limit: 10, windowMs: 60_000 },
  "/api/jobs/sync-pittcsc": { limit: 5, windowMs: 60_000 },
};

const HEAVY_ENDPOINT_NAMESPACES: Record<string, RateLimitNamespace> = {
  "/api/jobs/bulk-import": "heavy:/api/jobs/bulk-import",
  "/api/jobs/hydrate": "heavy:/api/jobs/hydrate",
  "/api/resumes/upload-pdf": "heavy:/api/resumes/upload-pdf",
  "/api/jobs/extract": "heavy:/api/jobs/extract",
  "/api/connectors/sync": "heavy:/api/connectors/sync",
  "/api/cover-letters/generate": "heavy:/api/cover-letters/generate",
  "/api/jobs/sync-pittcsc": "heavy:/api/jobs/sync-pittcsc",
};

const FETCH_FULLTEXT_LIMIT = {
  namespace: "heavy:/api/jobs/[id]/fetch-fulltext" as RateLimitNamespace,
  limit: 15,
  windowMs: 60_000,
};

function isFetchFulltextPath(pathname: string): boolean {
  return /^\/api\/jobs\/[^/]+\/fetch-fulltext$/.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    isDemoMode() &&
    pathname.startsWith("/api/") &&
    isMutationMethod(request.method) &&
    !demoAllowsMutation(pathname)
  ) {
    return NextResponse.json(
      { success: false, error: "This public demo keeps changes in your browser.", code: "GUEST_READ_ONLY" },
      { status: 401 }
    );
  }
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
  } else if (pathname.startsWith("/api/demo/")) {
    if (!rateLimit(clientKey(request, "demo-ai"), 8, 60_000)) {
      return NextResponse.json({ success: false, error: "Too many demo AI requests" }, { status: 429 });
    }
  } else if (heavyConfig) {
    const heavyNs = HEAVY_ENDPOINT_NAMESPACES[pathname];
    if (!rateLimit(clientKey(request, heavyNs), heavyConfig.limit, heavyConfig.windowMs)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
  } else if (isFetchFulltextPath(pathname)) {
    if (
      !rateLimit(
        clientKey(request, FETCH_FULLTEXT_LIMIT.namespace),
        FETCH_FULLTEXT_LIMIT.limit,
        FETCH_FULLTEXT_LIMIT.windowMs
      )
    ) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
  } else if (pathname.startsWith("/api/companies/") && pathname.endsWith("/dossier/generate")) {
    if (!rateLimit(clientKey(request, "heavy:dossier-generate"), 10, 60_000)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|wasm/|fonts/|workers/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm|mjs|woff2?|ttf|otf)$).*)",
  ],
};
