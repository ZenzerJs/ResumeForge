import { ProviderConfig, TestConnectionResult, GeneratePatchesResult, ConvertPdfResult } from "../types";
import { sanitizeError } from "../redact";
import { stripCodeFences } from "../utils";
import { TypstRepairInput, TypstRepairProposal, TypstRepairProposalSchema } from "../repair-schema";
import { buildTypstRepairSystemPrompt, buildTypstRepairUserPrompt } from "../repair-prompt";
import type { ChatCompletionResult } from "./custom";

export async function testAnthropicConnection(config: ProviderConfig): Promise<TestConnectionResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");

  if (!apiKey) {
    return {
      success: false,
      provider: "anthropic",
      message: "Anthropic API key is missing. Please provide a key in settings or set ANTHROPIC_API_KEY.",
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
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

/**
 * Sends a structured message request to Anthropic for patch generation.
 */
export async function generateAnthropicPatches(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "claude-sonnet-4-20250514";

  if (!apiKey) {
    return { success: false, error: "Anthropic API key is missing." };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Anthropic API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const rawJson = textBlock?.text;

    if (!rawJson) {
      return { success: false, error: "Anthropic returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Anthropic patch generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Phase 4.3b: Sends a structured message request to Anthropic for qualitative review.
 */
export async function generateAnthropicQualitativeReview(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    return { success: false, error: "Anthropic API key is missing." };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Anthropic API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const rawJson = textBlock?.text;

    if (!rawJson) {
      return { success: false, error: "Anthropic returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Anthropic qualitative review failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Phase 5: Sends a structured message request to Anthropic for cover letter generation.
 */
export async function generateAnthropicCoverLetter(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<GeneratePatchesResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    return { success: false, error: "Anthropic API key is missing." };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Anthropic API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const rawJson = textBlock?.text;

    if (!rawJson) {
      return { success: false, error: "Anthropic returned empty content in response." };
    }

    return { success: true, rawJson };
  } catch (err) {
    return { success: false, error: sanitizeError(`Anthropic cover letter generation failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

/**
 * Task 9.1: Sends a message request to Anthropic for PDF-to-Typst conversion.
 */
export async function convertAnthropicPdfTextToTypst(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ConvertPdfResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    return { success: false, error: "Anthropic API key is missing." };
  }

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Anthropic API returned status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const rawContent = textBlock?.text;

    if (!rawContent) {
      return { success: false, error: "Anthropic returned empty content in response." };
    }

    const typstSource = stripCodeFences(rawContent);
    return { success: true, typstSource };
  } catch (err) {
    return { success: false, error: sanitizeError(`Anthropic PDF conversion failed: ${err instanceof Error ? err.message : String(err)}`) };
  }
}

export async function repairTypstWithAnthropic(
  config: ProviderConfig,
  input: TypstRepairInput
): Promise<{ success: boolean; data?: TypstRepairProposal; error?: string }> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "claude-3-5-sonnet-20241022";

  if (!apiKey) {
    return { success: false, error: "Anthropic API key is missing. Please configure your key in Settings." };
  }

  const systemPrompt = buildTypstRepairSystemPrompt();
  const userPrompt = buildTypstRepairUserPrompt(input);

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      let errBody = "";
      try {
        const json = await res.json();
        errBody = json.error?.message || JSON.stringify(json);
      } catch {
        errBody = res.statusText;
      }
      return { success: false, error: sanitizeError(`Anthropic API status ${res.status}: ${errBody}`) };
    }

    const data = await res.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const rawContent = textBlock?.text;

    if (!rawContent) {
      return { success: false, error: "Anthropic returned empty content." };
    }

    const cleaned = stripCodeFences(rawContent);
    const parsedJson = JSON.parse(cleaned);
    const validated = TypstRepairProposalSchema.safeParse(parsedJson);

    if (!validated.success) {
      return {
        success: false,
        error: `Anthropic returned invalid repair proposal JSON: ${validated.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return { success: true, data: validated.data };
  } catch (err) {
    return {
      success: false,
      error: sanitizeError(`Anthropic repair failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}

/**
 * Multi-turn chat completion via Anthropic Messages API with tool_use support.
 */
export async function chatAnthropic(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
): Promise<ChatCompletionResult> {
  const apiKey = config.apiKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = (config.baseUrl?.trim() || process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");
  const model = config.model?.trim() || "claude-sonnet-4-20250514";

  if (!apiKey) {
    throw new Error("Anthropic API key is missing.");
  }

  // Extract system message and convert remaining messages to Anthropic format
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

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

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

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

