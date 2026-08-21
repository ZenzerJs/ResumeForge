"use client";

import React, { useState, useMemo } from "react";
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

export interface ApplyPrepSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    company: string;
    title: string;
    applyUrl?: string | null;
    location?: string | null;
    notes?: string | null;
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

type PrepTab = "star" | "form" | "cover";

export function ApplyPrepSheetModal({
  isOpen,
  onClose,
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
  const [activeTab, setActiveTab] = useState<PrepTab>("star");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);

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
        <div className="flex items-center gap-1 border-b border-slate-800 px-6 pt-3 pb-2 bg-slate-900/30">
          <button
            type="button"
            onClick={() => setActiveTab("star")}
            data-testid="tab-star-stories"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "star"
                ? "bg-amber-500 text-slate-950"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <Sparkles className="size-3.5" />
            <span>STAR Stories &amp; Talking Points</span>
            {starPrep.stories.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-300 font-mono">
                {starPrep.stories.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            data-testid="tab-form-highlights"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "form"
                ? "bg-amber-500 text-slate-950"
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
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "cover"
                ? "bg-amber-500 text-slate-950"
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

          {/* TAB 1: STAR Stories & Talking Points */}
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
