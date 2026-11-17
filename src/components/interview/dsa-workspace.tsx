"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  recommendProblemsForJob,
  type DsaProblem,
  type DsaLanguage,
  type DsaRecommendation,
} from "@/lib/dsa-problems";
import { listSandboxProblems } from "@/lib/sandbox-problems";
import { executeDsaCode, type DsaExecutionSummary } from "@/lib/dsa-runner";
import {
  askSocraticCoach,
  auditDsaSubmission,
  type DsaChatMessage,
  type DsaInterviewStage,
  type DsaScorecard,
} from "@/lib/dsa-coach";
import {
  Play,
  RotateCcw,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Terminal,
  ChevronDown,
  ChevronUp,
  Loader2,
  Bot,
  Send,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SANDBOX_PROBLEMS = listSandboxProblems();

const FILE_EXT: Record<DsaLanguage, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
};

const selectClass =
  "min-h-11 sm:h-8 appearance-none rounded-md border border-hairline bg-elevated pl-2.5 pr-7 text-base sm:text-xs font-medium text-foreground transition-colors hover:border-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 cursor-pointer";

export function DsaWorkspace({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const queryProblem = searchParams.get("problem");
  const queryJd = searchParams.get("jd");

  const [selectedProblem, setSelectedProblem] = useState<DsaProblem>(() => {
    if (queryProblem) {
      const match = SANDBOX_PROBLEMS.find((p) => p.slug === queryProblem || p.id === queryProblem);
      if (match) return match;
    }
    return SANDBOX_PROBLEMS[0];
  });

  const [selectedLanguage, setSelectedLanguage] = useState<DsaLanguage>("javascript");
  const [code, setCode] = useState<string>(() => selectedProblem.starterCode.javascript);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [jdInput, setJdInput] = useState<string>(() => queryJd || "");
  const [recommendations, setRecommendations] = useState<DsaRecommendation[]>([]);
  const [isRecommenderOpen, setIsRecommenderOpen] = useState<boolean>(() => Boolean(queryJd));
  const [executionSummary, setExecutionSummary] = useState<DsaExecutionSummary | null>(null);
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [coachStage, setCoachStage] = useState<DsaInterviewStage>("CLARIFICATION");
  const [coachMessages, setCoachMessages] = useState<DsaChatMessage[]>([]);
  const [coachInput, setCoachInput] = useState<string>("");
  const [isAskingCoach, setIsAskingCoach] = useState<boolean>(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<DsaScorecard | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const gutterRef = useRef<HTMLDivElement>(null);
  const runAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      runAbortRef.current?.abort();
    };
  }, []);

  // If query parameters arrive after initial mount
  useEffect(() => {
    if (queryProblem) {
      const match = SANDBOX_PROBLEMS.find((p) => p.slug === queryProblem || p.id === queryProblem);
      if (match && match.slug !== selectedProblem.slug) {
        setSelectedProblem(match);
        setCode(match.starterCode[selectedLanguage]);
        setRevealedHints({});
        setExecutionSummary(null);
        setActiveTestCaseIndex(0);
        setCoachStage("CLARIFICATION");
        setCoachMessages([]);
        setCoachError(null);
        setScorecard(null);
        setAuditError(null);
      }
    }
    if (queryJd && !jdInput) {
      setJdInput(queryJd);
      const recs = recommendProblemsForJob(queryJd, 5);
      setRecommendations(recs);
    }
  }, [queryProblem, queryJd, selectedLanguage, selectedProblem.slug, jdInput]);

  const handleSelectProblem = (slug: string) => {
    const next = SANDBOX_PROBLEMS.find((p) => p.slug === slug);
    if (!next) return;
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setIsRunning(false);
    setSelectedProblem(next);
    setCode(next.starterCode[selectedLanguage]);
    setRevealedHints({});
    setExecutionSummary(null);
    setActiveTestCaseIndex(0);
    setCoachStage("CLARIFICATION");
    setCoachMessages([]);
    setCoachError(null);
    setScorecard(null);
    setAuditError(null);
  };

  const handleLanguageChange = (lang: DsaLanguage) => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setIsRunning(false);
    setSelectedLanguage(lang);
    setCode(selectedProblem.starterCode[lang]);
    setExecutionSummary(null);
    setCoachError(null);
    setScorecard(null);
    setAuditError(null);
  };

  const handleReset = () => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    setIsRunning(false);
    setCode(selectedProblem.starterCode[selectedLanguage]);
    setExecutionSummary(null);
    setCoachError(null);
    setScorecard(null);
    setAuditError(null);
  };

  const handleRecommend = () => {
    if (!jdInput.trim()) return;
    const recs = recommendProblemsForJob(jdInput, 5);
    setRecommendations(recs);
  };

  const toggleHint = (index: number) => {
    setRevealedHints((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleAskCoach = async () => {
    const trimmed = coachInput.trim();
    if (!trimmed || isAskingCoach) return;
    setIsAskingCoach(true);
    setCoachError(null);
    const userMsg: DsaChatMessage = {
      role: "user",
      content: trimmed,
      stage: coachStage,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...coachMessages, userMsg];
    setCoachMessages(nextHistory);
    setCoachInput("");

    try {
      const turn = await askSocraticCoach({
        problem: selectedProblem,
        stage: coachStage,
        language: selectedLanguage,
        code,
        execution: executionSummary || undefined,
        messages: nextHistory,
        userMessage: trimmed,
      });
      const assistantMsg: DsaChatMessage = {
        role: "assistant",
        content: turn.reply,
        stage: turn.suggestedNextStage,
        timestamp: new Date().toISOString(),
      };
      setCoachMessages((prev) => [...prev, assistantMsg]);
      setCoachStage(turn.suggestedNextStage);
    } catch (err) {
      setCoachError(
        err instanceof Error && err.message
          ? err.message
          : "Unable to reach the Socratic Coach. Check your AI provider settings and try again."
      );
    } finally {
      setIsAskingCoach(false);
    }
  };

  const handleAuditScorecard = async () => {
    if (!executionSummary || isAuditing) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      const hintsUsed = Object.values(revealedHints).filter(Boolean).length;
      const result = await auditDsaSubmission({
        problem: selectedProblem,
        language: selectedLanguage,
        code,
        execution: executionSummary,
        hintsUsed,
      });
      setScorecard(result);
      setCoachStage("SCORECARD");
    } catch (err) {
      setAuditError(
        err instanceof Error && err.message
          ? err.message
          : "Unable to audit submission complexity. Check your AI provider settings and try again."
      );
    } finally {
      setIsAuditing(false);
    }
  };

  const handleRun = async () => {
    if (isRunning) return;
    runAbortRef.current?.abort();
    const controller = new AbortController();
    runAbortRef.current = controller;
    setIsRunning(true);
    try {
      const summary = await executeDsaCode({
        problem: selectedProblem,
        language: selectedLanguage,
        code,
        timeoutMs: 2500,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      startTransition(() => {
        setExecutionSummary(summary);
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setExecutionSummary({
        status: "Runtime Error",
        passedCount: 0,
        totalCount: selectedProblem.testCases.length,
        totalTimeMs: 0,
        results: [],
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsRunning(false);
      }
    }
  };

  const difficultyBadgeStyle = (difficulty: DsaProblem["difficulty"]) => {
    switch (difficulty) {
      case "Easy":
        return "bg-status-success/10 text-status-success-soft border-status-success/25";
      case "Medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Hard":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
  };

  const statusBadgeStyle = (status: DsaExecutionSummary["status"]) => {
    switch (status) {
      case "Accepted":
        return "bg-status-success/15 text-status-success-soft border-status-success/35";
      case "Wrong Answer":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      case "Time Limit Exceeded":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "Runtime Error":
      case "Syntax Error":
        return "bg-red-500/15 text-red-400 border-red-500/30";
    }
  };

  const activeTestCase = selectedProblem.testCases[activeTestCaseIndex] || selectedProblem.testCases[0];
  const activeResult = executionSummary?.results[activeTestCaseIndex];
  const lineCount = Math.max(code.split("\n").length, 1);

  return (
    <div
      className={cn(
        "flex flex-col bg-rf-bg text-foreground",
        embedded ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden lg:overflow-hidden" : "min-h-screen overflow-x-hidden"
      )}
    >
      {/* Toolbar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <div className="relative min-w-0 max-w-full">
            <label htmlFor="dsa-problem-select" className="sr-only">
              Select Problem
            </label>
            <select
              id="dsa-problem-select"
              data-testid="dsa-problem-select"
              value={selectedProblem.slug}
              onChange={(e) => handleSelectProblem(e.target.value)}
              className={cn(selectClass, "w-full max-w-[16rem] truncate sm:w-auto sm:max-w-xs")}
            >
              {SANDBOX_PROBLEMS.map((problem) => (
                <option key={problem.slug} value={problem.slug}>
                  {problem.title} ({problem.difficulty})
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>

          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              difficultyBadgeStyle(selectedProblem.difficulty)
            )}
          >
            {selectedProblem.difficulty}
          </span>
          <span className="rounded-full border border-hairline bg-panel px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            {selectedProblem.pattern}
          </span>
          <span className="hidden font-mono text-xs tabular-nums text-muted-foreground xl:inline">
            Time {selectedProblem.optimalTimeComplexity} · Space {selectedProblem.optimalSpaceComplexity}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsRecommenderOpen((prev) => !prev)}
          aria-expanded={isRecommenderOpen}
          className="inline-flex min-h-11 sm:h-8 items-center gap-1.5 rounded-md border border-hairline bg-panel px-3 text-xs font-medium text-text-secondary transition-colors hover:border-control hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          <span>Match with Job Description</span>
          {isRecommenderOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          )}
        </button>
      </header>

      {/* Collapsible JD recommender */}
      {isRecommenderOpen && (
        <section className="shrink-0 border-b border-hairline bg-panel/50 px-4 py-3 md:px-6">
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold text-foreground">Find problems for a target role</h2>
              <span className="text-xs text-muted-foreground">
                Ranks problems by keyword overlap with the job description
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                data-testid="dsa-jd-filter-input"
                value={jdInput}
                onChange={(e) => setJdInput(e.target.value)}
                placeholder="Paste a job description snippet, e.g. backend systems, distributed caching…"
                aria-label="Target job description snippet"
                className="h-16 flex-1 resize-none rounded-lg border border-hairline bg-inset p-2.5 text-base sm:text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              />
              <button
                type="button"
                data-testid="dsa-jd-recommend-btn"
                onClick={handleRecommend}
                className="flex min-h-11 sm:min-h-0 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-[#121010] transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:w-44"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <span>Rank Problems</span>
              </button>
            </div>

            {recommendations.length > 0 && (
              <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((rec) => {
                  const isCurrent = rec.problem.slug === selectedProblem.slug;
                  return (
                    <button
                      type="button"
                      key={rec.problem.slug}
                      onClick={() => handleSelectProblem(rec.problem.slug)}
                      className={cn(
                        "flex flex-col justify-between gap-1.5 rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                        isCurrent
                          ? "border-amber-500/50 bg-amber-500/5"
                          : "border-hairline bg-inset hover:border-control"
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {rec.problem.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs tabular-nums text-amber-300">
                          {rec.relevanceScore}% match
                        </span>
                      </span>
                      <span
                        data-testid="dsa-match-reason"
                        className="line-clamp-2 text-xs leading-relaxed text-text-secondary"
                      >
                        {rec.matchReason}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Split body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:overflow-hidden">
        {/* Problem pane */}
        <section className="space-y-6 rounded-xl border border-hairline bg-panel p-5 lg:col-span-5 lg:overflow-y-auto">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {selectedProblem.pattern}
            </p>
            <h1 className="mb-3 text-xl font-semibold tracking-tight text-foreground text-balance">
              {selectedProblem.title}
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {selectedProblem.categoryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-hairline px-2 py-0.5 text-xs font-medium text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {selectedProblem.description}
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Examples</h2>
            {selectedProblem.examples.map((example, idx) => (
              <div
                key={idx}
                className="space-y-1.5 rounded-lg border border-hairline bg-inset p-3 font-mono text-xs"
              >
                <div>
                  <span className="font-semibold text-muted-foreground">Input: </span>
                  <span className="text-foreground">{example.input}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Output: </span>
                  <span className="text-status-success-soft">{example.output}</span>
                </div>
                {example.explanation && (
                  <div className="border-t border-hairline pt-1.5 font-sans text-xs leading-relaxed text-text-secondary">
                    {example.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Constraints</h2>
            <ul className="list-inside list-disc space-y-1 font-mono text-xs text-text-secondary">
              {selectedProblem.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 border-t border-hairline pt-5">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-400" aria-hidden />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Progressive Interview Hints
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Try solving without peeking first. Reveal hints progressively if stuck.
            </p>

            <div className="space-y-2">
              {selectedProblem.hints.map((hintText, idx) => {
                const isRevealed = Boolean(revealedHints[idx]);
                const label =
                  idx === 0
                    ? "Hint 1: Conceptual Intuition"
                    : idx === 1
                    ? "Hint 2: Optimal Data Structure"
                    : "Hint 3: Algorithm & Invariants";

                return (
                  <div key={idx} className="overflow-hidden rounded-lg border border-hairline bg-inset">
                    <button
                      type="button"
                      data-testid={`dsa-hint-btn-${idx}`}
                      onClick={() => toggleHint(idx)}
                      aria-expanded={isRevealed}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-text-secondary transition-colors hover:bg-elevated/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60"
                    >
                      <span className="flex items-center gap-2">
                        <Lightbulb
                          className={cn("h-3.5 w-3.5", isRevealed ? "text-amber-400" : "text-muted-foreground")}
                          aria-hidden
                        />
                        <span>{label}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{isRevealed ? "Hide" : "Reveal"}</span>
                    </button>
                    {isRevealed && (
                      <div
                        data-testid={`dsa-hint-content-${idx}`}
                        className="border-t border-hairline px-3 pb-3 pt-2 text-xs leading-relaxed text-text-secondary"
                      >
                        {hintText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Socratic AI Coach & Complexity Auditor */}
          <div
            data-testid="dsa-socratic-coach-panel"
            className="space-y-3 border-t border-hairline pt-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-amber-400" aria-hidden />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Socratic Interview Coach
                </h2>
              </div>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-300">
                Stage: {coachStage}
              </span>
            </div>

            <p className="text-xs text-text-secondary">
              Discuss constraints, walk through your Big-O approach, or request a Socratic nudge without spoiling the code.
            </p>

            {coachMessages.length > 0 && (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-hairline bg-inset p-2.5 text-xs">
                {coachMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md p-2 leading-relaxed",
                      msg.role === "user"
                        ? "ml-4 bg-elevated text-foreground"
                        : "mr-2 border border-amber-500/20 bg-amber-500/5 text-foreground"
                    )}
                  >
                    <span className="mb-0.5 block font-mono text-xs uppercase text-muted-foreground">
                      {msg.role === "user" ? "You" : "Socratic Coach"}
                    </span>
                    {msg.content}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                data-testid="dsa-coach-input"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAskCoach();
                  }
                }}
                placeholder="Explain your approach or ask a clarifying question…"
                className="min-h-11 sm:h-8 min-w-0 flex-1 rounded-md border border-hairline bg-inset px-2.5 text-base sm:text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              />
              <button
                type="button"
                data-testid="dsa-coach-send-btn"
                disabled={isAskingCoach || !coachInput.trim()}
                onClick={() => void handleAskCoach()}
                className="inline-flex min-h-11 sm:h-8 shrink-0 items-center gap-1 rounded-md bg-elevated px-3 text-xs font-semibold text-amber-300 transition-colors hover:bg-panel disabled:opacity-50"
              >
                {isAskingCoach ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
                <span>Ask</span>
              </button>
            </div>

            {coachError && (
              <div
                role="alert"
                data-testid="dsa-coach-error"
                className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-xs text-red-300"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
                <span>{coachError}</span>
              </div>
            )}

            {executionSummary && (
              <div className="pt-1">
                <button
                  type="button"
                  data-testid="dsa-audit-scorecard-btn"
                  disabled={isAuditing}
                  onClick={() => void handleAuditScorecard()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {isAuditing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Award className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>Audit Complexity &amp; Generate Scorecard</span>
                </button>
              </div>
            )}

            {auditError && (
              <div
                role="alert"
                data-testid="dsa-audit-error"
                className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-xs text-red-300"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
                <span>{auditError}</span>
              </div>
            )}

            {scorecard && (
              <div
                data-testid="dsa-scorecard-panel"
                className="space-y-2.5 rounded-lg border border-status-success/30 bg-status-success/10 p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    Interview Readiness Grade:{" "}
                    <span className="font-mono text-sm text-amber-400">{scorecard.grade}</span>{" "}
                    ({scorecard.overallScore}/100)
                  </span>
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {scorecard.mode === "byok" ? "AI Audited" : "Heuristic Audit"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                  <div className="rounded border border-hairline bg-inset p-2">
                    <span className="block text-xs text-muted-foreground">Time Complexity</span>
                    <span className={scorecard.complexityAudit.isTimeOptimal ? "text-status-success-soft" : "text-amber-300"}>
                      {scorecard.complexityAudit.detectedTimeComplexity} (target {scorecard.complexityAudit.optimalTimeComplexity})
                    </span>
                  </div>
                  <div className="rounded border border-hairline bg-inset p-2">
                    <span className="block text-xs text-muted-foreground">Space Complexity</span>
                    <span className={scorecard.complexityAudit.isSpaceOptimal ? "text-status-success-soft" : "text-amber-300"}>
                      {scorecard.complexityAudit.detectedSpaceComplexity} (target {scorecard.complexityAudit.optimalSpaceComplexity})
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {scorecard.complexityAudit.actionableFeedback}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Editor + console */}
        <section className="flex min-h-0 flex-col gap-3 lg:col-span-7">
          <div className="flex min-h-[340px] flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-panel">
            <div className="flex flex-wrap shrink-0 items-center justify-between gap-2 sm:gap-3 border-b border-hairline px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded-md border border-hairline bg-inset px-2 py-1 font-mono text-xs text-text-secondary">
                  solution.{FILE_EXT[selectedLanguage]}
                </span>
                <div className="relative">
                  <label htmlFor="dsa-language-select" className="sr-only">
                    Language
                  </label>
                  <select
                    id="dsa-language-select"
                    data-testid="dsa-language-select"
                    value={selectedLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value as DsaLanguage)}
                    className={selectClass}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python 3</option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="dsa-reset-btn"
                  onClick={handleReset}
                  title="Reset code to the starter template"
                  className="inline-flex min-h-11 sm:h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  data-testid="dsa-run-btn"
                  disabled={isRunning}
                  onClick={handleRun}
                  title="Run (Ctrl or ⌘ + Enter)"
                  className="inline-flex min-h-11 sm:h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3.5 text-xs font-semibold text-[#121010] transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted-foreground"
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  )}
                  <span>{isRunning ? "Running…" : "Run Code"}</span>
                </button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 bg-inset">
              <div
                ref={gutterRef}
                aria-hidden
                className="select-none overflow-hidden border-r border-hairline bg-deep/40 py-4 pl-3 pr-3 text-right font-mono text-[13px] leading-relaxed text-muted-foreground"
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                data-testid="dsa-code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleRun();
                    return;
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const nextCode = code.substring(0, start) + "  " + code.substring(end);
                    setCode(nextCode);
                    setTimeout(() => {
                      target.selectionStart = target.selectionEnd = start + 2;
                    }, 0);
                  }
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                wrap="off"
                className="min-w-0 flex-1 resize-none whitespace-pre border-none bg-transparent p-4 font-mono text-[13px] leading-relaxed text-foreground caret-amber-400 selection:bg-amber-500/20"
                placeholder="// Write your solution here…"
                aria-label="Solution code"
              />
            </div>
          </div>

          {/* Test console */}
          <div className="flex min-h-[260px] lg:h-72 shrink-0 flex-col overflow-hidden rounded-xl border border-hairline bg-panel">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-foreground">Test Cases</span>

                <div data-testid="dsa-execution-status" className="flex items-center gap-2">
                  {executionSummary ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          statusBadgeStyle(executionSummary.status)
                        )}
                      >
                        {executionSummary.status === "Accepted" ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                        ) : executionSummary.status === "Time Limit Exceeded" ? (
                          <Clock className="h-3 w-3" aria-hidden />
                        ) : (
                          <XCircle className="h-3 w-3" aria-hidden />
                        )}
                        <span>{executionSummary.status}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums text-text-secondary">
                        {executionSummary.passedCount} / {executionSummary.totalCount} Passed
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        ({executionSummary.totalTimeMs}ms)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Press <kbd className="rounded border border-hairline px-1 font-mono text-xs">Run Code</kbd>{" "}
                      to test your solution
                    </span>
                  )}
                </div>
              </div>

              {executionSummary?.errorMessage && (
                <div className="flex max-w-sm items-center gap-1 truncate font-mono text-xs text-rose-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{executionSummary.errorMessage}</span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-hairline px-3 py-2">
              {selectedProblem.testCases.map((tc, idx) => {
                const res = executionSummary?.results[idx];
                const isActive = activeTestCaseIndex === idx;

                return (
                  <button
                    key={tc.id}
                    type="button"
                    data-testid={`dsa-test-case-tab-${idx}`}
                    onClick={() => setActiveTestCaseIndex(idx)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                      isActive
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        : "border-hairline bg-inset text-text-secondary hover:border-control hover:text-foreground"
                    )}
                  >
                    <span>Case {idx + 1}</span>
                    {res &&
                      (res.passed ? (
                        <CheckCircle2 className="h-3 w-3 text-status-success" aria-label="Passed" />
                      ) : (
                        <XCircle className="h-3 w-3 text-rose-400" aria-label="Failed" />
                      ))}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3 font-mono text-xs text-text-secondary">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="block font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Input
                  </span>
                  <div className="whitespace-pre-wrap rounded-md border border-hairline bg-inset p-2 text-text-secondary">
                    {JSON.stringify(activeTestCase.input, null, 2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Expected Output
                    </span>
                    <span className="text-status-success-soft">{JSON.stringify(activeTestCase.expected)}</span>
                  </div>

                  <span className="block pt-1 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actual Output
                  </span>
                  <div
                    data-testid="dsa-test-actual"
                    className={cn(
                      "whitespace-pre-wrap rounded-md border bg-inset p-2",
                      activeResult
                        ? activeResult.passed
                          ? "border-status-success/35 text-status-success-soft"
                          : "border-rose-500/30 text-rose-300"
                        : "border-hairline text-muted-foreground"
                    )}
                  >
                    {activeResult
                      ? typeof activeResult.actual === "object" && activeResult.actual !== null
                        ? JSON.stringify(activeResult.actual)
                        : String(activeResult.actual)
                      : "(Not run)"}
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <span className="flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Terminal className="h-3 w-3 text-text-secondary" aria-hidden />
                  <span>Console output</span>
                </span>
                <pre
                  data-testid="dsa-stdout-output"
                  className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-hairline bg-inset p-2 text-xs leading-relaxed text-text-secondary"
                >
                  {activeResult?.stdout || "(no stdout captured)"}
                </pre>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
