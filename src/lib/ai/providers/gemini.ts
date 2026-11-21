import {
  ProviderConfig,
  TestConnectionResult,
  TextCompletionMessage,
  TextCompletionOptions,
  TextCompletionResult,
  isValidGeminiModelSegment,
} from "../types";
import { sanitizeError } from "../redact";
import { DEFAULT_GEMINI_MODEL, normalizeGeminiModel } from "../model-defaults";
import type { ChatCompletionResult, ChatMessageInput } from "./custom";
import { safeFetch } from "@/lib/security/safe-fetch";
import { resolveProviderCredentialsWithHostPolicy } from "./credentials";

const RETRYABLE_GEMINI_STATUSES = new Set([429, 503]);
let geminiRetryDelaysMs: readonly number[] = [350, 1000];

export function __setGeminiRetryDelaysForTests(delays: readonly number[] | null): void {
  geminiRetryDelaysMs = delays ?? [350, 1000];
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 3000);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    if (delta >= 0) return Math.min(delta, 3000);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGeminiWithRetry(
  doFetch: () => Promise<Response>
): Promise<Response> {
  let res = await doFetch();
  for (let attempt = 0; attempt < geminiRetryDelaysMs.length; attempt++) {
    if (!RETRYABLE_GEMINI_STATUSES.has(res.status)) {
      return res;
    }
    const baseDelay = geminiRetryDelaysMs[attempt] ?? 0;
    const retryAfter = parseRetryAfterMs(res.headers.get("retry-after"));
    const jitter = baseDelay > 0 ? Math.floor(Math.random() * Math.min(150, baseDelay)) : 0;
    const waitMs = retryAfter !== null ? Math.min(retryAfter, baseDelay > 0 ? 3000 : 0) : baseDelay + jitter;
    await sleep(waitMs);
    res = await doFetch();
  }
  return res;
}

function extractGeminiVisibleText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (part): part is { text: string; thought?: boolean } =>
        Boolean(part) &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string" &&
        (part as { thought?: unknown }).thought !== true
    )
    .map((part) => part.text)
    .join("");
}

function parseAvailableGeminiModels(data: unknown): string[] {
  const models = (data as { models?: unknown } | null)?.models;
  if (!Array.isArray(models)) return [];
  const names: string[] = [];
  for (const entry of models) {
    if (!entry || typeof entry !== "object") continue;
    const rawName = (entry as { name?: unknown }).name;
    if (typeof rawName !== "string" || !rawName.trim()) continue;
    const methods = (entry as { supportedGenerationMethods?: unknown }).supportedGenerationMethods;
    if (Array.isArray(methods) && !methods.includes("generateContent")) {
      continue;
    }
    const normalized = rawName.trim().replace(/^models\//, "");
    if (isValidGeminiModelSegment(normalized) && !names.includes(normalized)) {
      names.push(normalized);
    }
  }
  return names;
}

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

function resolveGeminiModel(model: string | undefined, fallback = DEFAULT_GEMINI_MODEL): string {
  if (model === undefined) {
    return normalizeGeminiModel(undefined, fallback);
  }
  const trimmed = model.trim();
  if (!isValidGeminiModelSegment(trimmed)) {
    throw new Error("Invalid Gemini model identifier.");
  }
  return normalizeGeminiModel(trimmed, fallback);
}

function buildGeminiGenerateContentUrl(
  baseUrl: string,
  model: string | undefined,
  fallback = DEFAULT_GEMINI_MODEL
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

  let targetModel: string;
  try {
    targetModel = resolveGeminiModel(config.model);
  } catch (err) {
    return {
      success: false,
      provider: "gemini",
      message: err instanceof Error ? err.message : "Invalid Gemini model identifier.",
    };
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

    if (!res.ok) {
      const latencyMs = Date.now() - startTime;
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
    const availableModels = parseAvailableGeminiModels(data);
    const surfacedModels = availableModels.slice(0, 25);

    if (availableModels.length > 0 && !availableModels.includes(targetModel)) {
      const latencyMs = Date.now() - startTime;
      const suggestions = surfacedModels.slice(0, 5).join(", ");
      return {
        success: false,
        provider: "gemini",
        message: sanitizeError(
          `Model "${targetModel}" is not available for this API key.${suggestions ? ` Available models include: ${suggestions}.` : ""}`
        ),
        modelCount,
        availableModels: surfacedModels,
        latencyMs,
      };
    }

    const probeUrl = buildGeminiGenerateContentUrl(baseUrl, targetModel);
    const probeRes = await scopedProviderFetch(allowLocalhost)(probeUrl, {
      method: "POST",
      headers: geminiHeaders(apiKey),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ok" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Date.now() - startTime;

    if (!probeRes.ok) {
      let errBody = "";
      try {
        const json = await probeRes.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = probeRes.statusText;
      }
      const statusHint =
        probeRes.status === 404
          ? `Model "${targetModel}" was not found (404). Pick an available model below.`
          : probeRes.status === 429
            ? `Model "${targetModel}" is rate-limited or out of quota (429): ${errBody}`
            : probeRes.status === 503
              ? `Model "${targetModel}" is temporarily overloaded (503). Retry or try another model.`
              : `Model "${targetModel}" failed generateContent probe (${probeRes.status}): ${errBody}`;
      return {
        success: false,
        provider: "gemini",
        message: sanitizeError(statusHint),
        modelCount,
        availableModels: surfacedModels.length > 0 ? surfacedModels : undefined,
        latencyMs,
      };
    }

    return {
      success: true,
      provider: "gemini",
      message: `Successfully connected to Gemini API with ${targetModel} (${modelCount ?? surfacedModels.length} models available).`,
      modelCount,
      availableModels: surfacedModels.length > 0 ? surfacedModels : undefined,
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
    const url = buildGeminiGenerateContentUrl(baseUrl, config.model, options?.defaultModel ?? DEFAULT_GEMINI_MODEL);
    const res = await fetchGeminiWithRetry(() =>
      safeFetch(
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
      )
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
    const text = extractGeminiVisibleText(data.candidates?.[0]?.content?.parts);

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

function parseGeminiToolArgsSafe(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function wrapGeminiFunctionResponse(result: unknown): Record<string, unknown> {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result: result ?? null };
}

/**
 * Multi-turn chat completion via Gemini generateContent with function calling.
 */
export async function chatGemini(
  config: ProviderConfig,
  messages: ChatMessageInput[],
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

  const url = buildGeminiGenerateContentUrl(baseUrl, config.model, DEFAULT_GEMINI_MODEL);

  // Extract system message and convert remaining turns to native Gemini contents format
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  const contents: Array<{ role: "user" | "model"; parts: unknown[] }> = [];

  for (let i = 0; i < nonSystem.length; i++) {
    const m = nonSystem[i];

    if (m.role === "tool" && "toolCallId" in m) {
      const responseParts: unknown[] = [];
      let j = i;
      while (j < nonSystem.length) {
        const cur = nonSystem[j];
        if (cur.role !== "tool" || !("toolCallId" in cur)) break;
        const fnResponse: Record<string, unknown> = {
          name: cur.name,
          response: wrapGeminiFunctionResponse(cur.result !== undefined ? cur.result : cur.content),
        };
        if (cur.providerCallId) {
          fnResponse.id = cur.providerCallId;
        }
        responseParts.push({ functionResponse: fnResponse });
        j++;
      }
      contents.push({ role: "user", parts: responseParts });
      i = j - 1;
      continue;
    }

    if (m.role === "assistant") {
      if ("rawModelParts" in m && Array.isArray(m.rawModelParts) && m.rawModelParts.length > 0) {
        contents.push({ role: "model", parts: m.rawModelParts });
        continue;
      }
      if ("toolCalls" in m && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
        const modelParts: unknown[] = [];
        if (m.content) {
          modelParts.push({ text: m.content });
        }
        for (const tc of m.toolCalls) {
          modelParts.push({
            functionCall: {
              ...(tc.providerCallId ? { id: tc.providerCallId } : {}),
              name: tc.name,
              args: parseGeminiToolArgsSafe(tc.arguments),
            },
          });
        }
        contents.push({ role: "model", parts: modelParts });
        continue;
      }
      contents.push({ role: "model", parts: [{ text: m.content }] });
      continue;
    }

    contents.push({ role: "user", parts: [{ text: m.content }] });
  }

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

  const res = await fetchGeminiWithRetry(() =>
    scopedProviderFetch(allowLocalhost)(
      url,
      {
        method: "POST",
        headers: geminiHeaders(apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      }
    )
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

  const textContent = extractGeminiVisibleText(parts);
  const functionCallParts = parts.filter((p: any) => p.functionCall);

  return {
    content: textContent,
    toolCalls: functionCallParts.map((p: any) => ({
      id: p.functionCall.id || crypto.randomUUID(),
      providerCallId: typeof p.functionCall.id === "string" ? p.functionCall.id : undefined,
      name: p.functionCall.name,
      arguments: JSON.stringify(p.functionCall.args || {}),
    })),
    rawModelParts: parts.length > 0 ? parts : undefined,
  };
}

