"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  DSA_PROBLEMS,
  recommendProblemsForJob,
  type DsaProblem,
  type DsaLanguage,
  type DsaRecommendation,
} from "@/lib/dsa-problems";
import { executeDsaCode, type DsaExecutionSummary } from "@/lib/dsa-runner";
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
  Code2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DsaWorkspace() {
  const searchParams = useSearchParams();
  const queryProblem = searchParams.get("problem");
  const queryJd = searchParams.get("jd");

  const [selectedProblem, setSelectedProblem] = useState<DsaProblem>(() => {
    if (queryProblem) {
      const match = DSA_PROBLEMS.find((p) => p.slug === queryProblem || p.id === queryProblem);
      if (match) return match;
    }
    return DSA_PROBLEMS[0];
  });

  const [selectedLanguage, setSelectedLanguage] = useState<DsaLanguage>("javascript");
  const [code, setCode] = useState<string>(() => selectedProblem.starterCode.javascript);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [jdInput, setJdInput] = useState<string>(() => queryJd || "");
  const [recommendations, setRecommendations] = useState<DsaRecommendation[]>([]);
  const [isRecommenderOpen, setIsRecommenderOpen] = useState<boolean>(true);
  const [executionSummary, setExecutionSummary] = useState<DsaExecutionSummary | null>(null);
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // If query parameters arrive after initial mount
  useEffect(() => {
    if (queryProblem) {
      const match = DSA_PROBLEMS.find((p) => p.slug === queryProblem || p.id === queryProblem);
      if (match && match.slug !== selectedProblem.slug) {
        setSelectedProblem(match);
        setCode(match.starterCode[selectedLanguage]);
        setRevealedHints({});
        setExecutionSummary(null);
        setActiveTestCaseIndex(0);
      }
    }
    if (queryJd && !jdInput) {
      setJdInput(queryJd);
      const recs = recommendProblemsForJob(queryJd, 5);
      setRecommendations(recs);
    }
  }, [queryProblem, queryJd, selectedLanguage, selectedProblem.slug, jdInput]);

  const handleSelectProblem = (slug: string) => {
    const next = DSA_PROBLEMS.find((p) => p.slug === slug);
    if (!next) return;
    setSelectedProblem(next);
    setCode(next.starterCode[selectedLanguage]);
    setRevealedHints({});
    setExecutionSummary(null);
    setActiveTestCaseIndex(0);
  };

  const handleLanguageChange = (lang: DsaLanguage) => {
    setSelectedLanguage(lang);
    setCode(selectedProblem.starterCode[lang]);
    setExecutionSummary(null);
  };

  const handleReset = () => {
    setCode(selectedProblem.starterCode[selectedLanguage]);
    setExecutionSummary(null);
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

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const summary = await executeDsaCode({
        problem: selectedProblem,
        language: selectedLanguage,
        code,
        timeoutMs: 2500,
      });
      startTransition(() => {
        setExecutionSummary(summary);
      });
    } catch (err: unknown) {
      setExecutionSummary({
        status: "Runtime Error",
        passedCount: 0,
        totalCount: selectedProblem.testCases.length,
        totalTimeMs: 0,
        results: [],
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const difficultyBadgeStyle = (difficulty: DsaProblem["difficulty"]) => {
    switch (difficulty) {
      case "Easy":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Hard":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
  };

  const statusBadgeStyle = (status: DsaExecutionSummary["status"]) => {
    switch (status) {
      case "Accepted":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-4 py-3 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-md text-xs font-semibold">
            <Terminal className="h-4 w-4" />
            <span>DSA Arena</span>
          </div>

          {/* Problem Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="dsa-problem-select" className="sr-only">
              Select Problem
            </label>
            <select
              id="dsa-problem-select"
              data-testid="dsa-problem-select"
              value={selectedProblem.slug}
              onChange={(e) => handleSelectProblem(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              {DSA_PROBLEMS.map((problem) => (
                <option key={problem.slug} value={problem.slug}>
                  {problem.title} ({problem.difficulty})
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty & Pattern Badges */}
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-semibold border",
              difficultyBadgeStyle(selectedProblem.difficulty)
            )}
          >
            {selectedProblem.difficulty}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {selectedProblem.pattern}
          </span>
          <span className="hidden sm:inline-flex text-[11px] text-slate-400 font-mono">
            Time: {selectedProblem.optimalTimeComplexity} | Space: {selectedProblem.optimalSpaceComplexity}
          </span>
        </div>

        {/* Recommender Toggle Pill */}
        <button
          type="button"
          onClick={() => setIsRecommenderOpen((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>Match with Job Description</span>
          {isRecommenderOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      </header>

      {/* Collapsible JD Recommender Filter Bar */}
      {isRecommenderOpen && (
        <section className="border-b border-slate-800 bg-slate-900/40 p-4 shrink-0 transition-all">
          <div className="max-w-6xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Target Role DSA Pattern Recommender
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Ranks problems based on keyword and archetype overlap with your target JD
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                data-testid="dsa-jd-filter-input"
                value={jdInput}
                onChange={(e) => setJdInput(e.target.value)}
                placeholder="Paste Target Job Description snippet (e.g. backend systems, distributed caching, AST compiler, streaming)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-sans resize-none h-16 leading-relaxed"
              />
              <button
                type="button"
                data-testid="dsa-jd-recommend-btn"
                onClick={handleRecommend}
                className="sm:w-44 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shrink-0 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Rank Recommendations</span>
              </button>
            </div>

            {/* Recommendations List */}
            {recommendations.length > 0 && (
              <div className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {recommendations.map((rec) => {
                  const isCurrent = rec.problem.slug === selectedProblem.slug;
                  return (
                    <div
                      key={rec.problem.slug}
                      onClick={() => handleSelectProblem(rec.problem.slug)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between gap-1.5",
                        isCurrent
                          ? "bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30"
                          : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {rec.problem.title}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                          {rec.relevanceScore}% Match
                        </span>
                      </div>
                      <p
                        data-testid="dsa-match-reason"
                        className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed"
                      >
                        {rec.matchReason}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Split Body: Left Details & Right Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Pane: Problem Description, Constraints, Hints */}
        <section className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/20 p-5 overflow-y-auto space-y-6">
          {/* Title & Metadata */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>Pattern: {selectedProblem.pattern}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              {selectedProblem.title}
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {selectedProblem.categoryTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2 text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-line">
            {selectedProblem.description}
          </div>

          {/* Examples */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Examples
            </h2>
            {selectedProblem.examples.map((example, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-xs font-mono"
              >
                <div>
                  <span className="text-slate-500 font-semibold">Input: </span>
                  <span className="text-slate-300">{example.input}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Output: </span>
                  <span className="text-emerald-400">{example.output}</span>
                </div>
                {example.explanation && (
                  <div className="text-slate-400 text-[11px] font-sans pt-1 border-t border-slate-800/50">
                    <span className="text-slate-500 font-semibold">Explanation: </span>
                    {example.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Constraints */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Constraints
            </h2>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 font-mono">
              {selectedProblem.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {/* Progressive 3-Tier Hints */}
          <div className="space-y-3 pt-2 border-t border-slate-800/70">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Progressive Interview Hints
              </h2>
            </div>
            <p className="text-[11px] text-slate-400">
              Try solving without peeking first. Reveal hints progressively if stuck.
            </p>

            <div className="space-y-2">
              {selectedProblem.hints.map((hintText, idx) => {
                const isRevealed = Boolean(revealedHints[idx]);
                const testIdBtn = `dsa-hint-btn-${idx}`;
                const testIdContent = `dsa-hint-content-${idx}`;
                const label =
                  idx === 0
                    ? "Hint 1: Conceptual Intuition"
                    : idx === 1
                    ? "Hint 2: Optimal Data Structure"
                    : "Hint 3: Algorithm & Invariants";

                return (
                  <div
                    key={idx}
                    className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40"
                  >
                    <button
                      type="button"
                      data-testid={testIdBtn}
                      onClick={() => toggleHint(idx)}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 flex items-center justify-between transition"
                    >
                      <span className="flex items-center gap-2">
                        <Lightbulb className={cn("h-3.5 w-3.5", isRevealed ? "text-amber-400" : "text-slate-500")} />
                        <span>{label}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {isRevealed ? "Hide" : "Reveal"}
                      </span>
                    </button>
                    {isRevealed && (
                      <div
                        data-testid={testIdContent}
                        className="px-3 pb-3 pt-1 text-xs text-slate-300 font-sans leading-relaxed border-t border-slate-800/60 bg-slate-950/40"
                      >
                        {hintText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Pane: Code Editor & Test Console */}
        <section className="lg:col-span-7 flex flex-col bg-slate-950 overflow-hidden">
          {/* Editor Header Bar */}
          <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">Solution</span>
              </div>

              {/* Language Selector */}
              <label htmlFor="dsa-language-select" className="sr-only">
                Language
              </label>
              <select
                id="dsa-language-select"
                data-testid="dsa-language-select"
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value as DsaLanguage)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-indigo-500 transition font-mono cursor-pointer"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python 3</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="dsa-reset-btn"
                onClick={handleReset}
                title="Reset code to problem starter template"
                className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 px-2.5 py-1.5 rounded-md transition flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                data-testid="dsa-run-btn"
                disabled={isRunning}
                onClick={handleRun}
                className={cn(
                  "text-xs font-semibold px-4 py-1.5 rounded-md transition flex items-center gap-1.5 shadow-sm",
                  isRunning
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                )}
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{isRunning ? "Running..." : "Run Code"}</span>
              </button>
            </div>
          </div>

          {/* Code Editor Surface */}
          <div className="flex-1 min-h-[320px] relative bg-slate-950 flex flex-col">
            <textarea
              data-testid="dsa-code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
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
              className="flex-1 w-full p-4 bg-slate-950 text-slate-100 font-mono text-[13px] leading-relaxed resize-none focus:outline-none selection:bg-indigo-600/30 border-none"
              placeholder="// Write your solution here..."
            />
          </div>

          {/* Test Results & Output Console Pane */}
          <div className="border-t border-slate-800 bg-slate-900/60 flex flex-col h-64 shrink-0 overflow-hidden">
            {/* Console Bar */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300">Test Cases</span>

                {/* Overall Execution Status Badge */}
                <div data-testid="dsa-execution-status" className="flex items-center gap-2">
                  {executionSummary ? (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1",
                          statusBadgeStyle(executionSummary.status)
                        )}
                      >
                        {executionSummary.status === "Accepted" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : executionSummary.status === "Time Limit Exceeded" ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span>{executionSummary.status}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {executionSummary.passedCount} / {executionSummary.totalCount} Passed
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        ({executionSummary.totalTimeMs}ms)
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Click &quot;Run Code&quot; to test your solution
                    </span>
                  )}
                </div>
              </div>

              {executionSummary?.errorMessage && (
                <div className="text-[11px] text-rose-400 font-mono truncate max-w-sm flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{executionSummary.errorMessage}</span>
                </div>
              )}
            </div>

            {/* Test Case Tab Selector */}
            <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-800/80 bg-slate-900/40 shrink-0 overflow-x-auto">
              {selectedProblem.testCases.map((tc, idx) => {
                const res = executionSummary?.results[idx];
                const isActive = activeTestCaseIndex === idx;

                return (
                  <button
                    key={tc.id}
                    type="button"
                    data-testid={`dsa-test-case-tab-${idx}`}
                    onClick={() => setActiveTestCaseIndex(idx)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-t-md transition border-b-2 flex items-center gap-1.5 shrink-0",
                      isActive
                        ? "border-indigo-500 text-white bg-slate-800/70"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    )}
                  >
                    <span>Case {idx + 1}</span>
                    {res && (
                      res.passed ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3 w-3 text-rose-400" />
                      )
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Test Case Details */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono text-xs text-slate-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Input */}
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans font-semibold">
                    Input:
                  </span>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(activeTestCase.input, null, 2)}
                  </div>
                </div>

                {/* Expected & Actual */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans font-semibold">
                      Expected Output:
                    </span>
                    <span className="text-emerald-400">
                      {JSON.stringify(activeTestCase.expected)}
                    </span>
                  </div>

                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans font-semibold block pt-1">
                    Actual Output:
                  </span>
                  <div
                    data-testid="dsa-test-actual"
                    className={cn(
                      "p-2 rounded border font-mono whitespace-pre-wrap",
                      activeResult
                        ? activeResult.passed
                          ? "bg-slate-950 border-emerald-500/30 text-emerald-300"
                          : "bg-slate-950 border-rose-500/30 text-rose-300"
                        : "bg-slate-950 border-slate-800 text-slate-500"
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

              {/* Stdout Console Logs */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans font-semibold flex items-center gap-1.5">
                  <Terminal className="h-3 w-3 text-slate-400" />
                  <span>Captured stdout (console.log):</span>
                </span>
                <pre
                  data-testid="dsa-stdout-output"
                  className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap text-[11px] max-h-24 overflow-y-auto leading-relaxed"
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
