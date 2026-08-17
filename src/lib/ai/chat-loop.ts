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

export function formatToolResultForModel(name: string, result: unknown): string {
  let serialized = "";
  try {
    serialized = JSON.stringify(result);
  } catch {
    serialized = String(result);
  }
  if (serialized.length > 12_000) {
    serialized = serialized.slice(0, 12_000) + "…[truncated]";
  }
  return `[Tool result: ${name}]\n${serialized}`;
}

export async function executeChatToolRound(opts: {
  toolCalls: ChatCompletionResult["toolCalls"];
  context?: { typstSource?: string; activeJobId?: string };
  userId?: string | null;
  emit: (chunk: ChatStreamChunk) => void;
}): Promise<string> {
  const resultBlocks: string[] = [];

  for (const call of opts.toolCalls) {
    const id = call.id || crypto.randomUUID();
    opts.emit({ type: "tool_start", id, name: call.name });

    if (!isChatAllowlistedTool(call.name)) {
      const denied = {
        success: false,
        error: `Tool "${call.name}" is not available in chat mode. Use the Tailor tab for resume mutations.`,
      };
      opts.emit({ type: "tool_result", id, name: call.name, data: denied });
      resultBlocks.push(formatToolResultForModel(call.name, denied));
      continue;
    }

    const args = hydrateChatToolArgs(call.name, parseToolArguments(call.arguments), opts.context);
    const executed = await executeServerTool(call.name, args, opts.userId ?? undefined);
    opts.emit({ type: "tool_result", id, name: call.name, data: executed });
    resultBlocks.push(formatToolResultForModel(call.name, executed));
  }

  return resultBlocks.join("\n\n");
}
