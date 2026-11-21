import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveKey,
  getKey,
  removeKey,
  getActiveConfig,
  resolveClientProviderConfig,
  markProviderConnectionStatus,
  BYOK_UPDATED_EVENT,
  __resetByokVaultForTests,
} from "@/lib/byok-vault";
import { callByokModel } from "@/lib/ai-provider";

function createMockIndexedDb(options?: { failWriteTx?: boolean }) {
  const stores: Record<string, Map<string, any>> = {
    keys: new Map(),
    secrets: new Map(),
  };
  let keyPutCount = 0;

  function makeReq<T>(getter: () => T) {
    const req: any = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
    };
    queueMicrotask(() => {
      try {
        req.result = getter();
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.onerror?.({ target: req });
      }
    });
    return req;
  }

  const fakeDb: any = {
    objectStoreNames: {
      contains: (name: string) => name === "keys" || name === "secrets",
    },
    createObjectStore: vi.fn(),
    close: vi.fn(),
    transaction: (_storeNames: string[], mode: string) => {
      const tx: any = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: (storeName: string) => ({
          get: (key: string) => makeReq(() => stores[storeName].get(key)),
          getAllKeys: () => makeReq(() => Array.from(stores[storeName].keys())),
          put: (value: any, key?: string) => {
            if (mode === "readwrite" && options?.failWriteTx) {
              throw new Error("Simulated IDB write failure");
            }
            const resolvedKey = key ?? value?.provider;
            if (storeName === "keys") keyPutCount += 1;
            stores[storeName].set(String(resolvedKey), value);
            return makeReq(() => resolvedKey);
          },
          delete: (key: string) => {
            stores[storeName].delete(String(key));
            return makeReq(() => undefined);
          },
        }),
      };
      setTimeout(() => {
        tx.oncomplete?.({ target: tx });
      }, 5);
      return tx;
    },
  };

  const idb = {
    open: vi.fn(() => {
      const req: any = {
        result: fakeDb,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    }),
  };

  return { idb, stores, getKeyPutCount: () => keyPutCount };
}

async function seedLegacyEncryptedKey(
  store: Record<string, string>,
  provider: string,
  rawKey: string
) {
  let masterKey: CryptoKey;
  if (store["rf_vault_master_key"]) {
    masterKey = await crypto.subtle.importKey(
      "jwk",
      JSON.parse(store["rf_vault_master_key"]),
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  } else {
    masterKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const exported = await crypto.subtle.exportKey("jwk", masterKey);
    store["rf_vault_master_key"] = JSON.stringify(exported);
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    new TextEncoder().encode(rawKey)
  );
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
  store[`rf_byok_key_${provider}`] = `${b64(iv)}:${b64(new Uint8Array(cipher))}`;
}

describe("BYOK Vault & Router (WS6)", () => {
  const store: Record<string, string> = {};
  let mockIdb: ReturnType<typeof createMockIndexedDb>;

  beforeEach(() => {
    __resetByokVaultForTests();
    Object.keys(store).forEach((k) => delete store[k]);
    mockIdb = createMockIndexedDb();

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
      get length() {
        return Object.keys(store).length;
      },
      key: (idx: number) => Object.keys(store)[idx] ?? null,
    };

    vi.stubGlobal("window", { localStorage: mockStorage });
    vi.stubGlobal("localStorage", mockStorage);
    vi.stubGlobal("indexedDB", mockIdb.idb);
  });

  afterEach(() => {
    __resetByokVaultForTests();
    vi.unstubAllGlobals();
  });

  describe("Web Crypto AES-GCM IndexedDB Vault", () => {
    it("encrypts keys in IndexedDB using a non-extractable CryptoKey without touching localStorage", async () => {
      const rawKey = "sk-proj-testsecretkey123456789";
      await saveKey("openai", rawKey);

      expect(store["rf_byok_key_openai"]).toBeUndefined();
      expect(store["rf_vault_master_key"]).toBeUndefined();

      const masterKey = mockIdb.stores.keys.get("master") as CryptoKey;
      expect(masterKey).toBeDefined();
      expect(masterKey.extractable).toBe(false);
      await expect(crypto.subtle.exportKey("jwk", masterKey)).rejects.toThrow();

      const storedRecord = mockIdb.stores.secrets.get("openai");
      expect(storedRecord?.payload).toBeDefined();
      expect(storedRecord.payload).not.toContain(rawKey);
      expect(storedRecord.payload).toContain(":");

      const decrypted = await getKey("openai");
      expect(decrypted).toBe(rawKey);
    });

    it("removes a key cleanly from IndexedDB", async () => {
      await saveKey("groq", "gsk_secretkey123");
      expect(await getKey("groq")).toBe("gsk_secretkey123");

      await removeKey("groq");
      expect(await getKey("groq")).toBeNull();
      expect(mockIdb.stores.secrets.get("groq")).toBeUndefined();
    });

    it("migrates all legacy localStorage provider entries (including custom) and clears resumeforge_ai_settings.apiKey only after durable commit", async () => {
      await seedLegacyEncryptedKey(store, "anthropic", "sk-ant-legacysecret");
      await seedLegacyEncryptedKey(store, "custom", "sk-custom-secret");
      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "gemini",
        model: "gemini-2.5-flash",
        apiKey: "AIzaSyLegacySettingsKey",
      });

      expect(await getKey("anthropic")).toBe("sk-ant-legacysecret");
      expect(await getKey("custom")).toBe("sk-custom-secret");
      expect(await getKey("gemini")).toBe("AIzaSyLegacySettingsKey");

      expect(store["rf_byok_key_anthropic"]).toBeUndefined();
      expect(store["rf_byok_key_custom"]).toBeUndefined();
      expect(store["rf_vault_master_key"]).toBeUndefined();

      const updatedSettings = JSON.parse(store["resumeforge_ai_settings"]);
      expect(updatedSettings.provider).toBe("gemini");
      expect(updatedSettings.model).toBe("gemini-2.5-flash");
      expect(updatedSettings.apiKey).toBeUndefined();
    });

    it("keeps legacy localStorage ciphertext intact when IndexedDB migration commit fails and falls back to memory-only", async () => {
      await seedLegacyEncryptedKey(store, "openai", "sk-proj-keepme");
      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "gemini",
        apiKey: "AIzaSyKeepMe",
      });
      const failingIdb = createMockIndexedDb({ failWriteTx: true });
      vi.stubGlobal("indexedDB", failingIdb.idb);

      expect(await getKey("openai")).toBe("sk-proj-keepme");
      expect(await getKey("gemini")).toBe("AIzaSyKeepMe");
      expect(store["rf_vault_master_key"]).toBeDefined();
      expect(store["rf_byok_key_openai"]).toBeDefined();
      expect(JSON.parse(store["resumeforge_ai_settings"]).apiKey).toBe("AIzaSyKeepMe");
    });

    it("serializes concurrent initialization so master key is written once without clobbering writes", async () => {
      await Promise.all([
        getKey("gemini"),
        saveKey("openai", "sk-concurrent-openai"),
        saveKey("anthropic", "sk-concurrent-anthropic"),
      ]);

      expect(mockIdb.getKeyPutCount()).toBe(1);
      expect(await getKey("openai")).toBe("sk-concurrent-openai");
      expect(await getKey("anthropic")).toBe("sk-concurrent-anthropic");
    });

    it("falls back to memory-only storage when IndexedDB is unavailable", async () => {
      vi.stubGlobal("indexedDB", undefined);

      await saveKey("openai", "sk-memory-only");
      expect(store["rf_byok_key_openai"]).toBeUndefined();
      expect(store["rf_vault_master_key"]).toBeUndefined();
      expect(await getKey("openai")).toBe("sk-memory-only");

      await removeKey("openai");
      expect(await getKey("openai")).toBeNull();
    });

    it("ensures removeKey clears legacy settings apiKey so a removed credential stays removed across reload", async () => {
      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "gemini",
        model: "gemini-2.5-flash",
        apiKey: "AIzaSyShouldBeRemoved",
      });
      vi.stubGlobal("indexedDB", undefined);

      expect(await getKey("gemini")).toBe("AIzaSyShouldBeRemoved");
      await removeKey("gemini");
      expect(await getKey("gemini")).toBeNull();

      // Simulate reload / re-initialization
      __resetByokVaultForTests();
      expect(await getKey("gemini")).toBeNull();
      const persistedSettings = JSON.parse(store["resumeforge_ai_settings"]);
      expect(persistedSettings.provider).toBe("gemini");
      expect(persistedSettings.apiKey).toBeUndefined();
    });

    it("reports active config and hasKey accurately and truthfully", async () => {
      const defaultConfig = await getActiveConfig();
      expect(defaultConfig.provider).toBe("gemini");
      expect(defaultConfig.model).toBe("gemini-3.8-flash");
      expect(defaultConfig.hasKey).toBe(false);
      expect(defaultConfig.keyless).toBe(false);

      await saveKey("gemini", "AIzaSyTestKey");
      const configured = await getActiveConfig();
      expect(configured.hasKey).toBe(true);
      expect(configured.keyless).toBe(false);

      // Failed test/call clears active status for cloud provider
      markProviderConnectionStatus("gemini", false);
      const failedCloud = await getActiveConfig();
      expect(failedCloud.hasKey).toBe(false);
      expect(failedCloud.verified).toBe(false);

      // Saving a new key clears stale failure state
      await saveKey("gemini", "AQ.NewValidKey123456789012345");
      const replacedCloud = await getActiveConfig();
      expect(replacedCloud.hasKey).toBe(true);

      // Untested ollama/custom must not report hasKey: true
      store["resumeforge_ai_settings"] = JSON.stringify({ provider: "ollama" });
      const ollamaConfig = await getActiveConfig();
      expect(ollamaConfig.provider).toBe("ollama");
      expect(ollamaConfig.hasKey).toBe(false);
      expect(ollamaConfig.keyless).toBe(true);
      expect(ollamaConfig.verified).toBe(false);

      markProviderConnectionStatus("ollama", true);
      const verifiedOllama = await getActiveConfig();
      expect(verifiedOllama.hasKey).toBe(true);
      expect(verifiedOllama.keyless).toBe(false);
      expect(verifiedOllama.verified).toBe(true);

      markProviderConnectionStatus("ollama", false);
      const failedOllama = await getActiveConfig();
      expect(failedOllama.hasKey).toBe(false);
      expect(failedOllama.keyless).toBe(true);

      store["resumeforge_ai_settings"] = JSON.stringify({ provider: "custom" });
      const customKeylessConfig = await getActiveConfig();
      expect(customKeylessConfig.provider).toBe("custom");
      expect(customKeylessConfig.hasKey).toBe(false);
      expect(customKeylessConfig.keyless).toBe(true);

      await saveKey("custom", "custom-bearer-token");
      const customKeyedUntested = await getActiveConfig();
      expect(customKeyedUntested.provider).toBe("custom");
      expect(customKeyedUntested.hasKey).toBe(false);
      expect(customKeyedUntested.keyless).toBe(true);

      markProviderConnectionStatus("custom", true);
      const customVerified = await getActiveConfig();
      expect(customVerified.hasKey).toBe(true);
      expect(customVerified.keyless).toBe(false);
      expect(customVerified.verified).toBe(true);
    });

    it("isolates baseUrl per provider and never passes ollama localhost URL to gemini or custom", async () => {
      await saveKey("gemini", "AQ.TestGeminiKey1234567890123");
      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "gemini",
        model: "gemini-2.5-flash",
        baseUrl: "http://localhost:11434",
        baseUrls: {
          ollama: "http://localhost:11434",
          openai: "https://proxy.example.com/v1",
        },
      });

      const geminiConfig = await resolveClientProviderConfig();
      expect(geminiConfig).toEqual({
        provider: "gemini",
        apiKey: "AQ.TestGeminiKey1234567890123",
        baseUrl: undefined,
        model: "gemini-2.5-flash",
      });

      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "custom",
        baseUrl: "http://localhost:11434",
      });
      const customConfig = await resolveClientProviderConfig();
      expect(customConfig?.baseUrl).toBeUndefined();

      await saveKey("openai", "sk-openai-test");
      store["resumeforge_ai_settings"] = JSON.stringify({
        provider: "openai",
        baseUrls: {
          ollama: "http://localhost:11434",
          openai: "https://proxy.example.com/v1",
        },
      });
      const openaiConfig = await resolveClientProviderConfig();
      expect(openaiConfig?.baseUrl).toBe("https://proxy.example.com/v1");
    });

    it("dispatches resumeforge:byok-updated when connection status or keys change", async () => {
      const dispatchEvent = vi.fn();
      vi.stubGlobal("window", { localStorage: globalThis.localStorage, dispatchEvent });

      await saveKey("gemini", "AIzaSyEventTestKey");
      markProviderConnectionStatus("gemini", true);
      await removeKey("gemini");

      const eventNames = dispatchEvent.mock.calls.map((call) => call[0]?.type);
      expect(eventNames).toEqual([
        BYOK_UPDATED_EVENT,
        BYOK_UPDATED_EVENT,
        BYOK_UPDATED_EVENT,
      ]);
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

    it("surfaces 'Sign in to use this provider, or switch to Gemini.' when guest calls OpenAI/Anthropic/Groq and receives 401 from proxy", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "AUTH_REQUIRED",
              message: "Sign in to use this provider, or switch to Gemini.",
            },
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      );

      await expect(
        callByokModel({
          provider: "openai",
          apiKey: "sk-guest-key",
          prompt: "Test prompt",
        })
      ).rejects.toThrow("Sign in to use this provider, or switch to Gemini.");

      fetchSpy.mockRestore();
    });
  });

  it("uses updated default models for OpenAI and Anthropic when no custom model is saved", async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { for (const k of Object.keys(store)) delete store[k]; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length; },
      },
      dispatchEvent: vi.fn(),
    });

    store["resumeforge_ai_settings"] = JSON.stringify({ provider: "openai" });
    await saveKey("openai", "sk-openai-default");
    const openaiActive = await getActiveConfig();
    expect(openaiActive.model).toBe("gpt-4.1");
    const openaiResolved = await resolveClientProviderConfig();
    expect(openaiResolved?.model).toBe("gpt-4.1");

    store["resumeforge_ai_settings"] = JSON.stringify({ provider: "anthropic" });
    await saveKey("anthropic", "sk-ant-default");
    const anthropicActive = await getActiveConfig();
    expect(anthropicActive.model).toBe("claude-sonnet-4-20250514");
    const anthropicResolved = await resolveClientProviderConfig();
    expect(anthropicResolved?.model).toBe("claude-sonnet-4-20250514");
  });
});
