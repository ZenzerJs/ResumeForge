"use client";

import React, { useState } from "react";
import { ALL_QUESTIONS, COMPANY_LOGOS } from "../../lib/interview/questionDatabase";
import { InterviewQuestion, InterviewTrack } from "../../lib/schema/interviewPrep";
import { CompanyBadge, getCompanyLogo } from "./company-logos";

export interface InterviewHubProps {
  onSolveInRunner?: (slug: string) => void;
}

export function InterviewHub({ onSolveInRunner }: InterviewHubProps = {}) {
  const [track, setTrack] = useState<InterviewTrack | "all">("all");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard" | "all">("all");
  const [company, setCompany] = useState<string | "all">("all");
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null);

  const filteredQuestions = ALL_QUESTIONS.filter(q => {
    if (track !== "all" && q.track !== track) return false;
    if (difficulty !== "all" && q.difficulty !== difficulty) return false;
    if (company !== "all" && !q.companyTags.includes(company)) return false;
    return true;
  });

  const getDifficultyBadgeColor = (diff: string) => {
    switch (diff) {
      case "Easy": return "bg-primary/10 text-primary border-primary/20";
      case "Medium": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "Hard": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Interview Prep Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Curated curriculum covering NeetCode 150, High-Scale System Design, and 70–90m Online Assessments.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
          <span>{filteredQuestions.length} Questions Available</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Track Filters */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All Tracks" },
              { id: "algorithms", label: "Algorithms (NeetCode 150)" },
              { id: "system_design", label: "System Design" },
              { id: "oa_screening", label: "OA Screening" }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTrack(t.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  track === t.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground border border-border/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Difficulty Filters */}
          <div className="flex gap-1.5">
            {["all", "Easy", "Medium", "Hard"].map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  difficulty === d
                    ? "bg-foreground text-background font-semibold"
                    : "bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground border border-border/80"
                }`}
              >
                {d === "all" ? "All Levels" : d}
              </button>
            ))}
          </div>
        </div>

        {/* Company Filter Pills */}
        <div className="pt-2 border-t border-border/60">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 flex-shrink-0">
              Company:
            </span>
            <button
              onClick={() => setCompany("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0 ${
                company === "all"
                  ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
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
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-shrink-0 border ${
                    isSelected
                      ? "bg-primary/20 text-primary border-primary/30 font-semibold shadow-xs"
                      : "bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted/40"
                  }`}
                >
                  {getCompanyLogo(c.slug, "w-3.5 h-3.5 flex-shrink-0")}
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
            className="group border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all bg-card text-card-foreground flex flex-col justify-between"
            onClick={() => setSelectedQuestion(q)}
          >
            <div>
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {q.title}
                </h3>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getDifficultyBadgeColor(q.difficulty)}`}>
                  {q.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="font-medium text-foreground/80">{q.category}</span>
                <span>•</span>
                <span>{q.sourceSet}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 mt-auto">
              <div className="flex flex-wrap gap-1.5">
                {q.companyTags.map(tag => {
                  const comp = COMPANY_LOGOS.find(c => c.slug === tag);
                  return (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60 text-[11px] text-muted-foreground font-medium"
                    >
                      {getCompanyLogo(tag, "w-3 h-3 flex-shrink-0")}
                      <span>{comp?.name || tag}</span>
                    </span>
                  );
                })}
              </div>
              {q.timeComplexity && (
                <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
                  {q.timeComplexity}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/10">
          <p className="text-base font-semibold text-foreground">No questions found</p>
          <p className="text-sm text-muted-foreground mt-1">Try resetting or loosening the active company or track filters.</p>
          <button
            onClick={() => { setTrack("all"); setDifficulty("all"); setCompany("all"); }}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Problem Detail Modal */}
      {selectedQuestion && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-card text-card-foreground p-6 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border space-y-5">
            <div className="flex justify-between items-start gap-4 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getDifficultyBadgeColor(selectedQuestion.difficulty)}`}>
                    {selectedQuestion.difficulty}
                  </span>
                  <span className="text-xs text-muted-foreground">• {selectedQuestion.category}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground">{selectedQuestion.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedQuestion.sourceSet}</p>
              </div>
              <button 
                onClick={() => setSelectedQuestion(null)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            
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
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 border border-border rounded-xl text-xs">
                {selectedQuestion.timeComplexity && (
                  <div>
                    <span className="text-muted-foreground font-medium">Time Complexity:</span>
                    <p className="font-mono text-foreground font-semibold mt-0.5">{selectedQuestion.timeComplexity}</p>
                  </div>
                )}
                {selectedQuestion.spaceComplexity && (
                  <div>
                    <span className="text-muted-foreground font-medium">Space Complexity:</span>
                    <p className="font-mono text-foreground font-semibold mt-0.5">{selectedQuestion.spaceComplexity}</p>
                  </div>
                )}
                {selectedQuestion.constraints && selectedQuestion.constraints.length > 0 && (
                  <div className="col-span-2 pt-2 border-t border-border/50">
                    <span className="text-muted-foreground font-medium">Constraints:</span>
                    <ul className="list-disc list-inside mt-0.5 text-foreground/80 space-y-0.5">
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
              <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedQuestion.rubricGuide}
              </div>
            </div>

            {/* STAR Behavioral Framework Alignment */}
            {selectedQuestion.starRubric && (
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">STAR Behavioral Response Framework</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="font-semibold text-foreground/90">Situation: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.situation}</span></div>
                  <div><span className="font-semibold text-foreground/90">Task: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.task}</span></div>
                  <div><span className="font-semibold text-foreground/90">Action: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.action}</span></div>
                  <div><span className="font-semibold text-foreground/90">Result: </span><span className="text-muted-foreground">{selectedQuestion.starRubric.result}</span></div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              {onSolveInRunner && selectedQuestion.track === "algorithms" ? (
                <button
                  onClick={() => {
                    const slug = selectedQuestion.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                    setSelectedQuestion(null);
                    onSolveInRunner(slug);
                  }}
                  className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 font-semibold text-xs rounded-lg border border-amber-500/30 transition-colors flex items-center gap-1.5"
                >
                  <span>Solve in Code Runner</span>
                  <span>&rarr;</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setSelectedQuestion(null)}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
