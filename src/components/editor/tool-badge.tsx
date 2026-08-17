"use client";

import React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolBadgeProps {
  name: string;
  state: "running" | "completed" | "error";
  summary?: string;
  durationMs?: number;
  className?: string;
}

export const ToolBadge = React.memo(function ToolBadge({
  name,
  state,
  summary,
  durationMs,
  className,
}: ToolBadgeProps) {
  return (
    <div
      data-testid={`tool-badge-${name}`}
      data-state={state}
      className={cn(
        "my-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-xs backdrop-blur-xs transition-all",
        state === "running" &&
          "border-amber-500/30 bg-amber-950/20 text-amber-300 animate-pulse",
        state === "completed" &&
          "border-emerald-500/30 bg-emerald-950/20 text-emerald-300",
        state === "error" &&
          "border-red-500/30 bg-red-950/20 text-red-300",
        className
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px]">
        {state === "running" && (
          <Loader2 className="size-3 animate-spin text-amber-400" />
        )}
        {state === "completed" && (
          <CheckCircle2 className="size-3 text-emerald-400" />
        )}
        {state === "error" && (
          <AlertCircle className="size-3 text-red-400" />
        )}
        <span className="font-semibold">{name}</span>
      </div>

      {summary && (
        <>
          <span className="text-slate-600 font-mono text-[10px]">•</span>
          <span className="text-slate-200 font-medium text-xs truncate max-w-xs">
            {summary}
          </span>
        </>
      )}

      {typeof durationMs === "number" && (
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {durationMs}ms
        </span>
      )}
    </div>
  );
});
