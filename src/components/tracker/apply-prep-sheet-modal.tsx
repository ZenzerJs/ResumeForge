"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Briefcase,
  ExternalLink,
  User,
  FileText,
  Sparkles,
  ClipboardList,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Code2,
  Terminal,
  Building2,
  Search,
} from "lucide-react";
import { isSafeHref } from "@/lib/security/safe-fetch";
import {
  synthesizeStarInterviewPrep,
  formatStarStoryForClipboard,
  StarInterviewPrepResult,
  StarStory,
  EvidenceGrounding,
} from "@/lib/prep/star-synthesizer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CompanyIntelDossierPanel } from "./company-intel-dossier-panel";

export interface ApplyPrepSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PrepTab;
  job: {
    id?: string;
    company: string;
    title: string;
    applyUrl?: string | null;
    location?: string | null;
    notes?: string | null;
    rawDescription?: string | null;
    requirements?: {
      requiredSkills?: string[];
      preferredSkills?: string[];
      domainTerms?: string[];
    } | null;
  };
  coverLetter?: string | null;
  matchedHighlights?: string[];
  candidateInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  evidenceItems?: any[];
  prepResult?: StarInterviewPrepResult;
}

export type PrepTab = "oa-mock" | "star" | "intel" | "form" | "cover";

export interface InterviewPrepProblem {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  difficulty?: string | null;
  sourceUrl?: string | null;
  lastObserved?: string | null;
}

export function ApplyPrepSheetModal({
  isOpen,
  onClose,
  initialTab = "oa-mock",
  job,
  coverLetter,
  matchedHighlights = [],
  candidateInfo = {
    name: "Candidate",
    email: "candidate@resumeforge.dev",
    phone: "+1 (555) 019-2834",
    linkedin: "https://linkedin.com/in/candidate",
    github: "https://github.com/candidate",
    portfolio: "https://candidate.dev",
  },
  evidenceItems,
  prepResult,
}: ApplyPrepSheetModalProps) {
  const [activeTab, setActiveTab] = useState<PrepTab>(initialTab);
  const [problemSearch, setProblemSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [oaProblems, setOaProblems] = useState<InterviewPrepProblem[]>([]);
  const [isFetchingOa, setIsFetchingOa] = useState(false);
  const [oaMatched, setOaMatched] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    if (!job.id && !job.company) return;

    let cancelled = false;
    async function loadInterviewProblems() {
      setIsFetchingOa(true);
      try {
        const endpoint = job.id
          ? `/api/jobs/${job.id}/interview-prep`
          : `/api/jobs/sample/interview-prep`;
        const res = await fetch(endpoint);
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setOaProblems(json.problems || []);
          setOaMatched(Boolean(json.matched));
          setIsFallback(Boolean(json.isFallback));
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) setIsFetchingOa(false);
      }
    }
    void loadInterviewProblems();
    return () => {
      cancelled = true;
    };
  }, [isOpen, job.id, job.company]);

  const filteredProblems = useMemo(() => {
    return oaProblems.filter((p) => {
      if (categoryFilter !== "ALL") {
        const cat = (p.category || "OA").toUpperCase();
        if (categoryFilter === "OA" && !cat.includes("OA")) return false;
        if (categoryFilter === "PHONE" && !cat.includes("PHONE") && !cat.includes("SCREEN")) return false;
        if (categoryFilter === "ONSITE" && !cat.includes("ONSITE") && !cat.includes("DESIGN")) return false;
      }
      if (problemSearch.trim()) {
        const q = problemSearch.toLowerCase().trim();
        const inTitle = p.title.toLowerCase().includes(q);
        const inCat = (p.category || "").toLowerCase().includes(q);
        const inTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inCat && !inTags) return false;
      }
      return true;
    });
  }, [oaProblems, categoryFilter, problemSearch]);

  const starPrep: StarInterviewPrepResult = useMemo(() => {
    if (prepResult) return prepResult;
    return synthesizeStarInterviewPrep({
      job: {
        company: job.company,
        roleTitle: job.title,
        requirements: job.requirements,
      },
      evidenceItems: evidenceItems || [],
      candidateInfo,
    });
  }, [prepResult, job, evidenceItems, candidateInfo]);

  const mockInterviewerPrompt = useMemo(() => {
    const matchedProblemsStr =
      oaProblems.length > 0
        ? oaProblems
            .map((p) => {
              const dateStr = p.lastObserved
                ? ` (Observed: ${new Date(p.lastObserved).toLocaleDateString("en-US", { month: "short", year: "numeric" })})`
                : "";
              const srcStr = p.sourceUrl ? ` [Source: ${p.sourceUrl}]` : "";
              return `- ${p.title}${dateStr}${srcStr}`;
            })
            .join("\n")
        : "";

    const bulletsStr =
      matchedHighlights.length > 0
        ? matchedHighlights.map((b) => `- ${b}`).join("\n")
        : "No customized bullet diffs recorded.";

    return [
      `You are a Staff Software Engineer and Technical Interviewer at ${job.company || "Target Company"} interviewing a candidate for ${job.title || "Target Role"}.`,
      "",
      "### CONTEXT",
      "1. Target Job Description:",
      job.rawDescription || job.notes || "Software Engineering role.",
      "",
      "2. Tailored Bullets (what the candidate emphasizes for this company):",
      bulletsStr,
      "",
      `3. Known ${job.company || "Company"} Technical Problem Trends (real, recently observed):`,
      matchedProblemsStr || "No company-specific problems on file (state generic fallback).",
      "",
      "### RULES",
      `- ONLY use problems from section 3 for the OA simulator. Never invent a "historical" problem. If section 3 is empty, state that no company-specific problems are on file and instead pick ONE classic problem that exercises the top skill keyword in the job description — clearly labeled as a generic fallback.`,
      "- Probe claims, don't flatter them. If a bullet cites a metric (latency %, QPS, scale, users), ask how it was measured and what breaks at 10x scale.",
      "",
      "### OUTPUT (markdown, exactly these three sections)",
      "1. **Round 1 OA Simulator** — one problem from section 3, restated with input/output constraints and one worked example. Do not include the full solution.",
      "2. **Resume Deep-Dive** — two rigorous technical questions probing specific claims in the tailored bullets (concurrency safety, edge cases, metric validity).",
      "3. **STAR Cheat Sheet** — bulleted talking points drawn strictly from the candidate's verified project background provided above.",
    ].join("\n");
  }, [job, oaProblems, matchedHighlights]);

  if (!isOpen) return null;

  const copyToClipboard = async (key: string, text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setFallbackText(null);
        setTimeout(() => setCopiedKey(null), 2000);
      } else {
        setFallbackText(text);
        setCopiedKey(null);
      }
    } catch {
      setFallbackText(text);
      setCopiedKey(null);
    }
  };

  const renderGroundingBadge = (grounding: EvidenceGrounding) => {
    switch (grounding) {
      case "DIRECT":
        return (
          <Badge
            variant="outline"
            data-testid="grounding-badge-direct"
            className="border-emerald-500/60 text-emerald-300 bg-emerald-950/40 text-[10px] font-semibold gap-1"
          >
            <CheckCircle2 className="size-3 text-emerald-400" />
            <span>✓ Direct Verified Evidence</span>
          </Badge>
        );
      case "TRANSFERABLE":
        return (
          <Badge
            variant="outline"
            data-testid="grounding-badge-transferable"
            className="border-amber-500/60 text-amber-300 bg-amber-950/40 text-[10px] font-semibold gap-1"
          >
            <Sparkles className="size-3 text-amber-400" />
            <span>~ Transferable Evidence</span>
          </Badge>
        );
      case "GAP":
        return (
          <Badge
            variant="outline"
            data-testid="grounding-badge-gap"
            className="border-red-500/60 text-red-300 bg-red-950/40 text-[10px] font-semibold gap-1"
          >
            <AlertCircle className="size-3 text-red-400" />
            <span>✗ Unverified Gap — Mitigation Plan</span>
          </Badge>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      data-testid="apply-prep-sheet-modal"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-[#0b1326] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Application &amp; Interview Prep — {job.company}
              </h2>
              <p className="text-xs text-slate-400">{job.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-prep-sheet-btn"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close prep sheet"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800 px-6 pt-3 pb-2 bg-slate-900/30 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("oa-mock")}
            data-testid="tab-oa-mock"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "oa-mock"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <Code2 className="size-3.5" />
            <span>Technical Interview &amp; Practice Problems</span>
            {oaProblems.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-300 font-mono">
                {oaProblems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("star")}
            data-testid="tab-star-stories"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "star"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <Sparkles className="size-3.5" />
            <span>STAR Behavioral Stories</span>
            {starPrep.stories.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-300 font-mono">
                {starPrep.stories.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("intel")}
            data-testid="tab-intel-culture"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "intel"
                ? "bg-emerald-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <Building2 className="size-3.5" />
            <span>Intel &amp; Culture</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            data-testid="tab-form-highlights"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "form"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <User className="size-3.5" />
            <span>Form Highlights &amp; Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cover")}
            data-testid="tab-cover-letter"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "cover"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <FileText className="size-3.5" />
            <span>Cover Letter Draft</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs space-y-6">
          {/* Clipboard Fallback Textarea */}
          {fallbackText && (
            <div
              data-testid="clipboard-fallback-container"
              className="p-3 rounded-lg bg-amber-950/70 border border-amber-800 text-xs text-amber-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div data-testid="clipboard-fallback-notice" className="font-semibold text-amber-300">
                  Copy unavailable — select and copy the text below.
                </div>
                <button
                  type="button"
                  onClick={() => setFallbackText(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-900"
                >
                  Dismiss
                </button>
              </div>
              <textarea
                readOnly
                value={fallbackText}
                data-testid="clipboard-fallback-textarea"
                className="w-full h-24 p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-[11px] select-all focus:outline-none"
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}

          {/* TAB: Technical Interview & Practice Problems */}
          {activeTab === "oa-mock" && (
            <div className="space-y-6" data-testid="oa-mock-panel">
              {/* Status Header Banner */}
              <div
                className={cn(
                  "p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
                  oaMatched && oaProblems.length > 0
                    ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                    : "bg-slate-900/80 border-slate-800 text-slate-300"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <Code2 className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-100 block">
                      {oaMatched && oaProblems.length > 0
                        ? `Real Interview & OA Problems for ${job.company}`
                        : `Technical Interview Practice Problems`}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {oaMatched && oaProblems.length > 0
                        ? `Loaded ${oaProblems.length} verified assessment problems pulled directly from the Tech OA repository for ${job.company}.`
                        : `Showing curated technical interview questions from our 1,929+ problem repository.`}
                    </span>
                  </div>
                </div>

                {oaMatched && oaProblems.length > 0 ? (
                  <Badge variant="outline" className="border-emerald-500/50 bg-emerald-950/60 text-emerald-300 text-[10px] shrink-0 self-start sm:self-auto">
                    ✓ Verified {job.company} Bank ({oaProblems.length})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-700 bg-slate-800/80 text-slate-300 text-[10px] shrink-0 self-start sm:self-auto">
                    Curated Tech Repository
                  </Badge>
                )}
              </div>

              {/* Search & Category Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={problemSearch}
                    onChange={(e) => setProblemSearch(e.target.value)}
                    placeholder="Search practice problems by title, topic, or tag (e.g. DP, array, graph)..."
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {problemSearch && (
                    <button
                      type="button"
                      onClick={() => setProblemSearch("")}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {(["ALL", "OA", "PHONE", "ONSITE"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        "px-2.5 py-1 rounded text-[11px] font-mono transition-colors",
                        categoryFilter === cat
                          ? "bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold"
                          : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                      )}
                    >
                      {cat === "ALL" ? "All Types" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* List of Recent Leaked / Observed Problems */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Practice Problems ({filteredProblems.length})
                  </h3>
                  {filteredProblems.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          "all-oa-questions",
                          filteredProblems
                            .map((p) => `- ${p.title} (${p.category || "OA"})${p.sourceUrl ? ` [Link: ${p.sourceUrl}]` : ""}`)
                            .join("\n")
                        )
                      }
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === "all-oa-questions" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      Copy Problems List
                    </button>
                  )}
                </div>

                {isFetchingOa ? (
                  <div className="p-8 text-center text-slate-400">
                    <p>Loading real interview problems from repository...</p>
                  </div>
                ) : filteredProblems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredProblems.map((prob, idx) => {
                      const dateStr = prob.lastObserved
                        ? new Date(prob.lastObserved).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                        : null;
                      const practiceUrl =
                        prob.sourceUrl && isSafeHref(prob.sourceUrl)
                          ? prob.sourceUrl
                          : `https://www.google.com/search?q=${encodeURIComponent(`${job.company} ${prob.title} leetcode interview problem`)}`;

                      return (
                        <div
                          key={prob.id || idx}
                          data-testid="oa-problem-card"
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-100 text-xs">{prob.title}</span>
                              <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px]">
                                {prob.category || "OA"}
                              </Badge>
                              {prob.difficulty && (
                                <span
                                  className={cn(
                                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                                    prob.difficulty.toLowerCase().includes("easy")
                                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                                      : prob.difficulty.toLowerCase().includes("hard")
                                      ? "bg-red-950/80 text-red-400 border border-red-800/60"
                                      : "bg-amber-950/80 text-amber-400 border border-amber-800/60"
                                  )}
                                >
                                  {prob.difficulty}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              {dateStr && (
                                <span className="font-mono text-slate-500">Observed: {dateStr}</span>
                              )}
                              {prob.tags && prob.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {prob.tags.map((t, i) => (
                                    <span key={i} className="px-1.5 py-0.2 rounded bg-slate-800/80 text-[10px] text-slate-400 font-mono">
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <a
                              href={practiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                              title="Open problem in new tab to practice"
                            >
                              <span>Practice Problem</span>
                              <ExternalLink className="size-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`prob-${prob.id || idx}`, prob.title)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition"
                              title="Copy problem title"
                            >
                              {copiedKey === `prob-${prob.id || idx}` ? (
                                <Check className="size-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-slate-400 space-y-2">
                    <p>No practice problems matching &quot;{problemSearch}&quot;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProblemSearch("");
                        setCategoryFilter("ALL");
                      }}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Clear search &amp; filters
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Mock Interviewer Prompt Simulator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Mock Interviewer Copilot Simulator Prompt
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("mock-prompt", mockInterviewerPrompt)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "mock-prompt" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    Copy Full Prompt
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Copy this prompt into ChatGPT, Claude, or Gemini to run a realistic technical mock interview tailored to {job.company}&apos;s real assessment problems and your resume highlights.
                </p>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/90 p-3.5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {mockInterviewerPrompt}
                </div>
              </div>
            </div>
          )}

          {/* TAB: STAR Stories & Talking Points */}
          {activeTab === "star" && (
            <div className="space-y-6">
              {/* Section 1: STAR Stories */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Verified STAR Stories &amp; Mitigations
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Grounded strictly in verified Evidence Bank items
                  </span>
                </div>

                {starPrep.stories.length > 0 ? (
                  <div className="space-y-3">
                    {starPrep.stories.map((story, idx) => (
                      <div
                        key={idx}
                        data-testid="star-story-card"
                        className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {renderGroundingBadge(story.grounding)}
                              <span className="font-bold text-sm text-white">{story.requirement}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">
                              Source: {story.evidenceTitle}
                              {story.evidenceIds.length > 0 && (
                                <span className="ml-1 font-mono text-[10px] text-slate-500">
                                  ({story.evidenceIds.join(", ")})
                                </span>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(`star-${idx}`, formatStarStoryForClipboard(story))
                            }
                            data-testid="copy-star-story-btn"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] transition-colors shrink-0"
                            title="Copy formatted story/mitigation to clipboard"
                          >
                            {copiedKey === `star-${idx}` ? (
                              <>
                                <Check className="size-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5 text-amber-400" />
                                <span>Copy Text</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* If GAP: Render Honest Mitigation Plan Card */}
                        {story.grounding === "GAP" ? (
                          <div className="p-3 rounded-lg border border-red-900/40 bg-red-950/20 space-y-1.5">
                            <span className="font-bold text-red-300 uppercase tracking-wide text-[10px] block">
                              Honest Gap Mitigation Strategy
                            </span>
                            <p className="text-slate-300 leading-relaxed text-xs">
                              {story.mitigationPlan}
                            </p>
                          </div>
                        ) : (
                          /* If DIRECT or TRANSFERABLE: Render STAR Grid */
                          <div className="grid grid-cols-1 gap-2 pt-1 font-sans text-xs">
                            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                              <span className="font-bold text-amber-400 uppercase tracking-wide text-[10px] block mb-0.5">
                                S — Situation
                              </span>
                              <p className="text-slate-300 leading-relaxed">{story.situation}</p>
                            </div>

                            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                              <span className="font-bold text-blue-400 uppercase tracking-wide text-[10px] block mb-0.5">
                                T — Task
                              </span>
                              <p className="text-slate-300 leading-relaxed">{story.task}</p>
                            </div>

                            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                              <span className="font-bold text-indigo-400 uppercase tracking-wide text-[10px] block mb-0.5">
                                A — Action
                              </span>
                              <p className="text-slate-300 leading-relaxed">{story.action}</p>
                            </div>

                            <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                              <span className="font-bold text-emerald-400 uppercase tracking-wide text-[10px] block mb-0.5">
                                R — Result
                              </span>
                              <p className="text-slate-300 leading-relaxed">{story.result}</p>
                            </div>

                            {story.mitigationPlan && (
                              <div className="p-2.5 rounded bg-amber-950/30 border border-amber-900/50">
                                <span className="font-bold text-amber-300 uppercase tracking-wide text-[10px] block mb-0.5">
                                  Transferable Bridge Strategy
                                </span>
                                <p className="text-amber-200/90 leading-relaxed">{story.mitigationPlan}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Technologies */}
                        {story.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {story.technologies.map((t, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-slate-400">
                    <p>No verified evidence items loaded yet. Add items to Evidence Bank in Library.</p>
                  </div>
                )}
              </div>

              {/* Section 2: Gap Mitigations */}
              {starPrep.gapMitigations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Gap Mitigation Strategies
                  </h3>
                  <div className="space-y-2">
                    {starPrep.gapMitigations.map((gap, idx) => (
                      <div
                        key={idx}
                        data-testid="gap-mitigation-card"
                        className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-300">Missing: {gap.requirement}</span>
                          {gap.transferableSkills.length > 0 && (
                            <span className="text-[10px] text-slate-400">
                              Transferable: {gap.transferableSkills.join(", ")}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs">{gap.mitigationStrategy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Verified Talking Points */}
              {starPrep.talkingPoints.length > 0 && (
                <div className="space-y-3" data-testid="talking-points-container">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Key Verified Talking Points
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard("talking-points", starPrep.talkingPoints.join("\n- "))
                      }
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === "talking-points" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      Copy All Points
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                    {starPrep.talkingPoints.map((tp, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-300 leading-relaxed">
                        <ChevronRight className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{tp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Intel & Culture Dossier */}
          {activeTab === "intel" && (
            <div className="space-y-4" data-testid="intel-culture-panel">
              <CompanyIntelDossierPanel company={job.company} jobTitle={job.title} />
            </div>
          )}

          {/* TAB 2: Form Highlights & Contact */}
          {activeTab === "form" && (
            <div className="space-y-5">
              {/* Contact Info */}
              <div className="space-y-2">
                <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Candidate Information
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  {Object.entries(candidateInfo).map(([key, val]) => {
                    if (!val) return null;
                    const isCopied = copiedKey === `contact-${key}`;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-2 rounded bg-slate-800/60 px-2.5 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase text-slate-500 block">{key}</span>
                          <span className="truncate text-slate-200 block">{val}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`contact-${key}`, val)}
                          className="shrink-0 p-1 text-slate-400 hover:text-amber-400 transition-colors"
                          title={`Copy ${key}`}
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Matched Highlights */}
              {matchedHighlights.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Top Evidence Highlights for Form Answers
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard("all-highlights", matchedHighlights.join("\n\n"))
                      }
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === "all-highlights" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy All Bullets
                    </button>
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    {matchedHighlights.map((hl, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 rounded bg-slate-800/40 p-2 text-slate-300"
                      >
                        <span className="flex-1 leading-relaxed">• {hl}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`hl-${idx}`, hl)}
                          className="shrink-0 p-1 text-slate-400 hover:text-amber-400"
                          title="Copy bullet point"
                        >
                          {copiedKey === `hl-${idx}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Cover Letter Draft */}
          {activeTab === "cover" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Tailored Cover Letter Draft
                </span>
                {coverLetter && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard("cover-letter", coverLetter)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "cover-letter" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy Full Letter
                  </button>
                )}
              </div>

              {coverLetter ? (
                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {coverLetter}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-slate-400">
                  <p>No cover letter draft generated for this job application yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-900/60">
          <span className="text-[11px] text-slate-500">Ready to submit application</span>
          <div className="flex items-center gap-2">
            {job.applyUrl && isSafeHref(job.applyUrl) && (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="prep-sheet-open-portal-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Job Portal
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
