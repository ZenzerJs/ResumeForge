import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeFetch } from "../http";
import { UnsafeUrlError } from "@/lib/security/safe-fetch";

describe("SSRF Hardened safeFetch Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. Blocks non-HTTPS protocols (http://) without dispatching fetch", async () => {
    await expect(safeFetch("http://boards-api.greenhouse.io/v1/boards/shopify/jobs")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("2. Blocks unallowlisted domains without dispatching fetch", async () => {
    await expect(safeFetch("https://evil-hacker-site.com/jobs.json")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("3. Blocks loopback and private IP addresses directly in URL without dispatching fetch", async () => {
    await expect(safeFetch("https://127.0.0.1/api")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(safeFetch("https://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(safeFetch("https://10.0.0.1/admin")).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("4. Allows valid allowlisted host, preserves status/headers, and executes fetch with manual redirects and connector headers", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { "x-connector-trace": "abc-123" },
    });
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const controller = new AbortController();
    const res = await safeFetch("https://boards-api.greenhouse.io/v1/boards/shopify/jobs", {
      signal: controller.signal,
    });
    expect(res.status).toBe(202);
    expect(res.headers.get("x-connector-trace")).toBe("abc-123");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/shopify/jobs",
      expect.objectContaining({
        redirect: "manual",
        dispatcher: expect.any(Object),
      })
    );
    const headers = new Headers((global.fetch as any).mock.calls[0][1].headers);
    expect(headers.get("user-agent")).toBe("ResumeForge-Sync/1.0 (+https://github.com/resumeforge)");
    expect(headers.get("accept")).toBe("application/json");
  });
});
