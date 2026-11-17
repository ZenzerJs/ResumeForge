"use client";

import React, { useEffect, useState } from "react";
import { ALL_QUESTIONS, COMPANY_LOGOS } from "../../lib/interview/questionDatabase";
import { InterviewQuestion, InterviewTrack } from "../../lib/schema/interviewPrep";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CompanyBadge, getCompanyLogo } from "./company-logos";
import { BrandIcon, hasBrandIcon } from "../design-system/brand-icon";

export interface InterviewHubProps {
  onSolveInRunner?: (slug: string) => void;
  targetCompany?: string;
}

export function InterviewHub({ onSolveInRunner, targetCompany }: InterviewHubProps = {}) {
  const [track, setTrack] = useState<InterviewTrack | "all">("all");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard" | "all">("all");
  const [company, setCompany] = useState<string | "all">("all");
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);

  useEffect(() => {
    if (!targetCompany) {
      setCompany("all");
      return;
    }
    const norm = targetCompany.trim().toLowerCase();
    const matched = COMPANY_LOGOS.find(
      (c) =>
        c.slug.toLowerCase() === norm ||
        c.name.toLowerCase() === norm ||
        norm.includes(c.slug.toLowerCase()) ||
        norm.includes(c.name.toLowerCase())
    );
    if (matched) {
      setCompany(matched.slug);
    } else {
      setCompany("all");
    }
  }, [targetCompany]);

  const TRACK_FILTERS: ReadonlyArray<{ id: InterviewTrack | "all"; label: string }> = [
    { id: "all", label: "All Tracks" },
    { id: "algorithms", label: "Algorithms (NeetCode 150)" },
    { id: "system_design", label: "System Design" },
    { id: "oa_screening", label: "OA Screening" },
  ];
  const DIFFICULTY_FILTERS: ReadonlyArray<"all" | "Easy" | "Medium" | "Hard"> = [
    "all",
    "Easy",
    "Medium",
    "Hard",
  ];

  const filteredQuestions = ALL_QUESTIONS.filter(q => {
    if (track !== "all" && q.track !== track) return false;
    if (difficulty !== "all" && q.difficulty !== difficulty) return false;
    if (company !== "all" && !q.companyTags.includes(company)) return false;
    return true;
  });

  const getDifficultyBadgeColor = (diff: string) => {
    switch (diff) {
      case "Easy": return "bg-status-success/10 text-status-success border-status-success/30";
      case "Medium": return "bg-status-warning/10 text-status-warning border-status-warning/30";
      case "Hard": return "bg-status-danger/10 text-status-danger border-status-danger/30";
      default: return "bg-elevated text-text-secondary border-border";
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Filter Controls */}
      <div className="space-y-3 p-4 bg-card border border-border rounded-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Track Filters */}
          <div className="flex flex-wrap gap-1.5">
            {TRACK_FILTERS.map(t => (
              <button
                key={t.id}
                onClick={() => setTrack(t.id)}
                className={`min-h-11 sm:min-h-0 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  track === t.id
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border bg-elevated/60 hover:bg-elevated text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Difficulty Filters */}
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTY_FILTERS.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`min-h-11 sm:min-h-0 px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  difficulty === d
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border bg-elevated/60 hover:bg-elevated text-muted-foreground hover:text-foreground"
                }`}
              >
                {d === "all" ? "All Levels" : d}
              </button>
            ))}
          </div>
        </div>

        {/* Company Filter Pills */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex-shrink-0">
              Company:
            </span>
            <button
              onClick={() => setCompany("all")}
              className={`min-h-11 sm:min-h-0 px-2.5 py-1 rounded-[6px] text-xs transition-colors flex-shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                company === "all"
                  ? "bg-primary/15 text-primary border-primary/40 font-semibold"
                  : "bg-elevated/60 text-muted-foreground hover:text-foreground border-border hover:bg-elevated"
              }`}
            >
              All Companies
            </button>
            {COMPANY_LOGOS.map(c => {
              const isSelected = company === c.slug;
              return (
                <button
                  key={c.slug}
                  onClick={() => setCompany(isSelected ? "all" : c.slug)}
                  className={`inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs transition-colors flex-shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isSelected
                      ? "bg-primary/15 text-primary border-primary/40 font-semibold"
                      : "bg-elevated/60 text-muted-foreground hover:text-foreground border-border hover:bg-elevated"
                  }`}
                >
                  {getCompanyLogo(c.slug, "w-3.5 h-3.5 flex-shrink-0 grayscale")}
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuestions.map(q => (
          <div 
            key={q.id} 
            className="group flex flex-col justify-between rounded-[10px] surface-raised card-lift p-4 text-foreground cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_132px]"
            onClick={() => setSelectedQuestion(q)}
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-semibold text-base text-foreground transition-colors line-clamp-1">
                  {q.title}
                </h3>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getDifficultyBadgeColor(q.difficulty)}`}>
                  {q.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-on-surface-variant">
                  {hasBrandIcon(q.category) && <BrandIcon name={q.category} className="h-3.5 w-3.5 shrink-0" />}
                  {q.category}
                </span>
                <span>•</span>
                <span>{q.sourceSet}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 mt-auto">
              <div className="flex flex-wrap gap-1.5">
                {q.companyTags.map(tag => {
                  const comp = COMPANY_LOGOS.find(c => c.slug === tag);
                  const logo = getCompanyLogo(tag, "w-3 h-3 flex-shrink-0 grayscale");
                  return (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px] text-on-surface-variant"
                    >
                      {logo ?? (hasBrandIcon(tag) ? <BrandIcon name={tag} className="h-3 w-3 shrink-0" /> : null)}
                      <span>{comp?.name || tag}</span>
                    </span>
                  );
                })}
              </div>
              {q.timeComplexity && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {q.timeComplexity}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-[10px] bg-card/50">
          <p className="text-base font-semibold text-foreground">No questions found</p>
          <p className="text-sm text-muted-foreground mt-1">Try resetting or loosening the active company or track filters.</p>
          <button
            onClick={() => { setTrack("all"); setDifficulty("all"); setCompany("all"); }}
            className="mt-4 px-4 py-2 border border-outline text-foreground text-xs font-semibold rounded-[6px] hover:bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Problem Detail Modal */}
      <Dialog
        open={Boolean(selectedQuestion)}
        onOpenChange={(open) => {
          if (!open) setSelectedQuestion(null);
        }}
      >
        <DialogContent
          hideCloseButton
          className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[90dvh] space-y-5 overflow-y-auto overscroll-contain rounded-[10px] border-hairline bg-panel p-4 sm:p-6 text-foreground shadow-2xl"
        >
          {selectedQuestion ? (
            <>
              <DialogHeader className="flex flex-row items-start justify-between gap-4 space-y-0 border-b border-hairline pb-4 text-left">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getDifficultyBadgeColor(selectedQuestion.difficulty)}`}>
                      {selectedQuestion.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground">• {selectedQuestion.category}</span>
                  </div>
                  <DialogTitle className="text-xl font-bold text-foreground text-balance md:text-2xl">
                    {selectedQuestion.title}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    {selectedQuestion.sourceSet}
                  </DialogDescription>
                </div>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 items-center justify-center rounded-[6px] sm:p-1.5 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                </DialogClose>
              </DialogHeader>
            
            {/* Associated Companies with SVG Badges */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Interviewed At</h4>
              <div className="flex flex-wrap gap-2">
                {selectedQuestion.companyTags.map(tag => {
                  const logo = COMPANY_LOGOS.find(c => c.slug === tag);
                  return (
                    <CompanyBadge key={tag} slug={tag} name={logo?.name} />
                  );
                })}
              </div>
            </div>

            {/* Constraints & Complexity */}
            {(selectedQuestion.timeComplexity || selectedQuestion.spaceComplexity || selectedQuestion.constraints) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-inset border border-border rounded-[10px] text-xs">
                {selectedQuestion.timeComplexity && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Time Complexity:</span>
                    <p className="font-mono text-foreground font-semibold mt-0.5">{selectedQuestion.timeComplexity}</p>
                  </div>
                )}
                {selectedQuestion.spaceComplexity && (
                  <div>
                    <span className="text-muted-foreground font-semibold">Space Complexity:</span>
                    <p className="font-mono text-foreground font-semibold mt-0.5">{selectedQuestion.spaceComplexity}</p>
                  </div>
                )}
                {selectedQuestion.constraints && selectedQuestion.constraints.length > 0 && (
                  <div className="col-span-1 sm:col-span-2 pt-2 border-t border-border">
                    <span className="text-muted-foreground font-semibold">Constraints:</span>
                    <ul className="list-disc list-inside mt-0.5 text-on-surface-variant space-y-0.5">
                      {selectedQuestion.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Rubric Guide */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Discussion Rubric & Key Points</h4>
              <div className="p-3.5 bg-inset border border-border rounded-[10px] text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap font-sans">
                {selectedQuestion.rubricGuide}
              </div>
            </div>

            {/* STAR Behavioral Framework Alignment */}
            {selectedQuestion.starRubric && (
              <div className="p-3.5 bg-primary/5 border border-primary/25 rounded-[10px] space-y-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Answer outline: fill in your own results</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="font-semibold text-foreground">Situation: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.situation}</span></div>
                  <div><span className="font-semibold text-foreground">Task: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.task}</span></div>
                  <div><span className="font-semibold text-foreground">Action: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.action}</span></div>
                  <div><span className="font-semibold text-foreground">Result: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.result}</span></div>
                </div>
              </div>
            )}

            {onSolveInRunner && selectedQuestion.track === "algorithms" ? (
              <div className="flex items-center justify-start border-t border-hairline pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const slug = selectedQuestion.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                    setSelectedQuestion(null);
                    onSolveInRunner(slug);
                  }}
                  className="flex items-center gap-1.5 rounded-[6px] border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span>Solve in Code Runner</span>
                  <span>&rarr;</span>
                </button>
              </div>
            ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
