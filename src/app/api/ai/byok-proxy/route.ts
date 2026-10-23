import { requireUserId } from "@/lib/security/auth-request";
import { assertSafePublicUrl, UnsafeUrlError } from "@/lib/security/safe-fetch";
import { originAllowed } from "@/lib/security/session";
import { isDemoMode } from "@/lib/demo-mode";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";

const ALLOWED_PROVIDER_PATHS: Record<string, readonly string[]> = {
  "api.openai.com": ["/v1/chat/completions", "/v1/models", "/v1/responses"],
  "api.anthropic.com": ["/v1/messages", "/v1/models"],
  "api.groq.com": ["/openai/v1/chat/completions", "/openai/v1/models"],
};

const ALLOWED_HOSTS = Object.keys(ALLOWED_PROVIDER_PATHS);
const MAX_BYOK_PROXY_BODY_BYTES = 256 * 1024; // 256 KB
const BYOK_PROXY_TIMEOUT_MS = 30_000;

function hasSameOriginHeader(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  return originAllowed(req);
}

function isAllowedProviderPath(hostname: string, pathname: string): boolean {
  const prefixes = ALLOWED_PROVIDER_PATHS[hostname.toLowerCase()];
  if (!prefixes) return false;
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Authenticated same-origin proxy for BYOK requests requiring browser CORS bypass
 * (OpenAI, Anthropic, Groq). Guests without a session must sign in to use proxied
 * providers or use Gemini direct in-browser.
 * Never logs headers, keys, or request bodies.
 */
export async function POST(req: Request): Promise<Response> {
  // 1. Require same-origin Origin header on POST
  if (!hasSameOriginHeader(req)) {
    return new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN_ORIGIN", message: "Same-origin Origin header is required." },
      }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  // 2. Require authenticated user session
  const userIdOrRes = isDemoMode() ? null : await requireUserId(req);
  if (!isDemoMode() && userIdOrRes instanceof Response) {
    return new Response(
      JSON.stringify({
        error: {
          code: "AUTH_REQUIRED",
          message: "Sign in to use this provider, or switch to Gemini.",
        },
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }
  if (isDemoMode() && !rateLimit(clientKey(req, "demo-byok"), 8, 60_000)) {
    return new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many BYOK requests" } }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  // 3. Validate target URL header
  const targetUrl =
    req.headers.get("x-byok-target-url") ||
    req.headers.get("x-target-url") ||
    new URL(req.url).searchParams.get("target");

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing x-byok-target-url header" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid target URL" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  if (parsedUrl.protocol !== "https:") {
    return new Response(
      JSON.stringify({ error: { code: "HTTPS_REQUIRED", message: "Only HTTPS target URLs are allowed" } }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  const host = parsedUrl.hostname.toLowerCase();
  try {
    assertSafePublicUrl(parsedUrl.toString(), {
      allowLocalhost: false,
      allowedHosts: ALLOWED_HOSTS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError || (err as Error)?.name === "UnsafeUrlError") {
      return new Response(
        JSON.stringify({ error: { code: "SSRF_BLOCKED", message: (err as Error).message } }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
    throw err;
  }

  if (!isAllowedProviderPath(host, parsedUrl.pathname)) {
    return new Response(
      JSON.stringify({
        error: {
          code: "PATH_NOT_ALLOWED",
          message: `Path ${parsedUrl.pathname} is not on the provider allowlist for ${host}`,
        },
      }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  // 4. Enforce body size cap
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BYOK_PROXY_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds maximum size limit" } }),
        { status: 413, headers: { "content-type": "application/json" } }
      );
    }
  }

  const bodyBytes = new Uint8Array(await req.arrayBuffer());
  if (bodyBytes.byteLength > MAX_BYOK_PROXY_BODY_BYTES) {
    return new Response(
      JSON.stringify({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds maximum size limit" } }),
      { status: 413, headers: { "content-type": "application/json" } }
    );
  }

  // 5. Build strict allowlisted upstream headers (only authorization, x-api-key, anthropic-version, content-type)
  const forwardHeaders = new Headers();
  forwardHeaders.set("content-type", req.headers.get("content-type") || "application/json");

  const authHeader = req.headers.get("x-byok-auth") || req.headers.get("authorization");
  const explicitApiKey = req.headers.get("x-api-key");
  const provider = req.headers.get("x-byok-provider");

  if (provider === "anthropic" || host === "api.anthropic.com") {
    const rawKey = (explicitApiKey || authHeader || "").replace(/^Bearer\s+/i, "").trim();
    if (rawKey) {
      forwardHeaders.set("x-api-key", rawKey);
    }
    forwardHeaders.set(
      "anthropic-version",
      req.headers.get("anthropic-version") || "2023-06-01"
    );
  } else if (authHeader) {
    forwardHeaders.set("authorization", authHeader);
  }

  // 6. Upstream fetch with timeout and manual redirect blocking
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BYOK_PROXY_TIMEOUT_MS);

  try {
    const upstreamRes = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers: forwardHeaders,
      body: bodyBytes,
      redirect: "error",
      signal: controller.signal,
    });

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: {
        "content-type": upstreamRes.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return new Response(
        JSON.stringify({ error: { code: "UPSTREAM_TIMEOUT", message: "Upstream provider timed out" } }),
        { status: 504, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Proxy connection error" }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
