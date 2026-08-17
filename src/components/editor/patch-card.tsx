"use client";

import React, { useState } from "react";
import { Check, X, ShieldCheck, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PatchCardProps {
  id?: string;
  before: string;
  after: string;
  evidenceIds?: string[];
  rationale?: string;
  operation?: string;
  applied?: boolean;
  isApplying?: boolean;
  onApply?: () => void;
  onReject?: () => void;
  className?: string;
}

export const PatchCard = React.memo(function PatchCard({
  id,
  before,
  after,
  evidenceIds = [],
  rationale,
  operation,
  applied = false,
  isApplying = false,
  onApply,
  onReject,
  className,
}: PatchCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (onReject) onReject();
  };

  return (
    <div
      data-testid={`patch-card-${id || "item"}`}
      className={cn(
        "my-3 overflow-hidden rounded-xl border bg-slate-950/90 shadow-md text-xs transition-all",
        applied
          ? "border-emerald-500/40 bg-emerald-950/10"
          : "border-amber-500/25 hover:border-amber-500/40",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-[11px] text-slate-300">
            {evidenceIds.length > 0 ? (
              <>
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span>
                  Verified Citation:{" "}
                  <code className="text-amber-300 font-mono font-semibold">
                    {evidenceIds.join(", ")}
                  </code>
                </span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400 font-mono text-[11px]">
                  {operation || "PROPOSED_PATCH"}
                </span>
              </>
            )}
          </div>
        </div>

        {applied && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="size-3" /> Applied
          </span>
        )}
      </div>

      {/* Rationale explanation if available */}
      {rationale && (
        <div className="px-3 pt-2.5 text-[11.5px] text-slate-300 italic leading-relaxed">
          {rationale}
        </div>
      )}

      {/* Before / After Diff */}
      <div className="space-y-1.5 p-3 font-mono text-[11.5px] leading-relaxed">
        {before && (
          <div className="rounded border border-red-900/40 bg-red-950/30 px-2.5 py-1.5 text-red-300 line-through">
            <span className="text-red-500 font-bold select-none mr-1.5">-</span>
            {before}
          </div>
        )}
        {after && (
          <div className="rounded border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1.5 text-emerald-300">
            <span className="text-emerald-500 font-bold select-none mr-1.5">+</span>
            {after}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {!applied && (onApply || onReject) && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 bg-slate-900/40 px-3 py-2">
          {onReject && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-red-300 hover:bg-red-950/30 text-xs"
            >
              <X className="mr-1 size-3" /> Dismiss
            </Button>
          )}
          {onApply && (
            <Button
              variant="default"
              size="xs"
              onClick={onApply}
              disabled={isApplying}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-xs text-xs"
            >
              <Check className="mr-1 size-3" />
              {isApplying ? "Applying..." : "Apply Patch"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
