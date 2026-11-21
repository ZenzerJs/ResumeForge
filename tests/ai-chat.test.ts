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
import { guestSaveResponse, requireUserId } from "@/lib/security/auth-request";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_TAILOR_JOB_STORAGE_KEY,
  buildChatMessagesWithJobContext,
  resolveActiveTailorJobContext,
} from "@/components/editor/chat-panel";
import {
  ACTIVE_APPLICATION_STORAGE_KEY,
  writeActiveApplicationContext,
  type StorageLike,
} from "@/lib/tailor/application-context";

vi.mock("@/lib/security/auth-request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/auth-request")>();
  return {
    ...actual,
    requireUserId: vi.fn().mockResolvedValue("user-chat-1"),
  };
});

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
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe("Career assistant chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUserId).mockResolvedValue("user-chat-1");
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null);
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

  it("chat API route returns 401 before body parsing or SSE when unauthenticated", async () => {
    vi.mocked(requireUserId).mockResolvedValueOnce(guestSaveResponse());
    const badJsonReq = new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    const response = await chatPOST(badJsonReq);
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(sendChatCompletion).not.toHaveBeenCalled();
    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  it("chat API route scopes activeJobId lookup and omits unauthorized jobs", async () => {
    vi.mocked(prisma.job.findFirst).mockResolvedValueOnce(null);
    vi.mocked(sendChatCompletion).mockResolvedValueOnce({
      content: "Checked without private job.",
      toolCalls: [],
    });

    const response = await chatPOST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Summarize the target role." }],
          providerConfig: { provider: "openai", apiKey: "sk-test" },
          context: { activeJobId: "private-other-job" },
        }),
      })
    );

    expect(response.status).toBe(200);
    await response.text();
    expect(prisma.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "private-other-job" }),
        select: { id: true, roleTitle: true, company: true },
      })
    );
    const messagesPassed = vi.mocked(sendChatCompletion).mock.calls[0][1];
    expect(JSON.stringify(messagesPassed)).not.toContain("private-other-job");
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

  it("resolves active guest/unsaved Tailor job context and injects it into outbound chat messages", () => {
    const createMemoryStorage = (): StorageLike => {
      const map = new Map<string, string>();
      return {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => map.set(k, v),
        removeItem: (k) => map.delete(k),
      };
    };

    const sessionStore = createMemoryStorage();
    const localStore = createMemoryStorage();
    const guestScope = { userId: null, demoMode: false, scopeResolved: true };
    const otherUserScope = { userId: "user-other", demoMode: false, scopeResolved: true };

    writeActiveApplicationContext(
      {
        jobId: "guest-job-42",
        roleTitle: "Senior Backend Engineer",
        company: "Nova Labs",
        tab: "job-info",
      },
      guestScope,
      sessionStore
    );

    localStore.setItem(
      "resumeforge_guest_jobs",
      JSON.stringify([
        {
          id: "guest-job-42",
          roleTitle: "Senior Backend Engineer",
          company: "Nova Labs",
          rawDescription: "Build distributed Go and PostgreSQL services.",
          requirements: {
            requiredSkills: ["Go", "PostgreSQL", "Docker"],
            preferredSkills: ["GraphQL"],
            domainTerms: ["distributed systems"],
          },
        },
      ])
    );

    const resolved = resolveActiveTailorJobContext({
      propJobId: null,
      scope: guestScope,
      sessionStorage: sessionStore,
      localStorage: localStore,
    });

    expect(resolved.activeJobId).toBe("guest-job-42");
    expect(resolved.jobSummary).toMatchObject({
      jobId: "guest-job-42",
      roleTitle: "Senior Backend Engineer",
      company: "Nova Labs",
      extractedRequirements: {
        requiredSkills: ["Go", "PostgreSQL", "Docker"],
        preferredSkills: ["GraphQL"],
        domainTerms: ["distributed systems"],
      },
    });

    const originalHistory = [{ role: "user" as const, content: "What skills am I missing for this role?" }];
    const outbound = buildChatMessagesWithJobContext(originalHistory, resolved.jobSummary);
    expect(originalHistory[0].content).toBe("What skills am I missing for this role?");
    expect(outbound[0].content).toContain("[Active Tailor Job Context:");
    expect(outbound[0].content).toContain("Senior Backend Engineer");
    expect(outbound[0].content).toContain("Nova Labs");
    expect(outbound[0].content).toContain("PostgreSQL");
    expect(outbound[0].content).toContain("What skills am I missing for this role?");

    // Unsaved snapshot with no jobId yet is also resolved within matching scope
    const unsavedSession = createMemoryStorage();
    unsavedSession.setItem(
      ACTIVE_TAILOR_JOB_STORAGE_KEY,
      JSON.stringify({
        scopeKey: "guest:default",
        job: {
          roleTitle: "Frontend Engineer",
          company: "WebCraft",
          rawDescription: "TypeScript and Next.js required.",
          extractedRequirements: {
            requiredSkills: ["TypeScript", "Next.js"],
          },
        },
      })
    );
    const unsavedResolved = resolveActiveTailorJobContext({
      propJobId: null,
      scope: guestScope,
      sessionStorage: unsavedSession,
      localStorage: createMemoryStorage(),
    });
    expect(unsavedResolved.jobSummary?.roleTitle).toBe("Frontend Engineer");

    // Different user scope must NOT read guest snapshot or application context
    expect(sessionStore.getItem(ACTIVE_APPLICATION_STORAGE_KEY)).toBeTruthy();
    const crossAccount = resolveActiveTailorJobContext({
      propJobId: null,
      scope: otherUserScope,
      sessionStorage: sessionStore,
      localStorage: localStore,
    });
    expect(crossAccount.jobSummary).toBeNull();
  });

  it("sends structured assistant tool-call and tool-result turns through chat API and handles empty post-tool synthesis", async () => {
    vi.mocked(sendChatCompletion)
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{ id: "tc-1", name: "get_ats_score", arguments: "{}" }],
        rawModelParts: [
          { thought: true, text: "Need ATS score" },
          { functionCall: { name: "get_ats_score", args: {} }, thoughtSignature: "sig-xyz" },
        ],
      })
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [],
      })
      .mockResolvedValueOnce({
        content: "Your resume scores 82/100.",
        toolCalls: [],
      });

    const response = await chatPOST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Grade my resume" }],
          providerConfig: { provider: "gemini", apiKey: "AIzaSyTestKey" },
          context: { typstSource: "= Jane Doe\n== EXPERIENCE\n*Acme* -- *SWE*\n- Built TypeScript APIs." },
        }),
      })
    );

    const sseText = await response.text();
    expect(sseText).toContain("Your resume scores 82/100.");
    expect(sseText).toContain('"type":"done"');

    // Verify round 2 received structured assistant turn with rawModelParts AND role:"tool" turn
    const round2Messages = vi.mocked(sendChatCompletion).mock.calls[1]?.[1] as Array<Record<string, unknown>>;
    expect(round2Messages.some((m) => m.role === "assistant" && Array.isArray(m.rawModelParts))).toBe(true);
    expect(round2Messages.some((m) => m.role === "tool" && m.name === "get_ats_score")).toBe(true);
  });

  it("emits SSE error instead of empty done when synthesis also returns empty text", async () => {
    vi.mocked(sendChatCompletion)
      .mockResolvedValueOnce({
        content: "",
        toolCalls: [{ id: "tc-2", name: "get_ats_score", arguments: "{}" }],
      })
      .mockResolvedValueOnce({ content: "", toolCalls: [] })
      .mockResolvedValueOnce({ content: "", toolCalls: [] });

    const response = await chatPOST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Grade my resume" }],
          providerConfig: { provider: "gemini", apiKey: "AIzaSyTestKey" },
          context: { typstSource: "= Jane Doe" },
        }),
      })
    );

    const sseText = await response.text();
    expect(sseText).toContain('"type":"error"');
    expect(sseText).not.toContain('"type":"done"');
  });

  it("serializes native Gemini functionCall/thoughtSignature/functionResponse, OpenAI tool_calls, and Anthropic tool_use turns", async () => {
    const { chatGemini } = await import("@/lib/ai/providers/gemini");
    const { chatOpenAI } = await import("@/lib/ai/providers/openai");
    const { chatAnthropic } = await import("@/lib/ai/providers/anthropic");

    const capturedBodies: Array<Record<string, unknown>> = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      capturedBodies.push(JSON.parse(String(init?.body || "{}")));
      const target = String(url);
      if (target.includes("googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { thought: true, text: "hidden thought" },
                    { text: "Grounded Gemini answer" },
                  ],
                },
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (target.includes("anthropic.com")) {
        return new Response(
          JSON.stringify({ content: [{ type: "text", text: "Grounded Anthropic answer" }] }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Grounded OpenAI answer" } }] }),
        { status: 200 }
      );
    });

    const structuredMessages = [
      { role: "system" as const, content: "System" },
      { role: "user" as const, content: "Find my evidence" },
      {
        role: "assistant" as const,
        content: "",
        toolCalls: [{ id: "call_1", name: "search_evidence", arguments: '{"query":"go"}' }],
        rawModelParts: [
          { functionCall: { name: "search_evidence", args: { query: "go" } }, thoughtSignature: "sig-123" },
        ],
      },
      {
        role: "tool" as const,
        toolCallId: "call_1",
        name: "search_evidence",
        content: '["item-1"]',
        result: ["item-1"], // Array result must be wrapped into an object for Gemini!
      },
    ];

    const gemRes = await chatGemini(
      { provider: "gemini", apiKey: "AIzaSyTestKey", model: "gemini-3.8-flash" },
      structuredMessages,
      []
    );
    expect(gemRes.content).toBe("Grounded Gemini answer");
    const gemContents = capturedBodies[0].contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(gemContents[1].role).toBe("model");
    expect(gemContents[1].parts[0].thoughtSignature).toBe("sig-123");
    expect(gemContents[2].role).toBe("user");
    expect(gemContents[2].parts[0].functionResponse).toEqual({
      name: "search_evidence",
      response: { result: ["item-1"] },
    });

    await chatOpenAI({ provider: "openai", apiKey: "sk-test" }, structuredMessages, []);
    const oaiMsgs = capturedBodies[1].messages as Array<Record<string, unknown>>;
    expect(oaiMsgs[2].tool_calls).toBeDefined();
    expect(oaiMsgs[3]).toEqual({ role: "tool", tool_call_id: "call_1", content: '["item-1"]' });

    await chatAnthropic({ provider: "anthropic", apiKey: "sk-ant-test" }, structuredMessages, []);
    const antMsgs = capturedBodies[2].messages as Array<{ role: string; content: Array<Record<string, unknown>> }>;
    expect(antMsgs[1].role).toBe("assistant");
    expect(antMsgs[1].content[0].type).toBe("tool_use");
    expect(antMsgs[2].role).toBe("user");
    expect(antMsgs[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "call_1" });

    fetchSpy.mockRestore();
  });
});
