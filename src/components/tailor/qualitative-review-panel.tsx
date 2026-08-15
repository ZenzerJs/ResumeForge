"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Wand2,
  Sliders,
  FileSearch,
  MessageSquareCode,
  ArrowRight,
} from "lucide-react";
import {
  AtsQualitativeReviewResult,
  BulletVerdict,
} from "@/lib/ai/qualitative-schema";

interface QualitativeReviewPanelProps {
  result: AtsQualitativeReviewResult;
  deterministicScore: number;
  jobId?: string;
  onUseAsPrompt?: () => void;
}

const VERDICT_STYLES: Record<
  BulletVerdict,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  STRONG_EVIDENCE: {
    label: "Strong Evidence",
    bg: "bg-emerald-950/80",
    text: "text-emerald-300",
    border: "border-emerald-800/80",
    icon: "✓",
  },
  WEAK_EVIDENCE: {
    label: "Weak Evidence",
    bg: "bg-amber-950/80",
    text: "text-amber-300",
    border: "border-amber-800/80",
    icon: "⚠",
  },
  VAGUE_CLAIM: {
    label: "Vague Claim",
    bg: "bg-purple-950/80",
    text: "text-purple-300",
    border: "border-purple-800/80",
    icon: "?",
  },
  KEYWORD_STUFFING: {
    label: "Keyword Stuffing",
    bg: "bg-red-950/80",
    text: "text-red-300",
    border: "border-red-800/80",
    icon: "✗",
  },
};

export function QualitativeReviewPanel({
  result,
  deterministicScore,
  jobId,
  onUseAsPrompt,
}: QualitativeReviewPanelProps) {
  const router = useRouter();
  const [showReasoning, setShowReasoning] = useState(true);

  const handleUseAsPrompt = () => {
    if (onUseAsPrompt) {
      onUseAsPrompt();
    }
    if (typeof window !== "undefined") {
      const activeJobId = jobId || sessionStorage.getItem("resumeforge_active_job_id") || "default";
      const payload = {
        jobId: activeJobId,
        overviewCommentary: result.overviewCommentary,
        categoryFeedbacks: result.categoryFeedbacks,
        bulletFeedbacks: result.bulletFeedbacks,
        nextStepsAdvice: result.nextStepsAdvice,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(`resumeforge_tailor_feedback_${activeJobId}`, JSON.stringify(payload));
      router.push(`/editor?jobId=${activeJobId}`);
    }
  };

  const adjustedScore = Math.min(
    100,
    Math.max(0, deterministicScore + result.jdContextAdjustment)
  );

  const adjustmentFormatted =
    result.jdContextAdjustment >= 0
      ? `+${result.jdContextAdjustment}`
      : `${result.jdContextAdjustment}`;

  const adjustmentBadgeColor =
    result.jdContextAdjustment > 0
      ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/80"
      : result.jdContextAdjustment < 0
      ? "text-red-400 bg-red-950/60 border-red-800/80"
      : "text-slate-300 bg-slate-900 border-slate-700";

  return (
    <div
      className="bg-slate-950 border border-cyan-900/50 rounded-xl p-6 shadow-xl space-y-6"
      data-testid="qualitative-review-panel"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-cyan-900/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-950 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              AI Qualitative Reviewer
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full">
                BYOK Gateway Feedback
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              On-demand qualitative commentary & Bounded JD Context Adjustment (-10 to +10 pts)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUseAsPrompt}
          data-testid="use-as-prompt-btn"
          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition shrink-0"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Use as prompt
        </button>
      </div>

      {/* Bounded JD Context Adjustment Banner */}
      <div
        className="bg-slate-900/90 border border-cyan-900/40 rounded-xl p-4 space-y-3"
        data-testid="jd-adjustment-banner"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sliders className="h-5 w-5 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs text-slate-400 font-medium">
                Deterministic Base Score:{" "}
                <span className="font-mono text-slate-200 font-bold">
                  {deterministicScore} / 100
                </span>
              </div>
              <div className="text-sm font-semibold text-white flex items-center gap-2 mt-0.5">
                JD-Adjusted Score:{" "}
                <span className="font-mono text-cyan-300 font-extrabold text-base">
                  {adjustedScore} / 100
                </span>
                <span
                  data-testid="jd-adjustment-badge"
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${adjustmentBadgeColor}`}
                >
                  ({adjustmentFormatted} pts for JD Emphasis)
                </span>
              </div>
            </div>
          </div>

          {result.adjustmentReasoning.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              data-testid="toggle-reasoning-btn"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 self-start sm:self-center font-medium"
            >
              {showReasoning ? (
                <>
                  Hide Signals <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  View JD Signals ({result.adjustmentReasoning.length}){" "}
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Expandable Reasoning Breakdown */}
        {showReasoning && result.adjustmentReasoning.length > 0 && (
          <div
            className="border-t border-slate-800/80 pt-3 space-y-2"
            data-testid="adjustment-reasoning-list"
          >
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              JD Signal & Adjustment Traceability:
            </div>
            {result.adjustmentReasoning.map((item, idx) => (
              <div
                key={`adj-${idx}`}
                data-testid="reasoning-item"
                className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <FileSearch className="h-3.5 w-3.5 text-cyan-400" />
                    &quot;{item.jdSignal}&quot;
                  </span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      item.points >= 0
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : "bg-red-950 text-red-300 border border-red-800"
                    }`}
                  >
                    {item.points >= 0 ? `+${item.points}` : item.points} pts ({item.targetCategory})
                  </span>
                </div>
                <p className="text-slate-300 text-xs mt-1">{item.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overview Commentary */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquareCode className="h-4 w-4 text-cyan-400" />
          Qualitative Assessment Overview
        </h4>
        <div
          data-testid="overview-commentary"
          className="text-xs text-slate-200 bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 leading-relaxed"
        >
          {result.overviewCommentary}
        </div>
      </div>

      {/* Category Observations */}
      {result.categoryFeedbacks.length > 0 && (
        <div className="space-y-3" data-testid="category-feedbacks-list">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Category Observations & Nuance
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {result.categoryFeedbacks.map((cf, idx) => (
              <div
                key={`cf-${idx}`}
                className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs"
              >
                <span className="font-semibold text-white block border-b border-slate-800 pb-1.5">
                  {cf.categoryName}
                </span>

                {cf.strengths.length > 0 && (
                  <div>
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase block">
                      Strengths
                    </span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 mt-0.5">
                      {cf.strengths.map((s, sIdx) => (
                        <li key={sIdx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {cf.weaknesses.length > 0 && (
                  <div>
                    <span className="text-[10px] text-amber-400 font-semibold uppercase block">
                      Areas to Strengthen
                    </span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 mt-0.5">
                      {cf.weaknesses.map((w, wIdx) => (
                        <li key={wIdx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bullet-by-Bullet Qualitative Verdicts */}
      {result.bulletFeedbacks.length > 0 && (
        <div className="space-y-3" data-testid="bullet-feedbacks-list">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Bullet Evidence Veracity & Rigor ({result.bulletFeedbacks.length} reviewed)
          </h4>
          <div className="space-y-2">
            {result.bulletFeedbacks.map((bf, idx) => {
              const badge = VERDICT_STYLES[bf.verdict] || VERDICT_STYLES.WEAK_EVIDENCE;
              return (
                <div
                  key={`bf-${idx}`}
                  data-testid="bullet-feedback-item"
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-slate-200 bg-slate-950/80 p-2 rounded border border-slate-800 flex-1">
                      &quot;{bf.bulletText}&quot;
                    </p>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-semibold border flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      <span>{badge.icon}</span> {badge.label}
                    </span>
                  </div>
                  <p className="text-slate-300">{bf.reasoning}</p>
                  <p className="text-slate-400 text-[11px] italic flex items-center gap-1 text-cyan-300/80">
                    <Info className="h-3 w-3 text-cyan-400 shrink-0" />
                    Advice: {bf.improvementAdvice}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next Steps Guidance Banner */}
      {result.nextStepsAdvice.length > 0 && (
        <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-indigo-300 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-indigo-400" />
            Recommended Next Tailoring Actions
          </h4>
          <p className="text-xs text-slate-400">
            Use these findings to guide your next edits in the Resume Editor or generate evidence-backed patches.
          </p>
          <ul className="space-y-1 text-xs text-indigo-200 font-mono">
            {result.nextStepsAdvice.map((advice, idx) => (
              <li key={`advice-${idx}`} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-400" />
                <span>{advice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
