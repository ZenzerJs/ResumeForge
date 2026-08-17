"use client";

import React, { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AiJobStage =
  | "queued"
  | "connecting"
  | "extracting"
  | "matching"
  | "writing"
  | "verifying"
  | "done"
  | "error";

export const STAGE_COPY: Record<AiJobStage, string> = {
  queued: "Waiting for the model…",
  connecting: "Connecting to the AI provider…",
  extracting: "Reading the job and evidence bank…",
  matching: "Matching skills and bullets to the JD…",
  writing: "Drafting patches / cover letter…",
  verifying: "Checking claims against evidence…",
  done: "Ready to review",
  error: "Something failed — see details",
};

export const STAGE_ORDER: AiJobStage[] = [
  "queued",
  "connecting",
  "extracting",
  "matching",
  "writing",
  "verifying",
  "done",
];

export interface AiProgressProps {
  /** Current active stage */
  stage: AiJobStage;
  /** Optional custom stage sequence for this specific AI operation */
  stages?: AiJobStage[];
  /** Optional detailed error message if stage === 'error' */
  error?: string | null;
  /** Optional custom status copy override */
  customCopy?: string;
  /** Render compact single-line version (ideal for toolbars or inline cards) */
  compact?: boolean;
  /** Custom container class */
  className?: string;
  /** Callback to dismiss/reset error state */
  onDismissError?: () => void;
  /** Elapsed seconds if controlled externally */
  elapsedSeconds?: number;
}

/**
 * Shared AI Progress Component
 * Replaces bare spinners with accessible, staged feedback across all AI operations.
 */
export function AiProgress({
  stage,
  stages = STAGE_ORDER.filter((s) => s !== "error"),
  error,
  customCopy,
  compact = false,
  className,
  onDismissError,
  elapsedSeconds: controlledElapsed,
}: AiProgressProps) {
  const [internalElapsed, setInternalElapsed] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-increment elapsed timer when running
  useEffect(() => {
    if (stage === "done" || stage === "error") return;
    const interval = setInterval(() => {
      setInternalElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  // Reset internal elapsed timer when restarting from queued/connecting
  useEffect(() => {
    if (stage === "queued" || stage === "connecting") {
      setInternalElapsed(0);
    }
  }, [stage]);

  const elapsed = controlledElapsed ?? internalElapsed;
  const isError = stage === "error" || Boolean(error);
  const isDone = stage === "done" && !isError;
  const currentStageIndex = stages.indexOf(stage);

  const message = customCopy || (isError && error ? error : STAGE_COPY[stage]) || "Processing…";

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="ai-progress-compact"
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
          isDone && "bg-emerald-950/70 border-emerald-800/80 text-emerald-300",
          isError && "bg-red-950/70 border-red-800/80 text-red-300",
          !isDone && !isError && "bg-amber-950/60 border-amber-800/70 text-amber-200",
          className
        )}
      >
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        ) : isError ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400 shrink-0" />
        )}
        <span className="truncate">{message}</span>
        {!isDone && !isError && elapsed > 0 && (
          <span className="font-mono text-[10px] text-amber-400/80 shrink-0">
            {elapsed}s
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ai-progress-container"
      className={cn(
        "rounded-lg border p-3.5 shadow-sm transition-all",
        isDone && "bg-emerald-950/40 border-emerald-800/60 text-emerald-100",
        isError && "bg-red-950/50 border-red-800/80 text-red-200",
        !isDone && !isError && "bg-slate-900/90 border-slate-800 text-slate-200",
        className
      )}
    >
      {/* Header Row: Stage Icon + Message + Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isDone ? (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          ) : isError ? (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}

          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-tight text-white truncate">
              {message}
            </p>
            {!isError && !isDone && (
              <p className="text-[11px] text-slate-400 capitalize">
                Stage {currentStageIndex >= 0 ? currentStageIndex + 1 : 1} of {stages.length}: {stage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isDone && !isError && (
            <span className="flex items-center gap-1 font-mono text-xs text-amber-300/90 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
              <Clock className="h-3 w-3" />
              {elapsed}s
            </span>
          )}

          {isError && onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-[11px] font-medium text-red-100 transition"
            >
              Dismiss
            </button>
          )}

          {isError && error && (
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="text-slate-400 hover:text-white transition p-1"
              aria-label="Toggle error details"
            >
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stage Progress Stepper */}
      {!isError && stages.length > 1 && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/70">
          <div className="flex items-center justify-between gap-1">
            {stages.map((stg, idx) => {
              const isPast = currentStageIndex > idx || isDone;
              const isCurrent = currentStageIndex === idx && !isDone;

              return (
                <div
                  key={stg}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                  title={`${idx + 1}. ${STAGE_COPY[stg] || stg}`}
                >
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full transition-all duration-300",
                      isPast && "bg-emerald-500",
                      isCurrent && "bg-amber-400 animate-pulse",
                      !isPast && !isCurrent && "bg-slate-800"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-mono capitalize transition-colors hidden sm:block truncate max-w-full text-center",
                      isPast && "text-emerald-400 font-medium",
                      isCurrent && "text-amber-300 font-bold",
                      !isPast && !isCurrent && "text-slate-600"
                    )}
                  >
                    {stg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Details Accordion */}
      {isError && error && showDetails && (
        <div className="mt-2.5 pt-2 border-t border-red-800/50">
          <pre className="text-[11px] font-mono text-red-300/90 whitespace-pre-wrap break-all bg-red-950/80 p-2 rounded border border-red-800/60 max-h-32 overflow-y-auto">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to manage staged progression for async tasks.
 */
export function useAiProgress(
  stageSequence: AiJobStage[] = ["queued", "connecting", "extracting", "matching", "writing", "verifying", "done"]
) {
  const [stage, setStage] = useState<AiJobStage>("done");
  const [error, setError] = useState<string | null>(null);

  const startProgress = () => {
    setError(null);
    setStage(stageSequence[0] || "queued");
  };

  const advanceStage = (nextStage: AiJobStage) => {
    setStage(nextStage);
  };

  const completeProgress = () => {
    setStage("done");
  };

  const failProgress = (errorMessage: string) => {
    setError(errorMessage);
    setStage("error");
  };

  const resetProgress = () => {
    setStage("done");
    setError(null);
  };

  return {
    stage,
    error,
    setStage,
    startProgress,
    advanceStage,
    completeProgress,
    failProgress,
    resetProgress,
  };
}
