import { GoogleGenAI } from "@google/genai";
import { getActiveConfig, getKey, resolveClientProviderConfig, ByokProvider } from "./byok-vault";

export interface ByokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallByokModelOptions<T = unknown> {
  prompt?: string;
  systemPrompt?: string;
  messages?: ByokMessage[];
  provider?: ByokProvider | string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  json?: boolean;
  onToken?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface CallByokModelResult<T = unknown> {
  text: string;
  data?: T;
  provider: string;
  model: string;
  latencyMs: number;
}

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-20241022",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Streams an OpenAI-compatible SSE response and dispatches tokens to onToken.
 */
async function streamOpenAiResponse(
  response: Response,
  onToken?: (chunk: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (trimmed === "data: [DONE]") continue;

      if (trimmed.startsWith("data: ")) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          // OpenAI / Groq / Ollama delta
          const token =
            json.choices?.[0]?.delta?.content ||
            // Anthropic content_block_delta
            (json.type === "content_block_delta" ? json.delta?.text : "");

          if (token) {
            fullText += token;
            onToken?.(token);
          }
        } catch {
          // Skip incomplete JSON in SSE chunks
        }
      }
    }
  }

  return fullText;
}

/**
 * Universal execution helper for BYOK models.
 * Handles Gemini (default gemini-2.5-flash via @google/genai),
 * OpenAI-compatible endpoints (Groq, OpenAI), and local Ollama.
 * Routes through byok-proxy when CORS bypass is required.
 */
export async function callByokModel<T = unknown>(
  options: CallByokModelOptions<T>
): Promise<CallByokModelResult<T>> {
  const startTime = Date.now();

  // 1. Resolve active provider, model, baseUrl, and API key via unified client config
  const resolvedClient = await resolveClientProviderConfig();
  const activeConfig = await getActiveConfig();
  const provider = (
    options.provider ||
    resolvedClient?.provider ||
    activeConfig.provider ||
    "gemini"
  ).toLowerCase();
  const rawModel =
    options.model ||
    (provider === resolvedClient?.provider ? resolvedClient?.model : null) ||
    (provider === activeConfig.provider ? activeConfig.model : null) ||
    DEFAULT_MODELS[provider] ||
    "gemini-2.5-flash";
  const model =
    provider === "gemini" && rawModel === "gemini-3.8-flash"
      ? "gemini-2.5-flash"
      : rawModel;
  const apiKey =
    options.apiKey ||
    (provider === resolvedClient?.provider ? resolvedClient?.apiKey : null) ||
    (await getKey(provider)) ||
    "";
  const resolvedBaseUrl =
    options.baseUrl ||
    (provider === resolvedClient?.provider ? resolvedClient?.baseUrl : undefined);

  if (!apiKey && provider !== "ollama" && provider !== "custom") {
    throw new Error(`API key for provider '${provider}' is missing. Please configure it in Settings.`);
  }

  // 2. Normalize messages
  let messages: ByokMessage[] = options.messages ? [...options.messages] : [];
  if (messages.length === 0 && options.prompt) {
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: options.prompt });
  }

  let fullText = "";

  // 3. Dispatch to provider handler
  if (provider === "gemini") {
    const geminiModel = model === "gemini-3.8-flash" ? "gemini-2.5-flash" : model;
    const ai = new GoogleGenAI({ apiKey });
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemMsg = messages.find((m) => m.role === "system");
    const systemInstruction = options.systemPrompt || systemMsg?.content;

    const config: Record<string, unknown> = {
      temperature: options.temperature ?? 0.3,
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (options.json) {
      config.responseMimeType = "application/json";
    }

    if (options.onToken) {
      const stream = await ai.models.generateContentStream({
        model: geminiModel,
        contents,
        config,
      });

      for await (const chunk of stream) {
        const token = chunk.text || "";
        if (token) {
          fullText += token;
          options.onToken(token);
        }
      }
    } else {
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents,
        config,
      });
      fullText = response.text || "";
    }
  } else if (provider === "ollama") {
    // Local Ollama running directly on host (http://localhost:11434)
    const base = resolvedBaseUrl || "http://localhost:11434";
    const endpoint = `${base.replace(/\/+$/, "")}/v1/chat/completions`;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      stream: Boolean(options.onToken),
    };
    if (options.json) {
      body.response_format = { type: "json_object" };
      body.format = "json";
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ollama request failed (${res.status}): ${errText}`);
    }

    if (options.onToken) {
      fullText = await streamOpenAiResponse(res, options.onToken);
    } else {
      const json = await res.json();
      fullText = json.choices?.[0]?.message?.content || "";
    }
  } else {
    // OpenAI, Groq, Anthropic, or OpenAI-compatible custom endpoints
    let targetUrl: string;
    if (provider === "groq") {
      targetUrl = "https://api.groq.com/openai/v1/chat/completions";
    } else if (provider === "openai") {
      targetUrl = "https://api.openai.com/v1/chat/completions";
    } else if (provider === "anthropic") {
      targetUrl = "https://api.anthropic.com/v1/messages";
    } else {
      targetUrl = `${(resolvedBaseUrl || "http://localhost:8000").replace(/\/+$/, "")}/v1/chat/completions`;
    }

    // Build payload
    let requestBody: Record<string, unknown>;
    if (provider === "anthropic") {
      const systemMsg = messages.find((m) => m.role === "system");
      requestBody = {
        model,
        messages: messages.filter((m) => m.role !== "system"),
        system: options.systemPrompt || systemMsg?.content,
        max_tokens: 4096,
        temperature: options.temperature ?? 0.3,
        stream: Boolean(options.onToken),
      };
    } else {
      requestBody = {
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        stream: Boolean(options.onToken),
      };
      if (options.json) {
        requestBody.response_format = { type: "json_object" };
      }
    }

    // When running in the browser, route through byok-proxy for CORS bypass
    const needsCorsProxy = isBrowser() && (provider === "groq" || provider === "openai" || provider === "anthropic");
    const fetchUrl = needsCorsProxy ? "/api/ai/byok-proxy" : targetUrl;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (needsCorsProxy) {
      headers["x-byok-target-url"] = targetUrl;
      headers["x-byok-auth"] = `Bearer ${apiKey}`;
      headers["x-byok-provider"] = provider;
    } else {
      if (provider === "anthropic") {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    const res = await fetch(fetchUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!res.ok) {
      if (needsCorsProxy && res.status === 401) {
        let proxyMessage = "Sign in to use this provider, or switch to Gemini.";
        try {
          const errJson = await res.json();
          if (typeof errJson?.error?.message === "string" && errJson.error.message.trim().length > 0) {
            proxyMessage = errJson.error.message;
          }
        } catch {
          // Use default message when response body is not JSON
        }
        throw new Error(proxyMessage);
      }
      const errText = await res.text().catch(() => "");
      throw new Error(`${provider} request failed (${res.status}): ${errText}`);
    }

    if (options.onToken) {
      fullText = await streamOpenAiResponse(res, options.onToken);
    } else {
      const json = await res.json();
      if (provider === "anthropic") {
        fullText = json.content?.[0]?.text || "";
      } else {
        fullText = json.choices?.[0]?.message?.content || "";
      }
    }
  }

  // 4. Parse structured JSON if requested
  let parsedData: T | undefined = undefined;
  if (options.json) {
    try {
      const cleaned = stripCodeFences(fullText);
      parsedData = JSON.parse(cleaned) as T;
    } catch {
      // Return raw string if JSON parsing fails
    }
  }

  return {
    text: fullText,
    data: parsedData,
    provider,
    model,
    latencyMs: Date.now() - startTime,
  };
}
