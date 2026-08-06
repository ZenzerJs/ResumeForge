import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testProviderConnection } from "../src/lib/ai/gateway";

describe("AI Provider Gateway Connection Tests", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns error when OpenAI key is missing", async () => {
    const res = await testProviderConnection({ provider: "openai", apiKey: "" });
    expect(res.success).toBe(false);
    expect(res.message).toContain("OpenAI API key is missing");
  });

  it("connects to OpenAI successfully with valid key", async () => {
    const fakeKey = "sk-proj-validfakekey1234567890";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] }),
    } as Response);

    const res = await testProviderConnection({ provider: "openai", apiKey: fakeKey });

    expect(res.success).toBe(true);
    expect(res.modelCount).toBe(2);
    expect(res.message).not.toContain(fakeKey);
  });

  it("redacts key when OpenAI API returns 401 error", async () => {
    const fakeKey = "sk-proj-invalidkey999999999";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: `Incorrect API key provided: ${fakeKey}` } }),
    } as Response);

    const res = await testProviderConnection({ provider: "openai", apiKey: fakeKey });

    expect(res.success).toBe(false);
    expect(res.message).not.toContain(fakeKey);
    expect(res.message).toContain("[REDACTED_KEY]");
  });

  it("connects to Anthropic successfully", async () => {
    const fakeKey = "sk-ant-validfakekey1234567890";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "claude-3-5-sonnet-20241022" }] }),
    } as Response);

    const res = await testProviderConnection({ provider: "anthropic", apiKey: fakeKey });

    expect(res.success).toBe(true);
    expect(res.modelCount).toBe(1);
    expect(res.message).not.toContain(fakeKey);
  });

  it("connects to Gemini successfully", async () => {
    const fakeKey = "AIzaSyValidFakeGeminiKey1234567890123";
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: "models/gemini-1.5-flash" }] }),
    } as Response);

    const res = await testProviderConnection({ provider: "gemini", apiKey: fakeKey });

    expect(res.success).toBe(true);
    expect(res.modelCount).toBe(1);
    expect(res.message).not.toContain(fakeKey);
  });

  it("connects to custom OpenAI-compatible endpoint successfully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "local-model" }] }),
    } as Response);

    const res = await testProviderConnection({
      provider: "custom",
      baseUrl: "http://localhost:8000",
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain("custom OpenAI-compatible endpoint");
  });
});
