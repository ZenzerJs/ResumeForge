import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeFetch } from "../http";

describe("SSRF Hardened safeFetch Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. Blocks non-HTTPS protocols (http://)", async () => {
    await expect(safeFetch("http://boards-api.greenhouse.io/v1/boards/shopify/jobs")).rejects.toThrow(
      /Protocol "http:" is disallowed/i
    );
  });

  it("2. Blocks unallowlisted domains", async () => {
    await expect(safeFetch("https://evil-hacker-site.com/jobs.json")).rejects.toThrow(
      /Host "evil-hacker-site.com" is not allowlisted/i
    );
  });

  it("3. Blocks loopback and private IP addresses directly in URL", async () => {
    await expect(safeFetch("https://127.0.0.1/api")).rejects.toThrow(
      /protected IP address/i
    );
    await expect(safeFetch("https://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /protected IP address/i
    );
    await expect(safeFetch("https://10.0.0.1/admin")).rejects.toThrow(
      /protected IP address/i
    );
  });

  it("4. Allows valid allowlisted host and executes fetch with redirect manual", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const res = await safeFetch("https://boards-api.greenhouse.io/v1/boards/shopify/jobs");
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/shopify/jobs",
      expect.objectContaining({
        redirect: "manual",
      })
    );
  });
});
