import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testProviderConnection } from "../src/lib/ai/gateway";
import { resolveProviderCredentials } from "../src/lib/ai/providers/credentials";
import { POST as testConnectionPOST } from "../src/app/api/ai/test-connection/route";
import { POST as repairTypstPOST } from "../src/app/api/ai/repair-typst/route";

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
      json: async () => ({ data: [{ id: "remote-model" }] }),
    } as Response);

    const res = await testProviderConnection({
      provider: "custom",
      baseUrl: "https://custom-llm.example/v1",
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain("custom OpenAI-compatible endpoint");
  });

  it("rejects caller-selected loopback URLs with zero outbound fetches, while allowing server-configured local provider in dev", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "local-model" }] }),
    } as Response);
    globalThis.fetch = fetchSpy;

    const callerCustom = await testProviderConnection({
      provider: "custom",
      baseUrl: "http://localhost:8000",
    });
    expect(callerCustom.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    const callerOllama = await testProviderConnection({
      provider: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
    });
    expect(callerOllama.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    const serverOllama = await testProviderConnection({ provider: "ollama" });
    expect(serverOllama.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthenticated test-connection and repair-typst requests with 401 and zero outbound calls", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const testConnRes = await testConnectionPOST(
      new Request("http://localhost/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai", apiKey: "sk-byok-test" }),
      })
    );
    expect(testConnRes.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();

    const repairByokRes = await repairTypstPOST(
      new Request("http://localhost/api/ai/repair-typst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "= Jane",
          compileError: "line 1 error",
          providerConfig: { provider: "custom", apiKey: "dummy", baseUrl: "https://attacker.example" },
        }),
      })
    );
    expect(repairByokRes.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.stubEnv("DEMO_MODE", "true");
    const repairDemoRes = await repairTypstPOST(
      new Request("http://localhost/api/ai/repair-typst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "= Jane",
          compileError: "line 1 error",
          providerConfig: { provider: "openai", apiKey: "sk-demo" },
        }),
      })
    );
    expect(repairDemoRes.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
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
