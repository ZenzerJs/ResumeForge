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
    bg: "bg-status-success/15",
    text: "text-status-success-soft",
    border: "border-status-success/35",
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
      sessionStorage.setItem("resumeforge_tailor_feedback", JSON.stringify(payload));
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
      ? "status-success-surface"
      : result.jdContextAdjustment < 0
      ? "text-red-400 bg-red-950/60 border-red-800/80"
      : "text-text-secondary bg-inset border-hairline";

  return (
    <div
      className="bg-panel border border-signal/35 rounded-xl p-6 shadow-xl space-y-6"
      data-testid="qualitative-review-panel"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-signal/15 border border-signal/40 flex items-center justify-center text-signal">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              AI Qualitative Reviewer
              <span className="text-xs font-mono bg-signal/15 text-signal border border-signal/35 px-2 py-0.5 rounded-full">
                BYOK Gateway Feedback
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              On-demand qualitative commentary & Bounded JD Context Adjustment (-10 to +10 pts)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUseAsPrompt}
          data-testid="use-as-prompt-btn"
          className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-primary/20 transition shrink-0"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Use as prompt
        </button>
      </div>

      {/* Bounded JD Context Adjustment Banner */}
      <div
        className="bg-inset border border-hairline rounded-xl p-4 space-y-3"
        data-testid="jd-adjustment-banner"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sliders className="h-5 w-5 text-signal shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">
                Deterministic Base Score:{" "}
                <span className="font-mono text-foreground font-semibold tabular-nums">
                  {deterministicScore} / 100
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2 mt-0.5">
                JD-Adjusted Score:{" "}
                <span className="font-mono text-status-info font-semibold tabular-nums text-base">
                  {adjustedScore} / 100
                </span>
                <span
                  data-testid="jd-adjustment-badge"
                  className={`text-xs font-mono font-semibold tabular-nums px-2 py-0.5 rounded border ${adjustmentBadgeColor}`}
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
              className="text-xs text-signal hover:text-signal/80 flex items-center gap-1 self-start sm:self-center font-medium"
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
            className="border-t border-hairline pt-3 space-y-2"
            data-testid="adjustment-reasoning-list"
          >
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              JD Signal & Adjustment Traceability:
            </div>
            {result.adjustmentReasoning.map((item, idx) => (
              <div
                key={`adj-${idx}`}
                data-testid="reasoning-item"
                className="bg-panel border border-hairline rounded-lg p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-signal flex items-center gap-1.5">
                    <FileSearch className="h-3.5 w-3.5 text-signal" />
                    &quot;{item.jdSignal}&quot;
                  </span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      item.points >= 0
                        ? "status-success-surface border"
                        : "bg-red-950 text-red-300 border border-red-800"
                    }`}
                  >
                    {item.points >= 0 ? `+${item.points}` : item.points} pts ({item.targetCategory})
                  </span>
                </div>
                <p className="text-text-secondary text-xs mt-1">{item.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overview Commentary */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-signal uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquareCode className="h-4 w-4 text-signal" />
          Qualitative Assessment Overview
        </h4>
        <div
          data-testid="overview-commentary"
          className="text-xs text-foreground bg-inset border border-hairline rounded-lg p-3.5 leading-relaxed"
        >
          {result.overviewCommentary}
        </div>
      </div>

      {/* Category Observations */}
      {result.categoryFeedbacks.length > 0 && (
        <div className="space-y-3" data-testid="category-feedbacks-list">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Category Observations & Nuance
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {result.categoryFeedbacks.map((cf, idx) => (
              <div
                key={`cf-${idx}`}
                className="bg-inset border border-hairline rounded-lg p-3.5 space-y-2 text-xs"
              >
                <span className="font-semibold text-foreground block border-b border-hairline pb-1.5">
                  {cf.categoryName}
                </span>

                {cf.strengths.length > 0 && (
                  <div>
                    <span className="text-xs text-status-success-soft font-semibold uppercase block">
                      Strengths
                    </span>
                    <ul className="list-disc list-inside text-text-secondary space-y-0.5 mt-0.5">
                      {cf.strengths.map((s, sIdx) => (
                        <li key={sIdx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {cf.weaknesses.length > 0 && (
                  <div>
                    <span className="text-xs text-amber-400 font-semibold uppercase block">
                      Areas to Strengthen
                    </span>
                    <ul className="list-disc list-inside text-text-secondary space-y-0.5 mt-0.5">
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
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Bullet Evidence Veracity & Rigor ({result.bulletFeedbacks.length} reviewed)
          </h4>
          <div className="space-y-2">
            {result.bulletFeedbacks.map((bf, idx) => {
              const badge = VERDICT_STYLES[bf.verdict] || VERDICT_STYLES.WEAK_EVIDENCE;
              return (
                <div
                  key={`bf-${idx}`}
                  data-testid="bullet-feedback-item"
                  className="bg-inset border border-hairline rounded-lg p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-foreground bg-panel p-2 rounded border border-hairline flex-1">
                      &quot;{bf.bulletText}&quot;
                    </p>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded text-xs font-semibold border flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      <span>{badge.icon}</span> {badge.label}
                    </span>
                  </div>
                  <p className="text-text-secondary">{bf.reasoning}</p>
                  <p className="text-xs italic flex items-center gap-1 text-signal">
                    <Info className="h-3 w-3 text-signal shrink-0" />
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
        <div className="bg-signal/10 border border-signal/35 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-signal flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-signal" />
            Recommended Next Tailoring Actions
          </h4>
          <p className="text-xs text-text-secondary">
            Use these findings to guide your next edits in the Resume Editor or generate evidence-backed patches.
          </p>
          <ul className="space-y-1 text-xs text-foreground font-mono">
            {result.nextStepsAdvice.map((advice, idx) => (
              <li key={`advice-${idx}`} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-signal" />
                <span>{advice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
