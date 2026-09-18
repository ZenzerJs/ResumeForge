import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildChatSystemPrompt } from "@/lib/ai/chat-prompt";
import { ChatRequestSchema } from "@/lib/ai/chat-types";
import { CHAT_TOOLS, CHAT_TOOL_SCHEMAS } from "@/lib/ai/tools/definitions";
import {
  encodeSseChunk,
  hydrateChatToolArgs,
  isChatAllowlistedTool,
  parseToolArguments,
  executeChatToolRound,
} from "@/lib/ai/chat-loop";
import { POST as chatPOST } from "@/app/api/ai/chat/route";
import { sendChatCompletion } from "@/lib/ai/gateway";

vi.mock("@/lib/ai/gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/gateway")>();
  return {
    ...actual,
    sendChatCompletion: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe("Career assistant chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("system prompt includes master guardrails and tool names", () => {
    const prompt = buildChatSystemPrompt();
    expect(prompt).toContain("ZERO HALLUCINATION");
    expect(prompt).toContain("RESUMEFORGE CAREER ASSISTANT");
    expect(prompt).toContain("search_evidence");
    expect(prompt).toContain("get_ats_score");
    expect(prompt).toContain("NO MUTATIONS");
    expect(prompt.startsWith("You are the ResumeForge AI Core Engine")).toBe(true);
  });

  it("CHAT_TOOLS is a read-only subset without mutation tools", () => {
    expect(CHAT_TOOLS).toContain("search_evidence");
    expect(CHAT_TOOLS).toContain("get_ats_score");
    expect(CHAT_TOOLS).not.toContain("apply_patches");
    expect(CHAT_TOOLS).not.toContain("export_docx");
    expect(CHAT_TOOLS).not.toContain("propose_patches");
    expect(CHAT_TOOL_SCHEMAS.every((s) => CHAT_TOOLS.includes(s.function.name as (typeof CHAT_TOOLS)[number]))).toBe(
      true
    );
  });

  it("validates chat message schema", () => {
    const ok = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
      providerConfig: { provider: "openai", apiKey: "sk-test" },
    });
    expect(ok.success).toBe(true);

    const missing = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(missing.success).toBe(false);

    const empty = ChatRequestSchema.safeParse({
      messages: [],
      providerConfig: { provider: "openai" },
    });
    expect(empty.success).toBe(false);
  });

  it("encodes SSE chunks in the documented format", () => {
    expect(encodeSseChunk({ type: "text", content: "Hi" })).toBe(
      'data: {"type":"text","content":"Hi"}\n\n'
    );
    expect(encodeSseChunk({ type: "tool_start", id: "t1", name: "get_ats_score" })).toContain(
      '"type":"tool_start"'
    );
    expect(encodeSseChunk({ type: "done" })).toBe('data: {"type":"done"}\n\n');
    expect(encodeSseChunk({ type: "error", message: "nope" })).toContain('"type":"error"');
  });

  it("hydrates missing typst/job context onto tool args", () => {
    const ats = hydrateChatToolArgs("get_ats_score", {}, { typstSource: "= Jane" });
    expect(ats.typstContent).toBe("= Jane");
    const facts = hydrateChatToolArgs("get_resume_facts", {}, { typstSource: "= Jane" });
    expect(facts.typstSource).toBe("= Jane");
    const job = hydrateChatToolArgs("get_job", {}, { activeJobId: "job-1" });
    expect(job.jobId).toBe("job-1");
  });

  it("rejects mutation tools in chat mode and executes allowlisted tools", async () => {
    expect(isChatAllowlistedTool("apply_patches")).toBe(false);
    expect(isChatAllowlistedTool("get_ats_score")).toBe(true);
    expect(parseToolArguments("{not json")).toEqual({});

    const emitted: unknown[] = [];
    const denied = await executeChatToolRound({
      toolCalls: [{ id: "x", name: "apply_patches", arguments: "{}" }],
      emit: (c) => emitted.push(c),
    });
    expect(denied).toContain("not available in chat mode");
    expect(emitted[0]).toMatchObject({ type: "tool_start", name: "apply_patches" });
    expect(emitted[1]).toMatchObject({ type: "tool_result", name: "apply_patches" });

    const scoreChunks: unknown[] = [];
    const ok = await executeChatToolRound({
      toolCalls: [
        {
          id: "s1",
          name: "get_ats_score",
          arguments: JSON.stringify({
            typstContent: "= Jane Doe\n== EXPERIENCE\n*Google* -- *Engineer*\n- Built TypeScript APIs.",
            roleProfile: "Backend",
          }),
        },
      ],
      emit: (c) => scoreChunks.push(c),
    });
    expect(ok).toContain("get_ats_score");
    expect(scoreChunks.some((c) => (c as { type: string }).type === "tool_result")).toBe(true);
  });

  it("chat API route emits SSE error when provider config is missing", async () => {
    const response = await chatPOST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
      })
    );
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text).toContain('"type":"error"');
    expect(text.toLowerCase()).toContain("invalid");
  });

  it("chat API route runs tool calls then streams assistant text", async () => {
    vi.mocked(sendChatCompletion)
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [
          {
            id: "call-1",
            name: "inspect_layout_budget",
            arguments: JSON.stringify({ typstSource: "= Jane\n- bullet" }),
          },
        ],
      })
      .mockResolvedValueOnce({
        content: "Your resume fits on one page.",
        toolCalls: [],
      });

    const response = await chatPOST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Does this fit on one page?" }],
          providerConfig: { provider: "openai", apiKey: "sk-test" },
          context: { typstSource: "= Jane\n- bullet" },
        }),
      })
    );

    const text = await response.text();
    expect(text).toContain('"type":"tool_start"');
    expect(text).toContain("inspect_layout_budget");
    expect(text).toContain('"type":"tool_result"');
    expect(text).toContain('"type":"text"');
    expect(text).toContain("one page");
    expect(text).toContain('"type":"done"');
    expect(sendChatCompletion).toHaveBeenCalledTimes(2);
  });
});
