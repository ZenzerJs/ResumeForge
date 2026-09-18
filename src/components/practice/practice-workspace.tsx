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
import { PageHeader } from "@/components/design-system/page-header";
import { StatusPill } from "@/components/design-system/status-pill";
import { CommandButton } from "@/components/design-system/command-button";
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
    <AppShell variant={activeProblem ? "editor" : "quiet"}>
      <div className="flex flex-col flex-1 min-h-[calc(100vh-4rem)] bg-rf-bg text-rf-cloud">
        {/* ========================================================================= */}
        {/* VIEW 1: SPLIT-PANE LEETCODE-STYLE WORKSPACE                               */}
        {/* ========================================================================= */}
        {activeProblem ? (
          <div className="flex flex-col flex-1 h-full overflow-hidden" data-testid="practice-workspace-active">
            {/* Top Sub-Bar with Breadcrumb and Actions */}
            <div className="flex items-center justify-between px-4 py-2 bg-rf-surface/95 border-b border-border text-xs shrink-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToCatalog}
                  data-testid="back-to-catalog-btn"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-rf-meta hover:text-rf-cloud border border-border transition font-medium text-xs"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Problem Catalog</span>
                </button>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <span className="font-bold text-rf-cloud truncate">{activeProblem.title}</span>
                <span
                  className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0",
                    activeProblem.difficulty === "Easy"
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                      : activeProblem.difficulty === "Hard"
                      ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                      : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                  )}
                >
                  {activeProblem.difficulty}
                </span>
                {activeTopic && (
                  <span className="text-[11px] text-rf-meta hidden md:inline-flex items-center gap-1 shrink-0">
                    <span className="text-slate-600">•</span>
                    <span>{activeTopic.title}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Language Selector */}
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as CodeLanguage)}
                  data-testid="language-select"
                  className="bg-surface-container-lowest border border-border rounded-lg px-2.5 py-1 text-xs text-rf-cloud font-mono focus:outline-none focus:border-primary"
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
                  className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-border text-rf-meta hover:text-rf-cloud transition"
                >
                  <RotateCcw className="size-3.5" />
                </button>

                <CommandButton
                  variant="primary"
                  size="sm"
                  onClick={handleRunCode}
                  disabled={isRunning}
                  data-testid="run-code-btn"
                  className="font-bold"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>{isRunning ? "Running..." : "Run Code"}</span>
                </CommandButton>
              </div>
            </div>

            {/* Split Pane: Left (Learn/Spec) vs Right (Code/Console) */}
            <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
              {/* LEFT PANE: Topic Blueprint, Problem Spec & Hints */}
              <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-rf-surface/60 overflow-hidden">
                {/* Left Tabs */}
                <div className="flex items-center gap-1 px-4 pt-2 border-b border-border bg-rf-surface/90 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLeftTab("spec")}
                    data-testid="tab-problem-spec"
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-t-md transition border-b-2",
                      leftTab === "spec"
                        ? "border-primary text-primary bg-rf-elevated/70"
                        : "border-transparent text-rf-meta hover:text-rf-cloud hover:bg-rf-elevated/30"
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
                        ? "border-primary text-primary bg-rf-elevated/70"
                        : "border-transparent text-rf-meta hover:text-rf-cloud hover:bg-rf-elevated/30"
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
                        ? "border-primary text-primary bg-rf-elevated/70"
                        : "border-transparent text-rf-meta hover:text-rf-cloud hover:bg-rf-elevated/30"
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
                        <span className="text-rf-meta font-mono text-[11px] mr-1">Observed at:</span>
                        {activeProblem.companies.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-full bg-surface-container-high border border-border text-[10px] text-amber-300 font-medium font-mono"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      {/* Problem Description */}
                      <div className="space-y-3 leading-relaxed text-rf-cloud text-[13px] whitespace-pre-wrap bg-rf-surface p-4 rounded-xl border border-border">
                        {activeProblem.descriptionMarkdown}
                      </div>

                      {/* Examples */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-rf-cloud text-xs uppercase tracking-wider text-amber-400 font-mono">
                          Examples
                        </h4>
                        {activeProblem.examples.map((ex, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-surface-container-lowest border border-border font-mono text-xs space-y-1.5"
                          >
                            <div>
                              <span className="text-rf-meta">Input: </span>
                              <span className="text-rf-cloud font-semibold">{ex.input}</span>
                            </div>
                            <div>
                              <span className="text-rf-meta">Output: </span>
                              <span className="text-emerald-400 font-semibold">{ex.output}</span>
                            </div>
                            {ex.explanation && (
                              <div className="pt-2 text-rf-meta font-sans text-[11.5px] border-t border-border">
                                <span className="text-rf-meta font-mono font-semibold">Explanation: </span>
                                {ex.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Constraints */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-rf-cloud text-xs uppercase tracking-wider text-amber-400 font-mono">
                          Constraints
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-rf-meta font-mono text-[11.5px] bg-rf-surface p-3.5 rounded-xl border border-border">
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
                      <div className="p-4 rounded-xl bg-rf-surface border border-border space-y-2.5">
                        <div className="flex items-center gap-2 text-amber-400">
                          <BookOpen className="size-4" />
                          <h3 className="font-bold text-sm text-rf-cloud">{activeTopic.title} Pattern</h3>
                        </div>
                        <p className="text-rf-meta text-xs leading-relaxed">{activeTopic.overview}</p>
                      </div>

                      {/* Pattern Intuition Card */}
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                        <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Sparkles className="size-3.5" /> Pattern Intuition: When to Apply
                        </h4>
                        <p className="text-amber-100/90 leading-relaxed">{activeTopic.patternIntuition}</p>
                      </div>

                      {/* Time & Space Complexity Box */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border space-y-1">
                          <div className="flex items-center gap-1.5 text-rf-meta text-[11px] font-semibold">
                            <Clock className="size-3 text-amber-400" />
                            <span>Typical Time Complexity</span>
                          </div>
                          <div className="font-mono text-emerald-400 text-xs font-bold">{activeTopic.timeComplexity}</div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border space-y-1">
                          <div className="flex items-center gap-1.5 text-rf-meta text-[11px] font-semibold">
                            <HardDrive className="size-3 text-amber-400" />
                            <span>Typical Space Complexity</span>
                          </div>
                          <div className="font-mono text-emerald-400 text-xs font-bold">{activeTopic.spaceComplexity}</div>
                        </div>
                      </div>

                      {/* Pattern Blueprint (Pseudocode) */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-rf-cloud text-xs uppercase tracking-wider text-amber-400 font-mono">
                          Algorithmic Blueprint
                        </h4>
                        <pre className="p-3.5 rounded-xl bg-surface-container-lowest border border-border text-amber-300 font-mono text-[11.5px] overflow-x-auto leading-relaxed">
                          {activeTopic.blueprintPseudocode}
                        </pre>
                      </div>

                      {/* Worked Example */}
                      <div className="space-y-3 pt-2 border-t border-border">
                        <h4 className="font-semibold text-rf-cloud text-xs uppercase tracking-wider text-amber-400 font-mono">
                          Worked Example: {activeTopic.workedExample.title}
                        </h4>
                        <p className="text-rf-meta text-xs leading-relaxed">
                          {activeTopic.workedExample.walkthrough}
                        </p>
                        <pre className="p-3.5 rounded-xl bg-surface-container-lowest border border-border text-rf-cloud font-mono text-[11px] overflow-x-auto leading-relaxed">
                          {activeTopic.workedExample.code}
                        </pre>
                        <div className="space-y-1.5 pt-1">
                          <span className="font-semibold text-rf-cloud text-[11.5px]">Key Takeaways:</span>
                          <ul className="list-disc list-inside space-y-1 text-rf-meta text-[11px]">
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
                      <div className="text-rf-meta text-xs">
                        Stuck? Reveal hints step-by-step to steer your intuition without spoiling the full solution.
                      </div>

                      {/* Progressive Hints List */}
                      <div className="space-y-3">
                        {activeProblem.hints.map((hint) => {
                          const isOpen = unlockedHints.includes(hint.step);
                          return (
                            <div
                              key={hint.step}
                              className="rounded-xl border border-border bg-rf-surface/80 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleHint(hint.step)}
                                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-rf-elevated/60 transition"
                              >
                                <span className="font-semibold text-amber-300 text-xs flex items-center gap-2">
                                  <HelpCircle className="size-3.5 text-amber-400" />
                                  Hint {hint.step}: {hint.title}
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="size-3.5 text-rf-meta" />
                                ) : (
                                  <ChevronDown className="size-3.5 text-rf-meta" />
                                )}
                              </button>
                              {isOpen && (
                                <div className="px-3.5 py-3 border-t border-border bg-surface-container-lowest/60 text-rf-cloud text-xs leading-relaxed">
                                  {hint.content}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Solution Section */}
                      <div className="pt-4 border-t border-border space-y-3">
                        <button
                          type="button"
                          onClick={() => setShowSolution((prev) => !prev)}
                          data-testid="toggle-solution-btn"
                          className="w-full py-2.5 px-3 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition flex items-center justify-center gap-2"
                        >
                          <BookOpen className="size-3.5" />
                          <span>{showSolution ? "Hide Optimal Solution" : "Reveal Optimal Solution"}</span>
                        </button>

                        {showSolution && (
                          <div className="p-4 rounded-xl bg-surface-container-lowest border border-border space-y-3 text-xs animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rf-cloud">Approach: {activeProblem.solution.approach}</span>
                              <button
                                type="button"
                                onClick={handleCopySolution}
                                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline font-mono"
                              >
                                {copiedSolution ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                                <span>{copiedSolution ? "Copied" : "Copy Code"}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              <div className="p-2 rounded-lg bg-rf-surface border border-border text-rf-meta">
                                <span>Time: </span>
                                <span className="text-emerald-400 font-bold">{activeProblem.solution.timeComplexity}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-rf-surface border border-border text-rf-meta">
                                <span>Space: </span>
                                <span className="text-emerald-400 font-bold">{activeProblem.solution.spaceComplexity}</span>
                              </div>
                            </div>

                            <p className="text-rf-meta leading-relaxed">{activeProblem.solution.explanation}</p>

                            <pre className="p-3.5 rounded-xl bg-rf-surface border border-border text-emerald-300 font-mono text-[11px] overflow-x-auto">
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
              <div className="w-full lg:w-1/2 flex flex-col bg-surface-container-lowest overflow-hidden">
                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-h-[300px] overflow-hidden relative">
                  <div className="px-4 py-2 bg-rf-surface border-b border-border text-[11px] font-mono text-rf-meta flex items-center justify-between shrink-0">
                    <span className="text-rf-cloud font-semibold">Solution Editor ({selectedLanguage})</span>
                    <span className="text-rf-meta/70">Press Tab to indent</span>
                  </div>

                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const nextCode = code.substring(0, start) + "  " + code.substring(end);
                        setCode(nextCode);
                        setTimeout(() => {
                          if (textarea) {
                            textarea.selectionStart = textarea.selectionEnd = start + 2;
                          }
                        }, 0);
                      }
                    }}
                    data-testid="practice-code-editor"
                    spellCheck={false}
                    className="flex-1 w-full p-4 bg-surface-container-lowest text-rf-cloud font-mono text-[12.5px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 selection:bg-primary/20 border-none"
                    placeholder="// Write your solution here..."
                  />
                </div>

                {/* Console / Test Runner Bottom Sheet */}
                <div className="h-56 border-t border-border bg-rf-surface flex flex-col shrink-0 overflow-hidden">
                  {/* Console Tabs */}
                  <div className="flex items-center justify-between px-3 pt-2 bg-rf-surface border-b border-border shrink-0 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab("tests")}
                        data-testid="console-tab-tests"
                        className={cn(
                          "px-3 py-1 font-semibold rounded-t-md transition border-b-2 text-[11px]",
                          activeConsoleTab === "tests"
                            ? "border-primary text-primary bg-rf-elevated/70"
                            : "border-transparent text-rf-meta hover:text-rf-cloud"
                        )}
                      >
                        Sample Test Cases ({activeProblem.testCases.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveConsoleTab("output")}
                        data-testid="console-tab-output"
                        className={cn(
                          "px-3 py-1 font-semibold rounded-t-md transition border-b-2 text-[11px] flex items-center gap-1.5",
                          activeConsoleTab === "output"
                            ? "border-primary text-primary bg-rf-elevated/70"
                            : "border-transparent text-rf-meta hover:text-rf-cloud"
                        )}
                      >
                        <span>Execution Output</span>
                        {executionResult && (
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              executionResult.status === "PASS" ? "bg-emerald-400" : "bg-rose-400"
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
                        <span className="text-rf-meta">
                          {executionResult.passedTests}/{executionResult.totalTests} passed ({executionResult.executionTimeMs}ms)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Console Body */}
                  <div className="flex-1 overflow-y-auto p-3 text-xs font-mono bg-surface-container-lowest">
                    {activeConsoleTab === "tests" && (
                      <div className="space-y-2.5">
                        {activeProblem.testCases.map((tc, idx) => (
                          <div
                            key={tc.id}
                            className="p-2.5 rounded-lg bg-rf-surface border border-border text-[11.5px] space-y-1"
                          >
                            <div className="text-rf-meta font-semibold text-[10.5px]">Case {idx + 1}</div>
                            <div className="text-rf-cloud">
                              <span className="text-rf-meta">Input: </span>
                              {tc.inputDisplay}
                            </div>
                            <div className="text-emerald-400 font-semibold">
                              <span className="text-rf-meta">Expected: </span>
                              {tc.expectedDisplay}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeConsoleTab === "output" && (
                      <div className="space-y-2.5" data-testid="execution-results-container">
                        {!executionResult ? (
                          <div className="h-full flex items-center justify-center text-rf-meta text-center py-8">
                            Click &quot;Run Code&quot; to execute your solution against test cases.
                          </div>
                        ) : executionResult.error ? (
                          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 whitespace-pre-wrap">
                            {executionResult.error}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {executionResult.testResults.map((tr, idx) => (
                              <div
                                key={tr.testCaseId}
                                className={cn(
                                  "p-2.5 rounded-lg border text-[11.5px] space-y-1",
                                  tr.passed
                                    ? "bg-emerald-950/20 border-emerald-800/40 text-rf-cloud"
                                    : "bg-rose-950/20 border-rose-800/40 text-rf-cloud"
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
                                    <span className="text-[10px] text-rf-meta font-mono">{tr.executionTimeMs}ms</span>
                                  )}
                                </div>
                                <div className="text-rf-cloud">
                                  <span className="text-rf-meta">Input: </span>
                                  {tr.input}
                                </div>
                                <div>
                                  <span className="text-rf-meta">Expected: </span>
                                  <span className="text-emerald-400 font-semibold">{tr.expected}</span>
                                </div>
                                <div>
                                  <span className="text-rf-meta">Actual: </span>
                                  <span className={cn("font-semibold", tr.passed ? "text-emerald-400" : "text-rose-400")}>
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
            {/* Header Title using PageHeader */}
            <PageHeader
              eyebrow="TECHNICAL INTERVIEW & OA PREP"
              title="Algorithm Patterns & Problem Solving"
              description="Learn foundational algorithmic blueprints and intuitive patterns before writing code. Practice on curated problems asked in live assessments and interviews at top tech companies."
              statusBadge={
                <StatusPill
                  status="amber"
                  label={`${allProblems.length} Curated Problems`}
                />
              }
            />

            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl bg-rf-surface border border-border shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-rf-meta" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problems by title, pattern, or company (e.g. Two Sum, Amazon, DP)..."
                  className="w-full bg-surface-container-lowest border border-border rounded-lg pl-9 pr-8 py-1.5 text-xs text-rf-cloud placeholder:text-rf-meta/60 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Topic Selector */}
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="bg-surface-container-lowest border border-border rounded-lg px-2.5 py-1.5 text-xs text-rf-cloud focus:outline-none focus:border-primary font-sans"
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
                  className="bg-surface-container-lowest border border-border rounded-lg px-2.5 py-1.5 text-xs text-rf-cloud focus:outline-none focus:border-primary font-sans"
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
                  className="bg-surface-container-lowest border border-border rounded-lg px-2.5 py-1.5 text-xs text-rf-cloud focus:outline-none focus:border-primary font-sans"
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
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <BookOpen className="size-4" />
                  <span>Pattern Curriculum &amp; Intuition</span>
                </h2>
                <span className="text-xs font-mono text-rf-meta">{topics.length} core patterns</span>
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
                          ? "bg-primary/10 border-primary/60 shadow-lg shadow-primary/5"
                          : "bg-rf-surface border-border hover:border-slate-700 hover:bg-rf-elevated"
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-surface-container-lowest text-primary border border-border">
                              <IconComponent className="size-4" />
                            </div>
                            <h3 className="font-bold text-rf-cloud text-sm">{t.title}</h3>
                          </div>
                          <span className="text-[11px] font-mono text-rf-meta px-2 py-0.5 rounded bg-surface-container-lowest border border-border">
                            {problemCount} {problemCount === 1 ? "problem" : "problems"}
                          </span>
                        </div>
                        <p className="text-xs text-rf-meta leading-relaxed line-clamp-2">{t.overview}</p>
                      </div>

                      <div className="pt-2.5 border-t border-border flex items-center justify-between text-[11px] text-rf-meta font-mono">
                        <span>{t.timeComplexity.split(" ")[0]} time</span>
                        <span className="text-primary font-sans font-medium hover:underline">
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
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Code2 className="size-4" />
                  <span>Curated Practice Problems ({filteredProblems.length})</span>
                </h2>
              </div>

              {filteredProblems.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-rf-surface border border-border text-rf-meta space-y-2">
                  <p>No practice problems match the selected filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopicId("all");
                      setSelectedCompany("all");
                      setSelectedDifficulty("all");
                      setSearchQuery("");
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
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
                        className="p-4 rounded-xl bg-rf-surface border border-border hover:border-slate-700/80 hover:bg-rf-elevated/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="font-bold text-rf-cloud text-sm hover:text-primary transition">
                              {p.title}
                            </h3>
                            <span
                              className={cn(
                                "text-[10px] font-mono font-bold px-2 py-0.5 rounded",
                                p.difficulty === "Easy"
                                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                                  : p.difficulty === "Hard"
                                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                                  : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                              )}
                            >
                              {p.difficulty}
                            </span>
                            {topic && (
                              <span className="text-[11px] text-rf-meta font-medium px-2 py-0.5 rounded bg-surface-container-lowest border border-border">
                                {topic.title}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-rf-meta line-clamp-1">{p.summary}</p>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {p.companies.map((c) => (
                              <span
                                key={c}
                                className="px-1.5 py-0.5 rounded bg-surface-container-lowest border border-border text-[10px] text-amber-300 font-mono"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>

                        <CommandButton
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSelectProblem(p)}
                          data-testid={`practice-btn-${p.slug}`}
                          className="self-start sm:self-auto shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <span>Solve in Workspace</span>
                          <ExternalLink className="size-3.5" />
                        </CommandButton>
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
