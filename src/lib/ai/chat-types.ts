import { z } from "zod";
import { ProviderConfigSchema } from "./types";
import type { ResumeFacts } from "@/lib/facts/types";

// ---------------------------------------------------------------------------
// Chat message types shared by client and API route
// ---------------------------------------------------------------------------

export interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  state: "running" | "completed" | "error";
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCallRecord[];
  timestamp: number;
}

/** Context injected alongside the conversation for grounding. */
export interface ChatContext {
  typstSource?: string;
  masterFacts?: ResumeFacts | null;
  activeJobId?: string;
}

// ---------------------------------------------------------------------------
// API request / response schemas
// ---------------------------------------------------------------------------

export const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "tool"]),
      content: z.string(),
    })
  ).min(1),
  providerConfig: ProviderConfigSchema,
  context: z.object({
    typstSource: z.string().optional(),
    activeJobId: z.string().optional(),
  }).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Shape of each SSE chunk sent to the client. */
export type ChatStreamChunk =
  | { type: "text"; content: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_result"; id: string; name: string; data: unknown }
  | { type: "done" }
  | { type: "error"; message: string };
