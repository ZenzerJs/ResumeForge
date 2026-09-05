"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Code2,
  BookOpen,
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Search,
  Sparkles,
  ExternalLink,
  Layers,
  Cpu,
  Hash,
  ArrowLeftRight,
  Maximize2,
  Network,
  Clock,
  HardDrive,
  Copy,
  Check,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/design-system/app-shell";
import {
  getAllTopics,
  getAllProblems,
  getProblemBySlug,
  getAllCompanies,
} from "@/lib/practice/practice-curriculum";
import {
  CodeLanguage,
  PracticeProblem,
  TopicCurriculum,
  ExecutionResult,
} from "@/lib/practice/types";
import { runCodeAgainstTestCases } from "@/lib/practice/code-runner";

const TOPIC_ICONS: Record<string, React.ElementType> = {
  Hash,
  ArrowLeftRight,
  Maximize2,
  Layers,
  Search,
  Network,
  Cpu,
};

export function PracticeWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL Params State
  const initialSlug = searchParams.get("problem") || searchParams.get("slug");
  const initialTopic = searchParams.get("topic") || "all";
  const initialCompany = searchParams.get("company") || "all";

  const topics = useMemo(() => getAllTopics(), []);
  const allProblems = useMemo(() => getAllProblems(), []);
  const allCompanies = useMemo(() => getAllCompanies(), []);

  // Filter States for Catalog
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopic);
  const [selectedCompany, setSelectedCompany] = useState<string>(initialCompany);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Workspace Active Problem State
  const [activeProblem, setActiveProblem] = useState<PracticeProblem | null>(() => {
    if (initialSlug) {
      return getProblemBySlug(initialSlug) || null;
    }
    return null;
  });

  // Active Tabs in Split-Pane
  const [leftTab, setLeftTab] = useState<"spec" | "blueprint" | "hints">("spec");
  const [activeConsoleTab, setActiveConsoleTab] = useState<"tests" | "output">("tests");
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>("typescript");

  // Code & Execution State
  const [code, setCode] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Progressive Hints Disclosure
  const [unlockedHints, setUnlockedHints] = useState<number[]>([]);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [copiedSolution, setCopiedSolution] = useState<boolean>(false);

  // Active topic for current problem
  const activeTopic = useMemo<TopicCurriculum | null>(() => {
    if (!activeProblem) return null;
    return topics.find((t) => t.id === activeProblem.topicId) || null;
  }, [activeProblem, topics]);

  // Sync state with URL params
  useEffect(() => {
    const slug = searchParams.get("problem") || searchParams.get("slug");
    if (slug) {
      const prob = getProblemBySlug(slug);
      if (prob) {
        setActiveProblem(prob);
      }
    } else {
      setActiveProblem(null);
    }

    const comp = searchParams.get("company");
    if (comp) setSelectedCompany(comp);

    const top = searchParams.get("topic");
    if (top) setSelectedTopicId(top);
  }, [searchParams]);

  // Load starter template when active problem or language changes
  useEffect(() => {
    if (activeProblem) {
      const template = activeProblem.starterTemplates[selectedLanguage] || activeProblem.starterTemplates.typescript;
      setCode(template);
      setExecutionResult(null);
      setUnlockedHints([]);
      setShowSolution(false);
      setLeftTab("spec");
      setActiveConsoleTab("tests");
    }
  }, [activeProblem, selectedLanguage]);

  const handleSelectProblem = (problem: PracticeProblem) => {
    setActiveProblem(problem);
    const params = new URLSearchParams(searchParams.toString());
    params.set("problem", problem.slug);
    router.push(`/practice?${params.toString()}`);
  };

  const handleBackToCatalog = () => {
    setActiveProblem(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("problem");
    params.delete("slug");
    router.push(`/practice?${params.toString()}`);
  };

  const handleResetCode = () => {
    if (!activeProblem) return;
    const template = activeProblem.starterTemplates[selectedLanguage] || activeProblem.starterTemplates.typescript;
    setCode(template);
    setExecutionResult(null);
  };

  const handleRunCode = useCallback(async () => {
    if (!activeProblem || !code) return;
    setIsRunning(true);
    setActiveConsoleTab("output");

    try {
      if (selectedLanguage === "typescript" || selectedLanguage === "javascript") {
        // Fast client-side execution with type-sanitization and timeout protection
        const res = runCodeAgainstTestCases(code, activeProblem.testCases);
        setExecutionResult(res);
      } else {
        // Post to execute route
        const res = await fetch("/api/practice/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId: activeProblem.id,
            problemSlug: activeProblem.slug,
            code,
            language: selectedLanguage,
          }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setExecutionResult(json.data);
        } else {
          setExecutionResult({
            status: "ERROR",
            totalTests: activeProblem.testCases.length,
            passedTests: 0,
            executionTimeMs: 0,
            testResults: [],
            error: json.error || "Failed to execute code.",
          });
        }
      }
    } catch (err: any) {
      setExecutionResult({
        status: "ERROR",
        totalTests: activeProblem.testCases.length,
        passedTests: 0,
        executionTimeMs: 0,
        testResults: [],
        error: err?.message || String(err),
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeProblem, code, selectedLanguage]);

  const handleToggleHint = (step: number) => {
    setUnlockedHints((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const handleCopySolution = () => {
    if (!activeProblem) return;
    const solCode =
      activeProblem.solution.code[selectedLanguage] ||
      activeProblem.solution.code.typescript ||
      "";
    navigator.clipboard.writeText(solCode);
    setCopiedSolution(true);
    setTimeout(() => setCopiedSolution(false), 2000);
  };

  // Filtered problems for catalog view
  const filteredProblems = useMemo(() => {
    return allProblems.filter((p) => {
      if (selectedTopicId !== "all" && p.topicId !== selectedTopicId) return false;
      if (selectedDifficulty !== "all" && p.difficulty.toLowerCase() !== selectedDifficulty.toLowerCase()) return false;
      if (
        selectedCompany !== "all" &&
        !p.companies.some((c) => c.toLowerCase().includes(selectedCompany.toLowerCase()))
      )
        return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(query);
        const matchTopic = p.topicId.toLowerCase().includes(query);
        const matchCompany = p.companies.some((c) => c.toLowerCase().includes(query));
        if (!matchTitle && !matchTopic && !matchCompany) return false;
      }
      return true;
    });
  }, [allProblems, selectedTopicId, selectedDifficulty, selectedCompany, searchQuery]);

  return (
    <AppShell variant="quiet">
      <div className="flex flex-col flex-1 min-h-[calc(100vh-3.5rem)] bg-[#0a0d14] text-slate-200">
        {/* ========================================================================= */}
        {/* VIEW 1: SPLIT-PANE LEETCODE-STYLE WORKSPACE                               */}
        {/* ========================================================================= */}
        {activeProblem ? (
          <div className="flex flex-col flex-1 h-full" data-testid="practice-workspace-active">
            {/* Top Sub-Bar with Breadcrumb and Actions */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs shrink-0">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleBackToCatalog}
                  data-testid="back-to-catalog-btn"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-medium"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Problem Catalog</span>
                </button>
                <div className="h-4 w-px bg-slate-800" />
                <span className="font-bold text-white">{activeProblem.title}</span>
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded",
                    activeProblem.difficulty === "Easy"
                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                      : activeProblem.difficulty === "Hard"
                      ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                      : "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                  )}
                >
                  {activeProblem.difficulty}
                </span>
                {activeTopic && (
                  <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                    <span className="text-slate-600">•</span>
                    <span>{activeTopic.title}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as CodeLanguage)}
                  data-testid="language-select"
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>

                <button
                  type="button"
                  onClick={handleResetCode}
                  title="Reset to starter template"
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  <RotateCcw className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleRunCode}
                  disabled={isRunning}
                  data-testid="run-code-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#ff8c00] hover:bg-[#ffa024] text-slate-950 font-bold transition disabled:opacity-50"
                >
                  <Play className="size-3.5 fill-slate-950" />
                  <span>{isRunning ? "Running..." : "Run Code"}</span>
                </button>
              </div>
            </div>

            {/* Split Pane: Left (Learn/Spec) vs Right (Code/Console) */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* LEFT PANE: Topic Blueprint, Problem Spec & Hints */}
              <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0d111a] overflow-hidden">
                {/* Left Tabs */}
                <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLeftTab("spec")}
                    data-testid="tab-problem-spec"
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-t-md transition border-b-2",
                      leftTab === "spec"
                        ? "border-[#ff8c00] text-[#ff8c00] bg-slate-800/60"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Code2 className="size-3.5" />
                      Problem &amp; Examples
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeftTab("blueprint")}
                    data-testid="tab-topic-blueprint"
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-t-md transition border-b-2",
                      leftTab === "blueprint"
                        ? "border-[#ff8c00] text-[#ff8c00] bg-slate-800/60"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="size-3.5" />
                      Topic Blueprint &amp; Theory
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLeftTab("hints")}
                    data-testid="tab-problem-hints"
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-t-md transition border-b-2",
                      leftTab === "hints"
                        ? "border-[#ff8c00] text-[#ff8c00] bg-slate-800/60"
                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="size-3.5" />
                      Progressive Hints
                    </span>
                  </button>
                </div>

                {/* Left Tab Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-5 text-xs space-y-5">
                  {/* TAB 1: SPEC */}
                  {leftTab === "spec" && (
                    <div className="space-y-5" data-testid="problem-spec-panel">
                      {/* Company Tags */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-500 font-mono text-[11px] mr-1">Observed at:</span>
                        {activeProblem.companies.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-[10px] text-amber-300 font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      {/* Problem Description */}
                      <div className="space-y-3 leading-relaxed text-slate-300 text-[13px] whitespace-pre-wrap">
                        {activeProblem.descriptionMarkdown}
                      </div>

                      {/* Examples */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-amber-400/90">
                          Examples
                        </h4>
                        {activeProblem.examples.map((ex, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-1.5"
                          >
                            <div>
                              <span className="text-slate-500">Input: </span>
                              <span className="text-slate-200">{ex.input}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Output: </span>
                              <span className="text-emerald-400">{ex.output}</span>
                            </div>
                            {ex.explanation && (
                              <div className="pt-1 text-slate-400 font-sans text-[11.5px] border-t border-slate-800/60">
                                <span className="text-slate-500 font-mono">Explanation: </span>
                                {ex.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Constraints */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-amber-400/90">
                          Constraints
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-[11.5px]">
                          {activeProblem.constraints.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: TOPIC BLUEPRINT & THEORY */}
                  {leftTab === "blueprint" && activeTopic && (
                    <div className="space-y-5" data-testid="topic-blueprint-panel">
                      {/* Topic Header Card */}
                      <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2.5">
                        <div className="flex items-center gap-2 text-amber-400">
                          <BookOpen className="size-4" />
                          <h3 className="font-bold text-sm text-white">{activeTopic.title} Pattern</h3>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{activeTopic.overview}</p>
                      </div>

                      {/* Pattern Intuition Card */}
                      <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/50 space-y-2 text-xs">
                        <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Sparkles className="size-3.5" /> Pattern Intuition: When to Apply
                        </h4>
                        <p className="text-amber-100/90 leading-relaxed">{activeTopic.patternIntuition}</p>
                      </div>

                      {/* Time & Space Complexity Box */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
                            <Clock className="size-3 text-amber-400" />
                            <span>Typical Time Complexity</span>
                          </div>
                          <div className="font-mono text-emerald-400 text-xs">{activeTopic.timeComplexity}</div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
                            <HardDrive className="size-3 text-amber-400" />
                            <span>Typical Space Complexity</span>
                          </div>
                          <div className="font-mono text-emerald-400 text-xs">{activeTopic.spaceComplexity}</div>
                        </div>
                      </div>

                      {/* Pattern Blueprint (Pseudocode) */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-amber-400/90">
                          Algorithmic Blueprint
                        </h4>
                        <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-mono text-[11.5px] overflow-x-auto leading-relaxed">
                          {activeTopic.blueprintPseudocode}
                        </pre>
                      </div>

                      {/* Worked Example */}
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider text-amber-400/90">
                          Worked Example: {activeTopic.workedExample.title}
                        </h4>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {activeTopic.workedExample.walkthrough}
                        </p>
                        <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed">
                          {activeTopic.workedExample.code}
                        </pre>
                        <div className="space-y-1.5 pt-1">
                          <span className="font-semibold text-slate-300 text-[11.5px]">Key Takeaways:</span>
                          <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                            {activeTopic.workedExample.keyTakeaways.map((k, i) => (
                              <li key={i}>{k}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PROGRESSIVE HINTS & SOLUTION */}
                  {leftTab === "hints" && (
                    <div className="space-y-4" data-testid="problem-hints-panel">
                      <div className="text-slate-400 text-xs">
                        Stuck? Reveal hints step-by-step to steer your intuition without spoiling the full solution.
                      </div>

                      {/* Progressive Hints List */}
                      <div className="space-y-3">
                        {activeProblem.hints.map((hint) => {
                          const isOpen = unlockedHints.includes(hint.step);
                          return (
                            <div
                              key={hint.step}
                              className="rounded-lg border border-slate-800 bg-slate-950/70 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleHint(hint.step)}
                                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition"
                              >
                                <span className="font-semibold text-amber-300 text-xs flex items-center gap-2">
                                  <HelpCircle className="size-3.5 text-amber-400" />
                                  Hint {hint.step}: {hint.title}
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="size-3.5 text-slate-400" />
                                ) : (
                                  <ChevronDown className="size-3.5 text-slate-400" />
                                )}
                              </button>
                              {isOpen && (
                                <div className="px-3.5 py-3 border-t border-slate-800/80 bg-slate-900/30 text-slate-300 text-xs leading-relaxed">
                                  {hint.content}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Solution Section */}
                      <div className="pt-4 border-t border-slate-800 space-y-3">
                        <button
                          type="button"
                          onClick={() => setShowSolution((prev) => !prev)}
                          data-testid="toggle-solution-btn"
                          className="w-full py-2 px-3 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold text-xs transition flex items-center justify-center gap-2"
                        >
                          <BookOpen className="size-3.5" />
                          <span>{showSolution ? "Hide Optimal Solution" : "Reveal Optimal Solution"}</span>
                        </button>

                        {showSolution && (
                          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">Approach: {activeProblem.solution.approach}</span>
                              <button
                                type="button"
                                onClick={handleCopySolution}
                                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
                              >
                                {copiedSolution ? <Check className="size-3" /> : <Copy className="size-3" />}
                                <span>{copiedSolution ? "Copied" : "Copy Code"}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              <div className="p-2 rounded bg-slate-900 text-slate-300">
                                <span className="text-slate-500">Time: </span>
                                {activeProblem.solution.timeComplexity}
                              </div>
                              <div className="p-2 rounded bg-slate-900 text-slate-300">
                                <span className="text-slate-500">Space: </span>
                                {activeProblem.solution.spaceComplexity}
                              </div>
                            </div>

                            <p className="text-slate-300 leading-relaxed">{activeProblem.solution.explanation}</p>

                            <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                              {activeProblem.solution.code[selectedLanguage] ||
                                activeProblem.solution.code.typescript ||
                                "// Solution code available in TypeScript"}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Code Editor & Execution Console */}
              <div className="w-full lg:w-1/2 flex flex-col bg-[#0b0e14] overflow-hidden">
                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-h-[300px] overflow-hidden relative">
                  <div className="px-4 py-2 bg-slate-900/70 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between shrink-0">
                    <span>Solution Editor ({selectedLanguage})</span>
                    <span className="text-slate-500">Press Tab to indent</span>
                  </div>

                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        const nextCode = code.substring(0, start) + "  " + code.substring(end);
                        setCode(nextCode);
                        setTimeout(() => {
                          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                        }, 0);
                      }
                    }}
                    data-testid="practice-code-editor"
                    spellCheck={false}
                    className="flex-1 w-full p-4 bg-[#080b10] text-slate-100 font-mono text-[12.5px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50 selection:bg-amber-500/20"
                    placeholder="// Write your solution here..."
                  />
                </div>

                {/* Console / Test Runner Bottom Sheet */}
                <div className="h-56 border-t border-slate-800 bg-[#0d1118] flex flex-col shrink-0 overflow-hidden">
                  {/* Console Tabs */}
                  <div className="flex items-center justify-between px-3 pt-2 bg-slate-900/60 border-b border-slate-800 shrink-0 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab("tests")}
                        data-testid="console-tab-tests"
                        className={cn(
                          "px-3 py-1 font-semibold rounded-t transition border-b-2 text-[11px]",
                          activeConsoleTab === "tests"
                            ? "border-[#ff8c00] text-[#ff8c00] bg-slate-800/60"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        )}
                      >
                        Sample Test Cases ({activeProblem.testCases.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab("output")}
                        data-testid="console-tab-output"
                        className={cn(
                          "px-3 py-1 font-semibold rounded-t transition border-b-2 text-[11px] flex items-center gap-1.5",
                          activeConsoleTab === "output"
                            ? "border-[#ff8c00] text-[#ff8c00] bg-slate-800/60"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        )}
                      >
                        <span>Execution Output</span>
                        {executionResult && (
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              executionResult.status === "PASS" ? "bg-emerald-500" : "bg-rose-500"
                            )}
                          />
                        )}
                      </button>
                    </div>

                    {executionResult && (
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span
                          className={cn(
                            "font-bold",
                            executionResult.status === "PASS" ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {executionResult.status === "PASS" ? "ACCEPTED" : "FAILED"}
                        </span>
                        <span className="text-slate-500">
                          {executionResult.passedTests}/{executionResult.totalTests} passed ({executionResult.executionTimeMs}ms)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Console Body */}
                  <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
                    {activeConsoleTab === "tests" && (
                      <div className="space-y-2.5">
                        {activeProblem.testCases.map((tc, idx) => (
                          <div
                            key={tc.id}
                            className="p-2.5 rounded bg-slate-950/80 border border-slate-800/80 text-[11.5px] space-y-1"
                          >
                            <div className="text-slate-400 font-semibold text-[10.5px]">Case {idx + 1}</div>
                            <div className="text-slate-300">
                              <span className="text-slate-500">Input: </span>
                              {tc.inputDisplay}
                            </div>
                            <div className="text-emerald-400">
                              <span className="text-slate-500">Expected: </span>
                              {tc.expectedDisplay}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeConsoleTab === "output" && (
                      <div className="space-y-2.5" data-testid="execution-results-container">
                        {!executionResult ? (
                          <div className="h-full flex items-center justify-center text-slate-500 text-center py-8">
                            Click &quot;Run Code&quot; to execute your solution against test cases.
                          </div>
                        ) : executionResult.error ? (
                          <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 whitespace-pre-wrap">
                            {executionResult.error}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {executionResult.testResults.map((tr, idx) => (
                              <div
                                key={tr.testCaseId}
                                className={cn(
                                  "p-2.5 rounded border text-[11.5px] space-y-1",
                                  tr.passed
                                    ? "bg-emerald-950/20 border-emerald-800/40 text-slate-200"
                                    : "bg-rose-950/20 border-rose-800/40 text-slate-200"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold flex items-center gap-1.5">
                                    {tr.passed ? (
                                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                                    ) : (
                                      <XCircle className="size-3.5 text-rose-400" />
                                    )}
                                    <span>Case {idx + 1}: {tr.passed ? "Passed" : "Failed"}</span>
                                  </span>
                                  {tr.executionTimeMs !== undefined && (
                                    <span className="text-[10px] text-slate-500">{tr.executionTimeMs}ms</span>
                                  )}
                                </div>
                                <div className="text-slate-400">
                                  <span className="text-slate-500">Input: </span>
                                  {tr.input}
                                </div>
                                <div>
                                  <span className="text-slate-500">Expected: </span>
                                  <span className="text-emerald-400">{tr.expected}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Actual: </span>
                                  <span className={tr.passed ? "text-emerald-400" : "text-rose-400"}>
                                    {tr.actual}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: TOPIC ROADMAP & PROBLEM CATALOG                                   */
          /* ========================================================================= */
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8" data-testid="practice-catalog-view">
            {/* Header Title */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#ff8c00]">
                <Code2 className="size-5" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider">
                  Technical Interview &amp; OA Preparation
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Master Algorithmic Patterns
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm max-w-3xl leading-relaxed">
                Learn core data structure and algorithmic patterns before coding. Explore curated problem sets asked
                in technical assessments and interviews at top tech companies.
              </p>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problems by name, topic, or company (e.g. Two Sum, Amazon, DP)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Topic Selector */}
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Topics</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>

                {/* Difficulty Selector */}
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>

                {/* Company Selector */}
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Companies</option>
                  {allCompanies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Topic Cards Carousel / Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <BookOpen className="size-4 text-amber-400" />
                  <span>Pattern Curriculum &amp; Intuition</span>
                </h2>
                <span className="text-xs text-slate-500">{topics.length} core patterns</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topics.map((t) => {
                  const IconComponent = TOPIC_ICONS[t.icon] || BookOpen;
                  const isSelected = selectedTopicId === t.id;
                  const problemCount = allProblems.filter((p) => p.topicId === t.id).length;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTopicId(isSelected ? "all" : t.id)}
                      className={cn(
                        "p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-3",
                        isSelected
                          ? "bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-500/5"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-slate-800 text-amber-400">
                              <IconComponent className="size-4" />
                            </div>
                            <h3 className="font-bold text-slate-100 text-sm">{t.title}</h3>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800/80">
                            {problemCount} {problemCount === 1 ? "problem" : "problems"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{t.overview}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span>{t.timeComplexity.split(" ")[0]} time</span>
                        <span className="text-amber-400 font-sans font-medium hover:underline">
                          {isSelected ? "Clear Filter" : "Filter Problems →"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Practice Problems List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Code2 className="size-4 text-amber-400" />
                  <span>Curated Practice Problems ({filteredProblems.length})</span>
                </h2>
              </div>

              {filteredProblems.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
                  <p>No practice problems match the selected filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopicId("all");
                      setSelectedCompany("all");
                      setSelectedDifficulty("all");
                      setSearchQuery("");
                    }}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    Reset all filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredProblems.map((p) => {
                    const topic = topics.find((t) => t.id === p.topicId);
                    return (
                      <div
                        key={p.id}
                        data-testid="practice-problem-card"
                        className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="font-bold text-white text-sm hover:text-amber-300 transition">
                              {p.title}
                            </h3>
                            <span
                              className={cn(
                                "text-[10px] font-mono font-bold px-2 py-0.5 rounded",
                                p.difficulty === "Easy"
                                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                                  : p.difficulty === "Hard"
                                  ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                                  : "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                              )}
                            >
                              {p.difficulty}
                            </span>
                            {topic && (
                              <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-800/60">
                                {topic.title}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-1">{p.summary}</p>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {p.companies.map((c) => (
                              <span
                                key={c}
                                className="px-1.5 py-0.5 rounded bg-slate-800/80 text-[10px] text-amber-300 font-mono"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectProblem(p)}
                          data-testid={`practice-btn-${p.slug}`}
                          className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold transition"
                        >
                          <span>Solve in Workspace</span>
                          <ExternalLink className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
