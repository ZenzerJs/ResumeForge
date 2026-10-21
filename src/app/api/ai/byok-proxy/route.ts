import { assertSafePublicUrl, UnsafeUrlError } from "@/lib/security/safe-fetch";

/**
 * Proxy for BYOK requests requiring CORS bypass.
 * Strips authorization headers from all logs and streams upstream payload directly.
 */
export async function POST(req: Request): Promise<Response> {
  const targetUrl =
    req.headers.get("x-byok-target-url") ||
    req.headers.get("x-target-url") ||
    new URL(req.url).searchParams.get("target");

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing x-byok-target-url header" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return new Response(
        JSON.stringify({ error: "Invalid protocol; http/https required" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid target URL" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  try {
    await assertSafePublicUrl(targetUrl.toString());
  } catch (err) {
    if (err instanceof UnsafeUrlError || (err as Error)?.name === "UnsafeUrlError") {
      return new Response(
        JSON.stringify({ error: { code: "SSRF_BLOCKED", message: (err as Error).message } }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
    throw err;
  }

  // Build upstream forwarding headers without logging secrets
  const forwardHeaders = new Headers();
  forwardHeaders.set("Content-Type", req.headers.get("content-type") || "application/json");

  const authHeader = req.headers.get("x-byok-auth") || req.headers.get("authorization");
  const provider = req.headers.get("x-byok-provider");

  if (authHeader) {
    if (provider === "anthropic" || parsedUrl.hostname.includes("anthropic.com")) {
      const rawKey = authHeader.replace(/^Bearer\s+/i, "").trim();
      forwardHeaders.set("x-api-key", rawKey);
      forwardHeaders.set("anthropic-version", "2023-06-01");
    } else {
      forwardHeaders.set("Authorization", authHeader);
    }
  }

  // Forward extra custom headers if present
  const googApiKey = req.headers.get("x-goog-api-key");
  if (googApiKey) {
    forwardHeaders.set("x-goog-api-key", googApiKey);
  }

  try {
    const upstreamRes = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: forwardHeaders,
      body: req.body,
      redirect: "error",
      // @ts-expect-error duplex required in Node/Edge for streaming bodies
      duplex: "half",
    });

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: {
        "content-type": upstreamRes.headers.get("content-type") || "application/json",
        "cache-control": "no-cache",
      },
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError || (err as Error)?.name === "UnsafeUrlError") {
      return new Response(
        JSON.stringify({ error: { code: "SSRF_BLOCKED", message: (err as Error).message } }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
    // Zero server logging of authorization details; return sanitized error
    const msg = err instanceof Error ? err.message : "Upstream proxy request failed";
    return new Response(
      JSON.stringify({ error: "Proxy connection error", details: msg }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers":
        "content-type, authorization, x-api-key, x-goog-api-key, anthropic-version, x-byok-target-url, x-target-url",
    },
  });
}
