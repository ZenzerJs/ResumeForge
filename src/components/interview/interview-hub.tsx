"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
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
import { ChevronDown } from "lucide-react";

export const TRACK_FILTERS: ReadonlyArray<{ id: InterviewTrack | "all"; label: string }> = [
  { id: "all", label: "All Tracks" },
  { id: "algorithms", label: "Algorithms (Core 150 Patterns)" },
  { id: "system_design", label: "System Design" },
  { id: "oa_screening", label: "OA Screening" },
];

export const DIFFICULTY_FILTERS: ReadonlyArray<"all" | "Easy" | "Medium" | "Hard"> = [
  "all",
  "Easy",
  "Medium",
  "Hard",
];

export function filterInterviewQuestions(
  questions: ReadonlyArray<InterviewQuestion>,
  filters: {
    track: InterviewTrack | "all";
    difficulty: "Easy" | "Medium" | "Hard" | "all";
    company: string | "all";
  }
): InterviewQuestion[] {
  return questions.filter((q) => {
    if (filters.track !== "all" && q.track !== filters.track) return false;
    if (filters.difficulty !== "all" && q.difficulty !== filters.difficulty) return false;
    if (filters.company !== "all" && !q.companyTags.includes(filters.company)) return false;
    return true;
  });
}

export function formatQuestionCountText(filteredCount: number, totalCount: number): string {
  return filteredCount === totalCount
    ? `${totalCount} problems`
    : `${filteredCount} of ${totalCount} matching`;
}

export function formatQuestionSourceSet(sourceSet: string): string {
  return sourceSet === "NeetCode 150" ? "Core 150 Patterns" : sourceSet;
}

export interface InterviewHubProps {
  onSolveInRunner?: (slug: string) => void;
  targetCompany?: string;
  onFilteredCountChange?: (filteredCount: number, totalCount: number) => void;
}

export function InterviewHub({
  onSolveInRunner,
  targetCompany,
  onFilteredCountChange,
}: InterviewHubProps = {}) {
  const [track, setTrack] = useState<InterviewTrack | "all">("all");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard" | "all">("all");
  const [company, setCompany] = useState<string | "all">("all");
  const [showAllCompanies, setShowAllCompanies] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const urlHydratedRef = useRef(false);

  const VISIBLE_COMPANY_PILL_CAP = 8;
  const visibleCompanies = showAllCompanies
    ? COMPANY_LOGOS
    : (() => {
        const initial = COMPANY_LOGOS.slice(0, VISIBLE_COMPANY_PILL_CAP);
        if (company !== "all" && !initial.some((c) => c.slug === company)) {
          const active = COMPANY_LOGOS.find((c) => c.slug === company);
          if (active) return [...initial, active];
        }
        return initial;
      })();
  const hiddenCompanyCount = Math.max(0, COMPANY_LOGOS.length - visibleCompanies.length);

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

  const filteredQuestions = useMemo(() => filterInterviewQuestions(ALL_QUESTIONS, {
    track,
    difficulty,
    company,
  }), [track, difficulty, company]);

  const logoMap = useMemo(() => {
    const m = new Map<string, (typeof COMPANY_LOGOS)[number]>();
    for (const c of COMPANY_LOGOS) m.set(c.slug, c);
    return m;
  }, []);

  // Read initial filters from URL before syncing
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("track");
    if (t && TRACK_FILTERS.some(f => f.id === t)) setTrack(t as InterviewTrack | "all");
    const d = params.get("difficulty");
    if (d && DIFFICULTY_FILTERS.includes(d as "all" | "Easy" | "Medium" | "Hard")) {
      setDifficulty(d as "Easy" | "Medium" | "Hard" | "all");
    }
    const c = params.get("company");
    if (c) setCompany(c);
    urlHydratedRef.current = true;
  }, []);

  // Sync filter state to URL
  useEffect(() => {
    if (typeof window === "undefined" || !urlHydratedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (track !== "all") params.set("track", track);
    else params.delete("track");
    if (difficulty !== "all") params.set("difficulty", difficulty);
    else params.delete("difficulty");
    if (company !== "all") params.set("company", company);
    else params.delete("company");
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [track, difficulty, company]);

  useEffect(() => {
    onFilteredCountChange?.(filteredQuestions.length, ALL_QUESTIONS.length);
  }, [filteredQuestions.length, onFilteredCountChange]);

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
          {/* Track Filters - collapsed on <sm */}
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {TRACK_FILTERS.map(t => (
              <button
                key={t.id}
                type="button"
                aria-pressed={track === t.id}
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

          {/* Compact Filters toggle on <sm */}
          <div className="flex sm:hidden items-center justify-between w-full gap-2">
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(v => !v)}
              className="flex min-h-11 items-center gap-1.5 rounded-[6px] border border-hairline bg-inset px-3 text-xs font-semibold text-text-secondary"
            >
              Filters
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              className="rounded-full border border-border bg-inset px-2.5 py-0.5 font-mono text-xs text-muted-foreground tabular-nums"
            >
              {formatQuestionCountText(filteredQuestions.length, ALL_QUESTIONS.length)}
            </span>
          </div>

          {/* Difficulty Filters */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5">
            {DIFFICULTY_FILTERS.map(d => (
              <button
                key={d}
                type="button"
                aria-pressed={difficulty === d}
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
            <span
              data-testid="interview-hub-question-count"
              aria-live="polite"
              className="ml-1 rounded-full border border-border bg-inset px-2.5 py-0.5 font-mono text-xs text-muted-foreground tabular-nums"
            >
              {formatQuestionCountText(filteredQuestions.length, ALL_QUESTIONS.length)}
            </span>
          </div>
        </div>

        {/* Collapsed mobile filter panel */}
        {filtersOpen && (
          <div className="flex flex-col gap-3 sm:hidden border-t border-border pt-3">
            <div className="flex flex-wrap gap-1.5">
              {TRACK_FILTERS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={track === t.id}
                  onClick={() => setTrack(t.id)}
                  className={`min-h-11 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    track === t.id
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border bg-elevated/60 hover:bg-elevated text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DIFFICULTY_FILTERS.map(d => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={`min-h-11 px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
        )}

        {/* Company Filter Pills */}
        <div className={`${filtersOpen ? "block" : "hidden sm:block"} pt-2 border-t border-border`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex-shrink-0">
              Company:
            </span>
            <button
              type="button"
              aria-pressed={company === "all"}
              onClick={() => setCompany("all")}
              className={`min-h-11 sm:min-h-0 px-2.5 py-1 rounded-[6px] text-xs transition-colors flex-shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                company === "all"
                  ? "bg-primary/15 text-primary border-primary/40 font-semibold"
                  : "bg-elevated/60 text-muted-foreground hover:text-foreground border-border hover:bg-elevated"
              }`}
            >
              All Companies
            </button>
            {visibleCompanies.map(c => {
              const isSelected = company === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={isSelected}
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
            {COMPANY_LOGOS.length > VISIBLE_COMPANY_PILL_CAP && (
              <button
                type="button"
                data-testid="toggle-more-companies-btn"
                aria-expanded={showAllCompanies}
                onClick={() => setShowAllCompanies((prev) => !prev)}
                className="min-h-11 sm:min-h-0 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors flex-shrink-0 border border-hairline bg-inset text-text-secondary hover:text-foreground hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {showAllCompanies ? "Show fewer" : `+${hiddenCompanyCount} more`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Questions Grid */}
      <h2 className="text-lg font-bold text-foreground">Practice Problems</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuestions.map(q => (
          <button
            key={q.id}
            type="button"
            aria-pressed={selectedQuestion?.id === q.id}
            className="group flex w-full flex-col justify-between rounded-[10px] surface-raised card-lift p-4 text-left text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [content-visibility:auto] [contain-intrinsic-size:auto_132px]"
            onClick={() => setSelectedQuestion(q)}
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-semibold text-base text-foreground transition-colors line-clamp-1">
                  {q.title}
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getDifficultyBadgeColor(q.difficulty)}`}>
                  {q.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-on-surface-variant">
                  {hasBrandIcon(q.category) && <BrandIcon name={q.category} className="h-3.5 w-3.5 shrink-0" />}
                  {q.category}
                </span>
                <span>•</span>
                <span>{formatQuestionSourceSet(q.sourceSet)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 mt-auto">
              <div className="flex flex-wrap gap-1.5">
                {q.companyTags.slice(0, 3).map(tag => {
                  const comp = logoMap.get(tag);
                  const logo = getCompanyLogo(tag, "w-3 h-3 flex-shrink-0 grayscale");
                  return (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-on-surface-variant"
                    >
                      {logo ?? (hasBrandIcon(tag) ? <BrandIcon name={tag} className="h-3 w-3 shrink-0" /> : null)}
                      <span>{comp?.name || tag}</span>
                    </span>
                  );
                })}
                {q.companyTags.length > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-inset border border-hairline text-xs font-mono text-muted-foreground tabular-nums">
                    +{q.companyTags.length - 3}
                  </span>
                )}
              </div>
              {q.timeComplexity && (
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {q.timeComplexity}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-[10px] bg-card/50">
          <p className="text-base font-semibold text-foreground">No questions found</p>
          <p className="text-sm text-muted-foreground mt-1">Try resetting or loosening the active company or track filters.</p>
          <button
            type="button"
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
                  <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                    {formatQuestionSourceSet(selectedQuestion.sourceSet)}
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
                  const logo = logoMap.get(tag);
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
              <div className="p-3.5 bg-inset border border-border rounded-[10px] text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap font-sans">
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
