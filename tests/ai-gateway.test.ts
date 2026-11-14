import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  testProviderConnection,
  generatePatchProposals,
  generateQualitativeReview,
  generateCoverLetter,
  convertPdfTextToTypst,
  repairTypstSource,
  sendChatCompletion,
} from "../src/lib/ai/gateway";
import { resolveProviderCredentials } from "../src/lib/ai/providers/credentials";
import { ProviderConfigSchema } from "../src/lib/ai/types";
import { completeText as completeGeminiText, chatGemini } from "../src/lib/ai/providers/gemini";
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

describe("SEC-05 Gemini model segment validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["../models/secret", "gemini-2.5-flash?key=1", "a/b", ".", "..", "", "   ", "gemini:latest"])(
    "rejects invalid Gemini model segment %j in ProviderConfigSchema",
    (model) => {
      const parsed = ProviderConfigSchema.safeParse({ provider: "gemini", model });
      expect(parsed.success).toBe(false);
    }
  );

  it("allows valid Gemini models, gemini-3.8-flash alias, and Ollama model tags", () => {
    expect(ProviderConfigSchema.safeParse({ provider: "gemini", model: "gemini-2.5-flash" }).success).toBe(true);
    expect(ProviderConfigSchema.safeParse({ provider: "gemini", model: "gemini-3.8-flash" }).success).toBe(true);
    expect(ProviderConfigSchema.safeParse({ provider: "gemini" }).success).toBe(true);
    expect(ProviderConfigSchema.safeParse({ provider: "ollama", model: "llama3.2:latest" }).success).toBe(true);
    expect(ProviderConfigSchema.safeParse({ provider: "custom", model: "org/model:tag" }).success).toBe(true);
  });

  it("rejects traversal model before fetch across all six Gemini generation paths and normalizes alias", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 })
    );
    const badCfg = { provider: "gemini" as const, apiKey: "AIzaSyFakeKey1234567890", model: "../evil" };

    expect((await completeGeminiText(badCfg, [{ role: "user", content: "u" }], true)).success).toBe(false);
    expect((await generatePatchProposals({
      providerConfig: badCfg,
      masterTypst: "= Resume",
      jobRequirements: { requiredSkills: [], preferredSkills: [], domainTerms: [] },
      evidenceItems: [],
    })).success).toBe(false);
    expect((await generateQualitativeReview({
      providerConfig: badCfg,
      typstContent: "= Resume",
      jobRequirements: { requiredSkills: [], preferredSkills: [], domainTerms: [] },
      deterministicResult: {
        overallScore: 80,
        baseHealth: { score: 25, maxScore: 30, percentage: 83, findings: [] },
        requiredMatch: { score: 30, maxScore: 40, percentage: 75, findings: [] },
        preferredMatch: { score: 10, maxScore: 15, percentage: 67, findings: [] },
        roleEvidence: { score: 15, maxScore: 15, percentage: 100, findings: [] },
        skillEvaluations: [],
        gaps: [],
        selectedProfile: "Full-stack",
      },
    })).success).toBe(false);
    expect((await generateCoverLetter(badCfg, {
      jobId: "job-1",
      company: "Acme",
      roleTitle: "Engineer",
      rawDescription: "Build distributed backend systems",
      candidateName: "Jane Doe",
      activeRoleProfile: "Full-stack",
    }, [])).success).toBe(false);
    expect((await convertPdfTextToTypst({ providerConfig: badCfg, rawText: "Jane Doe" })).success).toBe(false);
    expect((await repairTypstSource(badCfg, { source: "= x", compileError: "err" })).success).toBe(false);
    await expect(sendChatCompletion(badCfg, [{ role: "user", content: "hi" }], [])).rejects.toThrow();
    await expect(chatGemini(badCfg, [{ role: "user", content: "hi" }], [])).rejects.toThrow(/Invalid Gemini model/i);
    expect(fetchSpy).not.toHaveBeenCalled();

    const aliasCfg = { provider: "gemini" as const, apiKey: "AIzaSyFakeKey1234567890", model: "gemini-3.8-flash" };
    await completeGeminiText(
      aliasCfg,
      [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
      true
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      expect.any(Object)
    );
  });
});

describe("SIMP-02b shared completeText across providers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("routes patch proposals across OpenAI, Anthropic, Gemini, and Custom/Groq/Ollama with provider-specific payloads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes("anthropic.com")) {
        return new Response(JSON.stringify({ content: [{ type: "text", text: '{"patches":[],"gaps":[]}' }] }), { status: 200 });
      }
      if (target.includes("googleapis.com")) {
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"patches":[],"gaps":[]}' }] } }] }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"patches":[],"gaps":[]}' } }] }),
        { status: 200 }
      );
    });

    const baseInput = {
      masterTypst: "= Jane Doe",
      jobRequirements: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] },
      evidenceItems: [],
    };

    const openAiRes = await generatePatchProposals({ ...baseInput, providerConfig: { provider: "openai", apiKey: "sk-test" } });
    expect(openAiRes.success).toBe(true);
    const openAiBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(openAiBody.response_format).toEqual({ type: "json_object" });

    const anthropicRes = await generatePatchProposals({ ...baseInput, providerConfig: { provider: "anthropic", apiKey: "sk-ant-test" } });
    expect(anthropicRes.success).toBe(true);
    const anthropicBody = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
    expect(anthropicBody.model).toBe("claude-sonnet-4-20250514");
    expect(typeof anthropicBody.system).toBe("string");

    const geminiRes = await generatePatchProposals({ ...baseInput, providerConfig: { provider: "gemini", apiKey: "AIzaSyTestKey123456" } });
    expect(geminiRes.success).toBe(true);
    const geminiBody = JSON.parse(String(fetchSpy.mock.calls[2][1]?.body));
    expect(geminiBody.generationConfig.responseMimeType).toBe("application/json");

    const customRes = await generatePatchProposals({
      ...baseInput,
      providerConfig: { provider: "custom", baseUrl: "https://custom.example/api" },
    });
    expect(customRes.success).toBe(true);
    expect(fetchSpy.mock.calls[3][0]).toBe("https://custom.example/api/v1/chat/completions");
    const customBody = JSON.parse(String(fetchSpy.mock.calls[3][1]?.body));
    expect(customBody.response_format).toBeUndefined();
  });
});
