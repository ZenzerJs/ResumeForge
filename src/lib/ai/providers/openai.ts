import {
  ProviderConfig,
  TestConnectionResult,
  TextCompletionMessage,
  TextCompletionOptions,
  TextCompletionResult,
} from "../types";
import { sanitizeError } from "../redact";
import { completeOpenAICompatibleText, type ChatCompletionResult } from "./custom";
import { safeFetch } from "@/lib/security/safe-fetch";
import { resolveProviderCredentialsWithHostPolicy } from "./credentials";
import { DEFAULT_MODELS } from "@/lib/byok-vault";

function providerFetch(
  url: string,
  init?: RequestInit,
  allowLocalhost = false,
): Promise<Response> {
  return safeFetch(url, init ?? {}, {
    timeoutMs: 130_000,
    allowLocalhost,
  });
}

export async function testOpenAIConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.OPENAI_API_KEY,
    envBaseUrl: process.env.OPENAI_BASE_URL,
    defaultBaseUrl: "https://api.openai.com",
    officialHosts: ["api.openai.com"],
  });

  if (!apiKey) {
    return {
      success: false,
      provider: "openai",
      message: "OpenAI API key is missing. Please provide a key in settings or set OPENAI_API_KEY.",
    };
  }

  const startTime = Date.now();
  try {
    const res = await providerFetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    }, allowLocalhost);

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
        provider: "openai",
        message: sanitizeError(`OpenAI API returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;

    return {
      success: true,
      provider: "openai",
      message: `Successfully connected to OpenAI models API (${modelCount ?? 0} models available).`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "openai",
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
    envApiKey: process.env.OPENAI_API_KEY,
    envBaseUrl: process.env.OPENAI_BASE_URL,
    defaultBaseUrl: "https://api.openai.com",
    officialHosts: ["api.openai.com"],
  });
  const model = config.model?.trim() || options?.defaultModel || DEFAULT_MODELS.openai;

  return completeOpenAICompatibleText({
    completionsUrl: `${baseUrl}/v1/chat/completions`,
    apiKey,
    requireApiKey: true,
    missingKeyMessage: options?.missingKeyMessage ?? "OpenAI API key is missing.",
    model,
    messages,
    sendResponseFormatJson: jsonMode,
    temperature: options?.temperature ?? 0.3,
    timeoutMs: options?.timeoutMs ?? 130_000,
    allowLocalhost,
    providerLabel: "OpenAI API",
    taskLabel: options?.taskLabel ?? "completion",
  });
}

/**
 * Multi-turn chat completion via OpenAI with tool/function calling support.
 */
export async function chatOpenAI(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.OPENAI_API_KEY,
    envBaseUrl: process.env.OPENAI_BASE_URL,
    defaultBaseUrl: "https://api.openai.com",
    officialHosts: ["api.openai.com"],
  });
  const model = config.model?.trim() || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OpenAI API key is missing.");
  }

  const body: any = { model, messages, temperature: 0.4 };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await providerFetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  }, allowLocalhost);

  if (!res.ok) {
    let errBody = "";
    try {
      const json = await res.json();
      errBody = json.error?.message || JSON.stringify(json);
    } catch {
      errBody = res.statusText;
    }
    throw new Error(sanitizeError(`OpenAI chat failed (${res.status}): ${errBody}`));
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  const content = choice?.content || "";
  const rawToolCalls = choice?.tool_calls || [];

  return {
    content,
    toolCalls: rawToolCalls.map((tc: any) => ({
      id: tc.id || crypto.randomUUID(),
      name: tc.function?.name || tc.name || "unknown",
      arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments || {}),
    })),
  };
}

