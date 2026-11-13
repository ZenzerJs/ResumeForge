import {
  ProviderConfig,
  TestConnectionResult,
  TextCompletionMessage,
  TextCompletionOptions,
  TextCompletionResult,
} from "../types";
import { sanitizeError } from "../redact";
import { safeFetch } from "@/lib/security/safe-fetch";
import { isServerManagedLocalConfig, resolveProviderCredentialsWithHostPolicy } from "./credentials";

function resolveCustomCredentials(config: ProviderConfig) {
  const isServerManagedOllama =
    config.provider === "ollama" && isServerManagedLocalConfig(config);
  return resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: isServerManagedOllama ? undefined : config.baseUrl,
    envApiKey:
      config.provider === "ollama" ? undefined : process.env.CUSTOM_OPENAI_API_KEY,
    envBaseUrl:
      config.provider === "ollama"
        ? isServerManagedOllama
          ? config.baseUrl
          : process.env.OLLAMA_BASE_URL
        : process.env.CUSTOM_OPENAI_BASE_URL,
    defaultBaseUrl:
      config.provider === "ollama"
        ? "http://localhost:11434/v1"
        : "http://localhost:8000",
    officialHosts: [],
    allowDefaultLocalhost: config.provider !== "groq",
  });
}

async function customFetch(
  url: string,
  init?: RequestInit,
  allowLocalhost = false,
): Promise<Response> {
  return safeFetch(url, init ?? {}, {
    allowLocalhost,
    timeoutMs: 120_000,
  });
}

export interface ChatCompletionResult {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}

/**
 * Multi-turn chat completion via a Custom OpenAI-compatible endpoint.
 * Supports function/tool calling in OpenAI format.
 */
export async function chatCustom(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveCustomCredentials(config);
  const model = config.model?.trim() || "default";

  const completionsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const body: any = { model, messages, temperature: 0.4 };
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await customFetch(completionsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, allowLocalhost);

  if (!res.ok) {
    let errBody = "";
    try {
      const json = await res.json();
      errBody = json.error?.message || JSON.stringify(json);
    } catch {
      errBody = res.statusText;
    }
    throw new Error(sanitizeError(`Custom endpoint chat failed (${res.status}): ${errBody}`));
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

/**
 * Custom OpenAI-Compatible Endpoint Adapter
 *
 * Connects to any local or self-hosted endpoint that implements OpenAI-compatible API schemas.
 */
export async function testCustomConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveCustomCredentials(config);

  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Attempt /models or /v1/models
    const targetUrl = baseUrl.endsWith("/v1") ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

    let res = await customFetch(targetUrl, {
      method: "GET",
      headers,
    }, allowLocalhost);

    // Fallback: try raw /models if /v1/models returns 404
    if (res.status === 404 && !baseUrl.endsWith("/v1")) {
      res = await customFetch(`${baseUrl}/models`, {
        method: "GET",
        headers,
      }, allowLocalhost);
    }

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
        provider: "custom",
        message: sanitizeError(`Custom endpoint returned status ${res.status}: ${errBody}`),
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.data)
      ? data.data.length
      : Array.isArray(data?.models)
      ? data.models.length
      : undefined;

    return {
      success: true,
      provider: "custom",
      message: `Successfully connected to custom OpenAI-compatible endpoint${modelCount !== undefined ? ` (${modelCount} models reported)` : ""}.`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      provider: "custom",
      message: sanitizeError(`Connection to custom endpoint failed: ${err instanceof Error ? err.message : String(err)}`),
      latencyMs,
    };
  }
}

export async function completeOpenAICompatibleText(params: {
  completionsUrl: string;
  apiKey?: string;
  requireApiKey: boolean;
  missingKeyMessage: string;
  model: string;
  messages: TextCompletionMessage[];
  sendResponseFormatJson: boolean;
  temperature: number;
  timeoutMs: number;
  allowLocalhost: boolean;
  providerLabel: string;
  taskLabel: string;
}): Promise<TextCompletionResult> {
  if (params.requireApiKey && !params.apiKey) {
    return { success: false, error: params.missingKeyMessage };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (params.apiKey) {
      headers["Authorization"] = `Bearer ${params.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
    };
    if (params.sendResponseFormatJson) {
      body.response_format = { type: "json_object" };
    }

    const res = await safeFetch(
      params.completionsUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      {
        allowLocalhost: params.allowLocalhost,
        timeoutMs: params.timeoutMs,
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
        error: sanitizeError(`${params.providerLabel} returned status ${res.status}: ${errBody}`),
      };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return { success: false, error: `${params.providerLabel} returned empty content in response.` };
    }

    return { success: true, text };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(
        `${params.providerLabel} ${params.taskLabel} failed: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }
}

export async function completeText(
  config: ProviderConfig,
  messages: TextCompletionMessage[],
  _jsonMode: boolean,
  options?: TextCompletionOptions
): Promise<TextCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveCustomCredentials(config);
  const model = config.model?.trim() || options?.defaultModel || "default";
  const completionsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  return completeOpenAICompatibleText({
    completionsUrl,
    apiKey,
    requireApiKey: false,
    missingKeyMessage: options?.missingKeyMessage ?? "API key is missing.",
    model,
    messages,
    sendResponseFormatJson: false,
    temperature: options?.temperature ?? 0.3,
    timeoutMs: options?.timeoutMs ?? 120_000,
    allowLocalhost,
    providerLabel: "Custom endpoint",
    taskLabel: options?.taskLabel ?? "completion",
  });
}

