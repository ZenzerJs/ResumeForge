import {
  ProviderConfig,
  TestConnectionResult,
  TextCompletionMessage,
  TextCompletionOptions,
  TextCompletionResult,
  isValidGeminiModelSegment,
} from "../types";
import { sanitizeError } from "../redact";
import type { ChatCompletionResult } from "./custom";
import { safeFetch } from "@/lib/security/safe-fetch";
import { resolveProviderCredentialsWithHostPolicy } from "./credentials";

function providerFetch(url: string, init?: RequestInit, allowLocalhost = false): Promise<Response> {
  return safeFetch(url, init ?? {}, {
    timeoutMs: 130_000,
    allowLocalhost,
  });
}

function scopedProviderFetch(allowLocalhost: boolean) {
  return (url: string, init?: RequestInit) => providerFetch(url, init, allowLocalhost);
}

function geminiHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

function resolveGeminiModel(model: string | undefined, fallback = "gemini-2.5-flash"): string {
  if (model === undefined) {
    return fallback;
  }
  const trimmed = model.trim();
  if (!isValidGeminiModelSegment(trimmed)) {
    throw new Error("Invalid Gemini model identifier.");
  }
  if (trimmed === "gemini-3.8-flash") {
    return fallback;
  }
  return trimmed;
}

function buildGeminiGenerateContentUrl(
  baseUrl: string,
  model: string | undefined,
  fallback = "gemini-2.5-flash"
): string {
  const resolved = resolveGeminiModel(model, fallback);
  return `${baseUrl}/v1beta/models/${encodeURIComponent(resolved)}:generateContent`;
}

export async function testGeminiConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.GEMINI_API_KEY,
    envBaseUrl: process.env.GEMINI_BASE_URL,
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    officialHosts: ["generativelanguage.googleapis.com"],
  });

  if (!apiKey) {
    return {
      success: false,
      provider: "gemini",
      message: "Gemini API key is missing. Please provide a key in settings or set GEMINI_API_KEY.",
    };
  }

  if (config.model !== undefined) {
    try {
      resolveGeminiModel(config.model);
    } catch (err) {
      return {
        success: false,
        provider: "gemini",
        message: err instanceof Error ? err.message : "Invalid Gemini model identifier.",
      };
    }
  }

  const startTime = Date.now();
  try {
  const res = await scopedProviderFetch(allowLocalhost)(`${baseUrl}/v1beta/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return {
        success: false,
        provider: "gemini",
        message: sanitizeError(`Gemini API returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.models) ? data.models.length : undefined;

    return {
      success: true,
      provider: "gemini",
      message: `Successfully connected to Gemini API (${modelCount ?? 0} models available).`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "gemini",
      message: sanitizeError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`),
      latencyMs,
    };
  }
}

export async function completeText(
  config: ProviderConfig,
  messages: TextCompletionMessage[],
  jsonMode: boolean,
  options?: TextCompletionOptions
): Promise<TextCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.GEMINI_API_KEY,
    envBaseUrl: process.env.GEMINI_BASE_URL,
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    officialHosts: ["generativelanguage.googleapis.com"],
  });

  if (!apiKey) {
    return { success: false, error: options?.missingKeyMessage ?? "Gemini API key is missing." };
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.3,
  };
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }
  if (options?.thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }

  try {
    const url = buildGeminiGenerateContentUrl(baseUrl, config.model, options?.defaultModel ?? "gemini-2.5-flash");
    const res = await safeFetch(
      url,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
        body: JSON.stringify(body),
      },
      {
        timeoutMs: options?.timeoutMs ?? 130_000,
        allowLocalhost,
      }
    );

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return {
        success: false,
        error: sanitizeError(`Gemini API returned status ${res.status}: ${errBody}`),
        providerStatus: res.status,
      };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { success: false, error: "Gemini returned empty content in response." };
    }

    return { success: true, text };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(
        `Gemini ${options?.taskLabel ?? "completion"} failed: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }
}

/**
 * Multi-turn chat completion via Gemini generateContent with function calling.
 */
export async function chatGemini(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.GEMINI_API_KEY,
    envBaseUrl: process.env.GEMINI_BASE_URL,
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    officialHosts: ["generativelanguage.googleapis.com"],
  });
  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const url = buildGeminiGenerateContentUrl(baseUrl, config.model, "gemini-2.5-flash");

  // Extract system message and convert to Gemini contents format
  const systemMsg = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  // Convert OpenAI tool schemas to Gemini functionDeclarations
  const functionDeclarations = tools.map((t: any) => ({
    name: t.function?.name || t.name,
    description: t.function?.description || t.description || "",
    parameters: t.function?.parameters || t.parameters || { type: "object", properties: {} },
  }));

  const body: any = { contents, generationConfig: { temperature: 0.4 } };
  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }
  if (functionDeclarations.length > 0) {
    body.tools = [{ functionDeclarations }];
  }

  const res = await scopedProviderFetch(allowLocalhost)(
    url,
    {
      method: "POST",
      headers: geminiHeaders(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    }
  );

  if (!res.ok) {
    let errBody = "";
    try {
      const json = await res.json();
      errBody = json.error?.message || JSON.stringify(json);
    } catch {
      errBody = res.statusText;
    }
    throw new Error(sanitizeError(`Gemini chat failed (${res.status}): ${errBody}`));
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
  const functionCallParts = parts.filter((p: any) => p.functionCall);

  return {
    content: textParts.join(""),
    toolCalls: functionCallParts.map((p: any) => ({
      id: crypto.randomUUID(),
      name: p.functionCall.name,
      arguments: JSON.stringify(p.functionCall.args || {}),
    })),
  };
}

