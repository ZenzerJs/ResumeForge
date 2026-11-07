import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testProviderConnection } from "../src/lib/ai/gateway";
import { resolveProviderCredentials } from "../src/lib/ai/providers/credentials";

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

describe("server provider credential isolation", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("GROQ_API_KEY", "synthetic-server-groq-key");
    vi.stubEnv("CUSTOM_OPENAI_API_KEY", undefined);
    vi.stubEnv("CUSTOM_OPENAI_BASE_URL", undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"data":[]}'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(["https://attacker.example", "https://api.groq.com:8443/openai/v1"])(
    "never sends the server Groq key to %s",
    async (baseUrl) => {
      await testProviderConnection({ provider: "groq", baseUrl });
      expect(fetch).toHaveBeenCalledOnce();
      const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
      expect(headers.has("authorization")).toBe(false);
    }
  );

  it("uses the server Groq key only at the official origin", async () => {
    await testProviderConnection({ provider: "groq" });
    expect(fetch).toHaveBeenCalledWith("https://api.groq.com/openai/v1/models", expect.any(Object));
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer synthetic-server-groq-key");
  });

  it("still permits an explicit BYOK key at a custom endpoint", async () => {
    await testProviderConnection({
      provider: "groq",
      baseUrl: "https://custom.example/v1",
      apiKey: "synthetic-user-key",
    });
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("authorization")).toBe("Bearer synthetic-user-key");
  });

  it.each(["http://api.openai.com", "https://api.openai.com:8443", "https://user@api.openai.com"])(
    "does not trust a changed provider origin or URL credentials: %s",
    (configBaseUrl) => {
      expect(resolveProviderCredentials({
        configBaseUrl,
        envApiKey: "synthetic-server-key",
        defaultBaseUrl: "https://api.openai.com",
        officialHosts: ["api.openai.com"],
      }).apiKey).toBeUndefined();
    }
  );
});
