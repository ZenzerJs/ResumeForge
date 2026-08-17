import { getRequestUserId } from "@/lib/security/auth-request";
import { sanitizeError } from "@/lib/ai/redact";
import { ChatRequestSchema, type ChatStreamChunk } from "@/lib/ai/chat-types";
import { buildChatSystemPrompt, buildChatContextPreamble } from "@/lib/ai/chat-prompt";
import { sendChatCompletion } from "@/lib/ai/gateway";
import { CHAT_TOOL_SCHEMAS } from "@/lib/ai/tools/definitions";
import {
  MAX_CHAT_TOOL_ROUNDS,
  encodeSseChunk,
  executeChatToolRound,
} from "@/lib/ai/chat-loop";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

function emitTextChunks(text: string, emit: (chunk: ChatStreamChunk) => void) {
  if (!text) return;
  const size = 48;
  for (let i = 0; i < text.length; i += size) {
    emit({ type: "text", content: text.slice(i, i + size) });
  }
}

/**
 * POST /api/ai/chat
 *
 * Multi-turn career assistant chat with read-only tool calling.
 * Streams SSE chunks: text | tool_start | tool_result | done | error.
 */
export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (chunk: ChatStreamChunk) => {
        controller.enqueue(encoder.encode(encodeSseChunk(chunk)));
      };

      try {
        const userId = await getRequestUserId(request);
        const body = await request.json();
        const parsed = ChatRequestSchema.safeParse(body);

        if (!parsed.success) {
          emit({
            type: "error",
            message: sanitizeError(
              `Invalid chat request: ${parsed.error.issues.map((i) => i.message).join(", ")}`
            ),
          });
          controller.close();
          return;
        }

        const { messages, providerConfig, context } = parsed.data;

        if (!providerConfig.provider) {
          emit({ type: "error", message: "Missing provider configuration." });
          controller.close();
          return;
        }

        let activeJobTitle: string | undefined;
        let activeJobCompany: string | undefined;
        if (context?.activeJobId) {
          try {
            const job = await prisma.job.findUnique({
              where: { id: context.activeJobId },
              select: { roleTitle: true, company: true },
            });
            activeJobTitle = job?.roleTitle || undefined;
            activeJobCompany = job?.company || undefined;
          } catch {
            // Job lookup is optional context.
          }
        }

        const systemPrompt = buildChatSystemPrompt();
        const preamble = buildChatContextPreamble({
          typstSourceLength: context?.typstSource?.length,
          activeJobTitle,
          activeJobCompany,
        });

        const conversation: Array<{ role: string; content: string }> = [
          { role: "system", content: systemPrompt },
        ];
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-20);
        const firstUserIndex = history.findIndex((m) => m.role === "user");
        for (let i = 0; i < history.length; i++) {
          const m = history[i];
          conversation.push({
            role: m.role,
            content: i === firstUserIndex && preamble ? `${preamble}${m.content}` : m.content,
          });
        }

        for (let round = 0; round < MAX_CHAT_TOOL_ROUNDS; round++) {
          const completion = await sendChatCompletion(
            providerConfig,
            conversation,
            CHAT_TOOL_SCHEMAS
          );

          if (completion.toolCalls.length > 0) {
            if (completion.content) {
              conversation.push({ role: "assistant", content: completion.content });
            }

            const toolBlock = await executeChatToolRound({
              toolCalls: completion.toolCalls,
              context: {
                typstSource: context?.typstSource,
                activeJobId: context?.activeJobId,
              },
              userId,
              emit,
            });

            conversation.push({
              role: "user",
              content: toolBlock,
            });
            continue;
          }

          emitTextChunks(completion.content, emit);
          emit({ type: "done" });
          controller.close();
          return;
        }

        emit({
          type: "error",
          message: "Tool loop limit reached. Try a more specific question.",
        });
        controller.close();
      } catch (err) {
        emit({
          type: "error",
          message: sanitizeError(err instanceof Error ? err.message : String(err)),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
