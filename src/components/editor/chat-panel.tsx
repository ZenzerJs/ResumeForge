"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const STORAGE_KEY = "resumeforge_chat_messages";

interface ProviderSettings {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

function loadAiSettings(): ProviderSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("resumeforge_ai_settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.apiKey) return null;
    return parsed as ProviderSettings;
  } catch {
    return null;
  }
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
}

export function ChatPanel({ typstSource, resumeTitle }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingTools, setStreamingTools] = useState<ToolCallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noKeyError, setNoKeyError] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent, streamingTools, isStreaming]);

  const activeJobId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return sessionStorage.getItem("resumeforge_active_job_id") || undefined;
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (!text || isStreaming) return;

      const aiSettings = loadAiSettings();
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
            messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
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
            try {
              applyChunk(JSON.parse(line.slice(6)) as ChatStreamChunk);
            } catch {
              // skip malformed chunk
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: assembled || (tools.length > 0 ? "I looked that up." : ""),
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
    [activeJobId, input, isStreaming, messages, typstSource]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="chat-panel">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="rounded-full bg-amber-500/10 border border-amber-500/20 p-3">
              <MessageSquare className="h-6 w-6 text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-200">Career Assistant</p>
              <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed">
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
                  className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[10px] text-slate-300 hover:border-amber-700/60 hover:text-amber-200 transition"
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
                  ? "max-w-[85%] rounded-xl border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100"
                  : "max-w-[92%] rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
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
            <div className="max-w-[92%] rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
              {streamingTools.map((t) => (
                <ToolBadge key={t.id} name={t.name} state={t.state} />
              ))}
              {streamingContent ? (
                <AiMarkdownRenderer content={streamingContent} />
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
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
              ? "bg-amber-950/50 border-amber-800/60 text-amber-300"
              : "bg-red-950/50 border-red-800/50 text-red-300"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span>{error}</span>
            {noKeyError && (
              <Link
                href="/settings"
                className="block underline underline-offset-2 text-amber-400 hover:text-amber-300 font-medium"
              >
                → Configure your API key in Settings
              </Link>
            )}
            {!noKeyError && (
              <button
                type="button"
                className="block underline text-red-200"
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

      <div className="border-t border-slate-800 p-3 space-y-2">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          rows={1}
          value={input}
          disabled={isStreaming}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
            resizeTextarea();
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask about your resume, evidence, or a job…"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 resize-none leading-relaxed"
        />
        <div className="flex justify-end">
          {isStreaming ? (
            <button
              type="button"
              data-testid="chat-stop-btn"
              onClick={stopStreaming}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 px-3 py-1.5 text-[11px] font-semibold text-slate-950 shadow shadow-amber-500/20"
            >
              <Send className="h-3 w-3" />
              Send
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-600 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
