import { CHAT_TOOLS, type AllowlistedToolName } from "./tools/definitions";
import { executeServerTool } from "./tools/executor";
import type { ChatStreamChunk } from "./chat-types";
import type { ChatCompletionResult } from "./providers/custom";

export const MAX_CHAT_TOOL_ROUNDS = 5;

export function encodeSseChunk(chunk: ChatStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export function isChatAllowlistedTool(name: string): name is AllowlistedToolName {
  return (CHAT_TOOLS as string[]).includes(name);
}

export function hydrateChatToolArgs(
  name: string,
  args: Record<string, unknown>,
  context?: { typstSource?: string; activeJobId?: string }
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...args };
  if (!context) return next;

  if (name === "get_ats_score" && !next.typstContent && context.typstSource) {
    next.typstContent = context.typstSource;
  }
  if (
    (name === "get_resume_facts" || name === "inspect_layout_budget") &&
    !next.typstSource &&
    context.typstSource
  ) {
    next.typstSource = context.typstSource;
  }
  if (name === "run_guardrail" && !next.candidateTypst && context.typstSource) {
    next.candidateTypst = context.typstSource;
  }
  if (name === "get_job" && !next.jobId && context.activeJobId) {
    next.jobId = context.activeJobId;
  }
  return next;
}

export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export interface ExecutedToolResult {
  toolCallId: string;
  providerCallId?: string;
  name: string;
  result: unknown;
  serialized: string;
  isError: boolean;
}

function serializeToolPayload(result: unknown): string {
  let serialized = "";
  try {
    serialized = JSON.stringify(result);
  } catch {
    serialized = String(result);
  }
  if (serialized.length > 12_000) {
    serialized = serialized.slice(0, 12_000) + "…[truncated]";
  }
  return serialized;
}

export function formatToolResultForModel(name: string, result: unknown): string {
  return `[Tool result: ${name}]\n${serializeToolPayload(result)}`;
}

export async function executeChatToolRoundStructured(opts: {
  toolCalls: ChatCompletionResult["toolCalls"];
  context?: { typstSource?: string; activeJobId?: string };
  userId?: string | null;
  emit: (chunk: ChatStreamChunk) => void;
}): Promise<ExecutedToolResult[]> {
  const results: ExecutedToolResult[] = [];

  for (const call of opts.toolCalls) {
    const id = call.id || crypto.randomUUID();
    opts.emit({ type: "tool_start", id, name: call.name });

    if (!isChatAllowlistedTool(call.name)) {
      const denied = {
        success: false,
        error: `Tool "${call.name}" is not available in chat mode. Use the Tailor tab for resume mutations.`,
      };
      opts.emit({ type: "tool_result", id, name: call.name, data: denied });
      results.push({
        toolCallId: id,
        providerCallId: call.providerCallId,
        name: call.name,
        result: denied,
        serialized: serializeToolPayload(denied),
        isError: true,
      });
      continue;
    }

    const args = hydrateChatToolArgs(call.name, parseToolArguments(call.arguments), opts.context);
    const executed = await executeServerTool(call.name, args, opts.userId ?? undefined);
    opts.emit({ type: "tool_result", id, name: call.name, data: executed });
    const isError = Boolean(
      executed &&
        typeof executed === "object" &&
        "success" in executed &&
        (executed as { success?: unknown }).success === false
    );
    results.push({
      toolCallId: id,
      providerCallId: call.providerCallId,
      name: call.name,
      result: executed,
      serialized: serializeToolPayload(executed),
      isError,
    });
  }

  return results;
}

export async function executeChatToolRound(opts: {
  toolCalls: ChatCompletionResult["toolCalls"];
  context?: { typstSource?: string; activeJobId?: string };
  userId?: string | null;
  emit: (chunk: ChatStreamChunk) => void;
}): Promise<string> {
  const results = await executeChatToolRoundStructured(opts);
  return results.map((r) => `[Tool result: ${r.name}]\n${r.serialized}`).join("\n\n");
}
