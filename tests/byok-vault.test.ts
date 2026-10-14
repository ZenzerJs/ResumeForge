import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveKey, getKey, removeKey, getActiveConfig } from "@/lib/byok-vault";
import { callByokModel } from "@/lib/ai-provider";
import { POST as proxyPost } from "@/app/api/ai/byok-proxy/route";

describe("BYOK Vault & Router (WS6)", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);

    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };

    (globalThis as any).window = { localStorage: mockStorage };
    (globalThis as any).localStorage = mockStorage;
  });

  describe("Web Crypto AES-GCM Vault", () => {
    it("encrypts and stores API keys without plaintext in localStorage", async () => {
      const rawKey = "sk-proj-testsecretkey123456789";
      await saveKey("openai", rawKey);

      // Verify something was stored
      const stored = store["rf_byok_key_openai"];
      expect(stored).toBeDefined();

      // Verify the raw key is NEVER stored in plaintext in localStorage
      expect(stored).not.toContain(rawKey);
      expect(stored).toContain(":"); // iv:ciphertext format

      // Retrieve and decrypt
      const decrypted = await getKey("openai");
      expect(decrypted).toBe(rawKey);
    });

    it("removes a key cleanly", async () => {
      await saveKey("groq", "gsk_secretkey123");
      expect(await getKey("groq")).toBe("gsk_secretkey123");

      await removeKey("groq");
      expect(await getKey("groq")).toBeNull();
      expect(store["rf_byok_key_groq"]).toBeUndefined();
    });

    it("migrates legacy unencrypted settings on getKey", async () => {
      const legacyKey = "sk-ant-legacysecret";
      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "anthropic",
        apiKey: legacyKey,
      });

      const retrieved = await getKey("anthropic");
      expect(retrieved).toBe(legacyKey);

      // Verify it was migrated to encrypted vault
      expect(store["rf_byok_key_anthropic"]).toBeDefined();
      expect(store["rf_byok_key_anthropic"]).not.toContain(legacyKey);
    });

    it("reports active config and hasKey accurately", async () => {
      // Default when empty
      const defaultConfig = await getActiveConfig();
      expect(defaultConfig.provider).toBe("gemini");
      expect(defaultConfig.model).toBe("gemini-3.8-flash");
      expect(defaultConfig.hasKey).toBe(false);

      // Save a key for gemini
      await saveKey("gemini", "AIzaSyTestKey");
      const configured = await getActiveConfig();
      expect(configured.hasKey).toBe(true);

      // Ollama returns hasKey: true by default
      store["resumeforge_ai_settings"] = JSON.stringify({ provider: "ollama" });
      const ollamaConfig = await getActiveConfig();
      expect(ollamaConfig.provider).toBe("ollama");
      expect(ollamaConfig.hasKey).toBe(true);
    });
  });

  describe("callByokModel execution helper", () => {
    it("throws clear error when required API key is missing", async () => {
      await expect(
        callByokModel({
          provider: "openai",
          prompt: "Hello",
          apiKey: "",
        })
      ).rejects.toThrow(/API key for provider 'openai' is missing/i);
    });

    it("calls OpenAI-compatible endpoint and parses structured JSON", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ summary: "ATS Resume Match", score: 95 }),
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await callByokModel<{ summary: string; score: number }>({
        provider: "groq",
        apiKey: "gsk-mock-key",
        prompt: "Analyze resume",
        json: true,
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(result.provider).toBe("groq");
      expect(result.data).toEqual({ summary: "ATS Resume Match", score: 95 });
      fetchSpy.mockRestore();
    });

    it("supports streaming callbacks on token generation", async () => {
      const streamChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        "data: [DONE]\n\n",
      ];

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          for (const chunk of streamChunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: readable,
      } as unknown as Response);

      const tokens: string[] = [];
      const result = await callByokModel({
        provider: "groq",
        apiKey: "gsk-mock-key",
        prompt: "Say hello",
        onToken: (tok) => tokens.push(tok),
      });

      expect(tokens).toEqual(["Hello", " world"]);
      expect(result.text).toBe("Hello world");
      fetchSpy.mockRestore();
    });
  });

  describe("BYOK Edge Proxy Route", () => {
    it("returns 400 when x-byok-target-url header is missing", async () => {
      const req = new Request("http://localhost/api/ai/byok-proxy", {
        method: "POST",
        body: JSON.stringify({ test: true }),
      });

      const res = await proxyPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Missing x-byok-target-url");
    });

    it("forwards upstream request and streams payload directly", async () => {
      const fakeTarget = "https://api.groq.com/openai/v1/chat/completions";
      const upstreamBody = JSON.stringify({ choices: [{ message: { content: "Proxy response" } }] });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(upstreamBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );

      const req = new Request("http://localhost/api/ai/byok-proxy", {
        method: "POST",
        headers: {
          "x-byok-target-url": fakeTarget,
          "x-byok-auth": "Bearer gsk-secret-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile" }),
      });

      const res = await proxyPost(req);
      expect(res.status).toBe(200);

      // Verify upstream fetch received auth and target
      expect(fetchSpy).toHaveBeenCalledWith(
        fakeTarget,
        expect.objectContaining({
          method: "POST",
          headers: expect.any(Headers),
        })
      );

      const responseText = await res.text();
      expect(responseText).toBe(upstreamBody);

      fetchSpy.mockRestore();
    });
  });
});
