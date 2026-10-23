import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as proxyModule from "@/app/api/ai/byok-proxy/route";
import { POST as proxyPost } from "@/app/api/ai/byok-proxy/route";
import { createSessionToken, getSessionCookieName } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { resetMockStore } from "@/lib/db-mock";

const MAX_BYOK_PROXY_BODY_BYTES = 256 * 1024;

describe("BYOK Proxy Hardening (/api/ai/byok-proxy)", () => {
  const TEST_SECRET = "test-secret-for-byok-proxy-hardening";
  let authCookie = "";

  beforeEach(async () => {
    process.env.APP_ACCESS_SECRET = TEST_SECRET;
    resetMockStore();

    const user = await prisma.user.create({
      data: {
        id: "user-proxy-test",
        email: "proxytester@example.com",
        username: "proxytester",
        passwordHash: "hash",
        sessionVersion: 1,
      },
    });

    const token = await createSessionToken(user.id, Date.now(), 1);
    authCookie = `${getSessionCookieName()}=${token}`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not export an OPTIONS handler and never returns access-control-allow-origin: *", async () => {
    expect("OPTIONS" in proxyModule).toBe(false);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const req = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        cookie: authCookie,
        "x-byok-target-url": "https://api.openai.com/v1/chat/completions",
        "x-byok-auth": "Bearer sk-test-123",
      },
      body: JSON.stringify({ model: "gpt-4o" }),
    });

    const res = await proxyPost(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("rejects missing or cross-origin Origin headers with 403", async () => {
    const missingOriginReq = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        cookie: authCookie,
        "x-byok-target-url": "https://api.openai.com/v1/chat/completions",
      },
      body: JSON.stringify({ model: "gpt-4o" }),
    });
    const resMissing = await proxyPost(missingOriginReq);
    expect(resMissing.status).toBe(403);

    const crossOriginReq = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        host: "localhost:3000",
        cookie: authCookie,
        "x-byok-target-url": "https://api.openai.com/v1/chat/completions",
      },
      body: JSON.stringify({ model: "gpt-4o" }),
    });
    const resCross = await proxyPost(crossOriginReq);
    expect(resCross.status).toBe(403);
  });

  it("rejects unauthenticated guest requests to proxy with 401 while allowing authenticated session", async () => {
    const guestReq = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        "x-byok-target-url": "https://api.groq.com/openai/v1/chat/completions",
      },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile" }),
    });

    const guestRes = await proxyPost(guestReq);
    expect(guestRes.status).toBe(401);
    const guestBody = await guestRes.json();
    expect(guestBody.error.code).toBe("AUTH_REQUIRED");
    expect(guestBody.error.message).toBe(
      "Sign in to use this provider, or switch to Gemini."
    );
  });

  it("allows /v1/responses on api.openai.com in addition to /v1/chat/completions and /v1/models", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "resp_123" }), { status: 200 })
    );

    const req = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        cookie: authCookie,
        "x-byok-target-url": "https://api.openai.com/v1/responses",
        "x-byok-auth": "Bearer sk-test-123",
      },
      body: JSON.stringify({ model: "gpt-4o", input: "hello" }),
    });

    const res = await proxyPost(req);
    expect(res.status).toBe(200);
  });

  it("rejects non-HTTPS target URLs, non-allowlisted hosts, and non-allowlisted path prefixes with 403", async () => {
    const makeReq = (target: string) =>
      new Request("http://localhost:3000/api/ai/byok-proxy", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000",
          cookie: authCookie,
          "x-byok-target-url": target,
        },
        body: JSON.stringify({ test: true }),
      });

    // HTTP to allowlisted host
    const httpRes = await proxyPost(makeReq("http://api.openai.com/v1/chat/completions"));
    expect(httpRes.status).toBe(403);

    // Non-allowlisted public host
    const arbitraryHostRes = await proxyPost(makeReq("https://example.com/v1/chat/completions"));
    expect(arbitraryHostRes.status).toBe(403);

    // Metadata IP / SSRF attempt
    const ssrfRes = await proxyPost(makeReq("https://169.254.169.254/latest/meta-data/"));
    expect(ssrfRes.status).toBe(403);

    // Non-allowlisted path on allowlisted host
    const badPathRes = await proxyPost(makeReq("https://api.openai.com/v1/files"));
    expect(badPathRes.status).toBe(403);
    const badPathJson = await badPathRes.json();
    expect(badPathJson.error.code).toBe("PATH_NOT_ALLOWED");
  });

  it("enforces body size cap (413 Payload Too Large)", async () => {
    const oversized = "x".repeat(MAX_BYOK_PROXY_BODY_BYTES + 1024);
    const req = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        cookie: authCookie,
        "x-byok-target-url": "https://api.openai.com/v1/chat/completions",
      },
      body: oversized,
    });

    const res = await proxyPost(req);
    expect(res.status).toBe(413);
  });

  it("forwards only allowlisted headers and strips cookie, host, and x-forwarded-*", async () => {
    let capturedHeaders: Headers | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_input, init) => {
      capturedHeaders = init?.headers as Headers;
      return new Response(JSON.stringify({ content: [{ text: "ok" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const req = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        cookie: authCookie,
        "x-forwarded-for": "10.0.0.1",
        "x-forwarded-proto": "http",
        "x-goog-api-key": "should-not-forward",
        "x-byok-target-url": "https://api.anthropic.com/v1/messages",
        "x-byok-auth": "Bearer sk-ant-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "claude-3-5-sonnet-20241022" }),
    });

    const res = await proxyPost(req);
    expect(res.status).toBe(200);
    expect(capturedHeaders).toBeDefined();

    const keys = Array.from(capturedHeaders!.keys()).map((k) => k.toLowerCase()).sort();
    expect(keys).toEqual(["anthropic-version", "content-type", "x-api-key"]);
    expect(capturedHeaders!.get("x-api-key")).toBe("sk-ant-secret");
    expect(capturedHeaders!.get("cookie")).toBeNull();
    expect(capturedHeaders!.get("host")).toBeNull();
    expect(capturedHeaders!.get("x-forwarded-for")).toBeNull();
    expect(capturedHeaders!.get("x-goog-api-key")).toBeNull();
  });

  it("never logs headers, keys, or request bodies on success or failure", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const secretKey = "sk-proj-super-sensitive-never-log-me";
    const secretBody = "SENSITIVE_RESUME_BODY_PAYLOAD";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error(`Connection failed for ${secretKey}`)
    );

    const req = new Request("http://localhost:3000/api/ai/byok-proxy", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        cookie: authCookie,
        "x-byok-target-url": "https://api.openai.com/v1/chat/completions",
        "x-byok-auth": `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ prompt: secretBody }),
    });

    const res = await proxyPost(req);
    expect(res.status).toBe(502);
    const bodyText = await res.text();
    expect(bodyText).not.toContain(secretKey);
    expect(bodyText).not.toContain(secretBody);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });
});
