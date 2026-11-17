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
          "border-status-warning/40 bg-status-warning/15 text-status-warning animate-pulse",
        state === "completed" &&
          "border-status-success/30 bg-status-success/10 text-status-success-soft",
        state === "error" &&
          "border-status-danger/30 bg-status-danger/10 text-status-danger",
        className
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-xs">
        {state === "running" && (
          <Loader2 className="size-3 animate-spin text-status-warning" />
        )}
        {state === "completed" && (
          <CheckCircle2 className="size-3 text-status-success" />
        )}
        {state === "error" && (
          <AlertCircle className="size-3 text-status-danger" />
        )}
        <span className="font-semibold">{name}</span>
      </div>

      {summary && (
        <>
          <span className="text-muted-foreground font-mono text-xs">•</span>
          <span className="text-foreground font-medium text-xs truncate max-w-xs">
            {summary}
          </span>
        </>
      )}

      {typeof durationMs === "number" && (
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {durationMs}ms
        </span>
      )}
    </div>
  );
});
