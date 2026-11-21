import {
  ProviderConfig,
  TestConnectionResult,
  TextCompletionMessage,
  TextCompletionOptions,
  TextCompletionResult,
} from "../types";
import { sanitizeError } from "../redact";
import type { ChatCompletionResult, ChatMessageInput } from "./custom";
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

export async function testAnthropicConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.ANTHROPIC_API_KEY,
    envBaseUrl: process.env.ANTHROPIC_BASE_URL,
    defaultBaseUrl: "https://api.anthropic.com",
    officialHosts: ["api.anthropic.com"],
  });

  if (!apiKey) {
    return {
      success: false,
      provider: "anthropic",
      message: "Anthropic API key is missing. Please provide a key in settings or set ANTHROPIC_API_KEY.",
    };
  }

  const startTime = Date.now();
  try {
    const res = await providerFetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
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
        provider: "anthropic",
        message: `Anthropic connection test failed (${res.status}): ${errBody}`,
        latencyMs,
      };
    }

    const data = await res.json();
    const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;

    return {
      success: true,
      provider: "anthropic",
      message: `Successfully connected to Anthropic API (${modelCount ?? 0} models available).`,
      modelCount,
      latencyMs,
    };
  } catch (err) {
    return {
      success: false,
      provider: "anthropic",
      message: sanitizeError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

export async function completeText(
  config: ProviderConfig,
  messages: TextCompletionMessage[],
  _jsonMode: boolean,
  options?: TextCompletionOptions
): Promise<TextCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.ANTHROPIC_API_KEY,
    envBaseUrl: process.env.ANTHROPIC_BASE_URL,
    defaultBaseUrl: "https://api.anthropic.com",
    officialHosts: ["api.anthropic.com"],
  });
  const model = config.model?.trim() || options?.defaultModel || DEFAULT_MODELS.anthropic;

  if (!apiKey) {
    return { success: false, error: options?.missingKeyMessage ?? "Anthropic API key is missing." };
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: options?.maxTokens ?? 4096,
    messages: chatMessages,
    temperature: options?.temperature ?? 0.3,
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  try {
    const res = await safeFetch(
      `${baseUrl}/v1/messages`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
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
        error: sanitizeError(`Anthropic API returned status ${res.status}: ${errBody}`),
        providerStatus: res.status,
      };
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const text = textBlock?.text;

    if (!text) {
      return { success: false, error: "Anthropic returned empty content in response." };
    }

    return { success: true, text };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(
        `Anthropic ${options?.taskLabel ?? "completion"} failed: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }
}

/**
 * Multi-turn chat completion via Anthropic Messages API with tool_use support.
 */
function parseToolInputSafe(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function chatAnthropic(
  config: ProviderConfig,
  messages: ChatMessageInput[],
  tools: any[],
): Promise<ChatCompletionResult> {
  const { apiKey, baseUrl, allowLocalhost } = resolveProviderCredentialsWithHostPolicy({
    configApiKey: config.apiKey,
    configBaseUrl: config.baseUrl,
    envApiKey: process.env.ANTHROPIC_API_KEY,
    envBaseUrl: process.env.ANTHROPIC_BASE_URL,
    defaultBaseUrl: "https://api.anthropic.com",
    officialHosts: ["api.anthropic.com"],
  });
  const model = config.model?.trim() || "claude-sonnet-4-20250514";

  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  // Extract system message and convert remaining messages to structured Anthropic format
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages: Array<{ role: "assistant" | "user"; content: unknown }> = [];
  const nonSystem = messages.filter((m) => m.role !== "system");

  for (let i = 0; i < nonSystem.length; i++) {
    const m = nonSystem[i];
    if (m.role === "tool" && "toolCallId" in m) {
      const toolBlocks: Array<Record<string, unknown>> = [];
      let j = i;
      while (j < nonSystem.length) {
        const cur = nonSystem[j];
        if (cur.role !== "tool" || !("toolCallId" in cur)) break;
        toolBlocks.push({
          type: "tool_result",
          tool_use_id: cur.toolCallId,
          content: cur.content,
          ...(cur.isError ? { is_error: true } : {}),
        });
        j++;
      }
      chatMessages.push({ role: "user", content: toolBlocks });
      i = j - 1;
      continue;
    }

    if (m.role === "assistant" && "toolCalls" in m && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
      const blocks: Array<Record<string, unknown>> = [];
      if (m.content) {
        blocks.push({ type: "text", text: m.content });
      }
      for (const tc of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: parseToolInputSafe(tc.arguments),
        });
      }
      chatMessages.push({ role: "assistant", content: blocks });
      continue;
    }

    chatMessages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }

  // Convert OpenAI tool schemas to Anthropic format
  const anthropicTools = tools.map((t: any) => ({
    name: t.function?.name || t.name,
    description: t.function?.description || t.description || "",
    input_schema: t.function?.parameters || t.parameters || { type: "object", properties: {} },
  }));

  const body: any = {
    model,
    messages: chatMessages,
    max_tokens: 4096,
    temperature: 0.4,
  };
  if (systemMsg) body.system = systemMsg.content;
  if (anthropicTools.length > 0) body.tools = anthropicTools;

  const res = await providerFetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
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
    throw new Error(sanitizeError(`Anthropic chat failed (${res.status}): ${errBody}`));
  }

  const data = await res.json();
  const content = data.content
    ?.filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("") || "";

  const toolUseBlocks = data.content?.filter((b: any) => b.type === "tool_use") || [];

  return {
    content,
    toolCalls: toolUseBlocks.map((b: any) => ({
      id: b.id || crypto.randomUUID(),
      name: b.name,
      arguments: JSON.stringify(b.input || {}),
    })),
  };
}

