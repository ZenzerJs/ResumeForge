"use client";

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
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
import { isSafeHref } from "@/lib/security/safe-url";
import {
  synthesizeStarInterviewPrep,
  formatStarStoryForClipboard,
  StarInterviewPrepResult,
  StarStory,
  EvidenceGrounding,
} from "@/lib/prep/star-synthesizer";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { readApiResponse } from "@/lib/api-error";
import { CompanyIntelDossierPanel } from "./company-intel-dossier-panel";
import { useRovingTablist } from "@/lib/hooks/use-roving-tablist";

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
const PREP_TABS: ReadonlyArray<PrepTab> = ["oa-mock", "star", "intel", "form", "cover"];

export function shouldFetchInterviewPrep(jobId: string | undefined, demoMode: boolean): boolean {
  if (demoMode) return false;
  const trimmed = jobId?.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("demo-sample-") || trimmed.startsWith("guest-job-") || trimmed === "sample") {
    return false;
  }
  return true;
}

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
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    portfolio: "",
  },
  evidenceItems,
  prepResult,
}: ApplyPrepSheetModalProps) {
  const [activeTab, setActiveTab] = useState<PrepTab>(initialTab);
  const { tablistRef: prepTablistRef, getTabProps: getPrepTabProps } = useRovingTablist(
    Math.max(0, PREP_TABS.indexOf(activeTab))
  );
  const [problemSearch, setProblemSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [oaProblems, setOaProblems] = useState<InterviewPrepProblem[]>([]);
  const [isFetchingOa, setIsFetchingOa] = useState(false);
  const [oaMatched, setOaMatched] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Ensure Escape closes this modal before any outer Sheet/Dialog DismissableLayer intercepts it.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (!job.id && !job.company) return;

    let cancelled = false;
    async function loadInterviewProblems() {
      setIsFetchingOa(true);
      try {
        const demoConfig = await fetchDemoConfig();
        if (cancelled) return;
        const jobId = job.id?.trim();
        if (!shouldFetchInterviewPrep(jobId, demoConfig?.demoMode === true)) {
          setOaProblems([]);
          setOaMatched(false);
          setIsFallback(false);
          return;
        }
        const endpoint = `/api/jobs/${encodeURIComponent(jobId!)}/interview-prep`;
        const res = await fetch(endpoint);
        const { ok, data: json } = await readApiResponse<{
          success?: boolean;
          problems?: InterviewPrepProblem[];
          matched?: boolean;
          isFallback?: boolean;
        }>(res);
        if (!cancelled && ok && json?.success) {
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

  const sanitizedCandidateInfo = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(candidateInfo).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
      ),
    [candidateInfo]
  );

  const starPrep: StarInterviewPrepResult = useMemo(() => {
    if (prepResult) return prepResult;
    return synthesizeStarInterviewPrep({
      job: {
        company: job.company,
        roleTitle: job.title,
        requirements: job.requirements,
      },
      evidenceItems: evidenceItems || [],
      candidateInfo: sanitizedCandidateInfo,
    });
  }, [prepResult, job, evidenceItems, sanitizedCandidateInfo]);

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
      "- **Cite the Exact Bullet:** Before each Resume Deep-Dive question, quote the exact tailored bullet you are targeting in a `>` blockquote so the candidate knows which claim is on trial.",
      "- **Include Expected Engineering Trade-offs:** Under each Resume Deep-Dive question, include a collapsible or bulleted *\"What a strong answer covers\"* checklist (e.g., idempotency keys, connection pooling under concurrency, hash collision / sandbox escape vectors) grounded in the candidate's actual tech stack.",
      "",
      "### OUTPUT (markdown, exactly these three sections)",
      "1. **Round 1 OA Simulator** — one problem from section 3, restated with input/output constraints and one worked example. Do not include the full solution.",
      "2. **Resume Deep-Dive** — two rigorous technical questions probing specific claims in the tailored bullets (concurrency safety, edge cases, metric validity).",
      "3. **STAR Cheat Sheet** — bulleted talking points drawn strictly from the candidate's verified project background provided above.",
    ].join("\n");
  }, [job, oaProblems, matchedHighlights]);

  const copyToClipboard = async (key: string, text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setFallbackText(null);
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 2000);
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
            className="border-status-success/45 text-status-success-soft bg-status-success/15 text-xs font-semibold gap-1"
          >
            <CheckCircle2 className="size-3 text-status-success" />
            <span>✓ Direct Verified Evidence</span>
          </Badge>
        );
      case "TRANSFERABLE":
        return (
          <Badge
            variant="outline"
            data-testid="grounding-badge-transferable"
            className="border-status-warning/40 text-status-warning bg-status-warning/15 text-xs font-semibold gap-1"
          >
            <Sparkles className="size-3 text-status-warning" />
            <span>~ Transferable Evidence</span>
          </Badge>
        );
      case "GAP":
        return (
          <Badge
            variant="outline"
            data-testid="grounding-badge-gap"
            className="border-status-danger/30 text-status-danger bg-status-danger/10 text-xs font-semibold gap-1"
          >
            <AlertCircle className="size-3 text-status-danger" />
            <span>✗ Unverified Gap — Mitigation Plan</span>
          </Badge>
        );
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        data-testid="apply-prep-sheet-modal"
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col gap-0 overflow-hidden rounded-[10px] border-hairline bg-panel p-0 text-foreground shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-hairline bg-elevated/60 px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-primary/15 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Application &amp; Interview Prep — {job.company}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {job.title}
              </DialogDescription>
            </div>
          </div>

          <DialogClose asChild>
            <button
              type="button"
              data-testid="close-prep-sheet-btn"
              className="rounded-[6px] p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Close prep sheet"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* Segmented Navigation Tabs */}
        <div
          ref={prepTablistRef}
          role="tablist"
          aria-label="Prep sheet sections"
          className="flex items-center gap-1 border-b border-hairline px-6 pt-3 pb-2 bg-inset/70 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "oa-mock"}
            {...getPrepTabProps(0)}
            onClick={() => setActiveTab("oa-mock")}
            data-testid="tab-oa-mock"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "oa-mock"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            )}
          >
            <Code2 className="size-3.5" aria-hidden="true" />
            <span>Technical Interview &amp; Practice Problems</span>
            {oaProblems.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-panel text-primary font-mono tabular-nums">
                {oaProblems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "star"}
            {...getPrepTabProps(1)}
            onClick={() => setActiveTab("star")}
            data-testid="tab-star-stories"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "star"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>STAR Behavioral Stories</span>
            {starPrep.stories.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-panel text-primary font-mono tabular-nums">
                {starPrep.stories.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "intel"}
            {...getPrepTabProps(2)}
            onClick={() => setActiveTab("intel")}
            data-testid="tab-intel-culture"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "intel"
                ? "bg-status-success text-contrast-ink font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            )}
          >
            <Building2 className="size-3.5" aria-hidden="true" />
            <span>Intel &amp; Culture</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "form"}
            {...getPrepTabProps(3)}
            onClick={() => setActiveTab("form")}
            data-testid="tab-form-highlights"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "form"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            )}
          >
            <User className="size-3.5" aria-hidden="true" />
            <span>Form Highlights &amp; Contact</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "cover"}
            {...getPrepTabProps(4)}
            onClick={() => setActiveTab("cover")}
            data-testid="tab-cover-letter"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 shrink-0",
              activeTab === "cover"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            )}
          >
            <FileText className="size-3.5" aria-hidden="true" />
            <span>Cover Letter Draft</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs space-y-6">
          {/* Clipboard Fallback Textarea */}
          {fallbackText && (
            <div
              data-testid="clipboard-fallback-container"
              className="p-3 rounded-lg bg-status-warning/15 border border-status-warning/40 text-xs text-status-warning space-y-2"
            >
              <div className="flex items-center justify-between">
                <div data-testid="clipboard-fallback-notice" className="font-semibold text-status-warning">
                  Copy unavailable — select and copy the text below.
                </div>
                <button
                  type="button"
                  onClick={() => setFallbackText(null)}
                  className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded bg-inset"
                >
                  Dismiss
                </button>
              </div>
              <textarea
                id="prep-clipboard-fallback"
                name="clipboardFallback"
                readOnly
                aria-label="Clipboard fallback text"
                value={fallbackText}
                data-testid="clipboard-fallback-textarea"
                className="w-full h-24 p-2 bg-inset border border-control/70 rounded-[6px] text-foreground font-mono text-xs select-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
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
                    ? "bg-status-success/15 border-status-success/35 text-status-success-soft"
                    : "bg-inset/80 border-hairline text-text-secondary"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <Code2 className="size-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground block">
                      {oaMatched && oaProblems.length > 0
                        ? `Real Interview & OA Problems for ${job.company}`
                        : `Technical Interview Practice Problems`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {oaMatched && oaProblems.length > 0
                        ? `Loaded ${oaProblems.length} verified assessment problems pulled directly from the Tech OA repository for ${job.company}.`
                        : `Showing curated technical interview questions from our 1,929+ problem repository.`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                  <Link
                    href={`/practice?${job.id ? `jobId=${encodeURIComponent(job.id)}&` : ""}company=${encodeURIComponent(job.company || "")}&role=${encodeURIComponent(job.title || "")}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-warning/15 hover:bg-status-warning/25 text-status-warning border border-status-warning/40 text-xs font-semibold transition"
                    title="Open in dedicated Practice Workspace"
                  >
                    <span>Full Practice Workspace</span>
                    <ExternalLink className="size-3" />
                  </Link>
                  {oaMatched && oaProblems.length > 0 ? (
                    <Badge variant="outline" className="border-status-success/45 bg-status-success/15 text-status-success-soft text-xs shrink-0">
                      ✓ Verified {job.company} Bank ({oaProblems.length})
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-hairline bg-elevated text-text-secondary text-xs shrink-0">
                      Curated Tech Repository
                    </Badge>
                  )}
                </div>
              </div>

              {/* Search & Category Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="prep-problem-search"
                    name="problemSearch"
                    type="text"
                    aria-label="Search practice problems"
                    value={problemSearch}
                    onChange={(e) => setProblemSearch(e.target.value)}
                    placeholder="Search practice problems by title, topic, or tag (e.g. DP, array, graph)..."
                    className="w-full bg-inset border border-control/70 rounded-[6px] pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:border-ring"
                  />
                  {problemSearch && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setProblemSearch("")}
                      className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden="true" />
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
                        "px-2.5 py-1 rounded text-xs font-mono transition-colors",
                        categoryFilter === cat
                          ? "bg-status-warning/15 border border-status-warning/40 text-status-warning font-bold"
                          : "bg-inset border border-hairline text-muted-foreground hover:text-foreground"
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
                  <h3 className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
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
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedKey === "all-oa-questions" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      Copy Problems List
                    </button>
                  )}
                </div>

                {isFetchingOa ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">Loading real interview problems from repository...</p>
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
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-inset/80 border border-hairline hover:border-control transition [content-visibility:auto] [contain-intrinsic-size:auto_180px]"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-foreground text-xs">{prob.title}</span>
                              <Badge variant="secondary" className="bg-elevated text-text-secondary border border-hairline text-xs">
                                {prob.category || "OA"}
                              </Badge>
                              {prob.difficulty && (
                                <span
                                  className={cn(
                                    "text-xs font-mono font-bold px-1.5 py-0.5 rounded",
                                    prob.difficulty.toLowerCase().includes("easy")
                                      ? "bg-status-success/15 text-status-success-soft border border-status-success/35"
                                      : prob.difficulty.toLowerCase().includes("hard")
                                      ? "bg-status-danger/10 text-status-danger border border-status-danger/30"
                                      : "bg-status-warning/15 text-status-warning border border-status-warning/40"
                                  )}
                                >
                                  {prob.difficulty}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {dateStr && (
                                <span className="font-mono text-muted-foreground">Observed: {dateStr}</span>
                              )}
                              {prob.tags && prob.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {prob.tags.map((t, i) => (
                                    <span key={i} className="px-1.5 py-0.2 rounded bg-elevated text-xs text-muted-foreground font-mono">
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-status-warning/15 hover:bg-status-warning/25 text-status-warning border border-status-warning/40 text-xs font-semibold transition"
                              title="Open problem in new tab to practice"
                            >
                              <span>Practice Problem</span>
                              <ExternalLink className="size-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`prob-${prob.id || idx}`, prob.title)}
                              className="p-1 rounded bg-elevated hover:bg-control/30 text-text-secondary hover:text-primary transition"
                              title="Copy problem title"
                            >
                              {copiedKey === `prob-${prob.id || idx}` ? (
                                <Check className="size-3.5 text-status-success" />
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
                  <div className="p-6 rounded-lg bg-inset/60 border border-hairline text-center text-muted-foreground space-y-2">
                    <p className="text-sm">No practice problems matching &quot;{problemSearch}&quot;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProblemSearch("");
                        setCategoryFilter("ALL");
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear search &amp; filters
                    </button>
                  </div>
                )}
              </div>

              {/* Section 2: Mock Interviewer Prompt Simulator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Mock Interviewer Copilot Simulator Prompt
                  </h3>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("mock-prompt", mockInterviewerPrompt)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "mock-prompt" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    Copy Full Prompt
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Copy this prompt into ChatGPT, Claude, or Gemini to run a realistic technical mock interview tailored to {job.company}&apos;s real assessment problems and your resume highlights.
                </p>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-hairline bg-inset p-3.5 font-mono text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
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
                  <h3 className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Verified STAR Stories &amp; Mitigations
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Grounded strictly in verified Evidence Bank items
                  </span>
                </div>

                {starPrep.stories.length > 0 ? (
                  <div className="space-y-3">
                    {starPrep.stories.map((story, idx) => (
                      <div
                        key={idx}
                        data-testid="star-story-card"
                        className="rounded-lg border border-hairline bg-inset/70 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {renderGroundingBadge(story.grounding)}
                              <span className="font-bold text-sm text-foreground">{story.requirement}</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
                              Source: {story.evidenceTitle}
                              {story.evidenceIds.length > 0 && (
                                <span className="ml-1 font-mono text-xs text-muted-foreground">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-elevated hover:bg-control/30 text-foreground border border-hairline text-xs transition-colors shrink-0"
                            title="Copy formatted story/mitigation to clipboard"
                          >
                            {copiedKey === `star-${idx}` ? (
                              <>
                                <Check className="size-3.5 text-status-success" />
                                <span className="text-status-success-soft">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5 text-primary" />
                                <span>Copy Text</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* If GAP: Render Honest Mitigation Plan Card */}
                        {story.grounding === "GAP" ? (
                          <div className="p-3 rounded-lg border border-status-danger/30 bg-status-danger/10 space-y-1.5">
                            <span className="font-bold text-status-danger uppercase tracking-wide text-xs block">
                              Honest Gap Mitigation Strategy
                            </span>
                            <p className="text-text-secondary leading-relaxed text-sm">
                              {story.mitigationPlan}
                            </p>
                          </div>
                        ) : (
                          /* If DIRECT or TRANSFERABLE: Render STAR Grid */
                          <div className="grid grid-cols-1 gap-2 pt-1 font-sans text-xs">
                            <div className="p-2.5 rounded bg-panel border border-hairline">
                              <span className="font-bold text-primary uppercase tracking-wide text-xs block mb-0.5">
                                S — Situation
                              </span>
                              <p className="text-sm text-text-secondary leading-relaxed">{story.situation}</p>
                            </div>

                            <div className="p-2.5 rounded bg-panel border border-hairline">
                              <span className="font-bold text-signal uppercase tracking-wide text-xs block mb-0.5">
                                T — Task
                              </span>
                              <p className="text-sm text-text-secondary leading-relaxed">{story.task}</p>
                            </div>

                            <div className="p-2.5 rounded bg-panel border border-hairline">
                              <span className="font-bold text-ember uppercase tracking-wide text-xs block mb-0.5">
                                A — Action
                              </span>
                              <p className="text-sm text-text-secondary leading-relaxed">{story.action}</p>
                            </div>

                            <div className="p-2.5 rounded bg-panel border border-hairline">
                              <span className="font-bold text-status-success uppercase tracking-wide text-xs block mb-0.5">
                                R — Result
                              </span>
                              <p className="text-sm text-text-secondary leading-relaxed">{story.result}</p>
                            </div>

                            {story.mitigationPlan && (
                              <div className="p-2.5 rounded bg-status-warning/15 border border-status-warning/40">
                                <span className="font-bold text-status-warning uppercase tracking-wide text-xs block mb-0.5">
                                  Transferable Bridge Strategy
                                </span>
                                <p className="text-sm text-status-warning/90 leading-relaxed">{story.mitigationPlan}</p>
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
                                className="px-2 py-0.5 rounded bg-elevated text-xs text-text-secondary border border-hairline"
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
                  <div className="p-4 rounded-lg bg-inset/60 border border-hairline text-center text-muted-foreground">
                    <p className="text-sm">No verified evidence items loaded yet. Add items to Evidence Bank in Library.</p>
                  </div>
                )}
              </div>

              {/* Section 2: Gap Mitigations */}
              {starPrep.gapMitigations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary" /> Gap Mitigation Strategies
                  </h3>
                  <div className="space-y-2">
                    {starPrep.gapMitigations.map((gap, idx) => (
                      <div
                        key={idx}
                        data-testid="gap-mitigation-card"
                        className="rounded-lg border border-status-warning/40 bg-status-warning/15 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-status-warning">Missing: {gap.requirement}</span>
                          {gap.transferableSkills.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Transferable: {gap.transferableSkills.join(", ")}
                            </span>
                          )}
                        </div>
                        <p className="text-text-secondary leading-relaxed text-sm">{gap.mitigationStrategy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Verified Talking Points */}
              {starPrep.talkingPoints.length > 0 && (
                <div className="space-y-3" data-testid="talking-points-container">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Key Verified Talking Points
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard("talking-points", starPrep.talkingPoints.join("\n- "))
                      }
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedKey === "talking-points" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      Copy All Points
                    </button>
                  </div>
                  <div className="rounded-lg border border-hairline bg-inset/70 p-3 space-y-2">
                    {starPrep.talkingPoints.map((tp, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-text-secondary leading-relaxed">
                        <ChevronRight className="size-3.5 text-primary shrink-0 mt-0.5" />
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
                <span className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Candidate Information
                </span>
                {Object.keys(sanitizedCandidateInfo).length === 0 ? (
                  <div className="rounded-lg border border-hairline bg-inset/70 p-3 text-muted-foreground">
                    Not found in resume
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-hairline bg-inset/70 p-3">
                    {Object.entries(sanitizedCandidateInfo).map(([key, val]) => {
                      const isCopied = copiedKey === `contact-${key}`;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 rounded bg-elevated px-2.5 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs uppercase text-muted-foreground block">{key}</span>
                            <span className="truncate text-foreground block">{val}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`contact-${key}`, val)}
                            className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors"
                            title={`Copy ${key}`}
                          >
                            {isCopied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Matched Highlights */}
              {matchedHighlights.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Top Evidence Highlights for Form Answers
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard("all-highlights", matchedHighlights.join("\n\n"))
                      }
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedKey === "all-highlights" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy All Bullets
                    </button>
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-hairline bg-inset/70 p-3">
                    {matchedHighlights.map((hl, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 rounded bg-elevated p-2 text-text-secondary"
                      >
                        <span className="flex-1 leading-relaxed">• {hl}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`hl-${idx}`, hl)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-primary"
                          title="Copy bullet point"
                        >
                          {copiedKey === `hl-${idx}` ? (
                            <Check className="h-3.5 w-3.5 text-status-success" />
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
                <span className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Tailored Cover Letter Draft
                </span>
                {coverLetter && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard("cover-letter", coverLetter)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {copiedKey === "cover-letter" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy Full Letter
                  </button>
                )}
              </div>

              {coverLetter ? (
                <div className="max-h-80 overflow-y-auto rounded-lg border border-hairline bg-inset/70 p-4 text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {coverLetter}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-inset/60 border border-hairline text-center text-muted-foreground">
                  <p className="text-sm">No cover letter draft generated for this job application yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hairline px-6 py-3 bg-inset/70">
          <span className="text-xs text-muted-foreground">Ready to submit application</span>
          <div className="flex items-center gap-2">
            {job.applyUrl && isSafeHref(job.applyUrl) && (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="prep-sheet-open-portal-btn"
                className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Job Portal
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
