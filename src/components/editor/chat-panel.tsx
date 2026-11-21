"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import { AiMarkdownRenderer } from "@/components/editor/ai-markdown-renderer";
import { ToolBadge } from "@/components/editor/tool-badge";
import type { ChatMessage, ChatStreamChunk, ToolCallRecord } from "@/lib/ai/chat-types";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { fetchDemoConfig, fetchSessionUser } from "@/components/auth/session-user";
import { DEMO_JOB } from "@/lib/demo-samples";
import {
  LEGACY_ACTIVE_JOB_STORAGE_KEY,
  readActiveApplicationContext,
  resolveApplicationScopeKey,
  type ApplicationAccountScope,
  type StorageLike,
} from "@/lib/tailor/application-context";

const STORAGE_KEY = "resumeforge_chat_messages";
export const ACTIVE_TAILOR_JOB_STORAGE_KEY = "resumeforge_active_tailor_job";

export interface ActiveTailorJobRequirements {
  requiredSkills?: string[];
  preferredSkills?: string[];
  domainTerms?: string[];
}

export interface ActiveTailorJobSummary {
  jobId?: string;
  roleTitle?: string;
  company?: string;
  rawDescription?: string;
  extractedRequirements?: ActiveTailorJobRequirements;
}

function getSafeSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getSafeLocalStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeJobRequirements(raw: unknown): ActiveTailorJobRequirements | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const toStringList = (val: unknown): string[] =>
    Array.isArray(val) ? val.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
  const requiredSkills = toStringList(obj.requiredSkills);
  const preferredSkills = toStringList(obj.preferredSkills);
  const domainTerms = toStringList(obj.domainTerms);
  if (requiredSkills.length === 0 && preferredSkills.length === 0 && domainTerms.length === 0) {
    return undefined;
  }
  return { requiredSkills, preferredSkills, domainTerms };
}

function hasAnyJobDetails(summary: ActiveTailorJobSummary | null | undefined): summary is ActiveTailorJobSummary {
  if (!summary) return false;
  return Boolean(
    summary.jobId ||
      summary.roleTitle ||
      summary.company ||
      summary.rawDescription?.trim() ||
      summary.extractedRequirements
  );
}

function isSavedActiveJobSummary(
  summary: ActiveTailorJobSummary | null | undefined,
  explicitJobId?: string | null
): summary is ActiveTailorJobSummary {
  if (!summary || !summary.jobId) return false;
  if (summary.jobId.startsWith("demo-sample-") && !explicitJobId) return false;
  return true;
}

/**
 * Reads the scoped active Tailor job snapshot from sessionStorage, clearing mismatched scopes.
 */
export function readActiveTailorJobSnapshot(
  scope: ApplicationAccountScope,
  storage: StorageLike | null = getSafeSessionStorage()
): ActiveTailorJobSummary | null {
  const scopeKey = resolveApplicationScopeKey(scope);
  if (!scopeKey || !storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_TAILOR_JOB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scopeKey?: unknown; job?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || parsed.scopeKey !== scopeKey) {
      storage.removeItem(ACTIVE_TAILOR_JOB_STORAGE_KEY);
      return null;
    }
    const job = parsed.job as Record<string, unknown> | undefined;
    if (!job || typeof job !== "object") return null;
    const summary: ActiveTailorJobSummary = {
      jobId: typeof job.jobId === "string" && job.jobId.trim() ? job.jobId.trim() : undefined,
      roleTitle: typeof job.roleTitle === "string" && job.roleTitle.trim() ? job.roleTitle.trim() : undefined,
      company: typeof job.company === "string" && job.company.trim() ? job.company.trim() : undefined,
      rawDescription:
        typeof job.rawDescription === "string" && job.rawDescription.trim()
          ? job.rawDescription.trim()
          : undefined,
      extractedRequirements: normalizeJobRequirements(job.extractedRequirements),
    };
    return hasAnyJobDetails(summary) ? summary : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the active Tailor job from explicit prop, scoped active application context,
 * active Tailor snapshot, guest jobs in localStorage, and DEMO_JOB fallback.
 */
export function resolveActiveTailorJobContext(opts: {
  propJobId?: string | null;
  scope: ApplicationAccountScope;
  sessionStorage?: StorageLike | null;
  localStorage?: StorageLike | null;
}): { activeJobId?: string; jobSummary: ActiveTailorJobSummary | null } {
  const sessionStorageRef = opts.sessionStorage !== undefined ? opts.sessionStorage : getSafeSessionStorage();
  const localStorageRef = opts.localStorage !== undefined ? opts.localStorage : getSafeLocalStorage();
  const scopeKey = resolveApplicationScopeKey(opts.scope);

  const appCtx = readActiveApplicationContext(opts.scope, sessionStorageRef);
  const snapshot = readActiveTailorJobSnapshot(opts.scope, sessionStorageRef);
  const legacyJobId =
    scopeKey && sessionStorageRef
      ? sessionStorageRef.getItem(LEGACY_ACTIVE_JOB_STORAGE_KEY) || undefined
      : undefined;

  const activeJobId =
    (opts.propJobId && opts.propJobId.trim()) ||
    appCtx?.jobId ||
    snapshot?.jobId ||
    legacyJobId ||
    undefined;

  const summary: ActiveTailorJobSummary = {};
  if (activeJobId) summary.jobId = activeJobId;

  if (snapshot && (!opts.propJobId || !snapshot.jobId || snapshot.jobId === activeJobId)) {
    if (snapshot.roleTitle) summary.roleTitle = snapshot.roleTitle;
    if (snapshot.company) summary.company = snapshot.company;
    if (snapshot.rawDescription) summary.rawDescription = snapshot.rawDescription;
    if (snapshot.extractedRequirements) summary.extractedRequirements = snapshot.extractedRequirements;
  }

  if (activeJobId && localStorageRef) {
    try {
      const rawJobs = localStorageRef.getItem("resumeforge_guest_jobs");
      const parsed = rawJobs ? JSON.parse(rawJobs) : [];
      if (Array.isArray(parsed)) {
        const match = parsed.find((item) => item && typeof item === "object" && item.id === activeJobId) as
          | Record<string, unknown>
          | undefined;
        if (match) {
          if (!summary.roleTitle && typeof match.roleTitle === "string" && match.roleTitle.trim()) {
            summary.roleTitle = match.roleTitle.trim();
          }
          if (!summary.company && typeof match.company === "string" && match.company.trim()) {
            summary.company = match.company.trim();
          }
          if (!summary.rawDescription && typeof match.rawDescription === "string" && match.rawDescription.trim()) {
            summary.rawDescription = match.rawDescription.trim();
          }
          if (!summary.extractedRequirements) {
            summary.extractedRequirements = normalizeJobRequirements(
              match.extractedRequirements ?? match.requirements
            );
          }
        }
      }
    } catch {
      // Ignore malformed guest jobs storage
    }
  }

  if (opts.scope.demoMode && activeJobId === DEMO_JOB.id) {
    if (!summary.roleTitle) summary.roleTitle = DEMO_JOB.roleTitle;
    if (!summary.company) summary.company = DEMO_JOB.company;
    if (!summary.rawDescription) summary.rawDescription = DEMO_JOB.rawDescription;
    if (!summary.extractedRequirements) {
      summary.extractedRequirements = normalizeJobRequirements(DEMO_JOB.requirements);
    }
  }

  if (appCtx && (!activeJobId || appCtx.jobId === activeJobId)) {
    if (!summary.roleTitle && appCtx.roleTitle) summary.roleTitle = appCtx.roleTitle;
    if (!summary.company && appCtx.company) summary.company = appCtx.company;
  }

  return {
    activeJobId,
    jobSummary: hasAnyJobDetails(summary) ? summary : null,
  };
}

export function formatActiveJobContextBlock(job: ActiveTailorJobSummary): string {
  const lines: string[] = ["[Active Tailor Job Context:"];
  if (job.roleTitle) lines.push(`Role: ${job.roleTitle}`);
  if (job.company) lines.push(`Company: ${job.company}`);
  if (job.jobId) lines.push(`Job ID: ${job.jobId}`);
  const reqs = job.extractedRequirements;
  if (reqs?.requiredSkills && reqs.requiredSkills.length > 0) {
    lines.push(`Required Skills: ${reqs.requiredSkills.join(", ")}`);
  }
  if (reqs?.preferredSkills && reqs.preferredSkills.length > 0) {
    lines.push(`Preferred Skills: ${reqs.preferredSkills.join(", ")}`);
  }
  if (reqs?.domainTerms && reqs.domainTerms.length > 0) {
    lines.push(`Domain Terms: ${reqs.domainTerms.join(", ")}`);
  }
  if (job.rawDescription) {
    const excerpt =
      job.rawDescription.length > 1500
        ? `${job.rawDescription.slice(0, 1500)}…`
        : job.rawDescription;
    lines.push(`Job Description:\n${excerpt}`);
  }
  lines.push("]");
  return lines.join("\n");
}

export function buildChatMessagesWithJobContext(
  history: Array<{ role: "user" | "assistant" | "tool"; content: string }>,
  jobSummary: ActiveTailorJobSummary | null
): Array<{ role: "user" | "assistant" | "tool"; content: string }> {
  if (!jobSummary) return history;
  const hasMeaningfulContext = Boolean(
    jobSummary.roleTitle ||
      jobSummary.company ||
      jobSummary.rawDescription ||
      jobSummary.extractedRequirements
  );
  if (!hasMeaningfulContext) return history;

  let lastUserIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return history;

  const block = formatActiveJobContextBlock(jobSummary);
  return history.map((msg, idx) =>
    idx === lastUserIdx ? { ...msg, content: `${block}\n\n${msg.content}` } : msg
  );
}

function newId(): string {
  return crypto.randomUUID();
}

const QUICK_ACTIONS = [
  "How does my resume match this job?",
  "What are my strongest evidence items?",
  "Check ATS score for my current resume",
  "What skills am I missing for this role?",
  "Help me improve my work experience bullets",
];

interface ChatPanelProps {
  typstSource: string;
  resumeTitle?: string;
  jobId: string | null;
}

export function ChatPanel({ typstSource, resumeTitle, jobId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingTools, setStreamingTools] = useState<ToolCallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noKeyError, setNoKeyError] = useState(false);
  const [activeJobSummary, setActiveJobSummary] = useState<ActiveTailorJobSummary | null>(null);
  const scopeRef = useRef<ApplicationAccountScope>({ scopeResolved: false });

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [demoConfig, sessionUser] = await Promise.all([
          fetchDemoConfig(),
          fetchSessionUser(),
        ]);
        if (cancelled) return;
        const resolvedScope: ApplicationAccountScope = {
          userId: sessionUser?.id ?? null,
          demoMode: demoConfig?.demoMode === true,
          scopeResolved: true,
        };
        scopeRef.current = resolvedScope;
        const resolved = resolveActiveTailorJobContext({
          propJobId: jobId,
          scope: resolvedScope,
        });
        setActiveJobSummary(
          isSavedActiveJobSummary(resolved.jobSummary, jobId) ? resolved.jobSummary : null
        );
      } catch {
        // Active job context is optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent, streamingTools, isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (!text || isStreaming) return;

      let scope = scopeRef.current;
      if (scope.scopeResolved === false) {
        try {
          const [demoConfig, sessionUser] = await Promise.all([
            fetchDemoConfig(),
            fetchSessionUser(),
          ]);
          scope = {
            userId: sessionUser?.id ?? null,
            demoMode: demoConfig?.demoMode === true,
            scopeResolved: true,
          };
          scopeRef.current = scope;
        } catch {
          scope = { userId: null, demoMode: false, scopeResolved: true };
        }
      }

      const resolved = resolveActiveTailorJobContext({
        propJobId: jobId,
        scope,
      });
      const activeJobId =
        resolved.activeJobId && (!resolved.activeJobId.startsWith("demo-sample-") || Boolean(jobId))
          ? resolved.activeJobId
          : undefined;
      let jobSummary = isSavedActiveJobSummary(resolved.jobSummary, jobId)
        ? resolved.jobSummary
        : null;

      if (
        activeJobId &&
        !activeJobId.startsWith("guest-job-") &&
        !activeJobId.startsWith("demo-sample-") &&
        activeJobId !== DEMO_JOB.id &&
        (!jobSummary?.rawDescription || !jobSummary?.extractedRequirements)
      ) {
        try {
          const jobRes = await fetch(`/api/jobs/${encodeURIComponent(activeJobId)}`);
          if (jobRes.ok) {
            const jobJson = (await jobRes.json()) as {
              success?: boolean;
              data?: {
                roleTitle?: string | null;
                company?: string | null;
                rawDescription?: string | null;
                extractedRequirements?: unknown;
              };
            };
            if (jobJson?.success && jobJson.data) {
              jobSummary = {
                ...(jobSummary ?? {}),
                jobId: activeJobId,
                roleTitle: jobJson.data.roleTitle || jobSummary?.roleTitle,
                company: jobJson.data.company || jobSummary?.company,
                rawDescription: jobJson.data.rawDescription || jobSummary?.rawDescription,
                extractedRequirements:
                  normalizeJobRequirements(jobJson.data.extractedRequirements) ||
                  jobSummary?.extractedRequirements,
              };
            }
          }
        } catch {
          // Chat can proceed with locally known job summary
        }
      }
      setActiveJobSummary(jobSummary);

      const aiSettings = await resolveClientProviderConfig();
      if (!aiSettings) {
        setNoKeyError(true);
        setError("AI provider not configured. Please enter your API key in Settings.");
        return;
      }

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      const nextHistory = [...messages, userMessage];
      setMessages(nextHistory);
      setInput("");
      setError(null);
      setNoKeyError(false);
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingTools([]);

      const controller = new AbortController();
      abortRef.current = controller;
      let assembled = "";
      const tools: ToolCallRecord[] = [];

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: buildChatMessagesWithJobContext(
              nextHistory.map((m) => ({ role: m.role, content: m.content })),
              jobSummary
            ),
            providerConfig: {
              provider: aiSettings.provider,
              apiKey: aiSettings.apiKey,
              baseUrl: aiSettings.baseUrl || undefined,
              model: aiSettings.model || undefined,
            },
            context: {
              typstSource,
              activeJobId,
            },
          }),
        });

        if (!res.ok || !res.body) {
          const fallback = await res.json().catch(() => null);
          throw new Error(fallback?.error || `Chat request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyChunk = (chunk: ChatStreamChunk) => {
          if (chunk.type === "text") {
            assembled += chunk.content;
            setStreamingContent(assembled);
          } else if (chunk.type === "tool_start") {
            tools.push({
              id: chunk.id,
              name: chunk.name,
              args: {},
              state: "running",
            });
            setStreamingTools([...tools]);
          } else if (chunk.type === "tool_result") {
            const idx = tools.findIndex((t) => t.id === chunk.id);
            const record: ToolCallRecord = {
              id: chunk.id,
              name: chunk.name,
              args: {},
              result: chunk.data,
              state: "completed",
            };
            if (idx >= 0) tools[idx] = record;
            else tools.push(record);
            setStreamingTools([...tools]);
          } else if (chunk.type === "error") {
            throw new Error(chunk.message);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let parsedChunk: ChatStreamChunk;
            try {
              parsedChunk = JSON.parse(line.slice(6)) as ChatStreamChunk;
            } catch {
              // skip malformed JSON chunk
              continue;
            }
            applyChunk(parsedChunk);
          }
        }

        if (!assembled.trim()) {
          throw new Error(
            tools.length > 0
              ? "The model finished running tools but did not return a reply. Try again or check your model in Settings."
              : "The model returned an empty reply. Please try again."
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: assembled,
            toolCalls: tools.length > 0 ? tools : undefined,
            timestamp: Date.now(),
          },
        ]);
        setStreamingContent("");
        setStreamingTools([]);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          if (assembled || tools.length > 0) {
            setMessages((prev) => [
              ...prev,
              {
                id: newId(),
                role: "assistant",
                content: assembled,
                toolCalls: tools.length > 0 ? tools : undefined,
                timestamp: Date.now(),
              },
            ]);
          }
        } else {
          const msg = err instanceof Error ? err.message : "Chat failed.";
          setError(msg);
          if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("provider")) {
            setNoKeyError(true);
          }
        }
        setStreamingContent("");
        setStreamingTools([]);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [input, isStreaming, jobId, messages, typstSource]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const resizeRafRef = useRef<number | null>(null);
  const lastTextareaHeightRef = useRef<number | null>(null);
  const lastInputLengthRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, []);

  const resizeTextarea = (nextLength: number) => {
    const el = textareaRef.current;
    const isShrinking = nextLength < lastInputLengthRef.current;
    lastInputLengthRef.current = nextLength;
    if (!el) return;
    // Skip layout read/write when text fits without overflow and is not shrinking from multi-line
    if (
      lastTextareaHeightRef.current !== null &&
      !isShrinking &&
      el.scrollHeight <= el.clientHeight
    ) {
      return;
    }
    if (resizeRafRef.current !== null) {
      cancelAnimationFrame(resizeRafRef.current);
    }
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = null;
      const target = textareaRef.current;
      if (!target) return;
      target.style.height = "auto";
      const nextHeight = Math.min(target.scrollHeight, 96);
      target.style.height = `${nextHeight}px`;
      lastTextareaHeightRef.current = nextHeight;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="chat-panel">
      {(activeJobSummary?.roleTitle || activeJobSummary?.company) && (
        <div
          data-testid="chat-active-job-banner"
          className="border-b border-hairline bg-inset px-3 py-1.5 text-xs font-mono text-muted-foreground truncate"
          title={[activeJobSummary.roleTitle, activeJobSummary.company].filter(Boolean).join(" · ")}
        >
          Active role: {[activeJobSummary.roleTitle, activeJobSummary.company].filter(Boolean).join(" · ")}
        </div>
      )}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="rounded-full bg-status-warning/15 border border-status-warning/40 p-3">
              <MessageSquare className="h-6 w-6 text-status-warning" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Career Assistant</p>
              <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
                Ask about your {resumeTitle || "resume"}, evidence bank, ATS fit, or a saved job.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  data-testid="chat-quick-action"
                  onClick={() => void sendMessage(action)}
                  className="rounded-full border border-hairline bg-inset px-2.5 py-1 text-xs text-text-secondary hover:border-status-warning/40 hover:text-status-warning transition"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            data-testid={`chat-msg-${m.role}`}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-xl border border-status-warning/40 bg-status-warning/15 px-3 py-2 text-xs text-foreground"
                  : "max-w-[92%] rounded-xl border border-hairline bg-inset px-3 py-2"
              }
            >
              {m.toolCalls?.map((t) => (
                <ToolBadge key={t.id} name={t.name} state={t.state} />
              ))}
              {m.role === "assistant" ? (
                <AiMarkdownRenderer content={m.content} />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start" data-testid="chat-streaming">
            <div className="max-w-[92%] rounded-xl border border-hairline bg-inset px-3 py-2">
              {streamingTools.map((t) => (
                <ToolBadge key={t.id} name={t.name} state={t.state} />
              ))}
              {streamingContent ? (
                <AiMarkdownRenderer content={streamingContent} />
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin text-status-warning" />
                  Thinking…
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className={`mx-3 mb-2 p-2.5 rounded-lg flex items-start gap-2 text-xs border ${
            noKeyError
              ? "bg-status-warning/15 border-status-warning/40 text-status-warning"
              : "bg-status-danger/10 border-status-danger/30 text-status-danger"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span>{error}</span>
            {noKeyError && (
              <Link
                href="/settings"
                className="block underline underline-offset-2 text-status-warning hover:text-status-warning/80 font-medium"
              >
                → Configure your API key in Settings
              </Link>
            )}
            {!noKeyError && (
              <button
                type="button"
                className="block underline text-status-danger"
                onClick={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === "user");
                  if (lastUser) void sendMessage(lastUser.content);
                }}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-hairline p-3 space-y-2">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          aria-label="Ask Career Assistant"
          rows={1}
          value={input}
          disabled={isStreaming}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
            resizeTextarea(e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask about your resume, evidence, or a job…"
          className="w-full bg-inset border border-hairline rounded-lg p-2.5 text-xs text-foreground placeholder-text-muted outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none leading-relaxed"
        />
        <div className="flex justify-end">
          {isStreaming ? (
            <button
              type="button"
              data-testid="chat-stop-btn"
              onClick={stopStreaming}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-inset px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-elevated"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              data-testid="chat-send-btn"
              disabled={!input.trim()}
              onClick={() => void sendMessage()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow shadow-primary/20"
            >
              <Send className="h-3 w-3" />
              Send
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
